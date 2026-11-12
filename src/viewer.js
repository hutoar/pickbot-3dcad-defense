import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { asset, esc, image, partProperties } from './ui.js';
import { createKinematics, poseReadouts, pickingPose } from './kinematics.js';

export function mountViewer(root,P,params) {
  root.innerHTML=`<div class="viewer-layout"><div class="viewer-stage"><div class="viewer-canvas"></div><details class="structure-tree"><summary>结构树</summary><div class="tree-content"></div></details><div class="viewer-help">拖动旋转 · 滚轮缩放 · 右键平移</div><div class="viewer-loading"><strong>正在加载数字样机</strong><progress max="100" value="0"></progress><span>准备运动数据与模型…</span></div><div class="viewer-tooltip" hidden></div><button class="stage-caption" hidden></button><div class="axis-labels"><span data-axis="X">X</span><span data-axis="Y">Y</span><span data-axis="Z">Z</span></div></div><aside class="viewer-panel"><section class="control-card selection-info"><h3>零件信息</h3><p class="note">点击模型或结构树查看零件</p></section><div class="viewer-controls"></div></aside></div>`;
  const stage=root.querySelector('.viewer-stage'),host=root.querySelector('.viewer-canvas'),panel=root.querySelector('.viewer-controls'),loading=root.querySelector('.viewer-loading'),tooltip=root.querySelector('.viewer-tooltip'),caption=root.querySelector('.stage-caption');
  let disposed=false,renderer,controls,resizeObserver,envTarget,scene,K,solver,nodes=[],meshes=[],edges=[],fruit,grid,selected=null,hovered=null,poseTween=null,cameraTween=null,animation=null,paused=false,lastTime=0,dirty=true;
  const controller=new AbortController(),state={},visibleGroups=new Set(P.instances.map(p=>p.group));
  const groups=[...visibleGroups],partMap=new Map(P.parts.map(p=>[p.part,p])),materials=new Set();
  const camera=new THREE.PerspectiveCamera(36,1,.005,100);
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const modelGroup=new THREE.Group();
  function disposeObject(object){object?.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});}
  function fail(error){if(disposed)return;loading.innerHTML=`<strong>三维模型未能加载</strong><p>${esc(error.message)}</p><button>重新加载</button>`;loading.querySelector('button').onclick=()=>location.reload();}
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearAlpha(0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
    renderer.domElement.setAttribute('aria-label','交互三维模型');host.append(renderer.domElement);
    scene=new THREE.Scene();scene.add(modelGroup);
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);envTarget=pmrem.fromScene(room);scene.environment=envTarget.texture;room.dispose();pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff,0x667080,2));const sun=new THREE.DirectionalLight(0xffffff,2.5);sun.position.set(3,5,4);scene.add(sun);
    controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=.06;controls.maxDistance=8;controls.autoRotateSpeed=.7;
    controls.addEventListener('start',()=>{cameraTween=null;});
    grid=new THREE.GridHelper(2,20,0x536681,0x8994a6);grid.position.y=-.075;grid.material.transparent=true;grid.material.opacity=.25;scene.add(grid);
    fruit=new THREE.Mesh(new THREE.SphereGeometry(.0325,32,24),new THREE.MeshPhysicalMaterial({color:0xc93524,roughness:.28,metalness:0,clearcoat:1,clearcoatRoughness:.18}));scene.add(fruit);
    resizeObserver=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}});resizeObserver.observe(host);
  }catch(error){fail(error);return()=>{disposed=true;resizeObserver?.disconnect();controls?.dispose();disposeObject(scene);envTarget?.dispose();renderer?.dispose();};}

  const axisScene=new THREE.Scene(),axisCamera=new THREE.PerspectiveCamera(40,1,.1,10);axisScene.add(new THREE.AxesHelper(.7));
  function applyPose(){
    solver.update(state);nodes.forEach((node,i)=>{node.matrix.copy(solver.final[i]);node.matrixWorldNeedsUpdate=true;});
    fruit.position.copy(animation&&!animation.attached?animation.anchor:solver.fruitCenter());scene.updateMatrixWorld(true);updateReadouts();dirty=false;
  }
  function updateReadouts(){
    const {height,phi}=poseReadouts(state);
    const values={theta:`θ = ${state.theta.toFixed(1)}° · 平台升程 ΔH = ${height} mm`,gap:`s = ${Number(state.gap.toFixed(1))} mm · 曲柄角 φ = ${phi}°`,roll:`腕部滚转 ${state.roll.toFixed(1)}°`,explode:`爆炸 ${Math.round(state.explode*100)}%`};
    for(const key of Object.keys(values)){panel.querySelector(`[data-output="${key}"]`).textContent=values[key];panel.querySelector(`[data-range="${key}"]`).value=key==='explode'?state[key]*100:state[key];}
  }
  function cancelAction(){animation=null;paused=false;caption.hidden=true;const b=panel.querySelector('[data-action="play"]');if(b)b.textContent='▶ 播放采摘动作';}
  function tweenPose(target,duration=600){cancelAction();poseTween={start:performance.now(),duration,from:{...state},to:{...state,...target}};}
  function boundsFor(filter=()=>true){scene.updateMatrixWorld(true);const box=new THREE.Box3();nodes.forEach((n,i)=>{if(n.visible&&filter(P.instances[i],i))box.expandByObject(n);});return box.isEmpty()?new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0,.4,0),new THREE.Vector3(1,1,1)):box;}
  function focus(view='iso',filter=null,immediate=false){
    const box=boundsFor(filter||(view==='gripper'?inst=>inst.gripper:()=>true)),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    const distance=Math.max(.12,size.length()/2/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*1.18/Math.min(1,camera.aspect));
    const directions={iso:new THREE.Vector3(1,.65,1),front:new THREE.Vector3(0,0,1),side:new THREE.Vector3(1,0,0),top:new THREE.Vector3(0,1,.001),gripper:new THREE.Vector3(1,.6,1)};
    const to=center.clone().add((directions[view]||directions.iso).normalize().multiplyScalar(distance));
    if(immediate){camera.position.copy(to);controls.target.copy(center);controls.update();}
    else cameraTween={start:performance.now(),from:camera.position.clone(),targetFrom:controls.target.clone(),to,targetTo:center};
  }
  function highlight(){meshes.forEach(m=>{const id=m.userData.instance; m.material.emissive.set(id===selected?'#C8541B':id===hovered?'#2F5D9E':'#000000');m.material.emissiveIntensity=id===selected?.45:id===hovered?.35:0;});root.querySelectorAll('[data-instance]').forEach(b=>b.classList.toggle('selected',b.dataset.instance===selected));}
  function setVisibility(group=null,instance=null){
    if(group){visibleGroups.clear();visibleGroups.add(group);}else if(!instance){groups.forEach(g=>visibleGroups.add(g));}
    nodes.forEach((n,i)=>{n.visible=instance?P.instances[i].id===instance:visibleGroups.has(P.instances[i].group);});
    panel.querySelectorAll('[data-group]').forEach(c=>{const groupNodes=nodes.filter((n,i)=>P.instances[i].group===c.dataset.group);c.checked=groupNodes.every(n=>n.visible);c.indeterminate=!c.checked&&groupNodes.some(n=>n.visible);});
    hovered=null;tooltip.hidden=true;highlight();
  }
  function select(id,shouldFocus=false){
    selected=id;highlight();const card=root.querySelector('.selection-info'),inst=P.instances.find(i=>i.id===id),p=inst&&partMap.get(inst.part);
    card.innerHTML=`<h3>零件信息</h3>${p?`${image(p.thumb,p.cn,'viewer-part')}<h4>${esc(p.cn)}</h4>${partProperties(p)}<div class="actions"><button data-isolate>隔离此零件</button><a class="button" href="#/parts?search=${encodeURIComponent(p.part)}">在零件库中查看</a></div>`:'<p class="note">点击模型或结构树查看零件</p>'}`;
    if(p){card.querySelector('[data-isolate]').onclick=()=>{setVisibility(null,id);focus('iso',x=>x.id===id);};if(shouldFocus){const node=nodes[P.instances.findIndex(i=>i.id===id)];if(!node.visible)setVisibility(inst.group);focus('iso',x=>x.id===id);}}
  }
  function buildControls(){
    const slider=(key,label,min,max,step)=>`<label class="slider-label"><span>${label}</span><output data-output="${key}"></output><input aria-label="${label}" data-range="${key}" type="range" min="${min}" max="${max}" step="${step}"></label>`;
    const check=(key,label,checked=false)=>`<label class="check"><input type="checkbox" data-toggle="${key}" ${checked?'checked':''}>${label}</label>`;
    panel.innerHTML=`<section class="control-card"><h3>工位与姿态</h3>${slider('theta','剪叉角 θ',K.thetas[0],K.thetas.at(-1),.5)}<div class="preset-row">${[K.thetas[0],K.default.theta,K.thetas.at(-1)].map((v,i)=>`<button data-preset="theta" data-value="${v}">${['低位','中位','高位'][i]} ${v}°</button>`).join('')}</div>${slider('gap','夹爪开口 s',K.gaps[0],K.gaps.at(-1),.5)}<div class="preset-row">${[K.gaps[0],K.default.gap,K.gaps.at(-1)].map(v=>`<button data-preset="gap" data-value="${v}">开口 ${v}</button>`).join('')}</div>${slider('roll','腕部滚转',0,180,.5)}</section><section class="control-card"><h3>爆炸视图</h3>${slider('explode','爆炸系数',0,100,1)}<button data-action="explode">一键爆炸 / 复原</button></section><section class="control-card"><h3>显示</h3><div class="group-checks">${groups.map(g=>`<label class="check"><input type="checkbox" data-group="${esc(g)}" checked><i style="background:${esc(P.instances.find(p=>p.group===g).color)}"></i>${esc(g)}</label>`).join('')}</div><div class="actions"><button data-action="isolate">仅显示所选</button><button data-action="show-all">全部显示</button></div><div class="display-checks">${check('edges','显示特征边',true)}${check('grid','显示地面网格',true)}${check('transparent','半透明')}${check('fruit','显示果实',true)}</div></section><section class="control-card"><h3>视角</h3><div class="view-buttons">${[['iso','轴测'],['front','正视'],['side','侧视'],['top','俯视'],['gripper','聚焦夹爪']].map(([v,t])=>`<button data-view="${v}">${t}</button>`).join('')}</div>${check('rotate','自动旋转')}</section><section class="control-card"><h3>演示动作</h3><button class="primary" data-action="play">▶ 播放采摘动作</button><button data-action="reset">复位</button></section>`;
    panel.querySelectorAll('[data-range]').forEach(input=>input.oninput=()=>{cancelAction();poseTween=null;const key=input.dataset.range;state[key]=Number(input.value)/(key==='explode'?100:1);dirty=true;});
    panel.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>tweenPose({[b.dataset.preset]:+b.dataset.value}));
    panel.querySelector('[data-action="explode"]').onclick=()=>tweenPose({explode:state.explode>.5?0:1},1000);
    panel.querySelectorAll('[data-group]').forEach(c=>c.onchange=()=>{if(c.checked)visibleGroups.add(c.dataset.group);else visibleGroups.delete(c.dataset.group);nodes.forEach((n,i)=>n.visible=visibleGroups.has(P.instances[i].group));panel.querySelectorAll('[data-group]').forEach(x=>{x.checked=visibleGroups.has(x.dataset.group);x.indeterminate=false;});hovered=null;tooltip.hidden=true;highlight();});
    panel.querySelector('[data-action="isolate"]').onclick=()=>{if(selected){const inst=P.instances.find(p=>p.id===selected);setVisibility(inst.group);focus();}};
    panel.querySelector('[data-action="show-all"]').onclick=()=>{setVisibility();focus();};
    panel.querySelectorAll('[data-toggle]').forEach(c=>c.onchange=()=>{switch(c.dataset.toggle){case'edges':edges.forEach(e=>e.visible=c.checked);break;case'grid':grid.visible=c.checked;break;case'fruit':fruit.visible=c.checked;break;case'rotate':controls.autoRotate=c.checked;break;case'transparent':materials.forEach(m=>{m.transparent=c.checked;m.opacity=c.checked?.35:1;m.depthWrite=!c.checked;m.needsUpdate=true;});break;}});
    panel.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(b.dataset.view==='gripper')setVisibility(groups.find(g=>P.instances.some(p=>p.group===g&&p.gripper)));focus(b.dataset.view);});
    function togglePlay(){
      poseTween=null;
      if(animation){paused=!paused;}else{solver.update({...K.default,explode:0});animation={time:0,anchor:solver.fruitCenter(),attached:false};paused=false;setVisibility();focus();}
      panel.querySelector('[data-action="play"]').textContent=paused?'继续采摘动作':'暂停采摘动作';caption.hidden=false;
    }
    panel.querySelector('[data-action="play"]').onclick=togglePlay;caption.onclick=togglePlay;
    panel.querySelector('[data-action="reset"]').onclick=()=>tweenPose({...K.default,explode:0});
    root.querySelector('.tree-content').innerHTML=groups.map(g=>`<details><summary>${esc(g)}</summary><button class="tree-focus" data-tree-group="${esc(g)}">定位子系统</button>${P.parts.filter(p=>p.group===g).map(p=>`<details><summary>${esc(p.cn)} (×${p.qty})</summary><button class="tree-focus" data-tree-part="${esc(p.part)}">定位零件</button>${P.instances.filter(i=>i.part===p.part).map(i=>`<button data-instance="${i.id}" title="${esc(i.inst)}">${esc(i.id)} · ${esc(i.inst)}</button>`).join('')}</details>`).join('')}</details>`).join('');
    root.querySelectorAll('[data-instance]').forEach(b=>b.onclick=()=>select(b.dataset.instance,true));
    root.querySelectorAll('[data-tree-group]').forEach(b=>b.onclick=()=>{setVisibility(b.dataset.treeGroup);focus();});
    root.querySelectorAll('[data-tree-part]').forEach(b=>b.onclick=()=>select(P.parts.find(p=>p.part===b.dataset.treePart).instances[0],true));
  }
  let down=null;
  function hit(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(meshes.filter(m=>{let n=m;while(n){if(!n.visible)return false;n=n.parent;}return true;}),false)[0]?.object.userData.instance||null;}
  const pointerDown=e=>{down={x:e.clientX,y:e.clientY,moved:false};};
  const pointerMove=e=>{if(!K)return;if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.moved=true;if(e.buttons){tooltip.hidden=true;return;}hovered=hit(e);highlight();tooltip.hidden=!hovered;if(hovered){tooltip.textContent=P.instances.find(i=>i.id===hovered).cn;const r=stage.getBoundingClientRect();tooltip.style.left=`${Math.min(stage.clientWidth-140,e.clientX-r.left+12)}px`;tooltip.style.top=`${Math.max(0,e.clientY-r.top-36)}px`;}renderer.domElement.style.cursor=hovered?'pointer':'grab';};
  const pointerUp=e=>{if(K&&e.button===0&&down&&!down.moved)select(hit(e));down=null;};
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointermove',pointerMove);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointerleave',()=>{hovered=null;tooltip.hidden=true;highlight();});

  // Both requests start before either is awaited. A route change cancels JSON and
  // disposes a late GLB result without starting a render loop.
  Promise.all([
    fetch(asset('data/kinematics.json'),{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error(`运动数据 ${r.status}`);return r.json();}),
    new GLTFLoader().loadAsync(asset('models/robot.glb'),e=>{if(disposed)return;const value=e.total?Math.round(e.loaded/e.total*100):0;loading.querySelector('progress').value=value;loading.querySelector('span').textContent=e.total?`模型 ${value}%`:`已加载 ${(e.loaded/1024).toFixed(0)} KB`;}).then(gltf=>{if(disposed){disposeObject(gltf.scene);throw new DOMException('Viewer disposed','AbortError');}return gltf;})
  ]).then(([data,gltf])=>{
    if(disposed){disposeObject(gltf.scene);return;}K=data;solver=createKinematics(K,P);
    const read=(name,fallback,min,max)=>{const value=Number(params.get(name));return params.has(name)&&Number.isFinite(value)?THREE.MathUtils.clamp(value,min,max):fallback;};
    Object.assign(state,{theta:read('theta',K.default.theta,K.thetas[0],K.thetas.at(-1)),gap:read('gap',K.default.gap,K.gaps[0],K.gaps.at(-1)),roll:read('roll',K.default.roll,0,180),explode:read('explode',0,0,1)});
    const originalMaterials=new Set();
    nodes=P.instances.map(inst=>{const node=gltf.scene.getObjectByName(inst.id);if(!node)throw new Error(`缺少实例 ${inst.id}`);modelGroup.add(node);node.matrixAutoUpdate=false;
      const childMeshes=[];node.traverse(o=>{if(o.isMesh)childMeshes.push(o);});
      childMeshes.forEach(mesh=>{(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>originalMaterials.add(m));if(!mesh.geometry.attributes.normal)mesh.geometry.computeVertexNormals();const vertexColors=false;mesh.material=new THREE.MeshStandardMaterial({color:new THREE.Color(inst.color),vertexColors,metalness:.25,roughness:.45});materials.add(mesh.material);mesh.userData.instance=inst.id;meshes.push(mesh);const edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,28),new THREE.LineBasicMaterial({color:0x14161c,transparent:true,opacity:.85}));mesh.add(edge);edges.push(edge);});return node;});
    originalMaterials.forEach(m=>m.dispose());buildControls();applyPose();
    if(groups.includes(params.get('iso')))setVisibility(params.get('iso'));
    focus(params.get('view')||'iso',null,true);
    if(P.instances.some(i=>i.id===params.get('select')))select(params.get('select'),true);
    loading.hidden=true;root.dataset.viewerReady='true';
    renderer.setAnimationLoop(now=>{
      if(disposed)return;const dt=lastTime?Math.max(0,(now-lastTime)/1000):0;lastTime=now;
      if(animation&&!paused){animation.time+=dt;const step=pickingPose(animation.time,K);Object.assign(state,step.pose);animation.attached=step.attached;caption.textContent=`${step.stage} · 点击暂停`;dirty=true;if(step.done)cancelAction();}else if(animation&&paused)caption.textContent=`${pickingPose(animation.time,K).stage} · 已暂停，点击继续`;
      if(poseTween){const t=THREE.MathUtils.clamp((now-poseTween.start)/poseTween.duration,0,1),ease=t*t*(3-2*t);for(const key of Object.keys(state))state[key]=poseTween.from[key]+(poseTween.to[key]-poseTween.from[key])*ease;dirty=true;if(t===1)poseTween=null;}
      if(dirty)applyPose();
      if(cameraTween){const t=THREE.MathUtils.clamp((now-cameraTween.start)/700,0,1),ease=t*t*(3-2*t);camera.position.lerpVectors(cameraTween.from,cameraTween.to,ease);controls.target.lerpVectors(cameraTween.targetFrom,cameraTween.targetTo,ease);if(t===1)cameraTween=null;}
      controls.update();renderer.setViewport(0,0,host.clientWidth,host.clientHeight);renderer.render(scene,camera);
      const axisSize=88;axisCamera.position.copy(camera.position).sub(controls.target).normalize().multiplyScalar(2.8);axisCamera.up.copy(camera.up);axisCamera.lookAt(0,0,0);axisCamera.updateMatrixWorld();renderer.autoClear=false;renderer.clearDepth();renderer.setViewport(host.clientWidth-axisSize-8,8,axisSize,axisSize);renderer.render(axisScene,axisCamera);renderer.autoClear=true;
      ['X','Y','Z'].forEach((label,i)=>{const p=new THREE.Vector3().setComponent(i,.85).project(axisCamera),el=root.querySelector(`[data-axis="${label}"]`);el.style.left=`${(p.x+1)*axisSize/2}px`;el.style.top=`${(1-p.y)*axisSize/2}px`;});
    });
  }).catch(error=>{if(error.name!=='AbortError')fail(error);});
  return()=>{disposed=true;controller.abort();renderer.setAnimationLoop(null);resizeObserver.disconnect();controls.dispose();disposeObject(scene);disposeObject(axisScene);envTarget.dispose();renderer.dispose();renderer.forceContextLoss();delete root.dataset.viewerReady;};
}
