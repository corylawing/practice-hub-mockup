/* WORD FILES OPEN AS THEY PRINT (16/11/2026).
       node test/wordpdf.test.js

   Heather: "some word documents show up formatted weird in Home Brace but when I put them in as pdfs they are
   correct." Word for the web lays out forms loosely; Microsoft's own PDF of the file (Graph ?format=pdf) matched it.
   A Word file opened from Home-Brace now opens as that PDF in a new tab, the Word link kept for everything else. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const U=fs.readFileSync(path.join(__dirname,'..','v1','user.js'),'utf8');
const D=fs.readFileSync(path.join(__dirname,'..','v1','documents.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const block=U.slice(U.indexOf('  const WORD_RX='), U.indexOf('  function docRel(webUrl){'));

function make(o){
  o=o||{};
  const calls={fetch:[], replaced:[], opened:0, prevented:0}, handlers=[];
  const w={document:{title:'', body:{innerHTML:''}}, location:{replace:u=>calls.replaced.push(u)}};
  const ctx={
    calls, w, handlers,
    isLive:()=>o.live!==false,
    PH_AUTH:{token:()=>Promise.resolve('TOKEN')},
    docContext:()=>Promise.resolve({driveId:'DRIVE1'}),
    escHTML:v=>String(v).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';'),
    fetch:(u,opt)=>{ calls.fetch.push({u, auth:opt&&opt.headers&&opt.headers.Authorization});
      if(o.fail) return Promise.resolve({ok:false, status:500});
      return Promise.resolve({ok:true, status:200, blob:()=>Promise.resolve({size:o.empty?0:1234})}); },
    Blob:function(parts, opt){ this.type=opt&&opt.type; },
    URL:{createObjectURL:()=>'blob:https://x/abc', revokeObjectURL:()=>{}},
    setTimeout:()=>0, Promise, String, encodeURIComponent,
    navigator:{userAgent:o.ua||'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/157', standalone:false},
    document:{addEventListener:(type,f)=>{ if(type==='click') handlers.push(f); }},
  };
  ctx.window={ PH_AUTH:ctx.PH_AUTH,
    matchMedia:q=>({matches: /standalone/.test(q) ? !!o.standalone : /pointer: fine/.test(q) ? o.fine!==false : false}),
    open:()=>{ calls.opened++; return o.blocked ? null : w; } };
  ctx.matchMedia=ctx.window.matchMedia;
  vm.createContext(ctx);
  vm.runInContext(block.replace(/escAttr/g,'escHTML')+'\nthis.isWordName=isWordName; this.wordAttrs=wordAttrs; this.wordPdfInto=wordPdfInto;', ctx);
  return ctx;
}
const link=(attrs)=>({ getAttribute:k=>attrs[k]===undefined?null:attrs[k], href:'https://contoso.sharepoint.com/_layouts/15/Doc.aspx?x&action=view', textContent:'Form.docx' });
function click(c, a, mods){
  let prevented=false;
  const e=Object.assign({ target:{closest:()=>a}, button:0, defaultPrevented:false, preventDefault:()=>{ prevented=true; } }, mods||{});
  c.handlers.forEach(f=>f(e)); return prevented;
}
const tick=()=>new Promise(r=>setImmediate(r));

(async()=>{
  let c=make();
  t('Word files are .doc/.docx (and .dot/.dotx/.rtf/.odt); PDFs, Excel and PowerPoint are left alone',
    ['A.docx','b.DOC','c.dotx','d.rtf'].every(c.isWordName) && !['a.pdf','b.xlsx','c.pptx','d.docx.pdf'].some(c.isWordName));
  t('a Word file’s link carries its id and name (escaped); anything else carries nothing',
    / data-word="ID1" data-name="Bob&#39;s &#60;form&#62;\.docx"/.test(c.wordAttrs("Bob's <form>.docx",'ID1')) && c.wordAttrs('x.pdf','ID1')==='' && c.wordAttrs('x.docx','')==='');

  let r=await c.wordPdfInto(c.w,'',"ITEM'1",'Medical History.docx','https://word/link');
  t('the PDF is Microsoft’s own conversion of that file, asked for with the signed-in person’s token',
    c.calls.fetch.length===1 && c.calls.fetch[0].u==="https://graph.microsoft.com/v1.0/drives/DRIVE1/items/ITEM'1/content?format=pdf" && c.calls.fetch[0].auth==='Bearer TOKEN');
  t('…and the new tab is sent to it (while it’s made, the tab says "Opening <name>…")',
    r==='pdf' && c.calls.replaced[0]==='blob:https://x/abc' && /Opening <b[^>]*>Medical History\.docx<\/b>/.test(c.w.document.body.innerHTML) && c.w.document.title==='Medical History.docx');
  c=make({fail:true}); r=await c.wordPdfInto(c.w,'D','I','x.docx','https://word/link');
  t('when the PDF can’t be made, the tab opens the Word link instead (as before)', r==='word' && c.calls.replaced[0]==='https://word/link');
  c=make({empty:true}); r=await c.wordPdfInto(c.w,'D','I','x.docx','https://word/link');
  t('an empty answer counts as "can’t be made"', r==='word' && c.calls.replaced[0]==='https://word/link');

  c=make(); let p=click(c, link({'data-word':'I','data-drive':'D','data-name':'x.docx'})); await tick(); await tick();
  t('a click on a computer opens one new tab and stops the Word link', p && c.calls.opened===1);
  c=make(); p=click(c, link({'data-word':'I'}), {metaKey:true});
  t('Cmd/Ctrl/Shift/middle-click: the Word link itself', !p && c.calls.opened===0 && !click(c, link({'data-word':'I'}), {ctrlKey:true}) && !click(c, link({'data-word':'I'}), {button:1}));
  c=make({ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)'}); p=click(c, link({'data-word':'I'}));
  t('a phone: the Word link, as before', !p && c.calls.opened===0);
  c=make({fine:false}); t('a touch screen: the Word link', !click(c, link({'data-word':'I'})) && c.calls.opened===0);
  c=make({standalone:true}); t('the home-screen app: the Word link', !click(c, link({'data-word':'I'})) && c.calls.opened===0);
  c=make({live:false}); t('the sandbox (no SharePoint): the link as it is', !click(c, link({'data-word':'I'})) && c.calls.opened===0);
  c=make({blocked:true}); p=click(c, link({'data-word':'I'}));
  t('a blocked new tab: the Word link isn’t stopped, so it still opens', !p && c.calls.opened===1);

  t('Documents: a Word file’s name and its Open both carry it', /rel="noopener"'\+wordA\(f\)\+'>'\+escH\(f\.name\)/.test(D) && /rel="noopener"'\+wordA\(f\)\+'>Open ↗<\/a>'/.test(D));
  t('Documents: "Edit" (Word itself) only for Word files, only for people who can edit there',
    /\(ctx\.canEdit && wordA\(f\) \? '<a class="sp" href="'\+escH\(safeUrl\(f\.webUrl\)\)\+'" target="_blank" rel="noopener"[^>]*>Edit ↗<\/a>' : ''\)/.test(D));
  t('linked files (kept elsewhere) are left as they were', !/openUrl\(l\.webUrl\)\)\+'" target="_blank" rel="noopener"'\+wordA/.test(D));
  t('the header search: a Word file found carries it too',
    /word:\(!it\.folder && isWordName\(it\.name\)\) \? \{item:it\.id, drive:ctx\.driveId\} : null,/.test(U) && /\(d\.word\?wordAttrs\(d\.name, d\.word\.item, d\.word\.drive\):''\)/.test(U));

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})();
