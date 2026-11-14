/** Desktop Chrome integration test. Recognition events are controlled to test handoff races reproducibly.
 * Requires the app on localhost:3000 and backend on localhost:8000. No personal Chrome profile is used.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const profile=mkdtempSync(join(tmpdir(),'blue-wake-chrome-'));
const chrome=spawn(process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
  `--user-data-dir=${profile}`,'--remote-debugging-port=0','--no-first-run','--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required','--window-size=1440,1000','about:blank',
],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let ws;
try {
  let port;
  for(let i=0;i<100;i++){try{port=Number(readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);break;}catch{await pause(100);}}
  assert.ok(port,'Scratch Chrome started');
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);let id=0;
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const n=++id;const timer=setTimeout(()=>reject(new Error(method+' timed out')),15000);
    const f=e=>{const m=JSON.parse(e.data);if(m.id!==n)return;ws.removeEventListener('message',f);clearTimeout(timer);m.error?reject(new Error(m.error.message)):resolve(m.result);};
    ws.addEventListener('message',f);ws.send(JSON.stringify({id:n,method,params}));
  });
  const evaluate=async expression=>{
    const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(response.exceptionDetails)throw new Error(response.exceptionDetails.text+': '+response.exceptionDetails.exception?.description);
    return response.result.value;
  };
  const until=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await pause(100);}throw new Error('Timed out: '+expression);};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.instances=[];window.events=[];window.maxOwners=0;window.owners=0;window.chatRequests=[];
    if (!location.hash.includes("native-denied")) {
    window.mockPermission=location.hash.includes('denied')?'denied':'granted';
    const originalQuery=navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query=descriptor=>descriptor.name==='microphone'?Promise.resolve({state:window.mockPermission,addEventListener(){},removeEventListener(){}}):originalQuery(descriptor);
    navigator.mediaDevices.getUserMedia=async()=>new MediaStream();
    class ControlledRecognition {
      onresult=null;onerror=null;onend=null;continuous=false;
      constructor(){this.id=window.instances.length;window.instances.push(this);}
      start(){this.active=true;window.owners++;window.maxOwners=Math.max(window.maxOwners,window.owners);window.events.push({type:'start',id:this.id,wake:this.continuous});}
      abort(){if(this.ending)return;this.ending=true;window.events.push({type:'abort',id:this.id});setTimeout(()=>this.end(),200);}
      stop(){this.abort();}
      result(text,final=false){this.onresult?.({resultIndex:0,results:[{isFinal:final,length:1,0:{transcript:text}}]});}
      end(){if(!this.active)return;this.active=false;window.owners--;window.events.push({type:'end',id:this.id});this.onend?.();}
    }
    window.SpeechRecognition=ControlledRecognition;
    window.flights=[];const originalAnimate=Element.prototype.animate;
    Element.prototype.animate=function(frames,options){if(this.matches('[aria-label="Talk to Blue"]'))window.flights.push(frames);return originalAnimate.call(this,frames,options);};
    }
    const originalFetch=window.fetch.bind(window);
    window.fetch=(url,init)=>{if(String(url).endsWith('/api/chat'))window.chatRequests.push(JSON.parse(init.body));return originalFetch(url,init);};
  `});
  const navigate=async(hash='')=>{
    await send('Page.navigate',{url:'http://127.0.0.1:3000/dashboard?id=astro-vance'+hash});
    await until(`!!document.querySelector('[aria-label="Talk to Blue"]')`);
  };
  await navigate();await until('window.instances.some(r=>r.active&&r.continuous)');
  assert.equal(await evaluate(`document.querySelector('[aria-label="Talk to Blue"]').textContent.trim()`),'');
  assert.equal(await evaluate(`document.querySelector('[aria-label="Talk to Blue"]').getAttribute('title')`),null);
  assert.equal(await evaluate(`document.querySelectorAll('dialog').length`),1);
  await evaluate(`window.instances.at(-1).result('We should review the blueprints.');window.instances.at(-1).result('Hey blueberry.')`);
  await pause(300);assert.equal(await evaluate(`document.querySelector('dialog').open`),false);
  console.log('PASS: idle dot has no visible label; ordinary speech and partial words leave the bot closed');
  await evaluate(`window.instances.at(-1).result('Hey Blue');window.instances.at(-1).result('Hey Blue',true)`);
  await until(`!!document.querySelector('dialog').open && window.instances.some(r=>r.active&&!r.continuous)`);
  assert.equal(await evaluate('window.instances.length'),2);
  assert.equal(await evaluate('window.flights.length'),1);
  assert.match(await evaluate('window.flights[0][1].transform'),/translate/);
  assert.equal(await evaluate('window.maxOwners'),1);
  assert.equal(await evaluate('window.chatRequests.length'),0);
  assert.equal(await evaluate(`document.querySelector('textarea').value`),'');
  assert.equal(await evaluate(`window.events.findIndex(e=>e.type==='end'&&e.id===0)<window.events.findIndex(e=>e.type==='start'&&e.id===1)`),true);
  console.log('PASS: Hey Blue opens existing dialog once; confirmed release precedes dictation; wake transcript discarded');
  await evaluate(`const rec=window.instances.at(-1);rec.result('My energy is good and I feel rested today.',true);rec.end()`);
  await until(`window.chatRequests.length===1 && document.querySelector('dialog').textContent.includes('BLUE is speaking')`);
  assert.equal(await evaluate('window.instances.length'),2);
  assert.equal(await evaluate(`window.chatRequests[0].messages.at(-1).content`),'My energy is good and I feel rested today.');
  assert.ok(!(await evaluate('JSON.stringify(window.chatRequests)')).includes('Hey Blue'));
  console.log('PASS: next spoken message reaches the existing backend; wake stays paused during reply playback');
  const before=await evaluate(`document.querySelector('[role="log"]').textContent`);
  await click('[aria-label="Close Blue"]');await until('window.instances.at(-1).active&&window.instances.at(-1).continuous');
  await evaluate(`window.instances.at(-1).result('Hey Bleu')`);
  await until(`document.querySelector('dialog').open&&window.instances.at(-1).active&&!window.instances.at(-1).continuous`);
  assert.equal(await evaluate(`document.querySelector('[role="log"]').textContent`),before);
  assert.equal(await evaluate('window.maxOwners'),1);
  console.log('PASS: Hey Bleu works after close; same session history is preserved');
  await click('[aria-label="Close Blue"]');await until('window.instances.at(-1).active&&window.instances.at(-1).continuous');
  await evaluate(`window.testHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.testHidden});document.dispatchEvent(new Event('visibilitychange'))`);
  await until('window.owners===0');const hiddenCount=await evaluate('window.instances.length');await pause(800);assert.equal(await evaluate('window.instances.length'),hiddenCount);
  await evaluate(`window.testHidden=false;document.dispatchEvent(new Event('visibilitychange'))`);
  await until('window.instances.length>'+hiddenCount);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Switch Astronaut')).click()`);
  await until(`!document.querySelector('[aria-label="Talk to Blue"]')&&window.owners===0`);
  console.log('PASS: hidden tab pauses; visible tab resumes; SPA navigation releases the recognizer');
  await navigate('#denied');await pause(500);assert.equal(await evaluate('window.instances.length'),0);
  await evaluate(`document.querySelector('[aria-label="Talk to Blue"]').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await until(`document.querySelector('dialog').open`);
  assert.match(await evaluate(`document.querySelector('dialog').textContent`),/Microphone access is denied/);
  assert.equal(await evaluate('window.instances.length'),0);
  await click('[aria-label="Mute Blue’s voice"]');
  await send('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false});await pause(300);
  let shot;
  for (const [width,height] of [[1440,900],[768,1024],[390,844]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(300);
    assert.equal(await evaluate(`document.documentElement.scrollWidth > innerWidth`),false);
    assert.equal(await evaluate(`(()=>{const b=document.querySelector('dialog').getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight})()`),true);
    shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync('/tmp/blue-wake-open-'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await send('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false});
  await click('[aria-label="Close Blue"]');
  await until(`document.activeElement.getAttribute('aria-label')==='Talk to Blue'`);
  await evaluate(`document.activeElement.blur()`);
  shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync('/tmp/blue-wake-idle.png',Buffer.from(shot.data,'base64'));
  console.log('PASS: permission-denied keyboard/click fallback opens existing bot with useful error; idle remains unlabeled');
  await send('Browser.setPermission',{permission:{name:'microphone'},setting:'denied',origin:'http://127.0.0.1:3000'});
  await navigate('#native-denied');
  assert.equal(await evaluate(`(async()=>{return (await navigator.permissions.query({name:'microphone'})).state})()`),'denied');
  await click('[aria-label="Talk to Blue"]');
  await until(`document.querySelector('dialog').open && document.querySelector('dialog').textContent.includes('Microphone access is denied')`);
  console.log('PASS: native Chrome microphone denial preserves the clickable dot and text-chat fallback');
  console.log(await evaluate('navigator.userAgent'));
} finally {
  ws?.close();chrome.kill('SIGTERM');await pause(700);rmSync(profile,{recursive:true,force:true});
}
