export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const asset = (path) => `${import.meta.env.BASE_URL}${path}`;
export const image = (path, title = '', group = 'page', extra = '') => `<figure class="figure ${extra}"><button class="image-button" data-lightbox="${esc(path)}" data-image-group="${esc(group)}" data-caption="${esc(title)}" aria-label="放大查看 ${esc(title)}"><img src="${asset(path)}" alt="${esc(title)}" loading="lazy"></button>${title ? `<figcaption>${esc(title)}<span>点击放大</span></figcaption>` : ''}</figure>`;
export const table = (heads, rows, options = {}) => `<div class="table-wrap"><table><thead><tr>${heads.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row,i) => `<tr ${options.select ? `data-row="${i}" tabindex="0" role="button" aria-label="查看 ${esc(row[0])}"` : ''}>${row.map((cell,j) => `<td class="${options.accent === j ? 'accent-cell' : ''}">${typeof cell === 'boolean' ? `<span class="status ${cell ? 'verified' : 'pending'}">${cell ? '✔ 已验证' : '待测'}</span>` : esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export const callout = (title, content, color = '') => `<aside class="callout ${color}"><h3>${esc(title)}</h3>${Array.isArray(content) ? `<ul>${content.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>` : `<p>${esc(content)}</p>`}</aside>`;
export const section = (title, body, extra = '') => `<section class="section ${extra}"><h2>${esc(title)}</h2>${body}</section>`;
export const stats = (items) => `<div class="stats">${items.map(s=>`<div class="stat card"><div><strong>${esc(s.v)}</strong><span>${esc(s.u)}</span></div><p>${esc(s.k)}</p></div>`).join('')}</div>`;
export const partProperties = p => `<dl class="properties">${[['文件名',p.file],['零件标识',p.part],['子系统',p.group],['材料',p.material],['质量',`${p.mass_g} g`],['体积',`${p.volume_cm3} cm³`],['包络',`${p.bbox_mm.join(' × ')} mm`],['同类数量',p.qty],['实例',p.instances.join(' / ')]].map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;

export function dialog(title, body, className = '') {
  const el = document.createElement('dialog');
  el.className = `modal ${className}`;
  el.innerHTML = `<header><h2>${esc(title)}</h2><button data-close aria-label="关闭">×</button></header><div class="modal-body">${body}</div>`;
  document.body.append(el);
  el.querySelector('[data-close]').onclick = () => el.close();
  el.addEventListener('click', e => { if (e.target === el) el.close(); });
  el.addEventListener('close', () => el.remove(), { once: true });
  el.showModal();
  return el;
}

export function initLightbox() {
  document.addEventListener('click', e => {
    const button = e.target.closest('[data-lightbox]');
    if (!button) return;
    const scope = button.closest('dialog') || document.getElementById('page');
    const group = [...scope.querySelectorAll('[data-lightbox]')].filter(x=>x.dataset.imageGroup === button.dataset.imageGroup);
    let index = group.indexOf(button), zoom = 1, x = 0, y = 0, start;
    const modal = dialog('图片查看', '<div class="lightbox-stage"><img draggable="false" alt=""></div><footer><button data-prev aria-label="上一张">←</button><p></p><button data-reset>重置缩放</button><button data-next aria-label="下一张">→</button></footer>', 'lightbox');
    const img = modal.querySelector('img'), stage = modal.querySelector('.lightbox-stage');
    const transform = () => { img.style.transform = `translate(${x}px,${y}px) scale(${zoom})`; };
    const show = () => { zoom=1;x=y=0; img.src=group[index].dataset.lightbox ? asset(group[index].dataset.lightbox) : ''; img.alt=group[index].dataset.caption; modal.querySelector('footer p').textContent=`${index+1} / ${group.length} · ${img.alt}`;transform(); };
    const move = d => { index=(index+d+group.length)%group.length;show(); };
    modal.querySelector('[data-prev]').onclick=()=>move(-1);
    modal.querySelector('[data-next]').onclick=()=>move(1);
    modal.querySelector('[data-reset]').onclick=()=>{zoom=1;x=y=0;transform();};
    stage.addEventListener('wheel', e=>{e.preventDefault();zoom=Math.max(.5,Math.min(8,zoom*Math.exp(-e.deltaY*.001)));transform();},{passive:false});
    stage.onpointerdown=e=>{start=[e.clientX-x,e.clientY-y];stage.setPointerCapture(e.pointerId);};
    stage.onpointermove=e=>{if(start){x=e.clientX-start[0];y=e.clientY-start[1];transform();}};
    stage.onpointerup=stage.onpointercancel=()=>{start=null;};
    modal.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();move(e.key==='ArrowRight'?1:-1);}});
    show();
  });
}

// Escape first: speech can contain Markdown, but cannot inject HTML or scripts.
export function markdown(source) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
  const lines=source.replace(/\r/g,'').split('\n');let out='',i=0;
  while(i<lines.length){
    const line=lines[i];
    if(/^\s*\|/.test(line) && /^\s*\|?[\s:|-]+\|/.test(lines[i+1]||'')){
      const cells=s=>s.trim().replace(/^\||\|$/g,'').split('|').map(s=>s.trim());
      const heads=cells(line);i+=2;const rows=[];
      while(i<lines.length&&/^\s*\|/.test(lines[i]))rows.push(cells(lines[i++]));
      out+=`<div class="table-wrap"><table><thead><tr>${heads.map(x=>`<th>${inline(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${inline(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;continue;
    }
    if(/^#{1,6} /.test(line)){const level=line.match(/^#+/)[0].length;out+=`<h${level}>${inline(line.slice(level+1))}</h${level}>`;}
    else if(/^\s*([-*]|\d+[.)])\s/.test(line)){
      const ordered=/^\s*\d/.test(line),tag=ordered?'ol':'ul';out+=`<${tag}>`;
      while(i<lines.length&&/^\s*([-*]|\d+[.)])\s/.test(lines[i]))out+=`<li>${inline(lines[i++].replace(/^\s*([-*]|\d+[.)])\s/,''))}</li>`;
      out+=`</${tag}>`;continue;
    }else if(line.trim())out+=`<p>${inline(line)}</p>`;
    i++;
  }return out;
}
