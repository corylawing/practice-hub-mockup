/* DOCUMENTS IN THE HEADER SEARCH - only what each person could open.
       node test/docsearch.test.js

   07/10/2026. Cory: "the search doesn't take into accounts these documents and what the
   user does or does not have access too." SharePoint's search finds the files; these
   checks hold user.js to showing each one ONLY to someone who could open it on the
   Documents page: the section's level, their own office/brand folder of a per-office
   section, "Only certain people" on the item or a folder it sits in. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const V1=path.join(__dirname,'..','v1');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const settle=()=>new Promise(r=>setTimeout(r,20));
const OFFICE=(id,name)=>'https://omegaorthodontics.sharepoint.com/sites/Home-Brace/_layouts/15/Doc.aspx?sourcedoc=%7B'+id+'%7D&file='+encodeURIComponent(name)+'&action=default&mobileredirect=true';
const U=rel=>'https://omegaorthodontics.sharepoint.com/sites/Home-Brace/Shared%20Documents/Home-Brace%20Documents/'+rel.split('/').map(encodeURIComponent).join('/');

const SECS=[{k:'policies',n:'Policies & Handbook',structure:'plain',teamMode:'all'},
            {k:'officedocs',n:'Office Docs',structure:'byLocation'},
            {k:'payroll',n:'Payroll',structure:'plain',teamMode:'some',teams:['Admin']}];
const FOUND=[
  {id:'A',name:'Uniform Policy.pdf',file:{},webUrl:U('Policies & Handbook/Uniform Policy.pdf')},
  {id:'B',name:'Payroll 2026.xlsx',file:{},webUrl:U('Payroll/Payroll 2026.xlsx')},
  {id:'C',name:'Lease Hobbs.pdf',file:{},webUrl:U('Office Docs/Hobbs/Lease Hobbs.pdf')},
  {id:'D',name:'Lease Carlsbad.pdf',file:{},webUrl:U('Office Docs/Carlsbad/Lease Carlsbad.pdf')},
  {id:'E',name:'Raise Policy.pdf',file:{},webUrl:U('Policies & Handbook/Raise Policy.pdf')},
  {id:'G',name:'Bonus Policy.pdf',file:{},webUrl:U('Policies & Handbook/Managers Only/Bonus Policy.pdf')},
  {id:'H',name:'Outside.pdf',file:{},webUrl:'https://omegaorthodontics.sharepoint.com/sites/Home-Brace/Shared%20Documents/Other/Outside.pdf'},
  {id:'S',name:'Policies & Handbook',folder:{},webUrl:U('Policies & Handbook')}];
/* 14/10/2026, Jessica: searching "hygiene", the oral hygiene form (a Word file) never came up.
   SharePoint gives Word, Excel and PowerPoint files an Office Online address with no folders
   in it - these are placed by their folder instead. W2 shares W's folder: looked up once. */
const FOUND_OFFICE=[
  {id:'W',name:'Oral Hygiene Form.docx',file:{},webUrl:OFFICE('W','Oral Hygiene Form.docx'),parentReference:{driveId:'D1',id:'P1'}},
  {id:'W2',name:'Hygiene Checklist.docx',file:{},webUrl:OFFICE('W2','Hygiene Checklist.docx'),parentReference:{driveId:'D1',id:'P1'}},
  {id:'X',name:'Hygiene Bonus Sheet.xlsx',file:{},webUrl:OFFICE('X','Hygiene Bonus Sheet.xlsx'),parentReference:{driveId:'D1',id:'F9'}},
  {id:'Y',name:'Hygiene Hobbs Log.docx',file:{},webUrl:OFFICE('Y','Hygiene Hobbs Log.docx')},
  {id:'Y2',name:'Hygiene Carlsbad Log.docx',file:{},webUrl:OFFICE('Y2','Hygiene Carlsbad Log.docx'),parentReference:{driveId:'D1',id:'P4'}},
  {id:'Z',name:'Hygiene Outside.docx',file:{},webUrl:OFFICE('Z','Hygiene Outside.docx'),parentReference:{driveId:'D1',id:'P3'}}];
