/* MintRig — authored SVG rig. No dependencies, no mutation of the source master.
 * Coordinates: source SVG user units. Public head angle is degrees.
 * One render() method owns every animated SVG attribute. */
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const number = v => Math.abs(v) < 1e-8 ? '0' : String(Math.round(v * 10000) / 10000);
  const arity = {M: 2, L: 2, C: 6, Z: 0};
  const EMOTIONS = ['neutral','happy','delighted','laughing','shy','love','surprised','confused','worried','sad','crying','angry','annoyed','determined','sleepy','wink','greeting','favorite','relieved','curious','pout'];
  const BODY = Object.freeze({HeadAngleZ:0,Tilt:0,Sway:0,Bob:0,Torso:0,TorsoSway:0,Crouch:0,ArmL:0,ArmR:0,ArmBeat:0,CheekReach:0,MouthReach:0,Wave:0,FootStep:0,HairSwing:0,Sob:0,TailSwing:0,Tempo:0,Stance:0,TailDroop:0,TailFlick:0,ShoulderDrop:0,Twist:0,TailStraight:0,Nod:0,Scan:0,Exhale:0});
  const BODY_RANGES = {HeadAngleZ:[-8,8],Tilt:[-8,8],Sway:[0,2],Bob:[0,3],Torso:[-3,3],TorsoSway:[0,2],Crouch:[0,8],ArmL:[-18,45],ArmR:[-18,45],ArmBeat:[0,12],CheekReach:[0,1],MouthReach:[0,1],Wave:[0,1],FootStep:[0,5],HairSwing:[0,4],Sob:[0,1],TailSwing:[0,5],Tempo:[0,8],Stance:[-1,1],TailDroop:[0,1],TailFlick:[0,1],ShoulderDrop:[0,14],Twist:[0,1],TailStraight:[0,1],Nod:[0,1],Scan:[0,1],Exhale:[0,1]};
  const EFFECTS = ['Cheek','Tear','HeartEyes','TearPool','AngerMark','SleepMark','LaughMark','StarEyes'];
  const SHAPES = ['BodySquash','SleevePuff','HairFlare','CheekPuff','TailCurve'];
  let instanceCount = 0;

  function parsePath(d) {
    const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/g) || [];
    const result = []; let i = 0;
    while (i < tokens.length) {
      const cmd = tokens[i++];
      if (!(cmd in arity)) throw new Error('Unsupported authored path command: ' + cmd);
      const v = tokens.slice(i, i + arity[cmd]).map(Number); i += arity[cmd];
      if (v.length !== arity[cmd] || !v.every(Number.isFinite)) throw new Error('Invalid path data');
      result.push(Object.freeze({cmd, v: Object.freeze(v)}));
    }
    return Object.freeze(result);
  }
  function mapPath(commands, fn) {
    return commands.map(({cmd, v}) => {
      const next = [];
      for (let i = 0; i < v.length; i += 2) next.push(...fn(v[i], v[i + 1]));
      if (!next.every(Number.isFinite)) throw new Error('Nonfinite deformed path');
      return cmd + next.map(number).join(' ');
    }).join(' ');
  }
  function pathFromLip(v) { return 'M'+v.slice(0,2).map(number).join(' ')+Array.from({length:(v.length-2)/6},(_,i)=>' C'+v.slice(2+i*6,8+i*6).map(number).join(' ')).join(''); }
  // Exact cubic subdivision gives every mouth six matching segments.
  function refineLip(v) {
    const out=v.slice(0,2),count=(v.length-2)/6,n=6/count;let a=v.slice(0,2);
    for(let i=2;i<v.length;i+=6){const b=v.slice(i,i+2),c=v.slice(i+2,i+4),d=v.slice(i+4,i+6);
      const point=t=>[0,1].map(k=>(1-t)**3*a[k]+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k]);
      const tangent=t=>[0,1].map(k=>3*((1-t)**2*(b[k]-a[k])+2*(1-t)*t*(c[k]-b[k])+t*t*(d[k]-c[k])));
      for(let j=0;j<n;j++){const t=j/n,u=(j+1)/n,p=point(t),q=point(u),dt=tangent(t),du=tangent(u);out.push(...p.map((x,k)=>x+dt[k]/(3*n)),...q.map((x,k)=>x-du[k]/(3*n)),...q);}a=d;
    }return out;
  }
  function reverseClosedCubics(commands) {
    let prior=commands[0].v;const segments=[];
    for(const c of commands.slice(1)){if(c.cmd==='Z')continue;if(c.cmd!=='C')throw new Error('Expected closed cubic clip');segments.push({cmd:'C',v:[...c.v.slice(2,4),...c.v.slice(0,2),...prior]});prior=c.v.slice(4,6);}
    return [{cmd:'M',v:prior},...segments.reverse(),{cmd:'Z',v:[]}];
  }
  function transform(angle, y = 0) {
    return Math.abs(angle) + Math.abs(y) < 1e-8 ? null : `translate(0 ${number(y)}) rotate(${number(angle)} 534 772)`;
  }
  function create(tag, attrs = {}) {
    const e = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, String(value));
    return e;
  }

  class MintRig {
    constructor(host, sourceSvg, rig, expressions, options = {}) {
      this.host = host; this.config = structuredClone(rig); this.expressions = structuredClone(expressions);
      this.prefix = `mint-${++instanceCount}-`; this.nodes = new Map(); this.rest = new Map();
      this.ranges = new Map(rig.parameters.map(p => [p.id, [p.min, p.max]]));
      this.defaults = Object.freeze(Object.fromEntries(rig.parameters.map(p => [p.id, p.default])));
      this._validateExpressions(expressions);
      this.svg = sourceSvg.cloneNode(true); this.svg.removeAttribute('style');
      this.svg.setAttribute('data-rig-instance', this.prefix);
      // Namespace every original ID and local reference, for two independent instances.
      for (const e of this.svg.querySelectorAll('[id]')) {
        const id = e.id; this.nodes.set(id, e); e.dataset.sourceId = id; e.id = this.prefix + id;
      }
      for (const e of [this.svg, ...this.svg.querySelectorAll('*')]) {
        for (const a of [...e.attributes]) {
          if (a.name === 'id' || a.name === 'data-source-id') continue;
          if (a.name === 'aria-labelledby') e.setAttribute(a.name, a.value.split(' ').map(id => this.prefix + id).join(' '));
          else if (a.value.includes('url(#')) e.setAttribute(a.name, a.value.replace(/url\(#([^)]*)\)/g, (_, id) => `url(#${this.prefix}${id})`));
        }
      }
      for (const e of this.svg.querySelectorAll('path')) this.rest.set(e, {d: e.getAttribute('d'), commands: parsePath(e.getAttribute('d'))});
      this.defs = this.svg.querySelector('defs'); this.root = this.get('character');
      this.headSlots = ['head','face','front-hair','head-accessories'].map(id => this._wrap(this.get(id), id + '-pose'));
      this.breathSlots = ['torso','neck','arm-left','arm-right','hood-collar','hood-drawstrings'].map(id => this._wrap(this.get(id), id + '-breath'));
      this.bagSlot = this._wrap(this.get('accessory-dino-bag'), 'bag-breath');
      this.eyes = ['left','right'].map(side => this._prepareEye(side));
      this._prepareMouth(); this._prepareEffects();
      this._prepareFullBody();
      this.frontPaths = [...this.get('front-hair').querySelectorAll('path')].filter(e => !e.closest('[data-source-id="eyes"]') && e.dataset.sourceId !== 'hood-opening-border');
      this.backPaths = [...this.get('back-hair').querySelectorAll('path')];
      this._prepareMeshRig();
      this.options = {idle: true, tracking: true, reducedMotion: false, ...options};
      this.beatPhase=0;this.clock = 0; this.paused = false; this.disposed = false; this.emotion = 'neutral'; this.intensity = 1;
      this.manual = {}; this.target = {...this.defaults}; this.transition = {from: {...this.defaults}, to: {...this.defaults}, at: 0, duration: 0};
      this.action='rest';this.actionIntensity=1;
      this.bodyTransition={from:{...BODY},to:{...BODY},at:0,duration:0};
      this.gaze = {x: 0, y: 0, targetX: 0, targetY: 0}; this.manualBlinkAt = -100;
      this.idleGain = this.options.idle && !this.options.reducedMotion ? 1 : 0;
      this.springs = [0,0,0].map(() => ({x: 0, v: 0, y: 0, vy: 0})); this.previousHead = 0; this.lastHeadVelocity = 0;
      this.previousBodyY=0;this.lastBodyVelocity=0;this.tailSpring={x:0,v:0};this.armSecondary={x:0,v:0};
      this.lastTimestamp = null; this.frameCount = 0;
      host.append(this.svg);
      const partSource=options.partSource||document.getElementById('variant-template')?.content.querySelector('svg');
      const partConfig=options.partConfig||JSON.parse(document.getElementById('variant-data')?.textContent||'null');
      if(partSource&&partConfig&&global.MintPartVariants)this.parts=new MintPartVariants(this,partSource,partConfig);
      this.speech={enabled:false,target:0,value:0,mix:0,vowel:null,gain:.9,vowelOpen:1,vowelRound:0};this.symbols=new MintEmotionEffects(this);this.interactions=new MintInteractions(this);
      this.render();
      this._visibility = () => { this.lastTimestamp = null; };
      document.addEventListener('visibilitychange', this._visibility);
      this.suspended=false;
      this._freeze=()=>{this.suspended=true;this.lastTimestamp=null;};
      this._thaw=()=>{this.suspended=false;this.lastTimestamp=null;};
      document.addEventListener('freeze',this._freeze);
      document.addEventListener('resume',this._thaw);
      if (options.autoStart !== false) this._raf = requestAnimationFrame(t => this._loop(t));
    }
    get(id) { const node = this.nodes.get(id); if (!node) throw new Error('Missing SVG part: ' + id); return node; }
    _wrap(node, id) { const g = create('g', {id: this.prefix + id, 'data-rig-slot': id}); node.before(g); g.append(node); return g; }
    _new(tag, id, attrs = {}) { return create(tag, {id: this.prefix + id, ...attrs}); }
    _set(e, name, value) {
      if (value === null) { if (e.hasAttribute(name)) e.removeAttribute(name); }
      else if (e.getAttribute(name) !== String(value)) e.setAttribute(name, String(value));
    }
    _validateValues(values) {
      for (const [id, value] of Object.entries(values)) {
        const range = this.ranges.get(id);
        if (!range || !Number.isFinite(value) || value < range[0] || value > range[1]) throw new Error('Invalid parameter: ' + id);
      }
    }
    _validateExpressions(data) {
      if (!data || data.schemaVersion !== 'mint-expressions-v2' || !data.emotions || !data.bodyActions) throw new Error('Invalid expression schema');
      this._validateValues(data.neutral);
      if(Object.keys(this.defaults).some(id=>data.neutral[id]!==this.defaults[id]))throw new Error('Canonical neutral must match rig defaults');
      for (const id of EMOTIONS) if (!data.emotions[id]) throw new Error('Required emotion missing: ' + id);
      for (const rec of Object.values(data.emotions)) {
        if(!rec.face||!rec.effects||typeof rec.label!=='string'||rec.body||rec.blend!=='override')throw new Error('Invalid emotion channel');
        this._validateValues(rec.face);this._validateValues(rec.effects);this._validateValues(rec.mesh||{});
        if(Object.keys(rec.mesh||{}).some(id=>!SHAPES.includes(id)))throw new Error('Invalid mesh emotion channel');
        if(Object.keys(rec.face).some(id=>id==='HeadAngleZ'||EFFECTS.includes(id)||SHAPES.includes(id))||Object.keys(rec.effects).some(id=>!EFFECTS.includes(id)))throw new Error('Parameter belongs to another channel');
        if(!data.bodyActions[rec.suggestedAction])throw new Error('Unknown suggested action');
        if (!Number.isFinite(rec.duration) || rec.duration < 0 || rec.duration > 5) throw new Error('Invalid expression duration');
      }
      for(const id of ['rest','sway','bounce','lean-left','lean-right'])if(!data.bodyActions[id])throw new Error('Required action missing: '+id);
      for(const rec of Object.values(data.bodyActions)){
        if(typeof rec.label!=='string'||!rec.values||Object.keys(rec.values).length!==Object.keys(BODY).length-1)throw new Error('Invalid body action');
        for(const key of Object.keys(BODY).filter(k=>k!=='HeadAngleZ')){const v=rec.values[key],r=BODY_RANGES[key];if(!Number.isFinite(v)||v<r[0]||v>r[1])throw new Error('Invalid body coefficient: '+key);}
      }
      if(Object.values(data.bodyActions.rest.values).some(v=>v!==0))throw new Error('Rest action must be zero');
    }
    _prepareEye(side) {
      const group = this.get('eye-' + side), white = this.get(`eye-${side}-white`), lashes = this.get(`eye-${side}-lashes`);
      const aperture = this._new('clipPath', `aperture-${side}`, {clipPathUnits: 'userSpaceOnUse'});
      const aperturePath = create('path'),apertureIrisPath=create('path');
      // The approved iris outline deliberately extends beyond the white at the
      // upper corners. Union its opening bound with the sclera opening; a plain
      // sclera clip would damage 199 canonical pixels.
      aperture.append(aperturePath,apertureIrisPath); this.defs.append(aperture);
      const clipFrame = this._new('g', `eye-${side}-opening`, {'clip-path': `url(#${aperture.id})`});
      const irisFrame = this._new('g', `eye-${side}-gaze`);
      group.insertBefore(clipFrame, this.get(`eye-${side}-iris`)); clipFrame.append(irisFrame);
      irisFrame.append(this.get(`eye-${side}-iris`), this.get(`eye-${side}-iris-outline`));
      const heart=this._new('path',`eye-${side}-heart-overlay`,{d:'M0 23 C-4 23 -25 8 -25 -7 C-25 -24 -7 -28 0 -14 C7 -28 25 -24 25 -7 C25 8 4 23 0 23 Z',fill:'#ec6f94',stroke:'none',opacity:0,'pointer-events':'none','data-overlay':'heart'});
      heart.setAttribute('transform',`translate(${side==='left'?417:652} 618)`);irisFrame.append(heart);
      const star=this._new('path',`eye-${side}-star-overlay`,{d:'M-4 -22 C-2 -29 2 -29 5 -22 L10 -10 L23 -8 C31 -7 31 -3 25 2 L15 11 L17 23 C18 30 14 31 8 27 L0 21 L-10 27 C-16 31 -20 28 -18 21 L-15 10 L-25 1 C-31 -4 -29 -8 -22 -9 L-9 -11 Z',fill:'#ffda62',stroke:'none',opacity:0,'data-overlay':'star'});star.setAttribute('transform',`translate(${side==='left'?417:652} 618)`);irisFrame.append(star);
      const lower=[this.get(`cheek-${side}-dot-inner`),this.get(`cheek-${side}-dot-outer`)];
      const closed = this._new('path', `eye-${side}-closed`, {fill: 'none', stroke: '#080c09', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0});
      group.append(closed);
      return {side, group, white, lashes, aperturePath, apertureIrisPath, aperture, clipFrame, irisFrame, heart, star, lower, closed, center: side === 'left' ? 417 : 652};
    }
    playInteraction(kind,side='left'){this.interactions.play(kind,side);}
    stopInteraction(){this.interactions.stop();this.render();}
    _registerVariant(group,id){
      for(const e of [group,...group.querySelectorAll('*')]){const name=e===group?id:id+'-'+(e.id||'node');e.id=this.prefix+name;e.dataset.sourceId=name;this.nodes.set(name,e);}
      for(const e of group.querySelectorAll('path'))this.rest.set(e,{d:e.getAttribute('d'),commands:parsePath(e.getAttribute('d'))});
    }
    setPartVariant(slot,pose,duration=.38){if(!this.parts)throw new Error('Part library unavailable');this.parts.set(slot,pose,duration);}
    setPartVariantsEnabled(enabled){if(this.parts){this.parts.enabled=Boolean(enabled);this.parts.retarget(.38);this.render();}}
    _prepareMouth() {
      const group = this.get('mouth'); this.lip = this.get('mouth-neutral');
      this.restLip = refineLip(this.rest.get(this.lip).commands.flatMap(c => c.v));
      this.smileLip = refineLip([512,678,518,686,526,688,535,681,544,688,552,686,558,678]);
      this.frownLip = refineLip([516,686,522,680,525,681,529,685,533,689,536,681,540,683,544,684,547,688,553,684]);
      this.roundLip = refineLip([522,686,522,675,528,671,535,671,542,671,548,675,548,686]);
      this.cavity = this._new('path','mouth-cavity',{fill:'#603638',stroke:'none',opacity:0});
      this.lowerLip = this._new('path','mouth-lower-lip',{fill:'none',stroke:'#090d09','stroke-width':6,'stroke-linecap':'round',opacity:0});
      const clip = this._new('clipPath','mouth-interior-clip',{clipPathUnits:'userSpaceOnUse'});
      this.cavityClip = create('path'); clip.append(this.cavityClip); this.defs.append(clip);
      this.tongue = this._new('path','mouth-tongue',{fill:'#f1adb5',stroke:'none','clip-path':`url(#${clip.id})`,opacity:0});
      group.insertBefore(this.cavity,this.lip); group.insertBefore(this.tongue,this.lip); group.append(this.lowerLip);
    }
    _prepareEffects() {
      this.blush = this._new('g','expression-blush',{opacity:0,stroke:'none'});
      this.blush.append(create('ellipse',{cx:370,cy:699,rx:25,ry:11,fill:'#f3a3ae'}),create('ellipse',{cx:699,cy:699,rx:25,ry:11,fill:'#f3a3ae'}));
      this.get('face').insertBefore(this.blush,this.get('mouth'));
      this.effects = this._new('g','tear-effects',{opacity:0,'data-overlay':'tears','pointer-events':'none'});
      this.headSlots[3].before(this.effects);
      this.tearPaths = [0,1].map(i => {
        const g = create('g'); const stream = create('path',{fill:'#8cd3e3',stroke:'none'});
        const light = create('path',{fill:'none',stroke:'#f5ffff','stroke-width':2,'stroke-linecap':'round'});
        const pool=create('path',{fill:'#a3dfe9',stroke:'none'});
        const drop = create('path',{d:'M0 -9 C-3 -5 -9 0 -9 5 C-9 16 9 16 9 5 C9 0 3 -5 0 -9 Z',fill:'#9edceb',stroke:'#d7f4f6','stroke-width':1.4});
        const glint=create('path',{d:'M-4 0 C-6 3 -6 6 -4 8',fill:'none',stroke:'#ffffff','stroke-width':2.3,'stroke-linecap':'round'});
        const clip=this._new('clipPath','tear-trail-reveal-'+i,{clipPathUnits:'userSpaceOnUse'}),reveal=create('rect');clip.append(reveal);this.defs.append(clip);stream.setAttribute('clip-path',`url(#${clip.id})`);
        g.append(stream,pool,light,drop,glint); this.effects.append(g); return {g,pool,stream,light,drop,glint,reveal};
      });
    }
    // Retarget from both current position and velocity. The carried velocity
    // decays over 180 ms; bounded parameters remain within the authored range.
    _channel(r,id,time,range,velocity=false){
      if(!r.duration||time>=r.at+r.duration)return velocity?0:r.to[id];
      const age=Math.max(0,time-r.at),t=age/r.duration,w=t*t*(3-2*t),tau=Math.min(.18,r.duration),u=Math.min(1,age/tau),v=r.velocity?.[id]||0;
      const carry=age*(1-u)**3,raw=lerp(r.from[id],r.to[id],w)+v*carry;
      if(velocity){if(raw<range[0]||raw>range[1])return 0;return (r.to[id]-r.from[id])*6*t*(1-t)/r.duration+v*(1-u)**2*(1-4*u);}
      return clamp(raw,...range);
    }
    _sample(time = this.clock) {
      const values={};for(const [id,range]of this.ranges)values[id]=this._channel(this.transition,id,time,range);
      values.HeadAngleZ=this._sampleBody(time).HeadAngleZ;return values;
    }
    _prepareFullBody(){
      // Every sleeve point is evaluated in shoulder coordinates, including
      // nested decorations with authored translate/scale transforms.
      this.arms=['left','right'].map((side,i)=>{
        const group=this.get('arm-'+side),shoulder=i?[664,836]:[405,836],elbow=i?[739,945]:[330,945],palm=i?[846,1049]:[229,1049];
        return {side,group,shoulder,elbow,palm};
      });
      this.shortSlot=this._wrap(this.get('shorts'),'shorts-pose');this.tailSlot=this._wrap(this.get('tail-back'),'tail-pose');this.tailBone=this._wrap(this.get('tail-back'),'tail-root-bone');
      this.legData=['left','right'].map((side,i)=>({side,hip:i?[608,1146]:[446,1146],ankle:i?[615,1270]:[441,1270],knee:i?[612,1208]:[443,1208],paths:[...this.get('leg-'+side).querySelectorAll('path')],cross:this._wrap(this.get('sock-'+side+'-cross'),'sock-'+side+'-pose'),foot:this._wrap(this.get('foot-'+side),'foot-'+side+'-pose')}));
      this.legData.forEach(leg=>{leg.upperLength=Math.hypot(leg.knee[0]-leg.hip[0],leg.knee[1]-leg.hip[1]);leg.lowerLength=Math.hypot(leg.ankle[0]-leg.knee[0],leg.ankle[1]-leg.knee[1]);});
      this.armDiagnostics=[];
    }
    _rotatePoint(p,pivot,angle){const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=p[0]-pivot[0],y=p[1]-pivot[1];return [pivot[0]+x*c-y*s,pivot[1]+x*s+y*c];}
    _meshPathRecords(group,nodes){
      return nodes.map(node=>{
        let matrix=new DOMMatrix(),parent=node.parentElement;
        while(parent&&parent!==group){const t=parent.transform?.baseVal.consolidate();if(t)matrix=new DOMMatrix([t.matrix.a,t.matrix.b,t.matrix.c,t.matrix.d,t.matrix.e,t.matrix.f]).multiply(matrix);parent=parent.parentElement;}
        const commands=this.rest.get(node).commands.map(c=>({cmd:c.cmd,points:Array.from({length:c.v.length/2},(_,i)=>{const p=new DOMPoint(c.v[i*2],c.v[i*2+1]).matrixTransform(matrix);return[p.x,p.y];})}));
        return{node,matrix,inverse:matrix.inverse(),commands};
      });
    }
    _newPartMesh(id,group,nodes,options){
      const records=this._meshPathRecords(group,nodes),points=records.flatMap(r=>r.commands.flatMap(c=>c.points));
      const mesh=new TriangleMesh(id,points,options);
      for(const record of records){record.meshId=id;for(const c of record.commands)c.bindings=c.points.map(p=>mesh.bind(p));}
      this.meshes.push(mesh);return{mesh,records};
    }
    _prepareMeshRig(){
      this.meshes=[];this.rigDebug={bones:false,mesh:false};
      this.arms.forEach(arm=>{
        const dx=arm.palm[0]-arm.shoulder[0],dy=arm.palm[1]-arm.shoulder[1],length=Math.hypot(dx,dy),axis=[dx/length,dy/length];
        const result=this._newPartMesh('arm-'+arm.side,arm.group,[...arm.group.querySelectorAll('path')],{columns:14,rows:6,origin:arm.shoulder,axis,weights:p=>{
          const t=(p[0]-arm.shoulder[0])*axis[0]+(p[1]-arm.shoulder[1])*axis[1],pin=1-smooth(15,90,t),lower=smooth(95,195,t);
          return{root:pin,upper:(1-pin)*(1-lower),lower:(1-pin)*lower};
        }});arm.mesh=result.mesh;arm.meshPaths=result.records;arm.palmBinding=arm.mesh.bind(arm.palm);
      });
      this.legData.forEach(leg=>{
        const result=this._newPartMesh('leg-'+leg.side,this.get('leg-'+leg.side),leg.paths,{columns:5,rows:9,weights:p=>{const w=smooth(1190,1230,p[1]);return{upper:1-w,lower:w};}});
        leg.mesh=result.mesh;leg.meshPaths=result.records;leg.crossBinding=leg.mesh.bind([leg.side==='left'?446:609,1205]);
        leg.footMesh=this._newPartMesh('foot-'+leg.side,this.get('foot-'+leg.side),[...this.get('foot-'+leg.side).querySelectorAll('path')],{columns:5,rows:5,weights:()=>({foot:1})});
      });
      this.torsoMesh=this._newPartMesh('torso',this.get('torso'),[...this.get('torso').querySelectorAll('path')],{columns:8,rows:10,weights:p=>{const chest=1-smooth(820,1135,p[1]);return{pelvis:1-chest,chest};}});
      this.hairMeshes=[this._newPartMesh('hair-front',this.get('front-hair'),this.frontPaths,{columns:14,rows:12,weights:p=>{const tip=clamp((p[1]-260)/550,0,1)**2;return{root:1-tip,tip};}}),this._newPartMesh('hair-back',this.get('back-hair'),this.backPaths,{columns:12,rows:8,weights:p=>{const tip=clamp((p[1]-590)/295,0,1)**2;return{root:1-tip,tip};}})];
      this.faceMesh=this._newPartMesh('face-contour',this.get('face'),[this.get('face-base')],{columns:10,rows:10,weights:p=>{const cheek=smooth(540,690,p[1])*(1-smooth(710,760,p[1]));return{root:1-cheek,cheek};}});
      this.tailMesh=this._newPartMesh('tail',this.get('tail-back'),[...this.get('tail-back').querySelectorAll('path')],{columns:14,rows:8,weights:p=>{const u=smooth(695,945,p[0]);return{root:(1-u)**2,mid:2*u*(1-u),tip:u*u};}});
      this.meshDebugLayer=this._new('g','mesh-debug',{'pointer-events':'none',display:'none',fill:'none','stroke-width':1.2});this.root.append(this.meshDebugLayer);
      this.debugParts=new Map();for(const mesh of this.meshes){const g=create('g'),tri=create('path',{stroke:'#14a9ad','stroke-opacity':.7}),bones=create('path',{stroke:'#ed5477','stroke-width':4,'stroke-linecap':'round'});g.append(tri,bones);this.meshDebugLayer.append(g);this.debugParts.set(mesh.id,{g,tri,bones});}
    }
    _writeMeshPaths(mesh,records,canonical=false){
      for(const record of records){
        if(canonical){this._set(record.node,'d',this.rest.get(record.node).d);continue;}
        const d=record.commands.map(c=>c.cmd+c.bindings.map(binding=>{
          const p=mesh.sample(binding),q=new DOMPoint(...p).matrixTransform(record.inverse);return number(q.x)+' '+number(q.y);
        }).join(' ')).join(' ');this._set(record.node,'d',d);
      }
    }
    _renderHairMeshes(){
      const still=this.springs.every(s=>Math.abs(s.x)+Math.abs(s.y)<1e-9)&&this.frameBase.HairFlare===0;
      this.hairMeshes.forEach((entry,i)=>{entry.mesh.deform(p=>this._hairPoint(...p,Boolean(i)));this._writeMeshPaths(entry.mesh,entry.records,still);});
      // The clip sits on the moving left lock, so follow its deformed socket.
      const clip=this.get('hair-cross-clip'),p=this.hairMeshes[0].mesh.sample(this.hairMeshes[0].mesh.bind([294,482]));
      this._set(clip,'transform',still?'translate(294 482) scale(1.8)':`translate(${number(p[0])} ${number(p[1])}) scale(1.8)`);
    }
    _renderTorsoMesh(d){
      const shape=this.frameSquash,puff=this.frameBase.CheekPuff;
      this.torsoMesh.mesh.deform((p,w)=>{
        const bell=w.chest*(1-w.chest)*4;
        return[p[0]+(p[0]-534)*(.006*d.breath+.075*shape)*bell,p[1]+(18*shape+d.body.ShoulderDrop)*w.chest];
      });
      this._writeMeshPaths(this.torsoMesh.mesh,this.torsoMesh.records,Math.abs(d.breath)+Math.abs(shape)+Math.abs(d.body.ShoulderDrop)<1e-9);
      this.faceMesh.mesh.deform((p,w)=>[p[0]+(p[0]-534)*.055*puff*w.cheek,p[1]-4*puff*w.cheek]);
      this._writeMeshPaths(this.faceMesh.mesh,this.faceMesh.records,puff===0);
    }
    _renderTailMesh(d){
      const body=d.body,motion=this.options.reducedMotion?0:1,phase=((this.beatPhase%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
      const pulse=start=>phase<start||phase>start+.8?0:phase<start+.18?smooth(start,start+.18,phase):1-smooth(start+.18,start+.8,phase);
      const flick=motion*body.TailFlick*(pulse(.2)+pulse(1.25))*26;
      const straight=body.TailStraight;
      const swing=(1-straight)*motion*(body.TailSwing*2.6*Math.sin(this.clock*1.65-.55)+this.idleGain*2.3*Math.sin(this.clock*1.45)+this.tailSpring.x),droop=body.TailDroop,curve=this.frameBase.TailCurve*(1-straight);
      const root=[675,1120],mid=[790,1180],rootAngle=swing+droop*43,tipAngle=(1-straight)*(droop*4+flick);
      this._set(this.tailBone,'transform',Math.abs(rootAngle)<1e-9?null:`rotate(${number(rootAngle)} 675 1120)`);
      this.tailMesh.mesh.deform((p,w)=>{
        const u=clamp((p[0]-675)/253,0,1),pin=smooth(690,830,p[0]),b=this._rotatePoint(p,mid,tipAngle);
        // Authored rest centre line is unbent into a horizontal taper for startle.
        const centre=1120+107*u+38*Math.sin(Math.PI*u);
        return[p[0]+(b[0]-p[0])*pin+straight*(p[0]-675)*.25,
          p[1]+(b[1]-p[1])*pin+u*u*(curve*24+droop*4)-straight*(centre-1120)];
      });
      this._writeMeshPaths(this.tailMesh.mesh,this.tailMesh.records,Math.abs(tipAngle)+Math.abs(curve)+straight+droop<1e-9);
      const map=p=>this._rotatePoint(this.tailMesh.mesh.sample(this.tailMesh.mesh.bind(p)),root,rootAngle);
      this.tailEvaluated={swing,droop,flick,curve,straight,rootAngle,tipAngle,tip:map([928,1224]),root:map(root),metrics:{...this.tailMesh.mesh.metrics}};
    }

    setRigDebug({bones=this.rigDebug.bones,mesh=this.rigDebug.mesh}={}){this.rigDebug={bones:Boolean(bones),mesh:Boolean(mesh)};this.render();}
    exportMeshes(){return{legBones:this.legData.map(l=>({side:l.side,rest:{hip:l.hip,knee:l.knee,ankle:l.ankle},lengths:[l.upperLength,l.lowerLength],pose:l.pose,skinning:'fixed-length two-bone solve, volume-preserving centerline knee corrective, rigid ankle boot'})),tailBones:{root:{pivot:[675,1120],node:this.tailBone.id,angle:this.tailEvaluated?.rootAngle||0},tip:{pivot:[790,1180],angle:this.tailEvaluated?.tipAngle||0},skinning:'rigid root parent + local distal mesh bend'},schemaVersion:'mint-triangle-mesh-v1',coordinateSpace:'source SVG user units before owning part bone transform',meshes:this.meshes.map(m=>m.export()),bindings:[...this.arms.flatMap(a=>a.meshPaths),...this.legData.flatMap(l=>[...l.meshPaths,...l.footMesh.records]),...this.torsoMesh.records,...this.tailMesh.records,...this.faceMesh.records,...this.hairMeshes.flatMap(h=>h.records),...(this.parts?.entries.flatMap(e=>e.records)||[])].map(r=>({meshId:r.meshId,sourceId:r.node.dataset.sourceId,commands:r.commands.map(c=>({command:c.cmd,bindings:c.bindings}))}))};}
    _renderMeshDebug(){
      const on=this.rigDebug.bones||this.rigDebug.mesh;this._set(this.meshDebugLayer,'display',on?null:'none');if(!on)return;
      const segment=(a,b)=>`M${a.map(number).join(' ')} L${b.map(number).join(' ')}`;
      for(const mesh of this.meshes){
        const part=this.debugParts.get(mesh.id);if(!part)continue;let transform=null,bones='';
        if(mesh.id.startsWith('arm-')){const arm=this.arms.find(a=>'arm-'+a.side===mesh.id),diag=this.armDiagnostics.find(a=>a.side===arm.side);transform=arm.group.parentElement.getAttribute('transform');bones=segment(diag.shoulder,diag.elbow)+' '+segment(diag.elbow,diag.palm);}
        else if(mesh.id.startsWith('leg-')){const leg=this.legData.find(a=>'leg-'+a.side===mesh.id);const p=leg.pose;bones=segment(p.hip,p.knee)+' '+segment(p.knee,p.ankle);}
        else if(mesh.id.startsWith('foot-')){const leg=this.legData.find(a=>'foot-'+a.side===mesh.id);transform=leg.foot.getAttribute('transform');bones=segment(leg.ankle,[leg.ankle[0],1390]);}
        else if(mesh.id==='torso'){transform=this.get('torso').parentElement.getAttribute('transform');bones=segment([534,1146],[534,836]);}
        else if(mesh.id==='tail'){transform=(this.tailSlot.getAttribute('transform')||'')+' '+(this.tailBone.getAttribute('transform')||'');const chain=[[675,1120],[790,1180],[928,1224]].map(p=>mesh.sample(mesh.bind(p)));bones=segment(chain[0],chain[1])+' '+segment(chain[1],chain[2]);}
        else if(mesh.id==='face-contour'){transform=this.headSlots[1].getAttribute('transform');}
        else{transform=this.headSlots[mesh.id==='hair-front'?2:0].getAttribute('transform');const h=mesh.id==='hair-front'?[534,280]:[534,600],tip=mesh.sample(mesh.bind([534,mesh.id==='hair-front'?790:870]));bones=segment(h,tip);}
        this._set(part.g,'transform',transform);this._set(part.tri,'display',this.rigDebug.mesh?null:'none');this._set(part.bones,'display',this.rigDebug.bones?null:'none');
        this._set(part.tri,'d',mesh.edges.map(([a,b])=>segment(mesh.positions[a],mesh.positions[b])).join(' '));this._set(part.bones,'d',bones);
      }
    }
    _skinArm(arm,target,amount){
      // Mesh skinning owns every sleeve/hand path. Poses are authored as
      // bounded shoulder/elbow rotations, not unreachable face contacts.
      const S=arm.shoulder,E=arm.elbow,P=arm.palm,side=arm.side==='left'?1:-1;
      const upper=arm.pose.upper,lower=arm.pose.lower;
      const elbow=this._rotatePoint(E,S,upper);
      const lowerMap=p=>{const q=this._rotatePoint(p,E,upper+lower);return[q[0]+elbow[0]-E[0],q[1]+elbow[1]-E[1]];};
      arm.mesh.deform((p,w)=>{
        const dx=E[0]-S[0],dy=E[1]-S[1],len=Math.hypot(dx,dy),axis=[dx/len,dy/len],normal=[-axis[1],axis[0]];
        const t=(p[0]-S[0])*axis[0]+(p[1]-S[1])*axis[1],width=(p[0]-S[0])*normal[0]+(p[1]-S[1])*normal[1];
        const volume=this.frameBase.SleevePuff*.24*smooth(10,80,t)*(1-smooth(180,260,t));
        const shaped=[p[0]+normal[0]*width*volume,p[1]+normal[1]*width*volume];
        const a=this._rotatePoint(shaped,S,upper),b=lowerMap(shaped);
        return[0,1].map(k=>shaped[k]*w.root+a[k]*w.upper+b[k]*w.lower);
      });
      this._writeMeshPaths(arm.mesh,arm.meshPaths,Math.abs(upper)+Math.abs(lower)+Math.abs(this.frameBase.SleevePuff)<1e-9);
      const palm=arm.mesh.sample(arm.palmBinding);
      return{side:arm.side,target:palm,palm,elbow,shoulder:S,error:0,clamped:arm.mesh.metrics.correctionScale<.99999,upper,lower,mesh:arm.mesh.metrics};
    }
    _renderFullBody(d,headLocal){
      const body=d.body,motion=this.options.reducedMotion?0:1,phase=Math.sin(this.beatPhase),fast=Math.sin(this.beatPhase*2.5);
      const twist=motion*body.Twist*Math.sin(this.beatPhase*.72);
      const angle=body.Torso+motion*body.TorsoSway*phase+twist*1.6;
      const crouch=body.Crouch+motion*body.Sob*(1+fast)*1.5+Math.max(0,body.Stance)*15+Math.abs(Math.sin(angle*Math.PI/180))*83;
      const spine=(angle===0&&crouch===0?'':`translate(0 ${number(crouch)}) rotate(${number(angle)} 534 1146)`)+(twist?` translate(534 1146) skewX(${number(twist*.25)}) translate(-534 -1146)`:'');
      const shapeY=18*this.frameSquash;
      const h=(shapeY?`translate(0 ${number(shapeY)}) `:'')+(headLocal||'')+(twist?` rotate(${number(-twist*1.4)} 534 772)`:'');this.headSlots.forEach(g=>this._set(g,'transform',(spine+' '+h).trim()||null));this._set(this.effects,'transform',(spine+' '+h).trim()||null);
      const b=d.breath,y=d.bodyY+motion*body.Sob*(fast+.35*Math.sin(this.beatPhase*5))*(-1.6);
      const breath=Math.abs(b)+Math.abs(y)<1e-8?'':`translate(534 ${number(1125+y)}) scale(${number(1+.002*b)} ${number(1+.007*b)}) translate(-534 -1125)`;
      const torso=(spine+' '+breath).trim()||null;this.breathSlots.forEach(g=>this._set(g,'transform',((torso||'')+(g===this.get('torso').parentElement||!(shapeY+body.ShoulderDrop)?'':` translate(0 ${number(shapeY+body.ShoulderDrop)})`)).trim()||null));
      this._set(this.shortSlot,'transform',spine||null);
      const tail=motion*body.TailSwing*Math.sin(this.beatPhase-.55);
      this._set(this.tailSlot,'transform',spine||null);
      const bag=motion*(body.TorsoSway*.7+body.ArmBeat*.05)*Math.sin(this.beatPhase-.6);
      this._set(this.bagSlot,'transform',(spine+` translate(0 ${number(-1.4*b+y+shapeY*.55)})`+(bag?` rotate(${number(bag)} 534 810)`:'')).trim());
      this.armDiagnostics=this.arms.map((arm,i)=>{
        const sign=i?-1:1,beat=motion*body.ArmBeat*phase;
        // Broad source sleeves tolerate a limited bend. Hand-to-face motion
        // is replaced by a small connected arm gesture, not a false IK lock.
        arm.pose={upper:sign*(body[i?'ArmR':'ArmL']*.45+beat*.25+body.CheekReach*18+(i?body.Wave*(10+motion*5*Math.sin(this.beatPhase*2.5)):0)),
          lower:sign*(-body.CheekReach*26-(i?body.MouthReach*30:0)+beat*.15)};
        return this._skinArm(arm,null,1);
      });
      this.legData.forEach((leg,i)=>{
        const side=i?1:-1,stance=body.Stance;
        // Wide poses spread at the ankle; close poses respect the original
        // broad boots. Lift has zero velocity on contact/release.
        const beat=Math.max(0,Math.sin(this.beatPhase+(i?Math.PI:0)));
        const lift=motion*body.FootStep*3*beat*beat;
        const stepX=side*(Math.max(0,stance)*45+Math.min(0,stance)*4);
        const footAngle=-side*Math.max(0,stance)*9;
        const soleRise=Math.abs(Math.sin(footAngle*Math.PI/180))*82+(Math.cos(footAngle*Math.PI/180)-1)*153;
        const hip=this._rotatePoint(leg.hip,[534,1146],angle);hip[1]+=crouch;
        const target=[leg.ankle[0]+stepX,leg.ankle[1]-lift-soleRise];
        const dx=target[0]-hip[0],dy=target[1]-hip[1],raw=Math.hypot(dx,dy);
        const L1=leg.upperLength,L2=leg.lowerLength,dist=clamp(raw,Math.abs(L1-L2)+.001,L1+L2);
        const ankle=[hip[0]+dx*dist/(raw||1),hip[1]+dy*dist/(raw||1)];
        const along=(L1*L1-L2*L2+dist*dist)/(2*dist),height=Math.sqrt(Math.max(0,L1*L1-along*along));
        // A stable pole prevents knees flipping when the legs straighten.
        const knee=[hip[0]+dx/(raw||1)*along+side*dy/(raw||1)*height,hip[1]+dy/(raw||1)*along-side*dx/(raw||1)*height];
        const angleOf=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
        const upper=angleOf(hip,knee)-angleOf(leg.hip,leg.knee),lower=angleOf(knee,ankle)-angleOf(leg.knee,leg.ankle);
        const map=(p,pivot,joint,rotation)=>{const q=this._rotatePoint(p,pivot,rotation);return[q[0]+joint[0]-pivot[0],q[1]+joint[1]-pivot[1]]};
        const rest=Math.abs(angle)+crouch+lift+Math.abs(stance)<1e-9;
        // Broad chibi socks need a volume-preserving corrective around the
        // solved chain; full elbow-like skin weights would fold their width.
        const rx=leg.ankle[0]-leg.hip[0],ry=leg.ankle[1]-leg.hip[1],restLength=Math.hypot(rx,ry),ux=rx/restLength,uy=ry/restLength;
        const vx=(ankle[0]-hip[0])/dist,vy=(ankle[1]-hip[1])/dist;
        const kmid=[(hip[0]+ankle[0])*.5,(hip[1]+ankle[1])*.5];
        leg.mesh.deform(p=>{if(rest)return [...p];const x=p[0]-leg.hip[0],y=p[1]-leg.hip[1],t=(x*ux+y*uy)/restLength,width=-x*uy+y*ux,soft=Math.sin(Math.PI*clamp(t,0,1))**2*.12;
          const shaped=[hip[0]+vx*t*dist-vy*width+(knee[0]-kmid[0])*soft,hip[1]+vy*t*dist+vx*width+(knee[1]-kmid[1])*soft];
          // Both edges of the sock opening share the boot's ankle frame.
          // A common center alone leaves wedges when the boot turns outward.
          const distal=smooth(1195,1250,p[1]),boot=map(p,leg.ankle,ankle,footAngle);
          return[0,1].map(k=>lerp(shaped[k],boot[k],distal));},p=>{
          if(rest)return [...p];
          // The mesh guard relaxes toward an attached garment frame, never
          // toward the unmoved leg. Both opening edges remain boot-local.
          const boot=map(p,leg.ankle,ankle,footAngle),bootHip=map(leg.hip,leg.ankle,ankle,footAngle),root=1-clamp((p[1]-leg.hip[1])/(1250-leg.hip[1]),0,1);
          return[0,1].map(k=>boot[k]+(hip[k]-bootHip[k])*root);
        });
        this._writeMeshPaths(leg.mesh,leg.meshPaths,rest);
        const cross=leg.mesh.sample(leg.crossBinding),cx=leg.side==='left'?446:609;
        this._set(leg.cross,'transform',rest?null:`translate(${number(cross[0]-cx)} ${number(cross[1]-1205)}) rotate(${number((upper+lower)*.5)} ${cx} 1205)`);
        // The boot is a rigid ankle child: all motifs and outlines share one
        // transform instead of shearing its large rounded silhouette.
        leg.footMesh.mesh.deform(p=>[...p]);this._writeMeshPaths(leg.footMesh.mesh,leg.footMesh.records,true);
        this._set(leg.foot,'transform',rest?null:`translate(${number(ankle[0]-leg.ankle[0])} ${number(ankle[1]-leg.ankle[1])}) rotate(${number(footAngle)} ${leg.ankle[0]} ${leg.ankle[1]})`);
        leg.pose={hip:rest?[...leg.hip]:hip,knee:rest?[...leg.knee]:knee,ankle:rest?[...leg.ankle]:ankle,target,upper:rest?0:upper,lower:rest?0:lower,footAngle,contactError:rest?0:Math.hypot(ankle[0]-target[0],ankle[1]-target[1]),lift};
      });
      this.fullBodyEvaluated={legs:this.legData.map(l=>l.pose),twist,torsoAngle:angle,crouch,arms:this.armDiagnostics,footLift:this.legData.map((_,i)=>motion*body.FootStep*Math.max(0,Math.sin(this.beatPhase+(i?Math.PI:0)))),tailAngle:tail};
    }
    _sampleBody(time=this.clock){
      return Object.fromEntries(Object.keys(BODY).map(id=>[id,this._channel(this.bodyTransition,id,time,BODY_RANGES[id])]));
    }
    _checkDuration(duration){if(!Number.isFinite(duration)||duration<0||duration>5)throw new Error('Invalid transition duration');}
    _retargetBody(to,duration){
      this._checkDuration(duration);const velocity=Object.fromEntries(Object.keys(BODY).map(id=>[id,this._channel(this.bodyTransition,id,this.clock,BODY_RANGES[id],true)]));this.bodyTransition={from:this._sampleBody(),to:{...to},velocity,at:this.clock,duration};
      this.target.HeadAngleZ=to.HeadAngleZ;this.render();
    }
    setBodyParameter(id,value,duration=.3){
      if(!['Stance','FootStep'].includes(id)||!Number.isFinite(value)||value<BODY_RANGES[id][0]||value>BODY_RANGES[id][1])throw new Error('Invalid leg control');
      this._retargetBody({...this.bodyTransition.to,[id]:value},duration);
    }
    setAction(id,intensity=1,duration=.65){
      const rec=this.expressions.bodyActions[id];
      if(!rec||!Number.isFinite(intensity)||intensity<0||intensity>1)throw new Error('Invalid action or intensity');
      this._checkDuration(duration);this.action=id;this.actionIntensity=intensity;this.parts?.retarget(duration===0?0:Math.min(.38,duration));
      this._retargetBody({HeadAngleZ:this.bodyTransition.to.HeadAngleZ,...Object.fromEntries(Object.entries(rec.values).map(([key,v])=>[key,v*intensity]))},duration);
    }
    _retarget(target, duration) {
      this._validateValues(target);
      if(!Number.isFinite(duration)||duration<0||duration>5) throw new Error('Invalid transition duration');
      const from=this._sample(); this.target={...target,HeadAngleZ:this.bodyTransition.to.HeadAngleZ};
      const velocity=Object.fromEntries([...this.ranges].map(([id,range])=>[id,this._channel(this.transition,id,this.clock,range,true)]));this.transition={from,to:{...target},velocity,at:this.clock,duration}; this.render();
    }
    _expressionTarget() {
      const rec=this.expressions.emotions[this.emotion], authored={...this.defaults,...rec.face,...rec.effects,...rec.mesh};
      return Object.fromEntries(Object.keys(this.defaults).map(id=>[id,lerp(this.defaults[id],authored[id],this.intensity)]));
    }
    setEmotion(id,intensity=1,duration=this.config.transition.durationSeconds) {
      if(!this.expressions.emotions[id]||!Number.isFinite(intensity)||intensity<0||intensity>1) throw new Error('Invalid emotion or intensity');
      this._checkDuration(duration);
      this.emotion=id; this.intensity=intensity; this.manual={}; this._retarget(this._expressionTarget(),duration);
    }
    setParameter(id,value,duration=.12) { this.setParameters({[id]:value},duration); }
    setParameters(values,duration=.12) {
      this._validateValues(values);this._checkDuration(duration);
      const face={...values};delete face.HeadAngleZ;
      if('HeadAngleZ' in values)this._retargetBody({...this.bodyTransition.to,HeadAngleZ:values.HeadAngleZ},duration);
      if(Object.keys(face).length){Object.assign(this.manual,face);this._retarget({...this._expressionTarget(),...this.manual},duration);}
    }
    releaseManual(duration=.3) { this.manual={};this._retarget(this._expressionTarget(),duration); }
    setGaze(x,y) {
      if(!Number.isFinite(x)||!Number.isFinite(y)) throw new Error('Nonfinite gaze');
      this.gaze.targetX=clamp(x,-1,1);this.gaze.targetY=clamp(y,-1,1);
    }
    gazeFromClient(clientX,clientY) {
      const m=this.headSlots[1].getScreenCTM(); if(!m)return;
      const point=new DOMPoint(clientX,clientY).matrixTransform(m.inverse());
      this.setGaze((point.x-534)/240,(point.y-610)/210);
    }
    setLipSync(level,vowel=null) {
      if(!Number.isFinite(level)||level<0||level>1||![null,"A","I","U","E","O"].includes(vowel))throw new Error("Invalid lip-sync input");
      this.speech.enabled=true;this.speech.target=level;this.speech.vowel=vowel;
    }
    stopLipSync(){this.speech.enabled=false;this.speech.target=0;}
    blink() { this.manualBlinkAt=this.clock; this.render(); }
    setIdle(enabled) { this.options.idle=Boolean(enabled); }
    setTracking(enabled) { this.options.tracking=Boolean(enabled); if(!enabled)this.setGaze(0,0); }
    setReducedMotion(enabled) {
      this.options.reducedMotion=Boolean(enabled);
      if(enabled){this.tailSpring={x:0,v:0};this.armSecondary={x:0,v:0};this.idleGain=0;this.springs.forEach(s=>{s.x=0;s.v=0;s.y=0;s.vy=0;});}
      this.render();
    }
    pause() { this.paused=true; }
    resume() { this.paused=false;this.lastTimestamp=null; }
    reset({canonical=false}={}) {
      this.interactions?.reset();this.speech={enabled:false,target:0,value:0,mix:0,vowel:null,gain:.9,vowelOpen:1,vowelRound:0};this.parts?.reset();this.clock=0;this.beatPhase=0;this.emotion='neutral';this.intensity=1;this.manual={};this.target={...this.defaults};
      this.action='rest';this.actionIntensity=1;this.bodyTransition={from:{...BODY},to:{...BODY},at:0,duration:0};
      this.transition={from:{...this.defaults},to:{...this.defaults},at:0,duration:0};
      this.gaze={x:0,y:0,targetX:0,targetY:0};this.manualBlinkAt=-100;
      this.springs.forEach(s=>{s.x=0;s.v=0;s.y=0;s.vy=0;});this.previousHead=0;this.lastHeadVelocity=0;this.previousBodyY=0;this.lastBodyVelocity=0;this.tailSpring={x:0,v:0};this.armSecondary={x:0,v:0};
      if(canonical){this.options.idle=false;this.options.tracking=false;this.paused=true;}
      this.idleGain=this.options.idle&&!this.options.reducedMotion?1:0;this.lastTimestamp=null;this.render();
    }
    seek(seconds) {
      if(!Number.isFinite(seconds)||seconds<0||seconds>86400)throw new Error('Invalid timeline time');
      this.tailSpring={x:0,v:0};this.armSecondary={x:0,v:0};this.clock=seconds;this.beatPhase=seconds*(1.8+this._sampleBody().Tempo);const base=this._sample(),drivers=this._drivers(base);
      this.springs.forEach((s,i)=>{const t=this._hairTarget(drivers,i,0,0);s.x=t[0];s.y=t[1];s.v=0;s.vy=0;});
      this.previousHead=drivers.head;this.previousBodyY=this._hairBodyY(drivers);this.lastHeadVelocity=0;this.lastBodyVelocity=0;this.render();
    }
    _shapeSquash(base,d){return clamp(base.BodySquash+(this.options.reducedMotion?0:d.body.Bob*.13*Math.sin(this.beatPhase)+d.body.Sob*.2*Math.sin(this.beatPhase*2.5)),-1.2,1.2);}
    _hairBodyY(d){return d.bodyY-3.4*d.breath+18*this._shapeSquash(this._sample(),d)+d.body.Crouch;}
    _hairTarget(d,i,velocity,bodyVelocity){
      if(this.options.reducedMotion)return[0,0];
      const wave=d.body.HairSwing*Math.sin(this.beatPhase-i*.6);
      return[clamp(-d.head*[1.5,.9,1.7][i]-velocity*[.24,.16,.28][i]+wave*3,-30,30),
        clamp(-bodyVelocity*[.32,.2,.38][i]-d.breath*2+wave*[1.4,.85,1.7][i],-22,22)];
    }
    _blinkEnvelope(t) {
      if(t<0||t>.26)return 0;
      return t<.095?smooth(0,.095,t):1-smooth(.11,.26,t);
    }
    _drivers(base) {
      const reduced=this.options.reducedMotion, gain=reduced?0:this.idleGain;
      const breath=gain*Math.sin(this.clock*1.65);
      const body=this._sampleBody(),phase=Math.sin(this.beatPhase),motionGain=reduced?0:1;
      const clip=this.clock%6.4,window=smooth(.3,.8,clip)*(1-smooth(2.6,3.3,clip));
      const shake=motionGain*body.Nod*window*Math.sin((clip-.4)*5)*2.6,scan=motionGain*body.Scan*window*Math.sin((clip-.4)*1.8),exhale=motionGain*body.Exhale*smooth(.5,1.5,clip)*(1-smooth(2,3.8,clip));
      const scanHead=motionGain*body.Scan*window*Math.sin((clip-.65)*1.8);body.ShoulderDrop+=exhale*2;
      const bodyAngle=body.Tilt+motionGain*body.Sway*phase,bodyY=motionGain*body.Bob*Math.sin(this.beatPhase-.38)*4+exhale*5;
      const contact=this.interactions?.sample()||{poke:0,left:0,right:0};const pointerGain=(this.options.tracking?1:0)*(1-contact.poke),directed=(contact.right-contact.left)*.85;
      return {
        breath,bodyAngle,bodyY,body,
        head:clamp(base.HeadAngleZ+body.Tilt+shake+scanHead*2+motionGain*body.Sway*Math.sin(this.beatPhase-.22)+pointerGain*this.gaze.x*2.2+gain*.28*Math.sin(this.clock*.79),-8,8),
        gazeX:clamp((base.EyeBallX+scan*.65)*(1-contact.poke)+directed+pointerGain*this.gaze.x+gain*.06*Math.sin(this.clock*.61)*(1-contact.poke),-1,1),
        gazeY:clamp(base.EyeBallY*(1-contact.poke)+pointerGain*this.gaze.y+gain*.04*Math.sin(this.clock*.83)*(1-contact.poke),-1,1),
        blink:Math.max(this._blinkEnvelope(this.clock-this.manualBlinkAt),gain*smooth(.05,.35,Math.min(base.EyeLOpen,base.EyeROpen))*this._blinkEnvelope((this.clock%4.9)-2.9))
      };
    }
    _step(dt) {
      const speech=this.speech,shape=({A:[1,.05],I:[.4,0],U:[.62,.9],E:[.68,.05],O:[.82,1]})[speech.vowel]||[1,0];speech.gain=lerp(speech.gain,this.expressions.lipSync?.emotions[this.emotion]?.gain??.9,1-Math.exp(-dt*8));speech.vowelOpen=lerp(speech.vowelOpen,shape[0],1-Math.exp(-dt*18));speech.vowelRound=lerp(speech.vowelRound,shape[1],1-Math.exp(-dt*18)); speech.value=lerp(speech.value,speech.target,1-Math.exp(-dt/(speech.target>speech.value?.045:.11)));speech.mix=lerp(speech.mix,speech.enabled?1:0,1-Math.exp(-dt*14));
      if(!speech.enabled&&speech.mix<1e-6){speech.mix=0;speech.value=0;}
      this.clock+=dt;this.beatPhase+=dt*(1.8+this._sampleBody().Tempo);
      const gainGoal=this.options.idle&&!this.options.reducedMotion?1:0;
      this.idleGain=lerp(this.idleGain,gainGoal,1-Math.exp(-dt*7));
      const response=1-Math.exp(-dt*13);
      this.gaze.x=lerp(this.gaze.x,this.gaze.targetX,response);this.gaze.y=lerp(this.gaze.y,this.gaze.targetY,response);
      const d=this._drivers(this._sample());
      const velocity=dt?clamp((d.head-this.previousHead)/dt,-180,180):0;
      const bodyY=this._hairBodyY(d),bodyVelocity=dt?clamp((bodyY-this.previousBodyY)/dt,-160,160):0;
      this.previousBodyY=bodyY;this.lastBodyVelocity=bodyVelocity;
      this.previousHead=d.head;this.lastHeadVelocity=velocity;
      if(this.options.reducedMotion){this.tailSpring={x:0,v:0};this.armSecondary={x:0,v:0};this.springs.forEach(s=>{s.x=0;s.v=0;s.y=0;s.vy=0;});}
      else {
        const n=Math.max(1,Math.ceil(dt*120)),h=dt/n;
        for(let j=0;j<n;j++){const a=this.armSecondary,target=clamp(-bodyVelocity*.035+d.body.TorsoSway*Math.sin(this.beatPhase)*.8,-3,3);a.v+=(44*(target-a.x)-11*a.v)*h;a.x=clamp(a.x+a.v*h,-4,4);}
        for(let j=0;j<n;j++){const s=this.tailSpring,target=clamp(-bodyVelocity*.045+d.head*.12,-8,8);s.v+=(32*(target-s.x)-8*s.v)*h;s.x=clamp(s.x+s.v*h,-12,12);}
        for(let j=0;j<n;j++)this.springs.forEach((s,i)=>{
          const [tx,ty]=this._hairTarget(d,i,velocity,bodyVelocity),k=[48,72,40][i],damping=[8.5,11,7.8][i];
          s.v+=(k*(tx-s.x)-damping*s.v)*h;s.vy+=(k*(ty-s.y)-damping*s.vy)*h;
          s.x=clamp(s.x+s.v*h,-34,34);s.y=clamp(s.y+s.vy*h,-26,26);
        });
      }
    }
    advance(seconds) {
      if(!Number.isFinite(seconds)||seconds<0||seconds>60)throw new Error('Invalid advance');
      for(let remain=seconds;remain>1e-9;){const dt=Math.min(remain,1/120);this._step(dt);remain-=dt;}
      this.render();
    }
    _loop(timestamp) {
      if(this.disposed)return;
      if(this.lastTimestamp!==null&&!this.paused&&!this.suspended&&!document.hidden)this._step(clamp((timestamp-this.lastTimestamp)/1000,0,.05));
      this.lastTimestamp=timestamp;
      if(!this.paused&&!this.suspended&&!document.hidden)this.render();
      this._raf=requestAnimationFrame(t=>this._loop(t));
    }
    _eyePoint(eye,x,y,base,opening,expanded=false) {
      const sign=eye.side==='left'?1:-1;
      const upper=clamp((632-y)/70,0,1);
      const tension=base.Tension*sign*(x-eye.center)*.2*upper;
      const smileLift=base.EyeSmile*8*clamp((y-632)/45,0,1);
      const lx=eye.side==='left'?x:1068-x,u=clamp((lx-335)/132,0,1);
      const closedCurve=(14-40*base.EyeSmile)*4*u*(1-u)+base.EyeSqueeze*22*(1-Math.abs(2*u-1));
      return [eye.center+(x-eye.center)*(expanded?1.12:1),632+((y-632)*(expanded?1.1:1)+tension-smileLift)*opening+(1-smooth(0,1,opening))*closedCurve];
    }
    _renderEye(eye,base,d) {
      const heldWink=Math.min(base.EyeLOpen,base.EyeROpen)<.05&&Math.abs(base.EyeLOpen-base.EyeROpen)>.3;
      const opening=base[eye.side==='left'?'EyeLOpen':'EyeROpen']*(1-(heldWink?0:d.blink));
      // An undeformed, centered source eye needs no additional aperture mask.
      // Avoid a second antialiasing pass on its approved outline at 2x/4x.
      const originalOpening=opening===1&&base.Tension===0&&base.EyeSmile===0&&d.gazeX===0&&d.gazeY===0;
      this._set(eye.clipFrame,'clip-path',originalOpening?null:`url(#${eye.aperture.id})`);
      const deform=(x,y)=>this._eyePoint(eye,x,y,base,opening);
      this._set(eye.white,'d',mapPath(this.rest.get(eye.white).commands,deform));
      this._set(eye.lashes,'d',mapPath(this.rest.get(eye.lashes).commands,(x,y)=>{
        const q=this._eyePoint(eye,x,y,base,opening);
        const w=1-smooth(0,1,opening);
        return [x,q[1]+(y-574)*.23*w];
      }));
      this._set(eye.aperturePath,'d',mapPath(this.rest.get(eye.white).commands,(x,y)=>this._eyePoint(eye,x,y,base,opening,true)));
      const irisBound=this.rest.get(this.get(`eye-${eye.side}-iris-outline`)).commands;
      this._set(eye.apertureIrisPath,'d',mapPath(eye.side==='right'?reverseClosedCubics(irisBound):irisBound,(x,y)=>this._eyePoint(eye,x,y,base,opening,true)));
      this._set(eye.irisFrame,'transform',Math.abs(d.gazeX)+Math.abs(d.gazeY)<1e-8?null:`translate(${number(d.gazeX*12)} ${number(d.gazeY*8)})`);
      // Preserve the original filled lash topology and outer wing through closure.
      // The target's center line differs for smiling, relaxed and squeezed lids.
      this._set(eye.closed,'opacity','0');
      this._set(eye.white,'opacity',opening<1e-5?'0':null);
      this._set(eye.lashes,'opacity',null);
      this._set(eye.irisFrame,'opacity',opening>=.025?null:number(smooth(0,.025,opening)));
      this._set(eye.heart,'opacity',number(base.HeartEyes));this._set(eye.star,'opacity',number(base.StarEyes));
      const lowerOpacity=smooth(.08,.35,opening);
      for(const node of eye.lower){this._set(node,'opacity',opening===1?null:number(lowerOpacity));this._set(node,'d',opening===1?this.rest.get(node).d:mapPath(this.rest.get(node).commands,(x,y)=>[x,y+(this._eyePoint(eye,x,668,base,opening)[1]-668)]));}
      return opening;
    }
    _renderMouth(base) {
      const speech=this.speech,mix=speech.mix,gain=speech.gain;
      const vowels={A:[1,.05],I:[.4,0],U:[.62,.9],E:[.68,.05],O:[.82,1]},v=[speech.vowelOpen,speech.vowel?speech.vowelRound:base.MouthRound];
      const f=base.MouthForm,open=lerp(base.MouthOpenY,clamp(speech.value*gain*v[0],0,1),mix),round=lerp(base.MouthRound,v[1],mix*.75)*smooth(0,.2,open);
      this.speechEvaluated={enabled:speech.enabled,level:speech.value,mix,open,form:f,round,vowel:speech.vowel};
      let top=this.restLip.map((v,i)=>lerp(v,(f>=0?this.smileLip:this.frownLip)[i],Math.abs(f)));
      top=top.map((v,i)=>lerp(v,this.roundLip[i],round));
      this._set(this.lip,'d',f===0&&open===0?this.rest.get(this.lip).d:pathFromLip(top));
      const left=top.slice(0,2),right=top.slice(-2),cx=(left[0]+right[0])/2;
      const segments=[];let prior=left;
      for(let i=2;i<top.length;i+=6){segments.push([...top.slice(i+2,i+4),...top.slice(i,i+2),...prior]);prior=top.slice(i+4,i+6);}
      const reverse=[...right,...segments.reverse().flat()];
      const belly=lerp(Math.max(left[1],right[1])+24,699,round);
      let target=refineLip([...right,right[0]-1,belly-2,cx+7,belly+2,cx,belly,cx-7,belly-2,left[0]+1,belly-6,...left]);
      const oval=refineLip([548,686,548,698,542,703,535,703,528,703,522,698,522,686]);target=target.map((v,i)=>lerp(v,oval[i],round));
      const lower=reverse.map((v,i)=>lerp(v,target[i],open));
      this._set(this.lip,'stroke-width',f===0&&open===0?6:number(lerp(6,4.8,Math.max(Math.abs(f),round,open))));
      this._set(this.lowerLip,'stroke-width',4.8);
      const cavity=pathFromLip(top)+' '+pathFromLip(lower).replace(/^M[^C]+/,'')+' Z';
      const visibility=smooth(0,.04,open);
      this._set(this.cavity,'d',cavity);this._set(this.cavityClip,'d',cavity);this._set(this.lowerLip,'d',pathFromLip(lower));
      this._set(this.cavity,'opacity',number(visibility));this._set(this.lowerLip,'opacity',number(visibility));
      const width=(right[0]-left[0])*.3,cy=Math.max(...lower.filter((_,i)=>i%2))-5;
      this._set(this.tongue,'d',`M${number(cx-width)} ${number(cy+8)} C${number(cx-width)} ${number(cy-8)} ${number(cx+width)} ${number(cy-8)} ${number(cx+width)} ${number(cy+8)} Z`);
      this._set(this.tongue,'opacity',number(smooth(.08,.35,open)*(1-round)));
    }
    _eyeLowerEdge(eye,x){
      // Find the visible lower boundary, rather than guessing a source Y.
      // In a near-closed eye even a small opening separates those two values.
      const hits=[];
      for(const node of [eye.white,eye.lashes]){
        const commands=parsePath(node.getAttribute('d'));let first=null,p=null;
        const edge=q=>{if(p&&x>=Math.min(p[0],q[0])&&x<=Math.max(p[0],q[0])&&p[0]!==q[0])hits.push(p[1]+(q[1]-p[1])*(x-p[0])/(q[0]-p[0]));p=q;};
        for(const {cmd,v}of commands){
          if(cmd==='M'){p=v;first=v;}else if(cmd==='L')edge(v);else if(cmd==='Z')edge(first);
          else if(cmd==='C'){const a=[...p];for(let j=1;j<=24;j++){const t=j/24,u=1-t;edge([0,1].map(k=>u*u*u*a[k]+3*u*u*t*v[k]+3*u*t*t*v[k+2]+t*t*t*v[k+4]));}}
        }
      }
      return hits.length?Math.max(...hits):632;
    }
    _hairPoint(x,y,back=false) {
      const u=clamp((x-130)/800,0,1),v=clamp((y-(back?590:260))/(back?295:550),0,1);
      const weights=[(1-u)**2,2*u*(1-u),u*u];
      const row=weights.reduce((sum,w,i)=>sum+w*this.springs[i].x,0),vertical=weights.reduce((sum,w,i)=>sum+w*this.springs[i].y,0);
      const flare=this.frameBase.HairFlare,side=clamp((x-534)/250,-1,1),gain=back?1.15:1;
      // Root stays pinned; lock tips spread/droop independently of gesture clips.
      return [x+v*v*(row+side*flare*26)*gain,y+v*v*(vertical-flare*9)*gain];
    }
    render() {
      if(this.disposed)return;
      const base=this.interactions?this.interactions.mix({...this._sample()}):this._sample(),d=this._drivers(base),headTransform=transform(d.head,-3.4*d.breath+d.bodyY);
      this.frameBody=d.body;this.frameBase=base;this.frameSquash=this._shapeSquash(base,d);
      const b=d.breath;
      const openings=this.eyes.map(eye=>this._renderEye(eye,base,d));
      for(const side of ['left','right']) {
        const e=this.get('brow-'+side),cx=side==='left'?416:647,sign=side==='left'?1:-1;
        this._set(e,'d',mapPath(this.rest.get(e).commands,(x,y)=>[x,y-base.BrowY*15-base.BrowAsymmetry*sign*12+base.Tension*sign*(x-cx)*.4]));
      }
      this._renderMouth(base);
      this._renderHairMeshes();
      this._set(this.blush,'opacity',number(base.Cheek*.5));
      const wet=Math.max(base.Tear,base.TearPool);this._set(this.effects,'opacity',number(wet));
      if(wet>0)this.tearPaths.forEach(({pool,stream,light,drop,glint,reveal},i)=>{
        const eye=this.eyes[i],x=eye.center+(i?30:-30),y=this._eyeLowerEdge(eye,x)-1;
        const t=this.options.reducedMotion?0:this.clock,phase=(t/2.65+i*.47)%1;
        const run=smooth(.22,.8,phase),fall=smooth(.8,1,phase),drift=(i?-1:1)*(run*6+fall*4);
        const opacity=smooth(0,.10,phase)*(1-smooth(.84,1,phase))*base.Tear;
        const dy=6+run*73+fall*fall*34,scale=.45+.5*smooth(0,.25,phase),transform=`translate(${number(x+drift)} ${number(y+dy)}) scale(${number(scale)} ${number(scale*(1+fall*.35))})`;
        const yl=this._eyeLowerEdge(eye,x-17)-1,yr=this._eyeLowerEdge(eye,x+17)-1;
        this._set(pool,'d',`M${x-17} ${number(yl)} C${x-7} ${number(y+1)} ${x+7} ${number(y+1)} ${x+17} ${number(yr)} C${x+13} ${number(y+7)} ${x-13} ${number(y+7)} ${x-17} ${number(yl)} Z`);
        this._set(pool,'opacity',.8);this._set(light,'d',`M${x-10} ${number(y+3)} C${x-4} ${number(y+5)} ${x+3} ${number(y+5)} ${x+9} ${number(y+3)}`);
        this._set(stream,'d',`M${x-4} ${number(y+3)} C${x-6} ${number(y+35)} ${x+drift-4} ${number(y+62)} ${x+drift-4} ${number(y+86)} C${x+drift-2} ${number(y+90)} ${x+drift+4} ${number(y+89)} ${x+drift+4} ${number(y+86)} C${x+drift+3} ${number(y+55)} ${x+4} ${number(y+30)} ${x+4} ${number(y+3)} Z`);
        this._set(stream,'opacity',number(base.Tear*.25*smooth(.12,.3,phase)*(1-smooth(.72,1,phase))));
        for(const[k,v]of Object.entries({x:x-22,y:y+3,width:44,height:Math.max(0,dy)}))this._set(reveal,k,number(v));
        this._set(drop,'transform',transform);this._set(glint,'transform',transform);this._set(drop,'opacity',number(opacity*.9));this._set(glint,'opacity',number(opacity*.85));
      });
      this._renderFullBody(d,headTransform);
      this._renderTorsoMesh(d);
      this._renderTailMesh(d);
      this.parts?.render(d);
      this.symbols?.render(base);this.interactions?.render();
      this._renderMeshDebug();
      this.frameCount++;
      this.evaluated={parameters:base,body:d.body,bodyAngle:d.bodyAngle,bodyY:d.bodyY,fullBody:this.fullBodyEvaluated,tail:this.tailEvaluated,eyeOpen:openings,headAngle:d.head,breath:b,gaze:[d.gazeX,d.gazeY],blink:d.blink,speech:this.speechEvaluated,headTransform:headTransform||'identity'};
    }
    getDebugState() {
      const p=this.transition.duration?clamp((this.clock-this.transition.at)/this.transition.duration,0,1):1;
      return structuredClone({time:this.clock,emotion:this.emotion,intensity:this.intensity,action:this.action,actionIntensity:this.actionIntensity,bodyTransition:this.bodyTransition,paused:this.paused,options:this.options,transitionProgress:p,target:this.target,evaluated:this.evaluated,springs:this.springs,headVelocity:this.lastHeadVelocity,frameCount:this.frameCount,parts:this.parts?.state(),activeTearNodes:this.evaluated.parameters.Tear>1e-5?6:0,activeHeartNodes:this.evaluated.parameters.HeartEyes>1e-5?2:0,instance:this.prefix});
    }
    exportExpressions() { return structuredClone(this.expressions); }
    importExpressions(data) { this._validateExpressions(data);if(!data.emotions[this.emotion]||!data.bodyActions[this.action])throw new Error('Active channel missing');this.expressions=structuredClone(data);this.setEmotion(this.emotion,this.intensity);this.setAction(this.action,this.actionIntensity); }
    serialize() { return new XMLSerializer().serializeToString(this.svg); }
    destroy() { this.disposed=true;cancelAnimationFrame(this._raf);document.removeEventListener('visibilitychange',this._visibility);document.removeEventListener('freeze',this._freeze);document.removeEventListener('resume',this._thaw);this.svg.remove(); }
  }
  global.MintRig=MintRig;
})(window);
