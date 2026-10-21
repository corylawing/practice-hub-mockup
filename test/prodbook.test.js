/* PRODUCTION BOOKS - Home-Brace working out the production workbook itself.

       node test/prodbook.test.js

   21/10/2026. Home-Brace keeps its own copy of the production workbook, one book per year: the
   template (labels, formatting, that year's formulas) and the numbers people typed. These check
   the engine on a small made-up workbook: reading .xlsx (stored and compressed), the formulas the
   practice's workbook uses (+ - * /, SUM, AVERAGE, ranges, other tabs, shared formulas, #REF! and
   #DIV/0!), and that the Excel it writes back is the template with the numbers put in.
   The real workbook is checked the same way on Cory's Mac only - its numbers never go in the repo.
   Made-up numbers only. */
const zlib=require('zlib');
const B=require('../v1/prodbook.js');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const enc=s=>new TextEncoder().encode(s);

/* ---- a small workbook, written by hand, with Excel's own cached results in <v> ---- */
const SST=['OFFICE A','TC Net Production','Completed Days','2026 Goal','Per day','Total','Typed in a formula','Broken','Mixed','DASHBOARD'];
const s=i=>'<c r="A'+i[0]+'" t="s"'+(i[2]!=null?' s="'+i[2]+'"':'')+'><v>'+i[1]+'</v></c>';
const SHEET1='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="40" customWidth="1"/></cols><sheetData>'+
  '<row r="1">'+s([1,0,1])+'</row>'+
  '<row r="3">'+s([3,1])+'<c r="B3" s="2"><v>100000</v></c><c r="C3" s="2"><v>120000</v></c><c r="D3" s="2"/></row>'+
  '<row r="4">'+s([4,2])+'<c r="B4"><v>10</v></c><c r="C4"><v>0</v></c><c r="D4"><v>8</v></c></row>'+
  '<row r="5">'+s([5,3])+'<c r="B5" s="2"><f t="shared" ref="B5:D5" si="0">B3*1.04</f><v>104000</v></c><c r="C5" s="2"><f t="shared" si="0"/><v>124800</v></c><c r="D5" s="2"><f t="shared" si="0"/><v>0</v></c></row>'+
  '<row r="6">'+s([6,4])+'<c r="B6"><f>B3/B4</f><v>10000</v></c><c r="C6" t="e"><f>C3/C4</f><v>#DIV/0!</v></c><c r="D6"><f>D3/D4</f><v>0</v></c></row>'+
  '<row r="7">'+s([7,5])+'<c r="B7"><f>SUM(B5:D5)</f><v>228800</v></c><c r="C7"><f>AVERAGE(B4:D4)</f><v>6</v></c><c r="D7" t="e"><f>SUM(B6:D6)</f><v>#DIV/0!</v></c></row>'+
  '<row r="8">'+s([8,6])+'<c r="B8"><f>18/B4</f><v>1.8</v></c></row>'+
  '<row r="9">'+s([9,7])+'<c r="B9" t="e"><f>B3/#REF!</f><v>#REF!</v></c></row>'+
  '<row r="10">'+s([10,8])+'<c r="B10"><f>-B3+C3*2</f><v>140000</v></c><c r="C10"><f>SUM(B3+C3)</f><v>220000</v></c></row>'+
  '</sheetData><mergeCells count="1"><mergeCell ref="A1:D1"/></mergeCells></worksheet>';
const SHEET2='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+
  '<row r="1"><c r="A1" t="s"><v>9</v></c></row>'+
  "<row r=\"2\"><c r=\"B2\"><f>'Office (A)'!B5-'Office (A)'!B3</f><v>4000</v></c></row>"+
  "<row r=\"3\"><c r=\"B3\"><f>SUM('Office (A)'!B3:C3)</f><v>220000</v></c></row>"+
  "<row r=\"4\"><c r=\"B4\" t=\"e\"><f>'Office (A)'!C6</f><v>#DIV/0!</v></c></row>"+
  '</sheetData></worksheet>';