const META={E:{teams:['Office Managers'],offices:[]}, F9:{teams:['Office Managers'],offices:[]}};
const LINKS=[{id:'L1|policies|',sec:'policies',sub:'',name:'Uniform Dashboard.xlsx',webUrl:'https://omegaorthodontics-my.sharepoint.com/x1',hidden:false},
             {id:'L2|officedocs|Carlsbad',sec:'officedocs',sub:'Carlsbad',name:'Uniform Carlsbad Sheet.xlsx',webUrl:'https://omegaorthodontics-my.sharepoint.com/x2',hidden:false},
             {id:'L3|policies|',sec:'policies',sub:'',name:'Uniform Old.xlsx',webUrl:'https://omegaorthodontics-my.sharepoint.com/x3',hidden:true}];
const ACCESS={
  'Staff':{schedule:'view',team:'view',documents:'view',policies:'view',officedocs:'view',payroll:'none'},
  'Office Managers':{schedule:'edit',team:'view',documents:'edit',policies:'view',officedocs:'view',payroll:'none'},
  'Admin':{admin:'manage',schedule:'manage',team:'view',documents:'manage',policies:'manage',officedocs:'manage',payroll:'manage'}};

function load(host, profile, opt){
  opt=opt||{};
  const LS={ph_access:JSON.stringify(ACCESS)}, calls=[];
  const mk=()=>({style:{},classList:{add(){},remove(){},contains(){return false}},children:[],appendChild(c){return c},remove(){},
    setAttribute(){},getAttribute(){return null},querySelector(){return null},querySelectorAll(){return []},addEventListener(){},insertBefore(){},
    set innerHTML(v){},get innerHTML(){return ''},set textContent(v){},get textContent(){return ''}});
  const ctx={console,Promise,Date,JSON,Math,Object,Array,String,Number,RegExp,Set,URL,isNaN,parseInt,parseFloat,setTimeout,clearTimeout,
    encodeURIComponent,decodeURIComponent,
    localStorage:{getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v)},removeItem:k=>{delete LS[k]}},
    location:{hostname:host,pathname:'/v1/home.html',search:'',origin:'https://x',assign(){},reload(){}},
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
    document:{readyState:'complete',documentElement:mk(),body:mk(),head:mk(),createElement:mk,getElementById:()=>null,
      querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},dispatchEvent(){return true}},
    navigator:{userAgent:'node'},
    fetch:()=>Promise.resolve({ok:false,json:()=>Promise.resolve({})}),
    PH_STORE:{get:k=>Promise.resolve(k==='ph_docsecs'?JSON.parse(JSON.stringify(SECS)):k==='ph_docmeta'?JSON.parse(JSON.stringify(META)):k==='ph_doclinks'?JSON.parse(JSON.stringify(LINKS)):null),
      set:()=>Promise.resolve({}),update:()=>Promise.resolve({})},
    PH_AUTH:{token:()=>Promise.resolve('t'), graph:p=>{ calls.push(p);
      if(p==='/sites/omegaorthodontics.sharepoint.com:/sites/Home-Brace') return Promise.resolve({id:'site'});
      if(p==='/sites/site/drive?$select=id') return Promise.resolve({id:'D1'});
      if(p==='/drives/D1/root:/Home-Brace%20Documents?$select=id') return Promise.resolve({id:'BASE'});
      if(p==='/drives/D1/items/F9?$select=id,webUrl,folder') return Promise.resolve({id:'F9',folder:{},webUrl:U('Policies & Handbook/Managers Only')});
      if(p==='/drives/D1/items/E?$select=id,webUrl,folder') return Promise.resolve({id:'E',file:{},webUrl:U('Policies & Handbook/Raise Policy.pdf')});
      if(p==='/drives/D1/items/P1?$select=id,webUrl,folder') return Promise.resolve({id:'P1',folder:{},webUrl:U('Policies & Handbook')});
      if(p==='/drives/D1/items/P2?$select=id,webUrl,folder') return Promise.resolve({id:'P2',folder:{},webUrl:U('Office Docs/Hobbs')});
      if(p==='/drives/D1/items/P4?$select=id,webUrl,folder') return Promise.resolve({id:'P4',folder:{},webUrl:U('Office Docs/Carlsbad')});
      if(p==='/drives/D1/items/P3?$select=id,webUrl,folder') return Promise.resolve({id:'P3',folder:{},webUrl:'https://omegaorthodontics.sharepoint.com/sites/Home-Brace/Shared%20Documents/Other'});
      if(p==='/drives/D1/items/Y?$select=id,parentReference') return Promise.resolve({id:'Y',parentReference:{driveId:'D1',id:'P2'}});
      if(opt.refuseParent && /parentReference/.test(p) && /search\(q=/.test(p)) return Promise.reject(new Error('Graph 400: Invalid $select'));
      if(opt.refuseParent && /^\/drives\/D1\/items\/W2?\?\$select=id,parentReference$/.test(p)) return Promise.resolve({id:p.slice(15,17).replace('?',''),parentReference:{driveId:'D1',id:'P1'}});
      if(/^\/drives\/D1\/items\/BASE\/search\(q='hygiene'/.test(p)) return Promise.resolve({value:JSON.parse(JSON.stringify(FOUND_OFFICE)).map(x=>{ if(opt.refuseParent) delete x.parentReference; return x; })});
      if(/^\/drives\/D1\/items\/BASE\/search\(q='/.test(p)) return Promise.resolve({value:JSON.parse(JSON.stringify(FOUND))});
      return Promise.reject(new Error('Graph 404: '+p)); }}};
  ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx; ctx.addEventListener=()=>{};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(V1,'_staff.js'),'utf8'),ctx,{filename:'_staff.js'});
  vm.runInContext(fs.readFileSync(path.join(V1,'user.js'),'utf8'),ctx,{filename:'user.js'});
  if(profile) ctx.PH.setProfile(profile);
  return {PH:ctx.PH, calls};
}
const LIVE='kind-hill-00da87410.3.azurestaticapps.net';
const person=(name,dept,office)=>({displayName:name, mail:name.toLowerCase().replace(/\s+/g,'.')+'@example.com',
  userPrincipalName:name.toLowerCase().replace(/\s+/g,'.')+'@example.com', jobTitle:'', department:dept, officeLocation:office});
