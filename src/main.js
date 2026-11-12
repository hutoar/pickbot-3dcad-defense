import './styles.css';
import { esc, asset, initLightbox, dialog } from './ui.js';
import { renderPage } from './pages.js';

const navigation=[['home','封面'],['requirements','一 作业问题与需求'],['scheme','二 总体方案'],['mechanisms','三 关键机构'],['control','四 感知与控制'],['viewer','五 交互三维模型'],['parts','五 零件库'],['drawings','五 工程图与装配'],['analysis','五 验证分析'],['gallery','六 渲染与创新点'],['media','六 演示视频'],['slides','答辩幻灯片'],['ai','七 AI、分工与改进'],['downloads','资料下载']];
let cleanup=()=>{}, revision=0, current='home';
const app=document.getElementById('app');

async function start(){
  const [C,P]=await Promise.all(['content','parts'].map(async name=>{const r=await fetch(asset(`data/${name}.json`));if(!r.ok)throw new Error(`${name}: ${r.status}`);return r.json();}));
  document.title=C.meta.title;
  app.innerHTML=`<aside class="sidebar" id="sidebar"><a class="brand" href="#/home"><span class="brand-mark">3D<span>CAD</span></span><div><strong>三维机械设计</strong><small>项目答辩 · 数字样机</small></div></a><div class="nav-label">汇报导航</div><nav>${navigation.map(([r,t],i)=>`<a href="#/${r}" data-nav="${r}"><span class="nav-number">${String(i).padStart(2,'0')}</span><span>${esc(t)}</span></a>`).join('')}</nav><div class="sidebar-bottom"><span>${esc(C.meta.group)}</span><span>三维数字样机</span></div></aside><div class="nav-shade"></div><div class="workspace"><header class="topbar"><button class="menu-toggle" aria-label="展开导航" aria-expanded="false">☰</button><div class="breadcrumb">三维机械设计 <span>/</span> <b id="crumb"></b></div><div class="top-tools"><span id="page-number"></span><button id="presentation">演示模式 <span>⛶</span></button></div></header><main id="main"><header id="page-heading" class="page-heading"></header><div id="page"></div><footer class="page-footer"><span>${esc(C.meta.subtitle)}</span><a id="next-page"></a></footer></main></div>`;
  initLightbox();
  const menu=app.querySelector('.menu-toggle');
  const closeMenu=()=>{document.body.classList.remove('nav-open');menu.setAttribute('aria-expanded','false');};
  menu.onclick=()=>{const open=document.body.classList.toggle('nav-open');menu.setAttribute('aria-expanded',open);};app.querySelector('.nav-shade').onclick=closeMenu;
  const syncFullscreen=()=>{document.body.classList.toggle('presentation',document.fullscreenElement===document.documentElement);app.querySelector('#presentation').firstChild.textContent=document.body.classList.contains('presentation')?'退出演示 ':'演示模式 ';};
  document.addEventListener('fullscreenchange',syncFullscreen);
  app.querySelector('#presentation').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{dialog('演示模式','<p>浏览器未能进入全屏，请检查全屏权限后重试。</p>');}};
  window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(document.body.classList.contains('presentation')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const i=navigation.findIndex(([r])=>r===current);location.hash=`#/${navigation[Math.max(0,Math.min(navigation.length-1,i+(e.key==='ArrowRight'?1:-1)))][0]}`;}});
  async function route(){
    const ticket=++revision;cleanup();cleanup=()=>{};closeMenu();document.querySelectorAll('dialog').forEach(d=>d.close());
    const [path,search='']=location.hash.slice(2).split('?');current=navigation.some(([r])=>r===path)?path:'home';
    if(path!==current){location.replace('#/home');return;}
    const index=navigation.findIndex(([r])=>r===current), title=navigation[index][1];
    app.querySelectorAll('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===current);if(a.dataset.nav===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    app.querySelector('#crumb').textContent=title;app.querySelector('#page-number').textContent=`${index} / ${navigation.length-1}`;
    const heading=app.querySelector('#page-heading');heading.hidden=current==='home';heading.innerHTML=`<p class="eyebrow">章节 ${String(index).padStart(2,'0')} / 项目答辩</p><h1>${esc(title.replace(/^[一二三四五六七] /,''))}</h1>`;
    const next=app.querySelector('#next-page');next.href=`#/${navigation[(index+1)%navigation.length][0]}`;next.textContent=`${navigation[(index+1)%navigation.length][1]} →`;
    const root=app.querySelector('#page');root.className=`page page-${current}`;root.innerHTML='';window.scrollTo(0,0);
    if(current==='viewer'){
      root.innerHTML='<div class="initial-loading">正在准备三维查看器…</div>';
      try{const {mountViewer}=await import('./viewer.js');if(ticket!==revision)return;cleanup=mountViewer(root,P,new URLSearchParams(search));}catch(e){if(ticket===revision)root.innerHTML=`<div class="callout orange"><h3>三维查看器未能加载</h3><p>${esc(e.message)}</p><button onclick="location.reload()">重新加载</button></div>`;}
    }else cleanup=renderPage(current,root,C,P,new URLSearchParams(search));
  }
  window.addEventListener('hashchange',route);await route();
}
start().catch(e=>{app.innerHTML=`<div class="initial-loading"><h1>资料加载失败</h1><p>${esc(e.message)}</p><button onclick="location.reload()">重新加载</button></div>`;});
