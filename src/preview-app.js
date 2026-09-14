(function () {
  'use strict';
  const $=id=>document.getElementById(id);
  const config=JSON.parse($('rig-data').textContent),expressions=JSON.parse($('expression-data').textContent);
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const rig=new MintRig($('character-host'),$('character-template').content.querySelector('svg'),config,expressions,{reducedMotion:media.matches});
  const partLabels={auto:'동작에 맞추기',base:'기본',index:'검지 모으기',chest:'가슴에 손',peace:'둥근 손 인사',open:'팔 펼치기',wave:'한 손 인사',hip:'허리에 손',clasp:'긴 소매 모으기'};
  for(const [slot,state]of Object.entries(rig.parts?.slots||{})){
    const label=document.createElement('label');label.textContent=({'arm-left':'왼손','arm-right':'오른손','leg-left':'왼발','leg-right':'오른발'})[slot];
    const select=document.createElement('select');select.id='part-'+slot;
    for(const id of ['auto',...state.names]){const o=document.createElement('option');o.value=id;o.textContent=partLabels[id];select.append(o);}
    select.addEventListener('change',()=>{if(comparing)toggleCompare(false);rig.setPartVariant(slot,select.value);});label.append(select);$('part-selects').append(label);
  }
  $('parts-enabled').addEventListener('change',()=>rig.setPartVariantsEnabled($('parts-enabled').checked));
  const lipInput=new MintLipSyncInput(rig,{demo:$('lip-demo'),mic:$('lip-mic'),stop:$('lip-stop'),file:$('lip-file'),audio:$('lip-audio'),gain:$('lip-gain'),level:$('lip-level'),status:$('lip-status')});window.mintLipSync=lipInput;window.addEventListener('pagehide',()=>lipInput.destroy(),{once:true});
  rig.svg.setAttribute('viewBox','-100 -190 1286 1660');
  $('pet').addEventListener('click',()=>{if(comparing)toggleCompare(false);rig.resume();rig.playInteraction('pet');syncState()});
  $('poke').addEventListener('click',()=>{if(comparing)toggleCompare(false);rig.resume();rig.playInteraction('poke');syncState()});
  $('poke-right').addEventListener('click',()=>{if(comparing)toggleCompare(false);rig.resume();rig.playInteraction('poke','right');syncState()});
  for(const side of ['left','right'])$('pull-'+side).addEventListener('click',()=>{if(comparing)toggleCompare(false);rig.resume();rig.playInteraction('pull',side);syncState()});
  $('hood-off').addEventListener('click',()=>{if(comparing)toggleCompare(false);const off=rig.target.HoodOff<.5;rig.setParameter('HoodOff',off?1:0,1.3);$('hood-off').textContent=off?'후드 쓰기':'후드 벗기';syncSliders()});
  document.querySelectorAll('[data-look]').forEach(b=>b.addEventListener('click',()=>{const[x,y]=b.dataset.look.split(',').map(Number);rig.setGaze(0,0);rig.setParameter('HeadYaw',x,.65);rig.setParameter('HeadPitch',y,.65);syncSliders()}));
  $('interaction-stop').addEventListener('click',()=>rig.stopInteraction());
  window.mintRig=rig; // Documented local preview/debug API.
  $('show-bones').addEventListener('change',()=>rig.setRigDebug({bones:$('show-bones').checked}));
  $('show-mesh').addEventListener('change',()=>rig.setRigDebug({mesh:$('show-mesh').checked}));
  $('export-mesh').addEventListener('click',()=>download(JSON.stringify(rig.exportMeshes(),null,2),'application/json','meshes.json'));
  let comparing=false,zoomed=false,savedCompare=null,stressTimers=[],lastUiTime=0,touchReturnTimer=null;
  const marks={cautious:'˘ . ˘',neutral:'• ᴗ •',happy:'^ ᴗ ^',delighted:'⌒ ▽ ⌒',laughing:'˃ ▽ ˂',shy:'˶ ᴗ ˶',love:'♡ ᴗ ♡',surprised:'• o •',confused:'• ᴖ ◦',worried:'´ ᴖ `',sad:'˘ ︵ ˘',crying:'˃ ﹏ ˂',angry:'ˋ ᴖ ˊ',annoyed:'¬ ︵ ¬',determined:'ˋ ᴗ ˊ',sleepy:'– o –',wink:'– ᴗ •',greeting:'• ᴗ • ノ',favorite:'★ ᴗ ★',relieved:'˘ ᴗ ˘',curious:'• ◇ •',pout:'¬ ︿ ¬'};
  for(const [id,record]of Object.entries(expressions.emotions)) {
    const b=document.createElement('button');b.className='preset';b.dataset.emotion=id;b.setAttribute('aria-pressed',String(id==='neutral'));b.title=record.description;b.setAttribute('aria-label',record.label+' · '+id);
    const mark=document.createElement('span');mark.className='face-mark';mark.textContent=marks[id];mark.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.textContent=record.label;
    const en=document.createElement('small');en.textContent=id;b.append(mark,label,en);$('presets').append(b);
    b.addEventListener('click',()=>chooseEmotion(id));
  }
  for(const [id,rec] of Object.entries(expressions.bodyActions)){const option=document.createElement('option');option.value=id;option.textContent=rec.label;$('body-action').append(option);}
  function chooseAction(){if(comparing)toggleCompare(false);$('link-motion').checked=false;rig.setAction($('body-action').value,Number($('body-intensity').value),.8);syncState();}
  $('body-action').addEventListener('change',chooseAction);
  $('body-intensity').addEventListener('input',()=>{$('body-intensity-value').value=Math.round(Number($('body-intensity').value)*100)+'%';chooseAction();});
  $('stop-action').addEventListener('click',()=>{if(comparing)toggleCompare(false);$('link-motion').checked=false;rig.setAction('rest',1,.8);syncState();});
  $('link-motion').addEventListener('change',()=>{if($('link-motion').checked){if(comparing)toggleCompare(false);rig.setAction(rig.expressions.emotions[rig.emotion].suggestedAction,Number($('body-intensity').value),.8);syncState();}});
  function duration(){return Number($('duration').value)}
  function syncSliders(){for(const p of config.parameters){const e=$('param-'+p.id);e.value=rig.target[p.id];$('value-'+p.id).textContent=display(p,rig.target[p.id]);}}
  function display(p,v){return p.id==='HeadAngleZ'?Number(v).toFixed(1)+'°':Number(v).toFixed(2)}
  function chooseEmotion(id) {
    if(comparing)toggleCompare(false);
    rig.stopInteraction();rig.setEmotion(id,Number($('intensity').value),duration());syncSliders();syncState();
    if($('link-motion').checked){rig.setAction(rig.expressions.emotions[id].suggestedAction,Number($('body-intensity').value),Math.max(.8,duration()));syncState();}
  }
  for(const [name,key]of [['stance','Stance'],['step','FootStep']])$('leg-'+name).addEventListener('input',()=>{if(comparing)toggleCompare(false);const v=Number($('leg-'+name).value);rig.setBodyParameter(key,v,rig.paused?0:.3);$('leg-'+name+'-value').textContent=v.toFixed(2)});
  function syncState() {
    document.querySelectorAll('[data-emotion]').forEach(b=>{b.classList.toggle('selected',b.dataset.emotion===rig.emotion);b.setAttribute('aria-pressed',String(b.dataset.emotion===rig.emotion));});
    $('play-pause').textContent=rig.paused?'재생':'일시정지';$('play-pause').setAttribute('aria-pressed',String(rig.paused));
    $('stage-state').textContent=comparing?'원본과 겹쳐 보기':rig.expressions.emotions[rig.emotion].label;
    $('idle').checked=rig.options.idle;$('tracking').checked=rig.options.tracking;$('pose-tracking').checked=rig.options.poseTracking;
    $('reduced-note').hidden=!rig.options.reducedMotion;
    $('parts-enabled').checked=rig.parts?.enabled??false;for(const[slot,state]of Object.entries(rig.parts?.slots||{}))$('part-'+slot).value=state.manual;
    for(const[name,key]of [['stance','Stance'],['step','FootStep']]){$('leg-'+name).value=rig.bodyTransition.to[key];$('leg-'+name+'-value').textContent=rig.bodyTransition.to[key].toFixed(2);}
    $('body-action').value=rig.action;$('body-intensity').value=rig.actionIntensity;$('body-intensity-value').value=Math.round(rig.actionIntensity*100)+'%';
  }
  for(const p of config.parameters) {
    const row=document.createElement('div');row.className='range-row';
    const label=document.createElement('label');label.className='range-label';label.htmlFor='param-'+p.id;label.textContent=p.label;
    const out=document.createElement('output');out.id='value-'+p.id;out.textContent=display(p,p.default);label.append(out);
    const input=document.createElement('input');input.type='range';input.id='param-'+p.id;input.min=p.min;input.max=p.max;input.step=p.id==='HeadAngleZ'?'.1':'.01';input.value=p.default;
    input.addEventListener('input',()=>{if(comparing)toggleCompare(false);rig.setParameter(p.id,Number(input.value),rig.paused?0:.1);out.textContent=display(p,input.value)});
    row.append(label,input);$('params').append(row);
  }
  $('play-pause').addEventListener('click',()=>{if(comparing)toggleCompare(false);rig.paused?rig.resume():rig.pause();syncState()});
  $('blink').addEventListener('click',()=>{if(comparing)toggleCompare(false);rig.blink();if(rig.paused)rig.resume();syncState()});
  $('reset').addEventListener('click',()=>{
    lipInput.stop();cancelStress();if(comparing)toggleCompare(false);rig.options.idle=true;rig.options.tracking=true;rig.options.poseTracking=false;rig.reset();rig.resume();$('link-motion').checked=true;$('intensity').value=1;$('intensity-value').value='100%';syncSliders();syncState();
  });
  $('idle').addEventListener('change',()=>{rig.setIdle($('idle').checked)});
  $('tracking').addEventListener('change',()=>rig.setTracking($('tracking').checked));
  $('pose-tracking').addEventListener('change',()=>rig.setPoseTracking($('pose-tracking').checked));
  $('intensity').addEventListener('input',()=>{$('intensity-value').value=Math.round(Number($('intensity').value)*100)+'%';chooseEmotion(rig.emotion)});
  $('duration').addEventListener('input',()=>{$('duration-value').value=Number($('duration').value).toFixed(2)+'초'});
  $('clear-manual').addEventListener('click',()=>{rig.releaseManual();syncSliders()});
  function setZoom(on){zoomed=on;rig.svg.setAttribute('viewBox',on?'235 225 610 560':comparing?'0 0 1086 1448':'-100 -190 1286 1660');$('zoom-face').setAttribute('aria-pressed',String(on));$('zoom-face').textContent=on?'전체 보기':'얼굴 확대';}
  $('zoom-face').addEventListener('click',()=>{if(comparing)toggleCompare(false);setZoom(!zoomed)});
  function toggleCompare(on) {
    comparing=on;$('compare-neutral').setAttribute('aria-pressed',String(on));$('master-compare').hidden=!on;
    if(on){lipInput.stop();savedCompare={emotion:rig.emotion,intensity:rig.intensity,action:rig.action,actionIntensity:rig.actionIntensity,head:rig.target.HeadAngleZ,paused:rig.paused,idle:rig.options.idle,tracking:rig.options.tracking,poseTracking:rig.options.poseTracking};setZoom(false);rig.reset({canonical:true});}
    else if(savedCompare){rig.options.idle=savedCompare.idle;rig.options.tracking=savedCompare.tracking;rig.options.poseTracking=savedCompare.poseTracking;rig.setEmotion(savedCompare.emotion,savedCompare.intensity,duration());rig.setAction(savedCompare.action,savedCompare.actionIntensity);rig.setParameter('HeadAngleZ',savedCompare.head);if(!savedCompare.paused)rig.resume();}
    syncSliders();syncState();
  }
  $('compare-neutral').addEventListener('click',()=>toggleCompare(!comparing));
  let pointerInside=false;
  $('stage').addEventListener('pointerenter',e=>{pointerInside=true;if(!comparing&&rig.options.tracking&&!e.target.closest('button')){clearTimeout(touchReturnTimer);rig.gazeFromClient(e.clientX,e.clientY,.48)}});
  for(const type of ['pointerdown','pointermove'])$('stage').addEventListener(type,e=>{if(comparing||e.target.closest('button'))return;clearTimeout(touchReturnTimer);if(rig.options.tracking)rig.gazeFromClient(e.clientX,e.clientY,pointerInside?.15:.48);if(rig.options.poseTracking)rig.poseFromClient(e.clientX,e.clientY,pointerInside?.22:.52);pointerInside=true;});
  $('stage').addEventListener('pointerleave',e=>{pointerInside=false;if(e.pointerType==='mouse'){rig.setGaze(0,0,.28);if(rig.options.poseTracking){rig.poseFollow.targetX=0;rig.poseFollow.targetY=0}}});
  $('stage').addEventListener('pointercancel',()=>{clearTimeout(touchReturnTimer);pointerInside=false;rig.setGaze(0,0,.28);if(rig.options.poseTracking){rig.poseFollow.targetX=0;rig.poseFollow.targetY=0}});
  $('stage').addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')touchReturnTimer=setTimeout(()=>rig.setGaze(0,0),800)});
  const CHEEK_PULL_THRESHOLD=42;window.mintCheekPullThreshold=CHEEK_PULL_THRESHOLD;
  let gesture=null;
  function headPoint(e){const m=rig.headSlots[1].getScreenCTM();if(!m)return null;return new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse())}
  $('stage').addEventListener('pointerdown',e=>{if(comparing||e.target.closest('button'))return;const p=headPoint(e);if(!p)return;const head=p.x>175&&p.x<893&&p.y>270&&p.y<610,cheek=p.y>625&&p.y<778&&(p.x>235&&p.x<445||p.x>623&&p.x<833);if(head||cheek)e.preventDefault();gesture={id:e.pointerId,x:e.clientX,y:e.clientY,localX:p.x,localY:p.y,head,cheek,side:p.x<534?'left':'right',kind:cheek?'poke':null,promoted:false};if(head||cheek){$('stage').classList.add('interacting');rig.setInteractionPointer(e.clientX,e.clientY,true,gesture.kind||'pet')}if(cheek){rig.resume();rig.directInteraction('poke',gesture.side,1);rig.setGaze(0,0,.18);rig.poseFollow.targetX=0;rig.poseFollow.targetY=0}if(head||cheek)$('stage').setPointerCapture(e.pointerId)});
  $('stage').addEventListener('pointermove',e=>{if(gesture?.id!==e.pointerId)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y,outward=dx*(gesture.side==='left'?-1:1),p=headPoint(e),localDx=(p?.x??gesture.localX)-gesture.localX,localDy=(p?.y??gesture.localY)-gesture.localY;if(gesture.cheek){if(!gesture.promoted&&outward>=CHEEK_PULL_THRESHOLD){gesture.promoted=true;gesture.kind='pull';rig.resume()}if(gesture.promoted){const strength=Math.max(.04,Math.min(1,(outward-CHEEK_PULL_THRESHOLD)/125));rig.directCheekPull(gesture.side,strength,localDx,localDy)}rig.setInteractionPointer(e.clientX,e.clientY,true,gesture.kind)}if(gesture.head&&Math.hypot(dx,dy)>9){gesture.kind='pet';rig.resume();rig.directInteraction('pet',gesture.side,Math.min(1,(Math.hypot(dx,dy)-9)/58+.3));rig.setInteractionPointer(e.clientX,e.clientY,true,'pet')}});
  const releaseGesture=e=>{if(gesture&&(!e||gesture.id===e.pointerId)){gesture=null;$('stage').classList.remove('interacting');rig.stopInteraction(.24)}};$('stage').addEventListener('pointerup',releaseGesture);$('stage').addEventListener('pointercancel',releaseGesture);
  $('timeline').addEventListener('input',()=>{rig.pause();rig.seek(Number($('timeline').value));syncState()});
  function cancelStress(){stressTimers.forEach(clearTimeout);stressTimers=[];$('stress').textContent='빠른 전환 확인';}
  $('stress').addEventListener('click',()=>{
    if(stressTimers.length){cancelStress();return;}if(comparing)toggleCompare(false);rig.resume();$('stress').textContent='전환 확인 중지';
    [...Object.keys(rig.expressions.emotions).filter(id=>id!=='neutral'),'neutral'].forEach((id,i)=>stressTimers.push(setTimeout(()=>chooseEmotion(id),i*110)));
    stressTimers.push(setTimeout(cancelStress,Object.keys(rig.expressions.emotions).length*110+duration()*1000+200));syncState();
  });
  function download(text,type,name){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  $('export-frame').addEventListener('click',()=>download(rig.serialize(),'image/svg+xml','character.'+rig.emotion+'.svg'));
  $('export-presets').addEventListener('click',()=>download(JSON.stringify(rig.exportExpressions(),null,2),'application/json','expressions.json'));
  $('import-presets').addEventListener('click',()=>$('preset-file').click());
  $('preset-file').addEventListener('change',async()=>{try{const file=$('preset-file').files[0];if(!file)return;if(file.size>100000)throw new Error('파일이 너무 큽니다.');rig.importExpressions(JSON.parse(await file.text()));$('message').textContent='표정 데이터를 불러왔습니다.';syncSliders();syncState();}catch(e){$('message').textContent='불러오기 실패: '+e.message;}finally{$('preset-file').value='';}});
  media.addEventListener('change',()=>{rig.setReducedMotion(media.matches);syncState()});
  function updateUi(t){
    if(t-lastUiTime>120){lastUiTime=t;const s=rig.getDebugState();
      const contact=rig.interactions.evaluated;const active=contact.pull>.02?'pull':contact.pet>.02?'pet':contact.poke>.02?'poke':null;
      $('pet').setAttribute('aria-pressed',String(active==='pet'));$('poke').setAttribute('aria-pressed',String(contact.left>.02));$('poke-right').setAttribute('aria-pressed',String(contact.right>.02));
      if(!comparing)$('stage-state').textContent=active?(active==='pull'?'볼 당기기':active==='pet'?'쓰담쓰담':'찌르기'):rig.expressions.emotions[rig.emotion].label;
      if($('rig-view').open){const meshes=rig.meshes;const flips=meshes.reduce((n,m)=>n+m.metrics.flippedTriangles,0);$('mesh-status').textContent=`${meshes.length} meshes · ${meshes.reduce((n,m)=>n+m.rest.length,0)} vertices · ${meshes.reduce((n,m)=>n+m.triangles.length,0)} triangles\n뒤집힌 면 ${flips} · 최소 면적비 ${Math.min(...meshes.map(m=>m.metrics.minimumAreaRatio)).toFixed(3)}`;}
      $('transition-progress').style.width=(s.transitionProgress*100)+'%';
      $('transition-label').textContent=s.transitionProgress<1?'표정 전환 중':rig.expressions.emotions[s.emotion].label;
      $('timeline-value').value=s.time.toFixed(2)+'초';
      if(document.activeElement!==$('timeline'))$('timeline').value=Math.min(s.time,12);
      if($('timeline-details').open)$('debug').textContent=`Head ${s.evaluated.headAngle.toFixed(2)}° · Eye ${s.evaluated.eyeOpen.map(v=>v.toFixed(2)).join(' / ')}\nBody ${s.action} · Hair ${s.springs.map(v=>v.x.toFixed(2)).join(' / ')} px\nHearts ${s.activeHeartNodes} · Tears ${s.activeTearNodes} · ${s.paused?'PAUSED':'PLAYING'}`;
    }requestAnimationFrame(updateUi);
  }
  syncState();requestAnimationFrame(updateUi);
})();
