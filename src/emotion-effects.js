/* Persistent vector overlays. Intensities belong to the emotion channel;
 * absolute animation time is shared so interrupted fades never restart. */
(function(global){
 const NS='http://www.w3.org/2000/svg',fmt=x=>String(Math.round(x*10000)/10000);
 const create=(tag,attrs)=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e};
 class MintEmotionEffects{
  constructor(r){
   this.r=r;this.root=r._new('g','emotion-symbols',{'pointer-events':'none'});r.meshDebugLayer.before(this.root);
   this.anger=r._new('g','anger-mark',{'data-overlay':'anger',opacity:0,fill:'none',stroke:'#df676d','stroke-width':7,'stroke-linecap':'round'});
   this.anger.append(create('path',{d:'M-25 -9 C-15 -4 -8 -8 -9 -23 M4 -25 C1 -12 7 -5 23 -7 M25 6 C12 2 5 9 7 24 M-6 25 C-2 12 -8 4 -23 7'}));this.root.append(this.anger);
   this.sleep=r._new('g','sleep-symbols',{'data-overlay':'sleep',opacity:0,fill:'none',stroke:'#728d9f','stroke-width':5.5,'stroke-linecap':'round','stroke-linejoin':'round'});
   this.zs=[0,1,2].map(i=>{const p=create('path',{d:'M0 0 L22 0 L0 27 L22 27'});this.sleep.append(p);return p});this.root.append(this.sleep);
   this.laugh=r._new('g','laugh-symbols',{'data-overlay':'laugh',opacity:0,fill:'none',stroke:'#dc9b56','stroke-width':15,'stroke-linecap':'round'});
   this.laugh.append(create('path',{d:'M106 269 L70 243 M96 307 L47 305 M108 345 L72 370 M974 269 L1010 243 M984 307 L1033 305 M972 345 L1008 370'}));this.root.append(this.laugh);
  }
  render(base){
   const r=this.r,t=r.options.reducedMotion?0:r.clock;
   r._set(this.root,'transform',r.headSlots[1].getAttribute('transform'));
   r._set(this.anger,'opacity',fmt(base.AngerMark));r._set(this.anger,'transform',`translate(762 242) rotate(-16) scale(${fmt(1.6+.06*Math.sin(t*4))})`);
   r._set(this.laugh,'opacity',fmt(base.LaughMark));r._set(this.laugh,'transform',`translate(0 ${fmt(Math.sin(t*5)*3)})`);
   r._set(this.sleep,'opacity',fmt(base.SleepMark));this.zs.forEach((z,i)=>{const wave=Math.sin(t*1.6-i*.7);r._set(z,'transform',`translate(${fmt(835+i*30)} ${fmt(252-i*38-wave*5)}) scale(${fmt(.62+i*.2)})`);r._set(z,'opacity',fmt(.7+.25*Math.sin(t*1.6-i*.7)**2));});
  }
 }
 global.MintEmotionEffects=MintEmotionEffects;
})(window);
