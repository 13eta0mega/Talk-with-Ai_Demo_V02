/* Pointer interactions: one interruptible clock, local cheek FFD inputs, and a
 * semantic paw cursor. External hand artwork is intentionally absent. */
(function(global){
 'use strict';
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
 const lerp=(a,b,t)=>a+(b-a)*t;
 const releaseCurve=u=>{
  u=clamp(u);const keys=[[0,1],[.35,.3],[.52,-.06],[.74,.03],[1,0]];
  for(let i=1;i<keys.length;i++)if(u<=keys[i][0]){const a=keys[i-1],b=keys[i],t=ease((u-a[0])/(b[0]-a[0]));return lerp(a[1],b[1],t)}
  return 0;
 };
 class MintInteractions{
  constructor(r){
   this.r=r;this.pullSide=-1;this.reset();
   this.root=r._new('g','interaction-overlay',{'pointer-events':'none','data-layer':'contact cursor above character'});r.meshDebugLayer.before(this.root);
   // Empty compatibility groups keep the public debug API stable without retaining hand paths.
   this.pet=r._new('g','pet-glove',{opacity:0});this.poke=r._new('g','poke-glove',{opacity:0});this.pokeRight=r._new('g','poke-glove-right',{opacity:0});this.pull=r._new('g','pull-glove',{opacity:0});
   this.root.append(this.pet,this.poke,this.pokeRight,this.pull);this.hearts=[];
   this.pointer=r._new('g','interaction-pointer',{opacity:0,'data-layer':'cat paw contact marker'});
   const art=r._new('g','interaction-pointer-paw',{fill:'#f38eae',stroke:'#ffffff','stroke-width':2.4,'stroke-linejoin':'round'});
   art.append(
    r._new('ellipse','paw-toe-1',{cx:-10.5,cy:-8.5,rx:5.6,ry:7.3,transform:'rotate(-24 -10.5 -8.5)'}),
    r._new('ellipse','paw-toe-2',{cx:-3.3,cy:-14.2,rx:5.8,ry:7.8,transform:'rotate(-7 -3.3 -14.2)'}),
    r._new('ellipse','paw-toe-3',{cx:4.5,cy:-14.2,rx:5.8,ry:7.8,transform:'rotate(7 4.5 -14.2)'}),
    r._new('ellipse','paw-toe-4',{cx:11.6,cy:-8.2,rx:5.6,ry:7.3,transform:'rotate(24 11.6 -8.2)'}),
    r._new('path','paw-pad',{d:'M-13 8 C-13 0 -8 -6 -3 -5 C0 -10 5 -10 8 -5 C14 -5 18 1 16 9 C14 17 7 19 2 16 C-4 20 -12 17 -13 8 Z'})
   );this.pointer.append(art);this.root.append(this.pointer);
   this.pointerState={x:534,y:690,active:false,kind:null};
  }
  reset(){
   this.state={from:{pet:0,left:0,right:0,pull:0},to:{pet:0,left:0,right:0,pull:0},at:0,duration:0};
   this.direct={kind:null,side:'left',from:0,to:0,at:0,duration:0,held:false,holdAt:0,releasing:false};
   this.pullVector={x:-135,y:0};this.pullSide=-1;this.weights=null;if(this.pointerState)this.pointerState.active=false;
  }
  _directValue(time=this.r.clock){const d=this.direct;if(d.releasing)return d.from*releaseCurve((time-d.at)/d.duration);const t=d.duration?ease((time-d.at)/d.duration):1;return lerp(d.from,d.to,t)}
  sample(time=this.r.clock){
   const s=this.state,age=Math.max(0,time-s.at),enter=ease(age/(s.easeDuration||.32)),exit=s.duration?1-ease((age-s.duration+.65)/.65):1;
   const v=Object.fromEntries(['pet','left','right','pull'].map(k=>[k,lerp(s.from[k],s.to[k],enter)*exit]));
   const d=this.direct,value=this._directValue(time);let deform=v.pull;
   if(d.kind&&value>0){v.pet=d.kind==='pet'?Math.max(v.pet,value):v.pet;v.left=d.kind==='poke'&&d.side==='left'?Math.max(v.left,value):v.left;v.right=d.kind==='poke'&&d.side==='right'?Math.max(v.right,value):v.right;v.pull=d.kind==='pull'?Math.max(v.pull,value):v.pull}
   if(d.kind==='pull'){deform=d.releasing?value:Math.max(deform,value);if(d.held&&time-d.holdAt>.55&&!this.r.options.reducedMotion){const tremble=(Math.sin(time*39)+.55*Math.sin(time*61+.8))/1.55;v.pull=clamp(v.pull+tremble*.014*v.pull);deform+=tremble*.012*v.pull}}
   return{...v,poke:v.left+v.right,direct:value,held:d.held,pullDeform:deform};
  }
  play(kind,side='left'){
   if(!['pet','poke','pull'].includes(kind)||!['left','right'].includes(side))throw Error('Unknown interaction');const from=this.sample();
   if(kind==='pull'){this.pullSide=side==='left'?-1:1;this.pullVector={x:this.pullSide*145,y:4}}
   this.state={from,to:{pet:kind==='pet'?1:0,left:kind==='poke'&&side==='left'?1:0,right:kind==='poke'&&side==='right'?1:0,pull:kind==='pull'?1:0},at:this.r.clock,duration:kind==='pull'?3.6:kind==='pet'?3.2:2.5};this.r.render();
  }
  directTo(kind,side='left',amount=1){
   if(!['pet','poke','pull'].includes(kind)||!['left','right'].includes(side)||!Number.isFinite(amount))throw Error('Unknown direct interaction');amount=clamp(amount);
   const now=this.r.clock,current=this._directValue(now),changed=this.direct.kind!==kind||this.direct.side!==side||!this.direct.held;
   if(!changed&&Math.abs(this.direct.to-amount)<.004)return;if(kind==='pull')this.pullSide=side==='left'?-1:1;
   this.direct={kind,side,from:changed?Math.max(0,current):current,to:amount,at:now,duration:changed?.075:.04,held:true,holdAt:changed?now:this.direct.holdAt,releasing:false};this.r.render();
  }
  directPull(side,strength,dx,dy){
   if(!['left','right'].includes(side)||![strength,dx,dy].every(Number.isFinite))throw Error('Invalid pull vector');
   const sign=side==='left'?-1:1,outward=Math.max(0,dx*sign),x=sign*165,y=clamp(dy/Math.max(24,outward)*90,-62,62);
   this.pullSide=sign;this.pullVector={x,y};this.directTo('pull',side,strength);
  }
  setPointer(clientX,clientY,active=true,kind=this.direct.kind){const m=this.r.headSlots[1].getScreenCTM();if(!m||!Number.isFinite(clientX)||!Number.isFinite(clientY))return;const p=new DOMPoint(clientX,clientY).matrixTransform(m.inverse());this.pointerState={x:p.x,y:p.y,active:Boolean(active),kind};this.r.render()}
  stop(duration=.24){
   duration=clamp(duration,.12,.3);const now=this.r.clock,current=this._directValue(now),from=this.sample(now),wasPull=this.direct.kind==='pull'||from.pull>0;
   this.direct={...this.direct,from:Math.max(0,current,from.pull),to:0,at:now,duration,held:false,releasing:wasPull};
   this.state={from,to:{pet:0,left:0,right:0,pull:0},at:now,duration:0,easeDuration:duration};if(this.pointerState)this.pointerState.active=false;
  }
  mix(base){
   const w=this.sample(),p=w.pet,q=w.poke,pull=Math.max(0,w.pull),soft=ease(pull),bridge=ease((pull-.62)/.16),extreme=ease((pull-.78)/.18);this.weights=w;
   base.EyeLOpen*=1-p;base.EyeROpen*=1-p;base.EyeSmile=lerp(base.EyeSmile,1,p);base.Cheek=Math.max(base.Cheek,p*.9,q*.25);
   base.MouthForm=lerp(lerp(base.MouthForm,.75,p),-.6,q);base.MouthOpenY*=1-Math.max(p,q)*.85;
   base.CheekPuff=lerp(base.CheekPuff,1,q);base.Tension=lerp(base.Tension,.55,q);base.EyeLOpen=lerp(base.EyeLOpen,.6,q);base.EyeROpen=lerp(base.EyeROpen,.6,q);base.HeadAngleZ+=(w.right-w.left)*1.5;
   if(pull>0){const near=this.pullSide<0?'EyeLOpen':'EyeROpen',far=this.pullSide<0?'EyeROpen':'EyeLOpen';base[near]*=lerp(1,.38,soft)*(1-bridge);base[far]*=lerp(1,.86,soft)*(1-bridge);base.EyeSmile*=1-bridge;base.EyeSqueeze=Math.max(base.EyeSqueeze,.24*soft+.58*bridge);base.BrowY=lerp(base.BrowY,.42,pull);base.Cheek=Math.max(base.Cheek,.72*pull);base.MouthForm=lerp(base.MouthForm,-.22,pull);base.MouthOpenY=lerp(base.MouthOpenY,.14,extreme)}
   base.CheekPull=pull;base.CheekPullDeform=w.pullDeform;base.CheekPullX=this.pullVector.x;base.CheekPullY=this.pullVector.y;base.CheekPullBridge=bridge;base.CheekPullExtreme=extreme;return base;
  }
  render(){
   const r=this.r,w=this.weights||this.sample(),t=r.options.reducedMotion?0:r.clock;r._set(this.root,'transform',r.headSlots[1].getAttribute('transform'));
   for(const hand of [this.pet,this.poke,this.pokeRight,this.pull])r._set(hand,'opacity',0);
   const marker=this.pointerState||{x:0,y:0,active:false},pull=Math.max(0,w.pull),pulse=r.options.reducedMotion?1:1+.045*Math.sin(t*9),tilt=marker.kind==='pet'?Math.sin(t*5)*7:this.pullSide*pull*8;
   r._set(this.pointer,'opacity',marker.active?1:0);r._set(this.pointer,'transform',`translate(${marker.x} ${marker.y}) rotate(${tilt}) scale(${pulse*(1+.12*pull)} ${pulse*(1-.08*pull)})`);
   this.evaluated={...w,phaseTime:t,headTransform:this.root.getAttribute('transform'),pointer:{...marker},pullVector:{...this.pullVector}};
  }
 }
 global.MintInteractions=MintInteractions;
})(window);
