/* A MADE-UP PRODUCTION WORKBOOK, laid out like Heather's: her row names, her kinds of formulas
   (a growth number on last year, a total of two goals, the case fee as one fixed box, the
   Dashboard reading the office tabs), made-up numbers only. Shared by the production tests.

       const {workbook} = require('./madeup-workbook.js')(require('../v1/prodbook.js'));
       workbook(2026)                       // the bytes of an .xlsx
       workbook(2026, {typedGoal:true})     // January's TC goal typed in by hand
       workbook(2026, {black:true})         // Jan-Mar blacked out on the Dashboard
       workbook(2026, {dec:999999})         // December's TC Net Production typed
       workbook(2026, {yoy:true})           // the Dashboard's "2026 | 2025 | YOY Change" table */
module.exports = function(B){
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
const COLS='BCDEFGHIJKLM'.split('');
function monthly(row, fn){ const o={}; COLS.forEach((c,i)=>{ const v=fn(c,i); if(v!==undefined) o[c+row]=v; }); return o; }
function sheets(year, opts){
  opts=opts||{}; const Y=year, L=year-1, P=year-2;
  const carl=Object.assign({A1:'CARLSBAD (FFO)'}, monthly(1,(c,i)=>MON[i]),
    {A3:'TC Net Production (Total - Discounts)'}, monthly(3,(c,i)=>i<9?100000+i*5000:(opts.dec&&i===11?opts.dec:undefined)),
    {A4:'Write-Offs and other Adjustments'}, monthly(4,(c,i)=>i<9?-1000:undefined),
    {A5:'Completed Number of Production Days'}, monthly(5,(c,i)=>i<9?9:undefined),
    {A6:'Number of Medicaid Starts'}, monthly(6,(c,i)=>i<9?2:undefined),
    {A8:L+' Net Production (Non-Medicaid)'}, monthly(8,(c,i)=>90000+i*1000),
    {A10:L+' Medicaid Production'}, monthly(10,(c,i)=>(i===11?{f:'3*4000'}:8000)),
    {A12:Y+' TC Production Goal (Non-Medicaid)'}, monthly(12,(c,i)=>opts.typedGoal&&i===0?123456:{f:c+'8*1.04'}),
    {A13:Y+' Actual TC Net Production (Non-Medicaid)'}, monthly(13,c=>({f:c+'3'})),
    {A14:Y+' Medicaid Production Goal'}, monthly(14,c=>({f:c+'10*1.04'})),
    {A15:Y+' Actual Medicaid Production'}, monthly(15,c=>({f:c+'6*$B$30'})),
    {A16:Y+' Total Production Goal (TC + Medicaid)'}, monthly(16,c=>({f:c+'12+'+c+'14'})),
    {A17:Y+' STRETCH Production Goal (TC + Medicaid)'}, monthly(17,c=>({f:c+'16*1.1'})),
    {A18:Y+' Actual TC ONLY + Medicaid Production'}, monthly(18,c=>({f:c+'13+'+c+'15'})),
    {A20:'Number of Production Days ('+L+')'}, monthly(20,()=>8),
    {A21:'Number of Production Days ('+Y+')'}, monthly(21,()=>9),
    {A22:'Needed Number of Starts per day in '+Y+' (Non-Medicaid)'}, monthly(22,c=>({f:c+'12/'+c+'21/$B$29'})),
    {A24:'Current Tracking (Over/Under) to Goal'}, monthly(24,c=>({f:c+'18-'+c+'16/'+c+'21*'+c+'5'})),
    {A25:'Current # of Starts Ahead or Behind Goal'}, monthly(25,c=>({f:c+'24/$B$29'})),
    {A29:L+' Average Case Fee', B29:5000, A30:'Medicaid Case Fee', B30:4000, A31:'Total Starts', B31:40});
  const lub=Object.assign({A1:'LUBBOCK (FFO)'}, monthly(1,(c,i)=>MON[i]),
    {A3:'TC Net Production (Total - Discounts)'}, monthly(3,(c,i)=>i<9?60000+i*1000:undefined),
    {A4:'Write-Offs and other Adjustments'}, monthly(4,(c,i)=>i<9?-500:undefined),
    {A5:'Completed Number of Production Days'}, monthly(5,(c,i)=>i<9?8:undefined),
    {A7:P+' Net Production'}, monthly(7,()=>50000),
    {A8:L+' Net Production'}, monthly(8,()=>55000),
    {A10:Y+' TC Production Goal'}, monthly(10,(c,i)=>({f:c+'8*'+(i===10?1.75:1.1)})),
    {A11:Y+' STRETCH Production Goal'}, monthly(11,c=>({f:c+'8*1.25'})),
    {A12:Y+' Actual TC Net Production'}, monthly(12,c=>({f:c+'3'})),
    {A18:'Number of NPE (2022)'}, monthly(18,()=>30),
    {A20:'Number of Production Days ('+L+')'}, monthly(20,()=>8),
    {A21:'Number of Production Days ('+Y+')'}, monthly(21,()=>8),
    {A22:'Needed Number of Starts per day in '+Y}, monthly(22,c=>({f:c+'10/'+c+'21/$B$34'})),
    {A31:'Current Tracking (Over/Under) to Goal'}, monthly(31,c=>({f:c+'3-'+c+'10'})),
    {A32:'Current # of Starts (Ahead/Behind) TC Goal'}, monthly(32,c=>({f:c+'31/$B$34'})),
    {A34:L+' Average Case Fee', B34:5200, A35:Y+' Average Case Fee'}, monthly(35,(c,i)=>i<9?5000+i*10:undefined));
  const dash={A1:'DASHBOARD', A3:'', B3:'Jan', ...(opts.yoy?{C3:'Feb',D3:'Mar',E3:'Apr',F3:'May',G3:'Jun',H3:'Jul',I3:'Aug',J3:'Sep',K3:'Oct',L3:'Nov',M3:'Dec'}:{}), A33:'', B33:Y, C33:L, A34:'Carlsbad (FFO)', B34:{f:"'Carlsbad (FFO)'!B18/'Carlsbad (FFO)'!B5"}, C34:20000,
              ...(opts.yoy?{D33:'YOY Change', D34:{f:'B34-C34'}}:{}),
              A5:'Carlsbad (FFO) Production Tracking'};
  Object.assign(dash, monthly(5,(c,i)=>i<3?(opts.black?{blank:true, s:2}:{f:"'Carlsbad (FFO)'!"+c+"24"}):{f:"'Carlsbad (FFO)'!"+c+"24", s:3}));
  return {'Dashboard':dash, 'Carlsbad (FFO)':carl, 'Lubbock (FFO)':lub};
}
/* XML from that, with Excel's own cached results worked out first (so "check" can compare) */
function workbook(year, opts){
  const S=sheets(year, opts), names=Object.keys(S), sst=[], si=v=>{ let i=sst.indexOf(v); if(i<0){ sst.push(v); i=sst.length-1; } return i; };
  const xmlCells=(cells, vals)=>{
    const rows={}; Object.keys(cells).forEach(a=>{ const r=+/\d+$/.exec(a)[0]; (rows[r]=rows[r]||[]).push(a); });
    return Object.keys(rows).map(Number).sort((a,b)=>a-b).map(r=>'<row r="'+r+'">'+rows[r].sort((a,b)=>B.colNum(/^[A-Z]+/.exec(a)[0])-B.colNum(/^[A-Z]+/.exec(b)[0])).map(a=>{
      const c=cells[a], st=(c&&c.s)?' s="'+c.s+'"':'';
      if(typeof c==='string') return '<c r="'+a+'" t="s"'+st+'><v>'+si(c)+'</v></c>';
      if(typeof c==='number') return '<c r="'+a+'"'+st+'><v>'+c+'</v></c>';
      if(c.blank) return '<c r="'+a+'"'+st+'/>';
      const v=vals?vals(a):'', te=B.isErr(v)?' t="e"':(typeof v==='string'?' t="str"':'');
      return '<c r="'+a+'"'+st+te+'><f>'+c.f.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</f>'+(v===''?'':'<v>'+v+'</v>')+'</c>';
    }).join('')+'</row>').join('');
  };
  const files=vals=>{
    const f={
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
      '_rels/.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+names.map((n,i)=>'<sheet name="'+n+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>',
      'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+names.map((n,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId90" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId91" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor theme="1"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFF8A8A"/><bgColor indexed="64"/></patternFill></fill></fills><cellXfs count="4"><xf fillId="0"/><xf fillId="0"/><xf fillId="2" applyFill="1"/><xf fillId="3" applyFill="1"/></cellXfs></styleSheet>'
    };
    names.forEach((n,i)=>{ f['xl/worksheets/sheet'+(i+1)+'.xml']='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+xmlCells(S[n], vals?(a=>vals(n,a)):null)+'</sheetData></worksheet>'; });
    f['xl/sharedStrings.xml']='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+sst.map(x=>'<si><t>'+x+'</t></si>').join('')+'</sst>';
    return f;
  };
  const first=B.parseBook(Object.fromEntries(Object.entries(files(null)).map(([k,v])=>[k,new TextEncoder().encode(v)]))), ev=B.evaluate(first);
  return B.writeZip(files((s,a)=>{ const v=ev.value(s,a); return v==null?'':v; }));
}

  return {workbook:workbook, sheets:sheets};
};
