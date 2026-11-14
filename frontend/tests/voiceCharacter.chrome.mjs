/** Real Fish Audio session in a disposable desktop Chrome profile, with a silent test microphone. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const profile=mkdtempSync(join(tmpdir(),'blue-character-chrome-'));
const wav=Buffer.alloc(44+16000*2*30);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
const audioFile=join(profile,'silence.wav');writeFileSync(audioFile,wav);
const chrome=spawn(process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
 `--user-data-dir=${profile}`,'--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--autoplay-policy=no-user-gesture-required',
 '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${audioFile}`,'--window-size=1440,1000','about:blank',
],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws;
try{
 let port;for(let i=0;i<100;i++){try{port=Number(readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);break;}catch{await pause(100);}}
 assert.ok(port);const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);let id=0;
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 const errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>reject(new Error(method+' timed out')),20000);const f=e=>{const m=JSON.parse(e.data);if(m.id!==n)return;ws.removeEventListener('message',f);clearTimeout(timer);m.error?reject(new Error(m.error.message)):resolve(m.result);};ws.addEventListener('message',f);ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description);return r.result.value;};
 const until=async expression=>{for(let i=0;i<200;i++){if(await evaluate(expression))return;await pause(100);}console.log(await evaluate(`document.querySelector('dialog')?.innerText`));throw new Error('Timed out: '+expression);};
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const type=async text=>{await evaluate(`(()=>{const input=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,${JSON.stringify(text)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await until(`!document.querySelector('[aria-label="Send message"]').disabled`);await click('[aria-label="Send message"]');};
 await send('Page.enable');await send('Runtime.enable');
 await send('Browser.grantPermissions',{origin:'http://127.0.0.1:3000',permissions:['audioCapture']});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.SpeechRecognition=class {onend=null;onerror=null;onresult=null;start(){}abort(){queueMicrotask(()=>this.onend?.());}stop(){this.abort();}};window.capturedStreams=[];const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async options=>{const stream=await original(options);window.capturedStreams.push(stream);return stream;};window.voiceSessions=0;const fetchOriginal=window.fetch.bind(window);window.fetch=(url,init)=>{if(String(url).endsWith('/api/voice-session'))window.voiceSessions++;return fetchOriginal(url,init);};`});
 console.log('Opening dashboard');
 await send('Page.navigate',{url:'http://127.0.0.1:3000/dashboard?id=astro-vance'});
 await until(`!!document.querySelector('[aria-label="Talk to Blue"]')`);console.log('Opening live voice');await click('[aria-label="Talk to Blue"]');
 await until(`document.querySelector('[role="log"]').textContent.includes('Hi, how are you doing today?')`);
 await until(`document.querySelector('dialog [role="status"]').textContent.includes('listening')`);
 assert.equal(await evaluate(`window.capturedStreams.some(s=>s.getAudioTracks().some(t=>t.readyState==='live'&&t.enabled))`),true);
 assert.equal(await evaluate(`document.querySelector('[aria-label="Mute microphone"]').getAttribute('aria-pressed')`),'false');
 console.log('PASS: real Fish voice session connected; greeting arrived; microphone remains live without another click');
 await type('How are you doing today?');
 await until(`Array.from(document.querySelectorAll('[role="log"] p')).filter(p=>p.textContent.startsWith('BLUE')).length>=2 && document.querySelector('dialog [role="status"]').textContent.includes('listening')`);
 const answer=await evaluate(`Array.from(document.querySelectorAll('[role="log"] p')).filter(p=>p.textContent.startsWith('BLUE')).at(-1).textContent`);
 assert.match(answer,/thanks|thank you|ready|here|doing|well|good/i);
 assert.doesNotMatch(answer,/I appreciate you sharing|Understood — thank you for walking/);
 console.log('Actual answer:',answer);
 assert.equal(await evaluate(`window.capturedStreams.some(s=>s.getAudioTracks().some(t=>t.readyState==='live'&&t.enabled))`),true);
 const sessionCount=await evaluate('window.voiceSessions');
 await click('[aria-label="Mute microphone"]');await until(`!!document.querySelector('[aria-label="Unmute microphone"]')`);
 await click('[aria-label="Unmute microphone"]');await until(`!!document.querySelector('[aria-label="Mute microphone"]')`);
 assert.equal(await evaluate('window.voiceSessions'),sessionCount);
 console.log('PASS: mute/unmute works in the same conversation; microphone stays available after reply');
 await type('I am not ready for the survey. Can we just talk first?');
 await until(`Array.from(document.querySelectorAll('[role="log"] p')).filter(p=>p.textContent.startsWith('BLUE')).length>=3 && document.querySelector('dialog [role="status"]').textContent.includes('listening')`);
 const consent=await evaluate(`Array.from(document.querySelectorAll('[role="log"] p')).filter(p=>p.textContent.startsWith('BLUE')).at(-1).textContent`);
 assert.match(consent,/of course|absolutely|sure|pace|talk|chat|no (?:rush|pressure|problem)/i);console.log('Consent answer:',consent);
 await click('[aria-label="Mute microphone"]');await click('[aria-label="Mute Blue’s voice"]');
 for(const [width,height] of [[1440,900],[768,1024],[390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(400);
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
  const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`/tmp/blue-octopus-${width}.png`,Buffer.from(shot.data,'base64'));
 }
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 assert.equal(await evaluate(`document.querySelector('svg[data-mood]').getAnimations({subtree:true}).filter(a=>a.playState==='running').length`),0);
 await click('[aria-label="Close Blue"]');await until(`!document.querySelector('dialog').open`);
 await until(`window.capturedStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))`);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: responsive views, reduced motion, and microphone cleanup on close');
}finally{ws?.close();chrome.kill('SIGTERM');await pause(700);rmSync(profile,{recursive:true,force:true});}