const FILES={
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Office (A)" sheetId="1" r:id="rId1"/><sheet name="Dashboard" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191028"/></workbook>',
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/></Relationships>',
  'xl/sharedStrings.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="10" uniqueCount="10">'+SST.map(x=>'<si><t>'+x+'</t></si>').join('')+'</sst>',
  'xl/styles.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="4" applyNumberFormat="1"/></cellXfs></styleSheet>',
  'xl/worksheets/sheet1.xml':SHEET1,
  'xl/worksheets/sheet2.xml':SHEET2,
  'xl/calcChain.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><c r="B5" i="1"/></calcChain>'
};
/* the same files as a COMPRESSED zip (how Excel saves), built with node's own deflate */
function deflatedZip(files){
  const parts=[], cd=[]; let off=0;
  const le=(n,b)=>{ const x=Buffer.alloc(b); b===2?x.writeUInt16LE(n):x.writeUInt32LE(n>>>0); return x; };
  for(const [name,txt] of Object.entries(files)){
    const raw=Buffer.from(txt), comp=zlib.deflateRawSync(raw), nm=Buffer.from(name), crc=B.crc32(new Uint8Array(raw));
    const head=Buffer.concat([le(0x04034b50,4),le(20,2),le(0,2),le(8,2),le(0,2),le(0,2),le(crc,4),le(comp.length,4),le(raw.length,4),le(nm.length,2),le(0,2),nm]);
    parts.push(head,comp);
    cd.push(Buffer.concat([le(0x02014b50,4),le(20,2),le(20,2),le(0,2),le(8,2),le(0,2),le(0,2),le(crc,4),le(comp.length,4),le(raw.length,4),le(nm.length,2),le(0,2),le(0,2),le(0,2),le(0,2),le(0,4),le(off,4),nm]));
    off+=head.length+comp.length;
  }
  const cdb=Buffer.concat(cd);
  return new Uint8Array(Buffer.concat([...parts,cdb,le(0x06054b50,4),le(0,2),le(0,2),le(cd.length,2),le(cd.length,2),le(cdb.length,4),le(off,4),le(0,2)]));
}

