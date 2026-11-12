import { esc, asset, image, table, callout, section, stats, partProperties, dialog, markdown } from './ui.js';

export function renderPage(route, root, C, P, params) {
  const cleanups=[];
  const put=html=>{root.innerHTML=html;};
  const figure=(path,title='',group='page')=>image(path,title,group);
  const diagram=(key,title)=>figure(C.diagrams[key],title);
  const routes={
    home(){
      put(`<div class="hero"><div class="hero-copy"><span class="eyebrow">${esc(C.meta.scene)}</span><h1>${esc(C.meta.title)}</h1><p class="subtitle">${esc(C.meta.subtitle)}</p><div class="tags">${C.meta.keywords.map(k=>`<span>${esc(k)}</span>`).join('')}</div><div class="team-placeholder"><strong>${esc(C.meta.group)}</strong><span>成员 ${esc(C.meta.members)}</span><span>指导教师 ${esc(C.meta.teacher)}</span></div><div class="actions"><a class="button primary" href="#/viewer">交互三维模型 <span>↗</span></a><a class="button" href="#/media">播放演示视频</a><a class="button" href="#/slides">答辩幻灯片</a></div></div>${figure('img/R1_hero_studio.jpg',C.renders.find(r=>r[0].includes('R1_'))?.[1] || '', 'hero')}</div>${stats(C.stats)}${section('汇报提纲',`<div class="outline">${C.outline.map(([n,t,r])=>`<a class="outline-item" href="#/${r}"><b>${esc(n)}</b><span>${esc(t)}</span><span>→</span></a>`).join('')}</div>`)}`);
    },
    requirements(){put(callout('驱动性问题',C.problem.question,'orange')+`<div class="two-col"><div><div class="constraints">${C.problem.constraints.map(([t,p])=>callout(t,p)).join('')}</div><p class="note">${esc(C.problem.note)}</p></div>${figure('img/R2_work_scene.jpg',C.renders[0][1])}</div>`+section('需求与技术指标',table(['#','需求','技术指标','验证方法','结果','状态'],C.indicators.map((r,i)=>[i+1,...r]),{accent:4})));},
    scheme(){
      const totals=[2,3,4].map(col=>C.schemes.criteria.reduce((sum,r)=>sum+r[1]*r[col],0).toFixed(2));
      const comparison=C.schemes.rows.slice(1),recorded=C.schemes.rows.at(-1).slice(1);
      const mismatch=totals.some((v,i)=>Math.abs(Number(v)-Number(recorded[i]))>.001);
      put(diagram('chain','功能链')+section('方案比较',table(C.schemes.rows[0],comparison,{accent:1}))+`<div class="two-col">${section('方案评分',table(['准则','权重','A','B','C'],[...C.schemes.criteria,['加权总分','',...totals]],{accent:2}))}${diagram('radar','方案比较雷达图')}</div>`+(mismatch?callout('评分数据核对',`原始资料中的总分与权重计算结果不一致。按 Σw·score 计算：${totals.join(' / ')}；资料记录：${recorded.join(' / ')}。评分表显示实际计算值，原始资料保持原样。`,'orange'):'')+callout('取舍理由',C.schemes.reasons)+section('技术路线',diagram('route','技术路线')));
    },
    mechanisms(){
      put(`<div class="tabs" role="tablist" aria-label="关键机构">${C.mechanisms.map((m,i)=>`<button role="tab" aria-selected="${i===0}" data-tab="${i}">${esc(m.title)}</button>`).join('')}</div><div id="mechanism-panel" role="tabpanel"></div>`);
      const show=i=>{const m=C.mechanisms[i];root.querySelectorAll('[data-tab]').forEach((b,j)=>b.setAttribute('aria-selected',i===j));
        const query=m.id==='lift'?'theta=55':m.id==='gripper'?`iso=${encodeURIComponent(P.instances.find(x=>x.gripper).group)}&view=gripper`:'view=iso';
        root.querySelector('#mechanism-panel').innerHTML=`<div class="section-heading"><h2>${esc(m.title)}</h2><a class="button" href="#/viewer?${query}">在三维模型中查看 ↗</a></div><div class="two-col mechanism"><div><aside class="callout"><h3>计算依据</h3>${m.formulas.map(f=>`<p class="formula">${esc(f)}</p>`).join('')}</aside>${callout('设计要点',m.points,'orange')}</div><div>${m.img.map(p=>figure(p,m.title,'mechanism')).join('')}</div></div>`;};
      root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>show(Number(b.dataset.tab)));show(0);
    },
    control(){put(`<div class="two-col">${figure('img/C8_sensor_layout.jpg','传感器布置')}${section('传感器配置',table(['编号','传感器','安装位置','规格与用途'],C.sensors)+`<p class="note">${esc(C.sensor_note)}</p>`)}</div>`+section('作业状态',`<div class="state-chain">${C.states.map(s=>`<div tabindex="0">${esc(s)}</div>`).join('')}</div>`+diagram('state','状态机'))+section('异常处置',table(['异常','检测信号','处置策略','关联机构'],C.anomalies))+section('控制流程',diagram('flow','控制流程')));},
    parts(){
      const groups=[...new Set(P.instances.map(p=>p.group))];
      put(`<div class="filter-bar"><label>子系统<select id="part-group"><option value="">全部</option>${groups.map(g=>`<option>${esc(g)}</option>`).join('')}</select></label><label class="search-label">搜索零件<input id="part-search" type="search" placeholder="中文名 / 英文名" value="${esc(params.get('search')||'')}"></label><span id="part-count" class="note" aria-live="polite"></span></div><div class="parts-grid" id="part-grid"></div>`);
      const showDetails=p=>{
        const m=dialog(p.cn,`${figure(p.thumb,p.cn,'part-detail')}${partProperties(p)}<a class="button primary" href="#/viewer?iso=${encodeURIComponent(p.group)}&select=${encodeURIComponent(p.instances[0])}">在三维模型中定位 ↗</a>`,'part-modal');
        m.querySelector('a').onclick=()=>m.close();
      };
      const filter=()=>{
        const g=root.querySelector('#part-group').value,q=root.querySelector('#part-search').value.trim().toLowerCase();
        const parts=P.parts.filter(p=>(!g||p.group===g)&&`${p.cn} ${p.part}`.toLowerCase().includes(q));
        root.querySelector('#part-count').textContent=`${parts.length} / ${P.parts.length}`;
        root.querySelector('#part-grid').innerHTML=parts.length?parts.map(p=>`<button class="part-card card" data-part="${esc(p.part)}"><img src="${asset(p.thumb)}" alt="${esc(p.cn)}" loading="lazy"><div><span class="eyebrow">${esc(p.group)}</span><h3>${esc(p.cn)}<small>× ${p.qty}</small></h3><p class="part-id">${esc(p.part)}</p><dl><div><dt>材料</dt><dd>${esc(p.material)}</dd></div><div><dt>质量</dt><dd>${p.mass_g} g</dd></div><div><dt>包络</dt><dd>${p.bbox_mm.join(' × ')} mm</dd></div></dl></div></button>`).join(''):'<p class="empty">没有匹配的零件</p>';
        root.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>showDetails(P.parts.find(p=>p.part===b.dataset.part)));
      };root.querySelector('#part-group').onchange=filter;root.querySelector('#part-search').oninput=filter;filter();
    },
    drawings(){put(`<div class="drawing-grid">${C.drawings.map(([p,t])=>figure(p,t,'drawings')).join('')}</div>`+section('装配与一致性验证',table(['检查项','方法','结果'],C.validation,{accent:2})));},
    analysis(){
      put(section('有限元分析',table(['零件','工况','单元数','自由度','σmax / MPa','99.5% / MPa','位移 / μm','安全系数 n'],C.fea.map(f=>[f.name,f.load,f.elements,f.dof,f.vm_max,f.vm_p995,f.umax_um,f.safety]),{accent:7,select:true})+'<div id="fea-image"></div>')+section('网格收敛',`<div class="two-col">${table(['网格 / mm','单元数','自由度','99.5% / MPa','σmax / MPa','位移 / μm'],C.convergence.map(r=>[r.h,r.elements,r.dof,r.vm_p995,r.vm_max,r.umax_um]))}${diagram('conv','网格收敛')}</div>`)+callout('方法与局限',C.fea_notes,'orange')+section('稳定性',stats([{v:C.stability.mass_kg,u:'kg',k:'整机质量'},{v:C.stability.tip_lat_min,u:'°',k:'横向最小临界角'},{v:C.stability.tip_lon_min,u:'°',k:'纵向最小临界角'}])+`<p class="note">${esc(C.stability.note)}</p><div class="two-col">${figure('img/A3_lift_tipping.jpg','升降与倾覆')}${diagram('mass','质量与重心')}</div>`)+section('工作空间',figure('img/A5_workspace.jpg','工作空间')));
      const show=i=>{root.querySelector('#fea-image').innerHTML=figure(C.fea[i].img,C.fea[i].name,'fea');root.querySelectorAll('[data-row]').forEach((r,j)=>r.classList.toggle('selected-row',i===j));};
      root.querySelectorAll('[data-row]').forEach(r=>{r.onclick=()=>show(+r.dataset.row);r.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();r.click();}};});show(0);
    },
    gallery(){
      put(`<div id="gallery-main"></div><div class="gallery-thumbs">${C.renders.map(([p,t],i)=>`<button data-render="${i}" aria-label="${esc(t)}"><img src="${asset(p)}" alt="${esc(t)}"><span>${esc(t)}</span></button>`).join('')}</div>`+section('创新点',`<div class="two-col innovations">${C.innovations.map(([t,p],i)=>`<article class="card"><b>创新点 ${i+1}</b><div><h3>${esc(t)}</h3><p>${esc(p)}</p></div></article>`).join('')}</div>`));
      const show=i=>{root.querySelector('#gallery-main').innerHTML=C.renders.map(([p,t,d],j)=>`<div ${i===j?'':'hidden'}>${figure(p,t,'renders')}${i===j?`<p class="note">${esc(d)}</p>`:''}</div>`).join('');root.querySelectorAll('[data-render]').forEach((b,j)=>b.setAttribute('aria-pressed',i===j));};
      root.querySelectorAll('[data-render]').forEach(b=>b.onclick=()=>show(+b.dataset.render));show(0);
    },
    media(){put(`<div class="videos">${C.videos.map(([p,t,d],i)=>`<article class="card video-card ${i===0?'main-video':''}"><video controls preload="metadata" playsinline src="${asset(p)}" aria-label="${esc(t)}"></video><div><h2>${esc(t)}</h2><p>${esc(d)}</p><a href="${asset(p)}" download>下载视频 ↓</a></div></article>`).join('')}</div>`);cleanups.push(()=>root.querySelectorAll('video').forEach(v=>v.pause()));},
    slides(){
      let index=0;const paths=Array.from({length:C.slides.count},(_,i)=>C.slides.pattern.replace('{NN}',String(i+1).padStart(2,'0')));
      put(`<div class="section-heading"><p class="note">← / → 翻页 · 点击画面左右半区翻页</p><div class="actions"><button id="slide-fullscreen">全屏放映</button><a class="button" href="${asset(C.downloads.find(d=>d[2]==='pptx')[0])}" download>下载 PPT ↓</a></div></div><div class="slide-player" id="slide-player"><img id="slide-image" alt="幻灯片"><button class="slide-hit previous" aria-label="上一页"></button><button class="slide-hit next" aria-label="下一页"></button></div><div class="slide-controls"><button id="slide-prev">← 上一页</button><span id="slide-count" aria-live="polite"></span><button id="slide-zoom">放大查看</button><button id="slide-next">下一页 →</button></div><div class="slide-thumbs">${paths.map((p,i)=>`<button data-slide="${i}" aria-label="第 ${i+1} 页"><img src="${asset(p)}" alt="第 ${i+1} 页" loading="lazy"><span>${i+1}</span></button>`).join('')}</div><div hidden>${paths.map((p,i)=>figure(p,`第 ${i+1} 页`,'slides')).join('')}</div>`);
      const show=i=>{index=Math.max(0,Math.min(paths.length-1,i));root.querySelector('#slide-image').src=asset(paths[index]);root.querySelector('#slide-image').alt=`幻灯片 ${index+1}`;root.querySelector('#slide-count').textContent=`${index+1} / ${paths.length}`;root.querySelectorAll('[data-slide]').forEach((b,j)=>b.setAttribute('aria-current',index===j?'true':'false'));const strip=root.querySelector('.slide-thumbs'),thumb=root.querySelector(`[data-slide="${index}"]`);strip.scrollLeft=thumb.offsetLeft-strip.offsetLeft-strip.clientWidth/2+thumb.clientWidth/2;};
      root.querySelectorAll('#slide-prev,.slide-hit.previous').forEach(b=>b.onclick=()=>show(index-1));root.querySelectorAll('#slide-next,.slide-hit.next').forEach(b=>b.onclick=()=>show(index+1));
      root.querySelectorAll('[data-slide]').forEach(b=>b.onclick=()=>show(+b.dataset.slide));
      root.querySelector('#slide-zoom').onclick=()=>root.querySelectorAll('[data-lightbox]')[index].click();
      root.querySelector('#slide-fullscreen').onclick=async()=>{try{await root.querySelector('#slide-player').requestFullscreen();}catch{dialog('全屏放映','<p>浏览器未能进入全屏，可继续使用页内播放器。</p>');}};
      const keys=e=>{if(document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||document.body.classList.contains('presentation')&&document.fullscreenElement!==root.querySelector('#slide-player'))return;if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();show(index+(e.key==='ArrowRight'?1:-1));}};
      window.addEventListener('keydown',keys);cleanups.push(()=>window.removeEventListener('keydown',keys));show(0);
    },
    ai(){put(section('AI 使用记录',table(['环节','工具 / 用途','核验'],C.ai))+section('团队分工',`<p class="note">成员信息由小组填写</p>`+table(['成员','职责','工作内容'],C.team))+section('项目进度',diagram('gantt','项目进度'))+section('改进方向',table(['现有局限','改进方向'],C.improvements))+callout('结论',C.conclusion,'green'));},
    downloads(){
      put(`<div class="downloads">${C.downloads.map(([p,t,type],i)=>`<article class="download-row card"><span class="file-badge type-${esc(type)}">${esc(type.toUpperCase())}</span><div><h3>${esc(t)}</h3><span class="note" data-size="${i}"></span></div><div class="actions">${type==='pdf'?`<a class="button" href="${asset(p)}" target="_blank" rel="noopener">在线阅读</a>`:''}${type==='md'?'<button id="speech-open">查看讲稿</button>':''}<a class="button primary" href="${asset(p)}" download>下载 ↓</a></div></article>`).join('')}</div>`);
      const controller=new AbortController();cleanups.push(()=>controller.abort());
      C.downloads.forEach(async([p],i)=>{try{const r=await fetch(asset(p),{method:'HEAD',signal:controller.signal});const n=Number(r.headers.get('content-length'));if(r.ok&&n>0){const el=root.querySelector(`[data-size="${i}"]`);if(el)el.textContent=n>=1048576?`${(n/1048576).toFixed(1)} MB`:`${(n/1024).toFixed(1)} KB`;}}catch{/* Sizes are optional. */}});
      root.querySelector('#speech-open').onclick=async()=>{const b=root.querySelector('#speech-open');b.disabled=true;try{const r=await fetch(asset(C.downloads.find(d=>d[2]==='md')[0]),{signal:controller.signal});if(!r.ok)throw new Error(r.status);dialog('答辩讲稿',markdown(await r.text()),'speech-modal');}catch(e){if(e.name!=='AbortError')dialog('读取失败','<p>讲稿未能读取，请使用下载按钮重试。</p>');}finally{b.disabled=false;}};
    },
  };
  routes[route]?.();
  return ()=>cleanups.forEach(f=>f());
}
