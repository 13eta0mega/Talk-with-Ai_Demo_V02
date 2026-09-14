/* Shared head projection: one deformation field preserves shared boundaries. */
(function(global){
 'use strict';
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,ease=v=>{v=clamp(v);return v*v*(3-2*v)},fmt=v=>Math.round(v*10000)/10000;
 const blendPath=(a,b,t)=>{const nums=b.match(/-?\d+(?:\.\d+)?/g).map(Number);let i=0;return a.replace(/-?\d+(?:\.\d+)?/g,n=>fmt(mix(+n,nums[i++],t)))};
 const mirrorPath=d=>{let i=0;return d.replace(/-?\d+(?:\.\d+)?/g,n=>(i++%2===0?fmt(1068-(+n)):n))};
 const rand=()=>{const n=new Uint32Array(1);crypto.getRandomValues(n);return n[0]/4294967296};
 class MintPerformance{
 constructor(r){
 this.r=r;this.saved=[];this.reset();
 this.face=r._wrap(r.get('face'),'face-depth');this.front=r._wrap(r.get('front-hair'),'hair-depth');this.back=r._wrap(r.get('head'),'head-depth');this.access=r._wrap(r.get('head-accessories'),'accessory-depth');
 this.eyeSlots=['left','right'].map(s=>r._wrap(r.get('eye-'+s),'eye-'+s+'-depth'));
 this.pullEyeBridge='M338 618 C370 612 408 611 462 620 C470 622 470 628 462 630 C411 625 372 625 340 630 C332 630 331 623 339 620 C369 616 396 619 426 623 C397 619 368 619 337 625 C329 625 330 620 338 618 Z';
 this.pullEyeTarget='M338 592 C370 598 408 612 462 630 C470 633 470 639 462 642 C411 660 372 670 340 672 C332 668 331 660 339 656 C369 648 396 639 426 635 C397 629 368 619 337 608 C329 604 330 596 338 592 Z';
 this.pullEyes=this.eyeSlots.map((slot,i)=>{const p=r._new('path','pull-eye-'+i,{d:i?mirrorPath(this.pullEyeBridge):this.pullEyeBridge,fill:'#090c09',stroke:'none','stroke-linejoin':'round',opacity:0});slot.append(p);return p});
 this.hood=r._wrap(r.get('hood-back'),'hood-lowering');this.cat=r._wrap(r.get('accessory-cat-pin'),'cat-lowering');
 this.fold=r._new('g','lowered-hood',{opacity:0});this.fold.append(r._new('path','hood-fold-shape',{d:'M331 766 C298 795 302 854 349 883 C395 913 474 909 534 887 C599 910 675 909 724 882 C767 855 769 802 739 771 C703 789 675 805 650 823 C599 852 470 852 417 824 C392 806 362 789 331 766 Z',fill:'#a7e7cb',stroke:'#090c09','stroke-width':7,'stroke-linejoin':'round'}));r.headSlots[0].before(this.fold);
 this.crown=r._new('path','hoodless-rounded-crown',{d:'M179 647 C161 533 210 380 289 293 C365 207 455 170 533 185 C618 166 710 208 783 292 C859 378 903 528 886 644 C860 724 808 780 741 805 C672 834 606 813 535 796 C458 819 393 834 326 805 C252 777 204 726 179 647 Z',fill:'url(#'+r.prefix+'hair-cream)',stroke:'#858c80','stroke-width':6,opacity:0});r.get('back-hair').before(this.crown);
 for(const id of ['back-hair-left','back-hair-right']){r.get(id).setAttribute('fill','url(#'+r.prefix+'hair-cream)');r.get(id).setAttribute('stroke','#858c80')}
 this.cheek=r._new('g','pull-cheek-front',{opacity:0});this.cheekClip=r._new('clipPath','pull-cheek-clip',{clipPathUnits:'userSpaceOnUse'});this.cheekRegion=r._new('path','pull-cheek-region',{});this.cheekClip.append(this.cheekRegion);r.defs.append(this.cheekClip);this.cheekFill=r._new('path','pull-cheek-fill',{fill:'url(#'+r.prefix+'skin)',stroke:'#090c09','stroke-width':7,'clip-path':'url(#'+this.cheekClip.id+')'});this.cheekBlush=r._new('ellipse','pull-cheek-pink',{rx:27,ry:11,fill:'#f4acb2',opacity:.45,stroke:'none'});this.cheek.append(this.cheekFill,this.cheekBlush);r.headSlots[2].append(this.cheek);
 this.pullMouth=r._new('path','pull-complaint-mouth',{d:'M511 684 C510 669 521 661 534 672 C547 661 558 672 557 687 C557 702 544 697 534 694 C524 702 510 700 511 684 Z',fill:'#efa9a0',stroke:'#090c09','stroke-width':5,opacity:0});r.get('mouth').append(this.pullMouth);
 this.thighBridges=r.legData.map(l=>{const path=r._new('path','thigh-overlap-'+l.side,{fill:'url(#'+r.prefix+'skin)',stroke:'none'});r.get('leg-'+l.side).prepend(path);return path});
 this.collar=r.get('collar-left');this.collarRest=r.rest.get(this.collar).d;
 }
 reset(){this.events=[];this.lookEvents=[];this.next=0;this.lookNext=0;this.side=1;this.depthClock=null;this.depth={root:{x:0,y:0},face:{x:0,y:0},hair:{x:0,y:0},access:{x:0,y:0},eyes:{x:0,y:0}};}
 random(time){
 while(this.next<=time+7){const interval=3+4*rand(),last=this.events.at(-1)?.target||0,options=[-1,0,1].filter(x=>x!==last);this.next+=interval;this.events.push({at:this.next,interval,side:this.side,target:options[Math.floor(rand()*options.length)]});this.side*=-1;}
 while(this.lookNext<=time+5){const interval=2+3*rand(),last=this.lookEvents.at(-1)?.index??-1,targets=[[-1,.15],[1,.15],[0,0],[-.65,.4],[.65,.4],[0,-.8],[0,.85]],options=targets.map((_,i)=>i).filter(i=>i!==last);let index=options[Math.floor(rand()*options.length)];this.lookNext+=interval;this.lookEvents.push({at:this.lookNext,interval,index,target:targets[index]});}
 const sample=(events)=>{let a=null,b=null;for(const e of events){if(e.at>time)break;a=b;b=e;}return[a,b,b?ease((time-b.at)/.85):0]};
 const[a,b,t]=sample(this.events),[c,e,u]=sample(this.lookEvents);
 return{tilt:6.4*mix(a?.target||0,b?.target||0,t),glance:mix(a?.side||0,b?.side||0,t),lookX:mix(c?.target[0]||0,e?.target[0]||0,u),lookY:mix(c?.target[1]||0,e?.target[1]||0,u)};
 }
 begin(){for(const [n,k,v]of this.saved.reverse()){if(v===null)n.removeAttribute(k);else n.setAttribute(k,v)}this.saved=[];}
 set(n,k,v){this.saved.push([n,k,n.getAttribute(k)]);n.setAttribute(k,v);}
 depthPose(yaw,pitch){
 const now=this.r.clock,dt=this.depthClock===null||now<this.depthClock?0:Math.min(.05,now-this.depthClock);this.depthClock=now;
 const rates={root:7.5,face:11,hair:5.3,access:4.4,eyes:14};
 for(const [id,p]of Object.entries(this.depth)){const a=dt?1-Math.exp(-dt*rates[id]):0;p.x=mix(p.x,yaw,a);p.y=mix(p.y,pitch,a);}
 return this.depth;
 }
 project(yaw,pitch){
 if(!yaw&&!pitch)return;
 const r=this.r,field=(x,y)=>{const nx=(x-534)/410,ny=(y-520)/430,weight=Math.max(0,1-nx*nx)*Math.max(.2,1-ny*ny*.45);return[x+yaw*23*weight,y+pitch*16*weight+yaw*nx*2]};
 const done=new Set();for(const slot of r.headSlots){const root=slot.getCTM();if(!root)continue;const inv=root.inverse();for(const n of slot.querySelectorAll('path,circle,ellipse')){if(done.has(n)||r.eyes.some(e=>e.irisFrame.contains(n)))continue;done.add(n);const m=inv.multiply(n.getCTM()),back=m.inverse(),point=(x,y)=>{const q=new DOMPoint(x,y).matrixTransform(m),v=field(q.x,q.y),p=new DOMPoint(...v).matrixTransform(back);return[fmt(p.x),fmt(p.y)]};
 if(n.tagName==='path'){const d=n.getAttribute('d');if(!d||/[AHVQSTahvqlmstcz]/.test(d))continue;this.set(n,'d',d.replace(/[MLC][^MLCZ]*/g,cmd=>{const values=cmd.slice(1).match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.map(Number)||[];let out=[];for(let i=0;i<values.length;i+=2)out.push(...point(values[i],values[i+1]));return cmd[0]+out.join(' ')+' '}));}
 else{const p=point(+n.getAttribute('cx'),+n.getAttribute('cy'));this.set(n,'cx',p[0]);this.set(n,'cy',p[1]);}
 }}
 // Apertures are authored in the same head coordinates as their eye contours.
 for(const n of [...r.eyes.flatMap(eye=>[eye.aperturePath,eye.apertureIrisPath]),this.cheekRegion]){if(!n||done.has(n))continue;const d=n.getAttribute('d');if(!d)continue;this.set(n,'d',d.replace(/[MLC][^MLCZ]*/g,c=>{const v=c.slice(1).match(/-?\d+(?:\.\d+)?/g)?.map(Number)||[],o=[];for(let i=0;i<v.length;i+=2)o.push(...field(v[i],v[i+1]).map(fmt));return c[0]+o.join(' ')+' '}));}
 // Iris base, pupil, glow and both highlights move as one rigid assembly.
 for(const eye of r.eyes){const current=eye.irisFrame.getAttribute('transform')||'';this.set(eye.irisFrame,'transform',`${current} translate(${fmt(yaw*22)} ${fmt(pitch*16)})`.trim());}
 }
 render(d){
 const r=this.r,b=r.frameBase,contact=r.interactions.weights||{pet:0,poke:0,pull:0},blocked=Math.max(contact.pet,contact.poke,contact.pull||0),random=this.random(r.clock);
 const pose=r.options.poseTracking?r.poseFollow:{x:0,y:0};
 const yaw=clamp(b.HeadYaw+pose.x*.9+(r.options.tracking?r.gaze.x*.35:0)*(1-blocked)+(r.options.reducedMotion?0:1)*d.body.Scan*random.lookX*.45,-1,1),pitch=clamp(b.HeadPitch+pose.y*.85+(r.options.tracking?r.gaze.y*.3:0)*(1-blocked)+(r.options.reducedMotion?0:1)*d.body.Scan*random.lookY*.4,-1,1);
 const pull=b.CheekPull,side=r.interactions.pullSide||-1,depth=this.depthPose(yaw,pitch);
 const tr=(x,y,s=0)=>`translate(${fmt(x)} ${fmt(y)}) skewY(${fmt(s)})`;
 this.set(this.back,'transform',tr(depth.root.x*2.2,depth.root.y*1.4,depth.root.x*.18));
 this.set(this.face,'transform',tr(depth.face.x*1.9,depth.face.y*1.25,depth.face.x*.13));
 this.set(this.front,'transform',tr(-depth.hair.x*1.5,depth.hair.y*.7,-depth.hair.x*.16));
 this.set(this.access,'transform',tr(-depth.access.x*2.4,depth.access.y*.45,-depth.access.x*.22));
 this.eyeSlots.forEach((slot,i)=>this.set(slot,'transform',tr(depth.eyes.x*(i?2.9:2.5),depth.eyes.y*1.5,depth.eyes.x*(i?-.08:.08))));
 // The normal eye closes first. Only after that bridge is complete does one
 // opaque chevron path morph toward the strong squeeze target; no cross-fade.
 const extreme=b.CheekPullExtreme||0,showExtreme=extreme>.001;
 this.pullEyes.forEach((p,i)=>{const a=i?mirrorPath(this.pullEyeBridge):this.pullEyeBridge,target=i?mirrorPath(this.pullEyeTarget):this.pullEyeTarget;r._set(p,'d',blendPath(a,target,extreme));r._set(p,'opacity',showExtreme?1:0);r._set(r.eyes[i].group,'opacity',showExtreme?0:null)});
 const deform=b.CheekPullDeform??pull,vx=(b.CheekPullX??side*165)*deform,vy=(b.CheekPullY??0)*deform;
 // Nearby side hair follows lightly; the forehead and opposite hair remain anchors.
 if(Math.abs(deform)>.0001){const group=r.get(side<0?'hair-side-left':'hair-side-right');for(const n of group.querySelectorAll('path')){const raw=n.getAttribute('d');this.set(n,'d',raw.replace(/[MLC][^MLCZ]*/g,c=>{const v=c.slice(1).match(/-?\d+(?:\.\d+)?/g)?.map(Number)||[];for(let i=0;i<v.length;i+=2){const w=ease((v[i+1]-548)/165)*ease((side*(v[i]-534)+10)/180);v[i]+=vx*.5*w;v[i+1]+=vy*.2*w-Math.abs(vx)*.035*w;}return c[0]+v.map(fmt).join(' ')+' '}));}}
 // Preserve the active expression mouth and pull its near corner through the
 // same deformation vector. The old complaint-mouth overlay stays disabled.
 r._set(this.cheek,'opacity',0);const mouthSwap=extreme>.06;r._set(this.pullMouth,'opacity',mouthSwap?1:0);r._set(this.pullMouth,'transform',mouthSwap?`translate(${fmt(vx*.13)} ${fmt(vy*.1)})`:null);
 if(Math.abs(deform)>.0001)for(const n of r.get('mouth').querySelectorAll('path'))if(n!==this.pullMouth){if(mouthSwap){this.set(n,'opacity',0);continue}const raw=n.getAttribute('d');if(raw&&!/[AHVQSTahvqlmstcz]/.test(raw))this.set(n,'d',raw.replace(/[MLC][^MLCZ]*/g,c=>{const v=c.slice(1).match(/-?\d+(?:\.\d+)?/g)?.map(Number)||[];for(let i=0;i<v.length;i+=2){const near=ease((side*(v[i]-534)+5)/45),w=.1+.38*near;v[i]+=vx*w;v[i+1]+=vy*w*.4;}return c[0]+v.map(fmt).join(' ')+' '}))}
 // Continue skin beneath the shorts opening while the leg cage spreads below it.
 r.legData.forEach((l,i)=>{const left=i?547:377,right=i?681:511,topY=1138,lowY=1181,m=l.mesh,rot=p=>{const q=r._rotatePoint(p,[534,1146],r.fullBodyEvaluated.torsoAngle);q[1]+=r.fullBodyEvaluated.crouch;return q.map(fmt)},a=rot([left,topY]),b=rot([right,topY]),c=m.sample(m.bind([right,lowY])).map(fmt),e=m.sample(m.bind([left,lowY])).map(fmt);r._set(this.thighBridges[i],'d',`M${a} L${b} L${c} L${e} Z`)});
 const hood=b.HoodOff;r._set(r.get('back-hair'),'opacity',null);r._set(this.hood,'transform',hood?`translate(0 ${fmt(565*hood)}) translate(534 170) scale(${fmt(1-.24*hood)} ${fmt(1-.78*hood)}) translate(-534 -170)`:null);r._set(this.hood,'opacity',hood?fmt(1-ease(hood)):null);
 r._set(this.crown,'opacity',0);r._set(this.fold,'opacity',ease((hood-.25)/.75));r._set(this.fold,'transform',r.breathSlots[0].getAttribute('transform'));
 r._set(this.cat,'opacity',hood?1-ease(hood):null);
 const border=r.nodes.get('hood-opening-border');if(border)r._set(border,'opacity',hood?fmt(1-hood):null);
   // Tuck the collar wings inside the garment overlap instead of pointing into the armpits.
   const weights=Object.values(r.parts?.slots||{}),amount=weights.length?Math.max(...weights.map(s=>1-s.weights.base)):0;
   if(amount){const target='M378 827 C364 814 370 795 389 783 C403 772 419 759 429 764 C477 776 514 814 531 850 C548 814 585 777 630 765 C648 760 668 775 683 786 C702 800 706 814 691 828 L665 810 C638 848 588 865 533 878 C477 868 431 847 403 811 Z';
    const nums=target.match(/-?\d+(?:\.\d+)?/g).map(Number);let n=0;r._set(this.collar,'d',this.collarRest.replace(/-?\d+(?:\.\d+)?/g,v=>fmt(mix(+v,nums[n++],amount))));
   }else r._set(this.collar,'d',this.collarRest);
   this.project(yaw,pitch);
   this.evaluated={yaw,pitch,hoodOff:hood,randomEvents:this.events.map(e=>({...e})),lookEvents:this.lookEvents.map(e=>({...e}))};
  }
 }
 global.MintPerformance=MintPerformance;
})(window);
