/** Local voice activity detection. Audio is sent only after a spoken turn, never during BLUE playback. */
const PROCESSOR = `
class BlueMicProcessor extends AudioWorkletProcessor {
  constructor(){super();this.buffer=new Float32Array(2048);this.used=0;}
  process(inputs){
    const input=inputs[0]?.[0];
    if(input)for(let i=0;i<input.length;i++){
      this.buffer[this.used++]=input[i];
      if(this.used===this.buffer.length){this.port.postMessage(this.buffer,[this.buffer.buffer]);this.buffer=new Float32Array(2048);this.used=0;}
    }
    return true;
  }
}
registerProcessor('blue-microphone',BlueMicProcessor);`;

export function waveBlob(chunks: Float32Array[], inputRate: number): Blob {
  const count=chunks.reduce((sum, chunk)=>sum+chunk.length,0);
  const input=new Float32Array(count);let offset=0;
  for(const chunk of chunks){input.set(chunk,offset);offset+=chunk.length;}
  const rate=16000;const length=Math.floor(count*rate/inputRate);
  const buffer=new ArrayBuffer(44+length*2);const view=new DataView(buffer);
  const write=(start:number,text:string)=>{for(let i=0;i<text.length;i++)view.setUint8(start+i,text.charCodeAt(i));};
  write(0,'RIFF');view.setUint32(4,36+length*2,true);write(8,'WAVE');write(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  write(36,'data');view.setUint32(40,length*2,true);
  for(let i=0;i<length;i++){
    const start=Math.floor(i*inputRate/rate),end=Math.max(start+1,Math.floor((i+1)*inputRate/rate));
    let sum=0;for(let j=start;j<end;j++)sum+=input[j]||0;
    const sample=Math.max(-1,Math.min(1,sum/(end-start)));
    view.setInt16(44+i*2,sample<0?sample*32768:sample*32767,true);
  }
  return new Blob([buffer],{type:'audio/wav'});
}

export class HandsFreeCapture {
  private stream: MediaStream | null=null;
  private context: AudioContext | null=null;
  private node: AudioWorkletNode | null=null;
  private stopped=false;
  private enabled=true;
  private chunks: Float32Array[]=[];
  private preRoll: Float32Array[]=[];
  private speaking=false;
  private silence=0;
  private voiced=0;
  private samples=0;
  private rate=48000;
  private onAudio: (audio:Blob)=>void;
  private onLevel: (level:number)=>void;
  constructor(onAudio:(audio:Blob)=>void,onLevel:(level:number)=>void){this.onAudio=onAudio;this.onLevel=onLevel;}
  async start(): Promise<void> {
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      if(this.stopped){stream.getTracks().forEach(track=>track.stop());return;}
      this.stream=stream;
      const context=new AudioContext();this.context=context;this.rate=context.sampleRate;
      if(context.state==='suspended'&&!navigator.userActivation?.hasBeenActive)throw new Error('Click the blue dot once to allow microphone audio.');
      const url=URL.createObjectURL(new Blob([PROCESSOR],{type:'text/javascript'}));
      try{await context.audioWorklet.addModule(url);}finally{URL.revokeObjectURL(url);}
      if(this.stopped)return;
      const node=new AudioWorkletNode(context,'blue-microphone');this.node=node;
      const mute=context.createGain();mute.gain.value=0;
      context.createMediaStreamSource(stream).connect(node);node.connect(mute);mute.connect(context.destination);
      node.port.onmessage=event=>this.process(event.data as Float32Array);
      await context.resume();
    } catch(error){await this.stop();throw error;}
  }
  setEnabled(enabled:boolean){this.enabled=enabled;this.clear();this.onLevel(0);}
  private clear(){this.chunks=[];this.preRoll=[];this.speaking=false;this.silence=0;this.voiced=0;this.samples=0;}
  private process(chunk:Float32Array){
    if(this.stopped||!this.enabled)return;
    const rms=Math.sqrt(chunk.reduce((sum,value)=>sum+value*value,0)/chunk.length);
    this.onLevel(Math.min(1,rms*5));
    const voice=rms>.012;
    if(!this.speaking){
      this.preRoll.push(chunk);
      while(this.preRoll.length>Math.ceil(this.rate*.25/chunk.length))this.preRoll.shift();
      if(!voice)return;
      this.speaking=true;this.chunks=this.preRoll;this.preRoll=[];
    } else this.chunks.push(chunk);
    this.samples+=chunk.length;
    if(voice){this.silence=0;this.voiced+=chunk.length;}else this.silence+=chunk.length;
    if(this.silence>this.rate*.85||this.samples>this.rate*20){
      if(this.voiced<this.rate*.15){this.clear();return;}
      const audio=waveBlob(this.chunks,this.rate);this.enabled=false;this.clear();this.onLevel(0);this.onAudio(audio);
    }
  }
  async stop(){
    this.stopped=true;this.enabled=false;this.clear();
    if(this.node){this.node.port.onmessage=null;this.node.disconnect();this.node=null;}
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
    const context=this.context;this.context=null;
    await context?.close().catch(()=>{});
  }
}
