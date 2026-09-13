/* External glove gestures reconstructed from the supplied top-row references.
 * Head-local socket -> final head transform. No second animation clock or timers. */
(function(global){
 const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)},lerp=(a,b,t)=>a+(b-a)*t;
 const NS='http://www.w3.org/2000/svg',heart='M0 12 C-6 6 -17 -2 -17 -10 C-17 -21 -5 -23 0 -14 C5 -23 17 -21 17 -10 C17 -2 6 6 0 12 Z';
 const path=(d,fill='#fcfcfc')=>{const p=document.createElementNS(NS,'path');p.setAttribute('d',d);p.setAttribute('fill',fill);return p};
 class MintInteractions{
  constructor(r){
   this.r=r;this.reset();this.root=r._new('g','interaction-overlay',{'pointer-events':'none','data-layer':'external hand above character'});r.meshDebugLayer.before(this.root);
   this.pet=r._new('g','pet-glove',{stroke:'#302523','stroke-width':7,'stroke-linejoin':'round','stroke-linecap':'round',opacity:0});
   const petArt=r._new('g','pet-hand-art',{transform:'scale(.36) translate(-110 -210)','stroke-width':12});
   petArt.append(path('M132 542 C108 529 115 447 132 397 C157 322 211 251 256 224 C272 215 282 219 299 235 C331 268 370 294 413 313 L331 607 C249 584 177 562 132 542 Z'),path('M493 347 C651 300 826 268 1001 282 C1174 295 1339 340 1425 434 C1446 454 1465 467 1502 482 C1546 500 1551 527 1525 553 C1499 579 1460 583 1421 578 C1400 604 1364 615 1321 604 C1244 587 1181 548 1121 526 C1064 541 978 542 914 543 C881 560 839 594 812 623 C859 636 927 646 965 673 C1002 699 1023 737 1007 773 C987 817 934 815 878 798 C790 772 725 759 639 758 C502 756 408 708 382 645 C350 667 318 648 312 617 C300 568 330 432 376 356 C408 299 473 287 493 347 Z'),path('M1090 331 C1217 352 1316 414 1408 454 M965 367 C1089 370 1245 444 1370 500 C1428 525 1447 551 1421 578','none'),path('M812 623 C805 605 799 590 793 577 M812 623 L757 608','none'));this.pet.append(petArt);this.root.append(this.pet);
   this.poke=r._new('g','poke-glove',{stroke:'#302523','stroke-width':7,'stroke-linejoin':'round','stroke-linecap':'round',opacity:0});
   this.poke.append(path('M0 125 C-5 77 16 27 53 0 L131 50 L112 171 C62 183 10 167 0 125 Z'),path('M121 54 C202 26 245 16 295 23 C371 37 446 57 518 71 C544 75 558 82 555 98 C550 124 525 130 489 125 L350 98 C365 122 383 147 381 166 C380 182 365 197 348 198 C345 221 327 232 311 232 C309 253 287 267 265 265 C247 261 229 246 215 235 C153 250 105 224 81 185 C64 158 62 121 74 88 C84 62 103 42 121 54 Z'),path('M350 98 L325 62 M348 198 C340 173 321 148 303 130 M311 232 C303 211 286 189 274 177 M215 235 L249 255','none'));this.root.append(this.poke);this.pokeRight=this.poke.cloneNode(true);this.pokeRight.id=r.prefix+'poke-glove-right';this.root.append(this.pokeRight);
   this.hearts=Array.from({length:3},(_,i)=>{const p=path(heart,'#ef83a5');p.id=r.prefix+'pet-floating-heart-'+i;p.setAttribute('stroke','#b7507a');p.setAttribute('stroke-width','2');p.setAttribute('opacity','0');this.root.append(p);return p});
  }
  reset(){this.state={from:{pet:0,left:0,right:0},to:{pet:0,left:0,right:0},at:0,duration:0};}
  sample(time=this.r.clock){const s=this.state,age=Math.max(0,time-s.at),enter=ease(age/.32),exit=s.duration?1-ease((age-s.duration+.65)/.65):1;const v=Object.fromEntries(['pet','left','right'].map(k=>[k,lerp(s.from[k],s.to[k],enter)*exit]));return {...v,poke:v.left+v.right};}
  play(kind,side='left'){if(!['pet','poke'].includes(kind)||!['left','right'].includes(side))throw Error('Unknown interaction');const from=this.sample();this.state={from,to:{pet:kind==='pet'?1:0,left:kind==='poke'&&side==='left'?1:0,right:kind==='poke'&&side==='right'?1:0},at:this.r.clock,duration:kind==='pet'?3.2:2.5};this.r.render();}
  stop(){this.state={from:this.sample(),to:{pet:0,left:0,right:0},at:this.r.clock,duration:0};}
  mix(base){const w=this.sample(),p=w.pet,q=w.poke;this.weights=w;
   base.EyeLOpen*=1-p;base.EyeROpen*=1-p;base.EyeSmile=lerp(base.EyeSmile,1,p);base.Cheek=Math.max(base.Cheek,p*.9,q*.25);
   base.MouthForm=lerp(lerp(base.MouthForm,.75,p),-.6,q);base.MouthOpenY*=1-Math.max(p,q)*.85;
   base.CheekPuff=lerp(base.CheekPuff,1,q);base.Tension=lerp(base.Tension,.55,q);base.EyeLOpen=lerp(base.EyeLOpen,.6,q);base.EyeROpen=lerp(base.EyeROpen,.6,q);
   base.HeadAngleZ+=(w.right-w.left)*1.5;return base;
  }
  render(){const r=this.r,w=this.weights||this.sample(),t=r.options.reducedMotion?0:r.clock;
   r._set(this.root,'transform',r.headSlots[1].getAttribute('transform'));
   r._set(this.pet,'opacity',w.pet);r._set(this.pet,'transform',`translate(${314+Math.sin(t*2.8)*32} ${245+Math.cos(t*5.6)*3}) scale(.72) rotate(${Math.sin(t*2.8-.25)*2} 90 140)`);
   const press=r.options.reducedMotion?0:Math.max(0,Math.sin(t*6));
   r._set(this.poke,'opacity',w.left);r._set(this.pokeRight,'opacity',w.right);r._set(this.pokeRight,'transform',`translate(1069 0) scale(-1 1) translate(${42+press*5} 645) scale(.52)`);r._set(this.poke,'transform',`translate(${42+press*5} 645) scale(.52)`);
   this.hearts.forEach((h,i)=>{const phase=(t/1.45+i/3)%1,alpha=r.options.reducedMotion?.65:ease(phase/.18)*(1-ease((phase-.6)/.4));r._set(h,'opacity',w.pet*alpha);r._set(h,'transform',`translate(${650+i*65} ${-5-(r.options.reducedMotion?55:phase*140)}) scale(${1.1+i*.13})`)});
   this.evaluated={...w,phaseTime:t,headTransform:this.root.getAttribute('transform')};
  }
 }
 global.MintInteractions=MintInteractions;
})(window);
