/* Local audio amplitude driver. No upload, speech recognition or network request. */
(function(global){
 class MintLipSyncInput{
  constructor(rig,ui){this.rig=rig;this.ui=ui;this.mode='off';this.gain=3;this.epoch=0;this.url=null;this.stream=null;this.context=null;this.analyser=null;this.fileNode=null;this.micNode=null;this.start=performance.now();this.raf=requestAnimationFrame(t=>this.tick(t));
   ui.demo.onclick=()=>{if(this.mode==='demo')this.stop();else{this.stop();this.mode='demo';this.start=performance.now();ui.status.textContent='샘플 발화 패턴 · 실제 음성 아님';ui.demo.setAttribute('aria-pressed','true');rig.resume();}};
   ui.stop.onclick=()=>this.stop();ui.gain.oninput=()=>{this.gain=Number(ui.gain.value)};
   ui.file.onchange=()=>{const f=ui.file.files[0];if(!f)return;this.stop();if(this.url)URL.revokeObjectURL(this.url);this.url=URL.createObjectURL(f);ui.audio.src=this.url;ui.audio.hidden=false;ui.status.textContent=f.name+' · 재생하면 입이 움직입니다';};
   ui.audio.onplay=async()=>{const token=++this.epoch;try{await this.prepare();if(token!==this.epoch)return;this.releaseMic();if(!this.fileNode){this.fileNode=this.context.createMediaElementSource(ui.audio);this.fileNode.connect(this.analyser);this.fileNode.connect(this.context.destination);}this.mode='audio';ui.status.textContent='오디오 음량에 맞춰 립싱크';rig.resume();}catch(e){this.stop();ui.status.textContent='오디오를 열 수 없습니다: '+e.message;}};
   ui.audio.onpause=()=>{if(this.mode==='audio'){this.mode='off';rig.stopLipSync();ui.status.textContent='오디오 일시정지';}};ui.audio.onended=()=>this.stop();
   ui.audio.onerror=()=>{this.stop();ui.status.textContent='지원하지 않는 오디오 형식입니다.'};
   ui.mic.onclick=async()=>{if(this.mode==='mic'){this.stop();return;}this.stop();const token=++this.epoch;try{await this.prepare();const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(token!==this.epoch){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;this.micNode=this.context.createMediaStreamSource(stream);this.micNode.connect(this.analyser);this.mode='mic';ui.mic.setAttribute('aria-pressed','true');ui.status.textContent='마이크 음량에 맞춰 립싱크 · 기기 안에서 처리';rig.resume();}catch(e){if(token===this.epoch){this.stop();ui.status.textContent='마이크를 사용할 수 없습니다. 오디오 파일이나 데모를 이용하세요.';}}};
  }
  async prepare(){if(!this.context){this.context=new AudioContext();this.analyser=this.context.createAnalyser();this.analyser.fftSize=1024;this.buffer=new Float32Array(1024);}await this.context.resume();}
  releaseMic(){this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.micNode?.disconnect();this.micNode=null;}
  stop(){this.epoch++;this.mode='off';this.ui.audio.pause();this.releaseMic();this.rig.stopLipSync();this.ui.demo.setAttribute('aria-pressed','false');this.ui.mic.setAttribute('aria-pressed','false');this.ui.status.textContent='립싱크 꺼짐';}
  tick(t){if(this.mode==='demo'){const sec=(t-this.start)/1000,phrase=sec%4,env=phrase<3?Math.max(0,Math.sin(phrase*Math.PI*4.3))**.7:0;this.rig.setLipSync(env,['A','I','U','E','O'][Math.floor(sec*1.8)%5]);}
   else if((this.mode==='audio'||this.mode==='mic')&&this.analyser){this.analyser.getFloatTimeDomainData(this.buffer);const rms=Math.sqrt(this.buffer.reduce((s,v)=>s+v*v,0)/this.buffer.length);this.rig.setLipSync(Math.min(1,Math.max(0,rms-.008)*this.gain*3));}
   this.ui.level.value=this.rig.speech.value;this.raf=requestAnimationFrame(x=>this.tick(x));}
  destroy(){this.stop();cancelAnimationFrame(this.raf);if(this.url)URL.revokeObjectURL(this.url);this.fileNode?.disconnect();this.context?.close();}
 }
 global.MintLipSyncInput=MintLipSyncInput;
})(window);