const names=list=>list.map(x=>x.name).sort();

(async()=>{
  { const {PH}=load(LIVE, person('Sam Staff','Staff','Hobbs')); await settle();
    const r=await PH.searchDocs('uniform'), n=names(r);
    t('staff find what their section lets them open', n.includes('Uniform Policy.pdf') && n.includes('Policies & Handbook') && n.includes('Uniform Dashboard.xlsx'));
    t('...their own office’s folder, not another office’s', n.includes('Lease Hobbs.pdf') && !n.includes('Lease Carlsbad.pdf') && !n.includes('Uniform Carlsbad Sheet.xlsx'));
    t('nothing from a section they can’t open (Payroll)', !n.includes('Payroll 2026.xlsx'));
    t('nothing set to "Only certain people" that leaves them out', !n.includes('Raise Policy.pdf'));
    t('nothing inside a folder that’s restricted from them', !n.includes('Bonus Policy.pdf'));
    t('nothing outside Home-Brace Documents, nothing un-linked', !n.includes('Outside.pdf') && !n.includes('Uniform Old.xlsx'));
    const s=r.find(x=>x.name==='Policies & Handbook'), f=r.find(x=>x.name==='Uniform Policy.pdf');
    t('a section opens on the Documents page; a file opens the real file in a new tab', s && s.href==='documents.html#policies' && !s.newTab && f && /Uniform%20Policy\.pdf$/.test(f.href) && f.newTab);
    t('each says where it lives', f && f.where==='Policies & Handbook' && (r.find(x=>x.name==='Lease Hobbs.pdf')||{}).where==='Office Docs › Hobbs');
    const html=PH.searchDocsHTML(r);
    t('the results are links, files in a new tab', /target="_blank"/.test(html) && html.indexOf('href="documents.html#policies"')>=0);
    // Jessica's report: Word / Excel files have an Office Online address with no folders in it.
    const h=await PH.searchDocs('hygiene'), hn=names(h), w=h.find(x=>x.name==='Oral Hygiene Form.docx');
    t('a Word file in a section they can open is found (placed by its folder)', !!w && w.where==='Policies & Handbook' && /Doc\.aspx/.test(w.href) && w.newTab);
    t('...even when SharePoint\u2019s result does not name the folder', (h.find(x=>x.name==='Hygiene Hobbs Log.docx')||{}).where==='Office Docs \u203a Hobbs');
    t('Word / Excel files follow the same rules: restricted folder, other office, outside', !hn.includes('Hygiene Bonus Sheet.xlsx') &&
      !hn.includes('Hygiene Carlsbad Log.docx') && !hn.includes('Hygiene Outside.docx')); }

  { const {PH}=load(LIVE, person('Olivia Manager','Office Managers','Hobbs')); await settle();
    const n=names(await PH.searchDocs('uniform'));
    t('an office manager also gets the files meant for office managers', n.includes('Raise Policy.pdf') && n.includes('Bonus Policy.pdf') &&
      names(await PH.searchDocs('hygiene')).includes('Hygiene Bonus Sheet.xlsx'));
    t('...but still not Payroll, nor another office', !n.includes('Payroll 2026.xlsx') && !n.includes('Lease Carlsbad.pdf')); }

  { const {PH,calls}=load(LIVE, person('Priya Tatum','Admin','')); await settle();
    const n=names(await PH.searchDocs('uniform'));
    const hn=names(await PH.searchDocs('hygiene'));
    t('an admin finds the Word and Excel files too', ['Oral Hygiene Form.docx','Hygiene Checklist.docx','Hygiene Bonus Sheet.xlsx','Hygiene Hobbs Log.docx','Hygiene Carlsbad Log.docx'].every(x=>hn.includes(x)) && !hn.includes('Hygiene Outside.docx'));
    t('a folder shared by several results is looked up once', calls.filter(c=>c==='/drives/D1/items/P1?$select=id,webUrl,folder').length===1);
    const before=calls.length; await PH.searchDocs('hygiene');
    t('...and not again on the next search', !calls.slice(before).some(c=>/\/items\/(P[0-9]|Y)\?/.test(c)));
    t('an admin finds everything in Home-Brace Documents', ['Uniform Policy.pdf','Payroll 2026.xlsx','Lease Hobbs.pdf','Lease Carlsbad.pdf','Raise Policy.pdf','Bonus Policy.pdf','Uniform Carlsbad Sheet.xlsx'].every(x=>n.includes(x)));
    t('...but never what is outside it or un-linked', !n.includes('Outside.pdf') && !n.includes('Uniform Old.xlsx')); }

  { const {PH,calls}=load(LIVE, person('Priya Tatum','Admin',''), {refuseParent:true}); await settle();
    const hn=names(await PH.searchDocs('hygiene'));
    t('if SharePoint refuses the folder field, search still works (asked the old way)', hn.includes('Oral Hygiene Form.docx') && hn.includes('Hygiene Hobbs Log.docx') &&
      calls.filter(c=>/search\(q='hygiene'\)/.test(c)).length===2); }

  { const {PH,calls}=load('localhost', person('Sam Staff','Staff','Hobbs')); await settle();
    const r=await PH.searchDocs('uniform');
    t('the sandbox never searches SharePoint', r.length===0 && !calls.some(c=>/search/.test(c))); }

  { const {PH,calls}=load(LIVE, person('Sam Staff','Staff','Hobbs')); await settle();
    t('one letter searches nothing', (await PH.searchDocs('u')).length===0 && !calls.length);
    await PH.searchDocs("o'brien policy");
    const q=calls.find(c=>/search\(q=/.test(c))||'';
    t('a quote in what is typed is escaped for SharePoint', q.indexOf("o''brien")>=0 || q.indexOf(encodeURIComponent("o''brien"))>=0); }

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})();