(async()=>{
  // 1. Moving formulas the way Excel fills them
  t('a shared formula moves its relative references', B.shift('B9*1.04',1,0)==='C9*1.04' && B.shift('SUM(B8:M8)',0,1)==='SUM(B9:M9)');
  t('...and leaves $absolute references alone', B.shift('B14/B26/$B$41',2,0)==='D14/D26/$B$41');
  t("...and other tabs' names alone", B.shift("'Carlsbad (FFO)'!B20+SUM(B3:C3)",1,0)==="'Carlsbad (FFO)'!C20+SUM(C3:D3)");

  // 2. Reading: a compressed .xlsx, like Excel saves, and a stored one
  const zipped=deflatedZip(FILES), stored=B.writeZip(FILES);
  const book=await B.open(zipped), book2=await B.open(stored);
  t('reads a compressed .xlsx (tabs in order)', book.names.join('|')==='Office (A)|Dashboard');
  t('reads a stored .xlsx the same way', JSON.stringify(book2.sheets)===JSON.stringify(book.sheets));
  const C=(sh,a)=>book.sheets[sh].cells[a];
  t('labels come from the shared strings', C('Office (A)','A3').v==='TC Net Production');
  t('a shared formula is expanded into every cell it covers', C('Office (A)','D5').f==='D3*1.04' && C('Office (A)','C5').f==='C3*1.04');
  t('a typed number is a number', C('Office (A)','B3').v===100000 && C('Office (A)','B3').f===null);

  // 3. Working the formulas out: every formula matches the result Excel saved
  const ev=B.evaluate(book); let n=0, miss=[];
  for(const sh of book.names) for(const [a,c] of Object.entries(book.sheets[sh].cells)){ if(c.f==null) continue; n++;
    const got=ev.value(sh,a); if(String(got)!==String(c.v)) miss.push(sh+'!'+a+' '+got+' vs '+c.v); }
  t('every formula matches what Excel saved ('+n+' of them)', n===16 && miss.length===0);
  if(miss.length) console.log(miss);
  t('dividing by zero is #DIV/0!, and an error in a SUM spreads', ev.value('Office (A)','C6')==='#DIV/0!' && ev.value('Office (A)','D7')==='#DIV/0!');
  t('an empty cell counts as 0 in arithmetic', ev.value('Office (A)','D5')===0 && ev.value('Office (A)','D6')===0);
  t('AVERAGE counts the typed zero but not empty cells', ev.value('Office (A)','C7')===6);
  t('a formula with #REF! in it stays #REF!', ev.value('Office (A)','B9')==='#REF!');
  t('another tab can be read, cell or range', ev.value('Dashboard','B2')===4000 && ev.value('Dashboard','B3')===220000);
  t('a function it does not know is refused, never guessed', (()=>{ const bk={names:['S'],sheets:{S:{cells:{A1:{v:'',f:'IF(1,2,3)',t:'n'}}}}}; return B.evaluate(bk).value('S','A1')==='#NAME?'; })());

  // 4. The year's data, the template, and the Excel written back
  const data=B.dataOf(book);
  t('the data is the typed numbers only (no labels, no formulas)', JSON.stringify(data['Office (A)'])==='{"B3":100000,"C3":120000,"B4":10,"C4":0,"D4":8}' && Object.keys(data.Dashboard).length===0);
  const tpl=B.blank(book);
  t('the template keeps every label and formula and no typed number', tpl.sheets['Office (A)'].cells.A3.v==='TC Net Production' && tpl.sheets['Office (A)'].cells.B5.f==='B3*1.04' && tpl.sheets['Office (A)'].cells.B3.v==='');
  const next=JSON.parse(JSON.stringify(data)); next['Office (A)'].C3=130000;
  const filled=B.withData(tpl,next), ev2=B.evaluate(filled);
  t('new numbers flow through the same formulas', ev2.value('Office (A)','C5')===135200 && ev2.value('Dashboard','B3')===230000);
  const out=B.exportXlsx(filled,next,ev2), back=await B.open(out);
  const D=(sh,a)=>back.sheets[sh].cells[a];
  t('the Excel written back carries the new number and the new results', D('Office (A)','C3').v===130000 && D('Office (A)','C5').v===135200 && D('Dashboard','B3').v===230000);
  t('...keeps the formulas, the shared one included', D('Office (A)','C5').f==='C3*1.04' && D('Dashboard','B2').f==="'Office (A)'!B5-'Office (A)'!B3");
  t('...keeps every cell\'s formatting', D('Office (A)','B3').s===2 && D('Office (A)','A1').s===1 && D('Office (A)','D3').s===2);
  t('...keeps an empty formatted cell empty', D('Office (A)','D3').v==='');
  const parts=await B.readZip(out), txt=k=>new TextDecoder().decode(parts[k]);
  t('...keeps the column widths and merged cells', /<col min="1" max="1" width="40"/.test(txt('xl/worksheets/sheet1.xml')) && /<mergeCell ref="A1:D1"\/>/.test(txt('xl/worksheets/sheet1.xml')));
  t('...leaves the styles untouched, byte for byte', txt('xl/styles.xml')===FILES['xl/styles.xml']);
  t('...tells Excel to recalculate on open, and drops the stale calculation chain',
    /fullCalcOnLoad="1"/.test(txt('xl/workbook.xml')) && !parts['xl/calcChain.xml'] && !/calcChain/.test(txt('[Content_Types].xml')) && !/calcChain/.test(txt('xl/_rels/workbook.xml.rels')));
  t('a book with the same data gives the same Excel twice', Buffer.compare(Buffer.from(out), Buffer.from(B.exportXlsx(filled,next,ev2)))===0);

  // 4b. A number typed over the FIRST cell of an Excel "shared" formula (its master) must not
  //     leave the rest of the group pointing at nothing - found on her real 2027 goals, 21/10/2026.
  const over=JSON.parse(JSON.stringify(data)); over['Office (A)'].B5=99999;
  const ob=B.withData(tpl,over), oback=await B.open(B.exportXlsx(ob,over,B.evaluate(ob)));
  t('typing over a shared formula\'s first cell keeps the others\' formulas', oback.sheets['Office (A)'].cells.B5.v===99999 && oback.sheets['Office (A)'].cells.B5.f==null &&
    oback.sheets['Office (A)'].cells.C5.f==='C3*1.04' && oback.sheets['Office (A)'].cells.D5.f==='D3*1.04');
  // 4c. A formula changed in Home-Brace is written out, the rest of its group with it
  const ed=B.blank(book); ed.sheets['Office (A)'].cells.B5=Object.assign({}, ed.sheets['Office (A)'].cells.B5, {f:'B3*1.1'});
  const eback=await B.open(B.exportXlsx(ed,{},null));
  t('a formula changed in Home-Brace is saved, and its shared group stays right', eback.sheets['Office (A)'].cells.B5.f==='B3*1.1' && eback.sheets['Office (A)'].cells.C5.f==='C3*1.04' && eback.sheets['Office (A)'].cells.D5.f==='D3*1.04');

  // 5. A grid the dashboard's reader understands
  const g=B.grid(filled,ev2,'Office (A)');
  t('the grid has the label in the first column and the months after it', g[2][0]==='TC Net Production' && g[2][2]===130000 && g[4][2]===135200);

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
