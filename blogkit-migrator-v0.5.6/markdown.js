'use strict';
// Conservative WordPress HTML -> mixed Markdown converter. No external dependencies.
function decode(s){return String(s).replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp);/gi,(m,n,k)=>{if(n){try{return String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))}catch{return m}}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[k.toLowerCase()]})}
function escapeMd(s){return s.replace(/([\\`*_\[\]])/g,'\\$1')}
function detectLanguage(s){let t=s.trim();if(!t)return 'text';if(/^[\[{]/.test(t)){try{JSON.parse(t);return 'json'}catch{}}if(/<\/?(?:!doctype|html|head|body|meta|script|style|div|span|p|a|img|section|link|input|button|h[1-6])\b/i.test(t))return 'html';if(/(^|\n)\s*(?:const|let|var|function|import|export|async\s+function|console\.|document\.|window\.)\b|=>|\bawait\s+\w+\(/m.test(t))return 'js';if(/(^|\n)\s*(?:\.[\w-]+|#[\w-]+|@media\b|body\s*\{|:root\s*\{)[^\n]*\{|\b(?:display|color|background|padding|margin|font-size)\s*:/m.test(t))return 'css';if(/\bSELECT\b[\s\S]*\bFROM\b|\bINSERT\s+INTO\b|\bCREATE\s+TABLE\b/i.test(t))return 'sql';if(/^\s*(?:#!\/bin\/(?:ba)?sh|(?:npm|git|node|curl|cd|mkdir)\s+\S+)/m.test(t))return 'bash';return 'text'}

// Convert HTML lists structurally. Regex matching individual <li> cannot handle nested lists.
function convertLists(html) {
  const tag=/<\/?(?:ul|ol|li)\b[^>]*>/gi;
  const root={type:'root',children:[]};
  let stack=[root],pos=0,m;
  const current=()=>stack[stack.length-1];
  function appendText(t){if(!t)return;current().children.push({type:'text',value:t});}
  while((m=tag.exec(html))){
    appendText(html.slice(pos,m.index));
    const name=(m[0].match(/^<\/?(ul|ol|li)/i)||[])[1].toLowerCase();
    const closing=/^<\//.test(m[0]);
    if(!closing){const node={type:name,children:[]};current().children.push(node);stack.push(node);}
    else {let idx=stack.length-1;while(idx>0&&stack[idx].type!==name)idx--;if(idx>0)stack.length=idx;else appendText(m[0]);}
    pos=tag.lastIndex;
  }
  appendText(html.slice(pos));
  function render(nodes,depth=0){let out='';for(const node of nodes){
    if(node.type==='text'){out+=node.value;continue;}
    if(node.type==='ul'||node.type==='ol'){
      const items=node.children.filter(x=>x.type==='li');
      const extra=node.children.filter(x=>x.type==='text').map(x=>x.value).join('');
      if(!items.length){out+=extra;continue;}
      const lines=items.map((item,i)=>{
        const sub=item.children.filter(x=>x.type==='ul'||x.type==='ol');
        const text=item.children.filter(x=>x.type!=='ul'&&x.type!=='ol').map(x=>render([x],depth+1)).join('')
          .replace(/<\/?p\b[^>]*>/gi,'').replace(/<br\s*\/?>/gi,'  \n').trim();
        const marker=node.type==='ol'?`${i+1}. `:'- ';
        const base='  '.repeat(depth)+marker+text.replace(/\n/g,'\n'+'  '.repeat(depth+1));
        return base+(sub.length?'\n'+sub.map(x=>render([x],depth+1).replace(/^\n+|\n+$/g,'')).join('\n'):'');
      });
      out+='\n\n'+lines.join('\n')+'\n\n'+extra;
    } else if(node.type==='li')out+=render(node.children,depth);
  }return out;}
  return render(root.children);
}

function convert(source,opts={}){let warnings=[],detected=[];let s=String(source).replace(/\r\n/g,'\n');let tokens=[];function protect(v){let id='OJMDTOKEN'+tokens.length+'END';tokens.push(v);return '\n\n'+id+'\n\n'}
// Gutenberg wrappers are editor metadata; do not remove rendered HTML. Unknown blocks are reported.
s=s.replace(/<!--\s*\/?wp:([\w/-]+)(?:\s+\{[^]*?\})?\s*-->/g,(_,name)=>{if(!/^(?:paragraph|heading|list|list-item|image|quote|code|preformatted|html|group|columns|column|separator|spacer|buttons|button|table|embed|shortcode|media-text|gallery|cover|details)$/.test(name))warnings.push('gutenberg_custom_block:'+name);return ''});
// Caption shortcodes: preserve image and caption, without WP wrapper.
s=s.replace(/\[caption\b[^\]]*\]([\s\S]*?)\[\/caption\]/gi,(_,inside)=>{let im=inside.match(/<img\b[^>]*>/i);if(!im){warnings.push('caption_without_image');return protect(inside)}let src=(im[0].match(/\bsrc\s*=\s*(["'])(.*?)\1/i)||[])[2];let alt=(im[0].match(/\balt\s*=\s*(["'])(.*?)\1/i)||[])[2]||'';if(!src){warnings.push('caption_without_src');return protect(inside)}let cap=inside.replace(im[0],'').replace(/<[^>]+>/g,'').trim();let label=decode(alt||cap);return protect(`![${escapeMd(label)}](${src})${cap?'\n\n*'+escapeMd(decode(cap))+'*':''}`)});
// Protect preformatted code before general HTML conversion.
s=s.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi,(_,attrs,inner)=>{let code=inner.match(/^\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*$/i);let attr=(code?code[1]:'')+' '+attrs;let content=code?code[2]:inner;let explicit=(attr.match(/(?:language|lang)-([\w+#.-]+)/i)||[])[1]||'';let lang=explicit.toLowerCase()||detectLanguage(decode(content));if(!explicit&&lang!=='text')detected.push(lang);let text=decode(content).replace(/^\n/,'').replace(/\n[ \t]*$/,'');let fence='`'.repeat(Math.max(3,...[...text.matchAll(/`+/g)].map(x=>x[0].length+1)));return protect(`${fence}${lang}\n${text}\n${fence}`)});
// Preserve unsupported structural HTML blocks rather than stripping styles/behavior.
s=s.replace(/<(table|figure|iframe|video|audio|svg|details|form|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,m=>{warnings.push('preserved_html:'+m.match(/^<([\w-]+)/)[1]);return protect(m)});
// Common standalone images.
s=s.replace(/<img\b[^>]*>/gi,tag=>{let src=(tag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)||[])[2];if(!src){warnings.push('image_without_src');return tag}let alt=(tag.match(/\balt\s*=\s*(["'])(.*?)\1/i)||[])[2]||'';return `![${escapeMd(decode(alt))}](${src})`});
// Links and simple inline emphasis; retain complex/custom tags.
s=s.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi,(all,a,inner)=>{let href=(a.match(/\bhref\s*=\s*(["'])(.*?)\1/i)||[])[2];return href&&!/<[a-z]/i.test(inner)?`[${decode(inner)}](${href})`:all});
// Keep inline emphasis as HTML to preserve Japanese text boundaries and nested markup.
s=s.replace(/<code\b[^>]*>([^<]*)<\/code>/gi,(_,v)=>'`'+decode(v).replace(/`/g,'\\`')+'`');
s=s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,(_,n,v)=>'\n\n'+'#'.repeat(Number(n))+' '+decode(v.replace(/<[^>]+>/g,'').replace(/^\*\*(.*?)\*\*$/,'$1'))+'\n\n');
s=s.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi,(_,v)=>'\n\n'+v.replace(/<\/?p\b[^>]*>/gi,'').trim().split('\n').map(line=>'> '+decode(line)).join('\n')+'\n\n');
s=convertLists(s);
s=s.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi,(_,v)=>'\n\n'+v.trim()+'\n\n').replace(/<br\s*\/?>/gi,'  \n').replace(/<hr\s*\/?>/gi,'\n\n---\n\n');
// Avoid stripping unknown HTML: preserving it is safer than silently changing layout.
s=s.replace(/\n{3,}/g,'\n\n').trim();for(let i=0;i<tokens.length;i++)s=s.replace('OJMDTOKEN'+i+'END',tokens[i].trim());
let shortcodes=[...s.matchAll(/\[([a-z][\w-]*)(?:\s[^\]]*)?\]/gi)].map(m=>m[1]).filter(n=>!['caption'].includes(n.toLowerCase()));for(let name of new Set(shortcodes))warnings.push('unhandled_shortcode:'+name);
return {body:s+'\n',warnings:[...new Set(warnings)],detected_languages:detected};}
module.exports={convert,detectLanguage};
