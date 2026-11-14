import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BrowserSpeech, WakeListener, isWakePhrase} from '../src/lib/browserSpeech.ts';

const flush = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
function harness(autoEnd=false) {
  const instances=[];
  class Recognizer {
    lang=''; continuous=false; interimResults=false; onresult=null; onerror=null; onend=null;
    constructor(){instances.push(this);}
    start(){this.started=true;}
    stop(){this.abort();}
    abort(){this.aborted=true; if(autoEnd) queueMicrotask(()=>this.onend?.());}
    result(text, final=false){this.onresult?.({resultIndex:0,results:[{isFinal:final,length:1,0:{transcript:text}}]});}
    end(){this.onend?.();}
  }
  return {speech:new BrowserSpeech(()=>Recognizer,25),instances};
}
const callbacks=()=>({result(){},error(){},end(){}});

test('matches both whole wake phrases, including punctuation, never partial words',()=>{
  for(const phrase of ['Hey Bleu','HEY BLUE!','Please, hey Blue.','hey, bleu']) assert.ok(isWakePhrase(phrase),phrase);
  for(const phrase of ['hello Blue','blue','hey','hey blueberry','they blue','hey blues','hey bleuish','the crew feels good']) assert.ok(!isWakePhrase(phrase),phrase);
});

test('handoff waits for onend, not abort() returning',async()=>{
  const {speech,instances}=harness();const client=Symbol();
  await speech.start(client,true,callbacks(),()=>true);
  let started=false;
  const next=speech.start(client,false,callbacks(),()=>true).then(rec=>{started=!!rec;});
  await flush(); assert.equal(instances[0].aborted,true);assert.equal(started,false);assert.equal(instances.length,1);
  instances[0].end();await next;assert.equal(started,true);assert.equal(instances.length,2);
  const released=speech.release();instances[1].end();await released;
});

test('missing end confirmation blocks the next recognizer',async()=>{
  const {speech,instances}=harness();const client=Symbol();let error='';
  await speech.start(client,true,callbacks(),()=>true);
  const next=await speech.start(client,false,{...callbacks(),error:e=>error=e},()=>true);
  assert.equal(next,null);assert.equal(instances.length,1);assert.equal(error,'release-timeout');instances[0].end();
});

test('ordinary speech is ignored, duplicate wake transcripts trigger once, close resumes',async()=>{
  const {speech,instances}=harness(true);let activations=0;let visible=true;
  const wake=new WakeListener(speech,Symbol(),()=>visible,()=>{activations++;void wake.pause();},()=>{});
  wake.resume();await flush();instances[0].result('The crew is doing well.');assert.equal(activations,0);
  instances[0].result('Hey Bleu');instances[0].result('Hey Bleu',true);await flush();assert.equal(activations,1);
  wake.resume();await flush();instances[1].result('Hey Blue');await flush();assert.equal(activations,2);
  visible=false;await wake.pause();wake.resume();await flush();assert.equal(instances.length,2);wake.dispose();
});

test('denial and unsupported service stop retries but surface a useful message',async()=>{
  for(const code of ['not-allowed','service-not-allowed','audio-capture']){
    const {speech,instances}=harness(true);let notice='';
    const wake=new WakeListener(speech,Symbol(),()=>true,()=>{},text=>notice=text);
    wake.resume();await flush();instances[0].onerror({error:code});await flush();wake.resume();await flush();
    assert.equal(instances.length,1);assert.match(notice,/microphone access/i);wake.dispose();
  }
  let notice='';const wake=new WakeListener(new BrowserSpeech(()=>undefined),Symbol(),()=>true,()=>{},text=>notice=text);
  wake.resume();await flush();assert.match(notice,/isn’t supported/);wake.dispose();
});

test('repeated network failures exhaust a bounded retry budget',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {speech,instances}=harness();let notice='';
  const wake=new WakeListener(speech,Symbol(),()=>true,()=>{},text=>notice=text);
  wake.resume();await flush();
  for(let i=0;i<3;i++){
    instances[i].onerror({error:'network'});instances[i].end();await flush();t.mock.timers.tick(2000);await flush();
  }
  wake.resume();await flush();assert.equal(instances.length,3);assert.match(notice,/repeated speech-service failures/);wake.dispose();
});

test('disposal invalidates pending starts and discards late transcripts',async()=>{
  const {speech,instances}=harness();const client=Symbol();let events=0;
  const wake=new WakeListener(speech,client,()=>true,()=>events++,()=>{});
  wake.resume();await flush();wake.dispose();instances[0].result('Hey Bleu');instances[0].end();await flush();
  assert.equal(events,0);wake.resume();assert.equal(instances.length,1);
});
