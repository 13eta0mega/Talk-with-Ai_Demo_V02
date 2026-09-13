/* Authored limb silhouettes, independent from the emotion channel.
 * Every visible variant still uses a rest-bound triangle cage. */
(function(global){
 'use strict';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
 const fmt=x=>String(Math.round(x*10000)/10000);
 const NS='http://www.w3.org/2000/svg';
 const create=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e};
 class MintPartVariants{
  constructor(r,source,config){
   this.r=r;this.config=structuredClone(config);this.slots={};this.entries=[];
   this.enabled=true;this.strong=false;
   this.fore=r._new('g','variant-arms',{'data-layer':'foreground limbs'});r.meshDebugLayer.before(this.fore);
   this.waveBag=r._new('g','wave-bag-front',{opacity:0,'data-layer':'pouch above greeting arm'});const bagCopy=r.get('accessory-dino-bag').cloneNode(true);r._registerVariant(bagCopy,'wave-bag-art');this.waveBag.append(bagCopy);this.fore.after(this.waveBag);
   this.back=r._new('g','variant-legs',{'data-layer':'legs under shorts'});r.shortSlot.before(this.back);
   for(const kind of ['arm'])for(const side of ['left','right']){
    const slot=kind+'-'+side,names=['base',...Object.keys(config.parts).filter(id=>id.startsWith(kind+'-')).map(id=>id.slice(kind.length+1))];
    const weights=Object.fromEntries(names.map(n=>[n,n==='base'?1:0]));
    this.slots[slot]={names,manual:'auto',from:{...weights},to:{...weights},at:0,duration:0,weights};
    for(const name of names.slice(1)){
     const id=kind+'-'+name,meta=config.parts[id],group=source.querySelector('#'+id).cloneNode(true);
     r._registerVariant(group,'variant-'+slot+'-'+name);
     // Mirror the authored art, then bind the mirrored paths, including motifs.
     const frame=r._new('g','variant-'+slot+'-'+name+'-pose',{opacity:0,display:'none','data-slot':slot,'data-variant':name});
     if(side==='right')group.setAttribute('transform',`translate(${kind==='arm'?1069:1054} 0) scale(-1 1)`);
     // User-approved paint order: every gesture hand and sleeve sits above
     // the bag AND its strap, especially when the hands meet at the chest.
     // Keep the hand under its cuff but in front of the hood and bag.
     const hands=r._new('g','variant-'+slot+'-'+name+'-hands',{'data-layer':'hands above hood'});
     const cuffs=r._new('g','variant-'+slot+'-'+name+'-cuffs',{'data-layer':'cuffs above hood'});
     if(side==='right')hands.setAttribute('transform',group.getAttribute('transform'));
     if(side==='right')cuffs.setAttribute('transform',group.getAttribute('transform'));
     for(const path of [...group.querySelectorAll('path')])if(path.id.endsWith('-hand'))hands.append(path);
     for(const path of [...group.querySelectorAll('path')])if(path.id.endsWith('-cuff'))cuffs.append(path);
     const clothing=r._new('g','variant-'+slot+'-'+name+'-clothing',{'data-layer':'sleeves above hood'});
     clothing.append(group);frame.append(hands,clothing,cuffs);this.fore.append(frame);
     const mirror=p=>side==='left'?[...p]:[(kind==='arm'?1069:1054)-p[0],p[1]];
     const root=mirror(meta.root),tip=mirror(meta.tip),elbow=mirror(meta.elbow||meta.root),wrist=mirror(meta.wrist||meta.tip),dx=tip[0]-root[0],dy=tip[1]-root[1],length2=dx*dx+dy*dy;
     const mesh=r._newPartMesh('variant-'+slot+'-'+name,frame,[...frame.querySelectorAll('path')],{columns:8,rows:8,weights:p=>{
      if(name==='peace'||name==='clasp'){
       const pin=smooth((Math.hypot(p[0]-root[0],p[1]-root[1])-25)/100),ax=wrist[0]-elbow[0],ay=wrist[1]-elbow[1];
       const t=((p[0]-elbow[0])*ax+(p[1]-elbow[1])*ay)/(ax*ax+ay*ay),fore=smooth((t-.03)/.72),hand=smooth((t-.68)/.30);
       return{root:1-pin,upper:pin*(1-fore),lower:pin*(fore-hand),hand:pin*hand};
      }
      const t=clamp(((p[0]-root[0])*dx+(p[1]-root[1])*dy)/length2,0,1);
      const w=smooth((t-.08)/.66);return{root:1-w,tip:w};
     }});
     const debug=create('g'),tri=create('path',{stroke:'#14a9ad','stroke-opacity':.7,fill:'none','stroke-width':1.1}),bones=create('path',{stroke:'#ed5477','stroke-width':4,fill:'none'});
     debug.append(tri,bones);r.meshDebugLayer.append(debug);
     this.entries.push({slot,kind,side,name,frame,group,root,tip,elbow,wrist,...mesh,debug,tri,bones});
    }
   }
  }
  sample(slot,time=this.r.clock){
   const s=this.slots[slot],t=s.duration?smooth((time-s.at)/s.duration):1;
   if(t===1)return{...s.to};if(t===0)return{...s.from};
   return Object.fromEntries(s.names.map(n=>[n,s.from[n]+(s.to[n]-s.from[n])*t]));
  }
  retarget(duration=.38){
   const r=this.r;if(r.actionIntensity>=.45)this.strong=true;else if(r.actionIntensity<=.25)this.strong=false;
   for(const [slot,s]of Object.entries(this.slots)){
    const pose=!this.enabled?'base':s.manual!=='auto'?s.manual:this.strong?(this.config.actions[r.action]?.[slot]||'base'):'base';
    if(s.to[pose]===1&&duration!==0)continue;
    s.from=this.sample(slot);s.to=Object.fromEntries(s.names.map(n=>[n,n===pose?1:0]));s.at=r.clock;s.duration=duration;
   }
  }
  set(slot,pose,duration=.38){
   const s=this.slots[slot];if(!s||!(pose==='auto'||s.names.includes(pose)))throw new Error('Invalid part variant');
   this.r._checkDuration(duration);s.manual=pose;this.retarget(duration);this.r.render();
  }
  reset(){this.strong=false;for(const e of this.entries)e.mesh.deform(p=>[...p]);for(const s of Object.values(this.slots)){s.manual='auto';s.from=Object.fromEntries(s.names.map(n=>[n,n==='base'?1:0]));s.to={...s.from};s.at=0;s.duration=0;s.weights={...s.from};}}
  render(d){
   const r=this.r,motion=r.options.reducedMotion?0:1;
   for(const [slot,s]of Object.entries(this.slots)){
    s.weights=this.sample(slot);
    const [kind,side]=slot.split('-'),base=s.weights.base;
    const original=kind==='arm'?[r.get(slot)]:[r.get(slot),r.legData.find(l=>l.side===side).cross,r.legData.find(l=>l.side===side).foot];
    for(const node of original){r._set(node,'opacity',base===1?null:fmt(base));r._set(node,'visibility',base===0?'hidden':null);}
   }
   const bagWeight=Math.max(...Object.values(this.slots).map(s=>s.weights.peace||0));r._set(this.waveBag,'opacity',fmt(bagWeight));r._set(this.waveBag,'transform',r.bagSlot.getAttribute('transform'));
   for(const e of this.entries){
    const weight=this.slots[e.slot].weights[e.name];r._set(e.frame,'opacity',fmt(weight));r._set(e.frame,'display',weight===0?'none':null);
    const parent=e.kind==='arm'?r.get(e.slot).parentElement:r.shortSlot;
    r._set(e.frame,'transform',parent.getAttribute('transform'));
    r._set(e.debug,'transform',parent.getAttribute('transform'));
    r._set(e.debug,'display',weight>0&&(r.rigDebug.mesh||r.rigDebug.bones)?null:'none');
    if(weight===0)continue;
    const parentMatrix=parent.transform.baseVal.consolidate()?.matrix||new DOMMatrix();
    const headMatrix=r.headSlots[1].transform.baseVal.consolidate()?.matrix||new DOMMatrix();
    let delta=[0,0];
    if(e.kind==='arm'&&['fist','mouth'].includes(e.name)){
     const p=new DOMPoint(...e.tip).matrixTransform(headMatrix).matrixTransform(parentMatrix.inverse());
     delta=[clamp(p.x-e.tip[0],-32,32),clamp(p.y-e.tip[1],-32,32)];
    }
    const phase=r.beatPhase-(e.side==='left'?.35:.7);
    const pulse=motion*((d.body.ArmBeat*.16+d.body.Sob*2)*Math.sin(phase*1.3)+r.armSecondary.x*.32);
    // Only small rotations happen inside a replacement silhouette. The large
    // pose change is authored geometry, so the sleeve is never folded inside out.
    const angle=motion*(['wave','peace'].includes(e.name)?(1.2+d.body.Wave*2)*Math.sin(phase*2.5):e.kind==='leg'?d.body.FootStep*.65*Math.sin(phase):pulse);
    const finger=e.name==='index'?motion*1.8*(1-Math.cos(phase*1.8))*.5*(e.side==='left'?-1:1):0;
    e.mesh.deform((p,w)=>{
     if(e.name==='peace'||e.name==='clasp'){
      const sign=e.side==='left'?1:-1,clasp=e.name==='clasp',amp=motion*(clasp?d.body.Twist:d.body.Wave),upper=sign*amp*(clasp?1.4:3)*Math.sin(phase*(clasp?.65:.7)),lower=sign*amp*(clasp?-1.1:15)*Math.sin(phase*(clasp?.65:1.8)),hand=sign*amp*(clasp?.4:11)*Math.sin(phase*(clasp?.65:1.8)-.55);
      const a=r._rotatePoint(p,e.root,upper),joint=r._rotatePoint(e.elbow,e.root,upper),q=r._rotatePoint(p,e.elbow,upper+lower),b=[q[0]+joint[0]-e.elbow[0],q[1]+joint[1]-e.elbow[1]];
      const wr=r._rotatePoint(e.wrist,e.elbow,upper+lower),wpos=[wr[0]+joint[0]-e.elbow[0],wr[1]+joint[1]-e.elbow[1]],c=r._rotatePoint(b,wpos,hand);
      e.bonePose={upper,lower,hand,elbow:joint,wrist:wpos};return[0,1].map(k=>p[k]*w.root+a[k]*w.upper+b[k]*w.lower+c[k]*w.hand);
     }
     const q=r._rotatePoint(p,e.tip,angle);
     const volume=r.frameBase.SleevePuff*(e.kind==='arm'?.06:.015)*4*w.tip*(1-w.tip);
     return[p[0]+(q[0]-p[0]+delta[0]+finger)*w.tip+(p[0]-e.root[0])*volume,
      p[1]+(q[1]-p[1]+delta[1]+pulse)*w.tip-(e.kind==='leg'?r.frameSquash*8*w.tip:0)];
    });
    r._writeMeshPaths(e.mesh,e.records);
    if(r.rigDebug.mesh||r.rigDebug.bones){
     const line=(a,b)=>`M${a.map(fmt).join(' ')} L${b.map(fmt).join(' ')}`;
     r._set(e.tri,'display',r.rigDebug.mesh?null:'none');r._set(e.bones,'display',r.rigDebug.bones?null:'none');
     r._set(e.tri,'d',e.mesh.edges.map(([a,b])=>line(e.mesh.positions[a],e.mesh.positions[b])).join(' '));
     r._set(e.bones,'d',['peace','clasp'].includes(e.name)&&e.bonePose?line(e.root,e.bonePose.elbow)+line(e.bonePose.elbow,e.bonePose.wrist)+line(e.bonePose.wrist,e.mesh.sample(e.mesh.bind(e.tip))):line(e.root,e.mesh.sample(e.mesh.bind(e.tip))));
    }
   }
  }
  state(){return Object.fromEntries(Object.entries(this.slots).map(([id,s])=>[id,{manual:s.manual,weights:{...s.weights},target:{...s.to}}]));}
 }
 global.MintPartVariants=MintPartVariants;
})(window);
