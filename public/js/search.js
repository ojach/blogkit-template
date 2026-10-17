const input=document.querySelector('[data-search]');
const list=document.querySelector('[data-results]');
if(input&&list){
  let articles=[];
  fetch(input.dataset.indexUrl || 'search-index.json').then(r=>{if(!r.ok)throw new Error('Search index unavailable');return r.json()}).then(data=>articles=data).catch(()=>{});
  const addText=(parent,tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;parent.append(el);return el};
  const showOriginal=()=>list.querySelectorAll('[data-card]').forEach(el=>el.hidden=false);
  const render=found=>{
    list.replaceChildren();
    if(!found.length){addText(list,'li',input.dataset.noResults||'No matching articles.','empty');return}
    for(const a of found){
      const li=document.createElement('li');li.className='article-card';li.dataset.card='';
      const meta=[a.displayDate||a.published,a.category].filter(Boolean).join(' · ');addText(li,'div',meta,'article-meta');
      const heading=document.createElement('h2');const link=document.createElement('a');link.href=a.url;link.textContent=a.title;heading.append(link);li.append(heading);
      addText(li,'p',a.excerpt||a.description);list.append(li);
    }
  };
  let originalHtml=list.innerHTML;
  input.addEventListener('input',()=>{
    const q=input.value.trim().toLocaleLowerCase();
    if(!q){list.innerHTML=originalHtml;return}
    const found=articles.filter(a=>(a.title+' '+a.description).toLocaleLowerCase().includes(q));render(found);
  });
}
