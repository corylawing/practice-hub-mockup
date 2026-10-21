/* PRODUCTION BOOKS - Home-Brace's own copy of the production workbook, one BOOK per year.

   21/10/2026, Cory: "build our own data base and make it scalable for the future and that they
   can produce an excel formatted exactly as they have" ... "they may have to change calculations
   and everything on different years that shouldn't impact other years". The live dashboard keeps
   reading Heather's Excel until Cory says otherwise; this is built beside it.

   A book is one year, complete in itself:
     - the TEMPLATE: that year's workbook with the numbers taken out - tabs, labels, formatting,
       column widths, merged cells, and that year's FORMULAS (her growth multipliers live there);
     - the DATA: every number someone typed, by tab and cell.
   Home-Brace works out every formula itself, so its figures are the Excel's figures by
   construction, and the Excel download is the template with the data put back - formatted
   exactly as theirs, because it IS theirs. Changing a calculation for 2027 changes 2027's
   template only. "Last year" rows hold a COPY of last year's figures (as the Excel does),
   so correcting an old year never moves a newer year's goals.

   Their workbook uses only + - * / ( ), SUM, AVERAGE, ranges and references to other tabs
   (1,881 formulas in "2026 PRODUCTION DASHBOARD (New)-7.xlsx", 21/10/2026). Anything outside
   that is refused out loud (#NAME?), never guessed.

   Works in the browser and in node (the tests). No libraries: zip is read with the platform's
   DecompressionStream and written uncompressed ("stored"), which every Excel opens. */
(function(global){
  'use strict';

  /* ------------------------------------------------------------------ zip */
  function u16(b,o){ return b[o] | (b[o+1]<<8); }
  function u32(b,o){ return (b[o] | (b[o+1]<<8) | (b[o+2]<<16) | (b[o+3]<<24)) >>> 0; }
  function inflateRaw(bytes){
    if(typeof DecompressionStream === 'undefined'){
      /* Older Safari (before 16.4): pako, which store.js fetches only when it is needed (22/10/2026). */
      var z = global.PH_STORE && global.PH_STORE.zlib;
      if(!z) return Promise.reject(new Error('This browser cannot open Excel files (no DecompressionStream).'));
      return z().then(function(pk){
        if(!pk) throw new Error('This browser cannot open Excel files (no DecompressionStream).');
        return pk.inflateRaw(bytes);
      });
    }
    var s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(s).arrayBuffer().then(function(ab){ return new Uint8Array(ab); });
  }
  /* bytes (Uint8Array | ArrayBuffer) -> Promise of { 'xl/workbook.xml': Uint8Array, ... } in file order */
  function readZip(bytes){
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), e = -1;
    for(var i = b.length - 22; i >= Math.max(0, b.length - 65557); i--){ if(u32(b,i) === 0x06054b50){ e = i; break; } }
    if(e < 0) return Promise.reject(new Error('That is not an Excel (.xlsx) file.'));
    var n = u16(b, e+10), p = u32(b, e+16), out = {}, jobs = [];
    for(var k = 0; k < n; k++){
      if(u32(b,p) !== 0x02014b50) return Promise.reject(new Error('The Excel file is damaged.'));
      var method = u16(b,p+10), csize = u32(b,p+20), nlen = u16(b,p+28), xlen = u16(b,p+30), clen = u16(b,p+32), lho = u32(b,p+42);
      var name = new TextDecoder().decode(b.subarray(p+46, p+46+nlen));
      var start = lho + 30 + u16(b,lho+26) + u16(b,lho+28), data = b.subarray(start, start+csize);
      out[name] = null;
      jobs.push((method === 0 ? Promise.resolve(data.slice()) : method === 8 ? inflateRaw(data)
        : Promise.reject(new Error('Unsupported compression in the Excel file.'))).then(function(nm){ return function(d){ out[nm] = d; }; }(name)));
      p += 46 + nlen + xlen + clen;
    }
    return Promise.all(jobs).then(function(){ return out; });
  }
  var CRC = (function(){ var t = new Uint32Array(256); for(var n = 0; n < 256; n++){ var c = n; for(var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(d){ var c = 0xFFFFFFFF; for(var i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  /* { name: Uint8Array | string } (insertion order kept) -> Uint8Array of a stored zip */
  function writeZip(files){
    var enc = new TextEncoder(), parts = [], cd = [], off = 0;
    function w16(a,v){ a.push(v & 255, (v>>>8) & 255); }
    function w32(a,v){ a.push(v & 255, (v>>>8) & 255, (v>>>16) & 255, (v>>>24) & 255); }
    Object.keys(files).forEach(function(name){
      var d = typeof files[name] === 'string' ? enc.encode(files[name]) : files[name], nm = enc.encode(name), c = crc32(d), h = [];
      w32(h,0x04034b50); w16(h,20); w16(h,0x0800); w16(h,0); w16(h,0); w16(h,0x21); w32(h,c); w32(h,d.length); w32(h,d.length); w16(h,nm.length); w16(h,0);
      var head = new Uint8Array(h.length + nm.length); head.set(h); head.set(nm, h.length);
      parts.push(head, d);
      var e = []; w32(e,0x02014b50); w16(e,20); w16(e,20); w16(e,0x0800); w16(e,0); w16(e,0); w16(e,0x21); w32(e,c); w32(e,d.length); w32(e,d.length);
      w16(e,nm.length); w16(e,0); w16(e,0); w16(e,0); w16(e,0); w32(e,0); w32(e,off);
      var ent = new Uint8Array(e.length + nm.length); ent.set(e); ent.set(nm, e.length); cd.push(ent);
      off += head.length + d.length;
    });
    var cdLen = cd.reduce(function(a,x){ return a + x.length; }, 0), end = [];
    w32(end,0x06054b50); w16(end,0); w16(end,0); w16(end,cd.length); w16(end,cd.length); w32(end,cdLen); w32(end,off); w16(end,0);
    var all = parts.concat(cd, [new Uint8Array(end)]), size = all.reduce(function(a,x){ return a + x.length; }, 0), out = new Uint8Array(size), at = 0;
    all.forEach(function(x){ out.set(x, at); at += x.length; });
    return out;
  }

  /* The same, compressed - about a tenth of the size. The browser's own CompressionStream. */
  function deflateRaw(bytes){
    if(typeof CompressionStream === 'undefined') return Promise.resolve(null);
    var s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Response(s).arrayBuffer().then(function(ab){ return new Uint8Array(ab); });
  }
  function writeZipSmall(files){
    var enc = new TextEncoder(), names = Object.keys(files);
    var raw = names.map(function(n){ return typeof files[n] === 'string' ? enc.encode(files[n]) : files[n]; });
    return Promise.all(raw.map(deflateRaw)).then(function(comp){
      if(comp.some(function(c){ return !c; })) return writeZip(files);       // no CompressionStream: stored is fine
      var parts = [], cd = [], off = 0;
      function w16(a,v){ a.push(v & 255, (v>>>8) & 255); }
      function w32(a,v){ a.push(v & 255, (v>>>8) & 255, (v>>>16) & 255, (v>>>24) & 255); }
      names.forEach(function(name, i){
        var d = raw[i], z = comp[i], nm = enc.encode(name), c = crc32(d), h = [];
        w32(h,0x04034b50); w16(h,20); w16(h,0x0800); w16(h,8); w16(h,0); w16(h,0x21); w32(h,c); w32(h,z.length); w32(h,d.length); w16(h,nm.length); w16(h,0);
        var head = new Uint8Array(h.length + nm.length); head.set(h); head.set(nm, h.length); parts.push(head, z);
        var e = []; w32(e,0x02014b50); w16(e,20); w16(e,20); w16(e,0x0800); w16(e,8); w16(e,0); w16(e,0x21); w32(e,c); w32(e,z.length); w32(e,d.length);
        w16(e,nm.length); w16(e,0); w16(e,0); w16(e,0); w16(e,0); w32(e,0); w32(e,off);
        var ent = new Uint8Array(e.length + nm.length); ent.set(e); ent.set(nm, e.length); cd.push(ent);
        off += head.length + z.length;
      });
      var cdLen = cd.reduce(function(a,x){ return a + x.length; }, 0), end = [];
      w32(end,0x06054b50); w16(end,0); w16(end,0); w16(end,cd.length); w16(end,cd.length); w32(end,cdLen); w32(end,off); w16(end,0);
      var all = parts.concat(cd, [new Uint8Array(end)]), out = new Uint8Array(all.reduce(function(a,x){ return a + x.length; }, 0)), at = 0;
      all.forEach(function(x){ out.set(x, at); at += x.length; });
      return out;
    });
  }

  /* ------------------------------------------------------------------ cell addresses */
  function colNum(s){ var n = 0; for(var i = 0; i < s.length; i++) n = n*26 + s.charCodeAt(i) - 64; return n; }
  function colName(n){ var s = ''; while(n > 0){ var r = (n-1) % 26; s = String.fromCharCode(65+r) + s; n = (n-1-r)/26; } return s; }
  function split(a){ var m = /^\$?([A-Z]{1,3})\$?(\d+)$/.exec(a); return m ? {c:colNum(m[1]), r:+m[2]} : null; }
  function addr(c,r){ return colName(c) + r; }
  var ENT = {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
  function unxml(s){ return String(s).replace(/&(amp|lt|gt|quot|apos);/g, function(m){ return ENT[m]; }).replace(/&#(\d+);/g, function(_,d){ return String.fromCharCode(+d); }); }
  function toxml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  /* Move a formula's relative references by (dc, dr) - how Excel fills a "shared" formula. Sheet
     names are skipped; they may hold letters, but never letters followed straight by digits. */
  var REF = /('[^']*'!|[A-Za-z_][\w.]*!)?(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(\w])/g;
  function shift(f, dc, dr){
    return f.replace(REF, function(m, sh, dcol, col, drow, row, offset, whole){
      var prev = offset > 0 ? whole[offset-1] : '';
      if(!sh && /[A-Za-z_\d.]/.test(prev)) return m;
      return (sh||'') + dcol + (dcol ? col : colName(colNum(col)+dc)) + drow + (drow ? row : (+row + dr));
    });
  }

  /* ------------------------------------------------------------------ xlsx -> book */
  function txt(u8){ return new TextDecoder().decode(u8); }
  function rels(files, path){
    var dir = path.replace(/[^/]*$/, ''), relPath = dir + '_rels/' + path.slice(dir.length) + '.rels', x = files[relPath], out = {};
    if(!x) return out;
    txt(x).replace(/<Relationship\b[^>]*>/g, function(tag){
      var id = /\bId="([^"]+)"/.exec(tag), tg = /\bTarget="([^"]+)"/.exec(tag);
      if(id && tg){ var t = tg[1]; out[id[1]] = t.charAt(0) === '/' ? t.slice(1) : (dir + t).replace(/[^/]+\/\.\.\//g, ''); }
      return tag;
    });
    return out;
  }
  function sharedStrings(files){
    var x = files['xl/sharedStrings.xml']; if(!x) return [];
    var out = []; txt(x).replace(/<si>([\s\S]*?)<\/si>/g, function(_, si){
      var s = ''; si.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, function(__, t){ s += unxml(t); return __; }); out.push(s); return _;
    });
    return out;
  }
  /* -> { names:[...], sheets:{ name:{ path, cells:{ A1:{v, f, t, s} } } }, files, sst }
     v: number | string | error text ('#REF!') | '' ; f: the formula WITHOUT '=' (shared ones expanded) */
  function parseBook(files){
    var wb = txt(files['xl/workbook.xml']), r = rels(files, 'xl/workbook.xml'), sst = sharedStrings(files), names = [], sheets = {};
    wb.replace(/<sheet\b[^>]*>/g, function(tag){
      var nm = /\bname="([^"]*)"/.exec(tag), id = /\br:id="([^"]+)"/.exec(tag) || /\bid="([^"]+)"/.exec(tag);
      if(nm && id){ var n = unxml(nm[1]); names.push(n); sheets[n] = {path:r[id[1]], cells:{}}; }
      return tag;
    });
    names.forEach(function(n){
      var sh = sheets[n], x = txt(files[sh.path] || new Uint8Array()), masters = {}, deps = [];
      x.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, function(_, attrs, body){
        var a = /\br="([A-Z]+\d+)"/.exec(attrs); if(!a) return _;
        var t = (/\bt="([^"]+)"/.exec(attrs)||[])[1] || 'n', s = (/\bs="(\d+)"/.exec(attrs)||[])[1];
        var cell = {v:'', f:null, t:t, s:s == null ? null : +s};
        body = body || '';
        var fm = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(body);
        if(fm){
          var fa = fm[1], ftext = fm[2] != null ? unxml(fm[2]) : '', si = /\bsi="(\d+)"/.exec(fa);
          if(/\bt="shared"/.test(fa) && si){
            cell.si = +si[1];
            if(ftext){ masters[si[1]] = {at:a[1], f:ftext}; cell.f = ftext; } else deps.push({at:a[1], si:si[1]});
          } else cell.f = ftext;
          cell.f0 = cell.f;
        }
        var vm = /<v>([\s\S]*?)<\/v>/.exec(body);
        if(t === 'inlineStr'){ var is = ''; body.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, function(__, q){ is += unxml(q); return __; }); cell.v = is; }
        else if(vm){ var raw = unxml(vm[1]); cell.v = t === 's' ? (sst[+raw] != null ? sst[+raw] : '') : t === 'n' ? +raw : t === 'b' ? (raw === '1') : raw; }
        sh.cells[a[1]] = cell;
        return _;
      });
      deps.forEach(function(d){
        var m = masters[d.si]; if(!m) return;
        var p = split(m.at), q = split(d.at);
        sh.cells[d.at].f = sh.cells[d.at].f0 = shift(m.f, q.c - p.c, q.r - p.r);
      });
    });
    return {names:names, sheets:sheets, files:files, sst:sst};
  }

  /* ------------------------------------------------------------------ formulas */
  var ERR = /^#(REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!)$/;
  function isErr(v){ return typeof v === 'string' && ERR.test(v); }
  function tokenize(f){
    var out = [], i = 0, m;
    while(i < f.length){
      var rest = f.slice(i), ch = f[i];
      if(/\s/.test(ch)){ i++; continue; }
      if((m = /^#(REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!)/.exec(rest))){ out.push({k:'err', v:m[0]}); i += m[0].length; continue; }
      if((m = /^(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/.exec(rest))){ out.push({k:'num', v:+m[1]}); i += m[0].length; continue; }
      if((m = /^('(?:[^']|'')*'|[A-Za-z_][\w.]*)!/.exec(rest))){ out.push({k:'sheet', v:m[1].charAt(0) === "'" ? m[1].slice(1,-1).replace(/''/g,"'") : m[1]}); i += m[0].length; continue; }
      if((m = /^\$?[A-Z]{1,3}\$?\d+(?![\w(])/.exec(rest))){ out.push({k:'ref', v:m[0].replace(/\$/g,'')}); i += m[0].length; continue; }
      if((m = /^([A-Z][A-Z0-9.]*)\(/.exec(rest))){ out.push({k:'fn', v:m[1]}); i += m[1].length; continue; }
      if('+-*/(),:'.indexOf(ch) >= 0){ out.push({k:ch}); i++; continue; }
      throw new Error('#NAME?');
    }
    return out;
  }
  /* -> tree: {num} {err} {ref, sheet} {range, sheet, a, b} {fn, args} {op, l, r} {neg} */
  function parse(f){
    var t = tokenize(f), i = 0;
    function peek(){ return t[i] || {k:'end'}; }
    function eat(k){ if(peek().k !== k) throw new Error('#NAME?'); return t[i++]; }
    function expr(){ var n = term(); while(peek().k === '+' || peek().k === '-'){ var op = t[i++].k; n = {op:op, l:n, r:term()}; } return n; }
    function term(){ var n = unary(); while(peek().k === '*' || peek().k === '/'){ var op = t[i++].k; n = {op:op, l:n, r:unary()}; } return n; }
    function unary(){ if(peek().k === '-'){ i++; return {neg:unary()}; } if(peek().k === '+'){ i++; return unary(); } return prim(); }
    function prim(){
      var p = peek();
      if(p.k === 'num'){ i++; return {num:p.v}; }
      if(p.k === 'err'){ i++; return {err:p.v}; }
      if(p.k === '('){ i++; var e = expr(); eat(')'); return e; }
      if(p.k === 'fn'){ i++; eat('('); var args = []; if(peek().k !== ')'){ args.push(expr()); while(peek().k === ','){ i++; args.push(expr()); } } eat(')'); return {fn:p.v, args:args}; }
      var sheet = null; if(p.k === 'sheet'){ sheet = p.v; i++; p = peek(); }
      if(p.k === 'ref'){ i++; if(peek().k === ':'){ i++; var b = eat('ref'); return {range:true, sheet:sheet, a:p.v, b:b.v}; } return {ref:p.v, sheet:sheet}; }
      if(p.k === 'err' && sheet){ i++; return {err:p.v}; }
      throw new Error('#NAME?');
    }
    var tree = expr(); if(peek().k !== 'end') throw new Error('#NAME?');
    return tree;
  }
  /* Excel's rules, as far as these workbooks need them: an empty cell is 0 in arithmetic; text
     that reads as a number counts, other text is #VALUE!; an error anywhere wins; SUM and AVERAGE
     skip text and empty cells in a range; AVERAGE of nothing is #DIV/0!. */
  function evaluate(book){
    var vals = {}, busy = {}, trees = {};
    function cellOf(sheet, a){ var sh = book.sheets[sheet]; return sh ? sh.cells[a] : undefined; }
    function value(sheet, a){
      if(!book.sheets[sheet]) return '#REF!';
      var key = sheet + '!' + a;
      if(key in vals) return vals[key];
      var c = cellOf(sheet, a);
      if(!c) return '';
      if(c.f == null) return c.v;
      if(busy[key]) return '#REF!';          // a loop; Excel would refuse it too
      busy[key] = true;
      var v;
      try{ v = run(trees[key] || (trees[key] = parse(c.f)), sheet); }catch(e){ v = (e && /^#/.test(e.message)) ? e.message : '#NAME?'; }
      busy[key] = false;
      return (vals[key] = v);
    }
    function num(v){
      if(isErr(v)) return v;
      if(v === '' || v == null) return 0;
      if(typeof v === 'number') return v;
      if(typeof v === 'boolean') return v ? 1 : 0;
      var n = Number(String(v).trim()); return String(v).trim() !== '' && isFinite(n) ? n : '#VALUE!';
    }
    function cellsIn(node, sheet){
      var sh = node.sheet || sheet, p = split(node.a), q = split(node.b), out = [];
      for(var r = Math.min(p.r,q.r); r <= Math.max(p.r,q.r); r++) for(var c = Math.min(p.c,q.c); c <= Math.max(p.c,q.c); c++) out.push(value(sh, addr(c,r)));
      return out;
    }
    function agg(args, sheet, avg){
      var s = 0, n = 0, i, j;
      for(i = 0; i < args.length; i++){
        var a = args[i];
        if(a.range){ var vs = cellsIn(a, sheet); for(j = 0; j < vs.length; j++){ var x = vs[j]; if(isErr(x)) return x; if(typeof x === 'number'){ s += x; n++; } } }
        else if(a.ref){ var y = value(a.sheet || sheet, a.ref); if(isErr(y)) return y; if(typeof y === 'number'){ s += y; n++; } }
        else { var z = num(run(a, sheet)); if(isErr(z)) return z; s += z; n++; }
      }
      if(avg) return n ? s / n : '#DIV/0!';
      return s;
    }
    function run(n, sheet){
      if('num' in n) return n.num;
      if('err' in n) return n.err;
      if(n.neg){ var v = num(run(n.neg, sheet)); return isErr(v) ? v : -v; }
      if(n.ref) return value(n.sheet || sheet, n.ref);
      if(n.range) return '#VALUE!';
      if(n.fn){
        if(n.fn === 'SUM') return agg(n.args, sheet, false);
        if(n.fn === 'AVERAGE') return agg(n.args, sheet, true);
        return '#NAME?';
      }
      var l = num(run(n.l, sheet)); if(isErr(l)) return l;
      var r = num(run(n.r, sheet)); if(isErr(r)) return r;
      if(n.op === '+') return l + r;
      if(n.op === '-') return l - r;
      if(n.op === '*') return l * r;
      if(r === 0) return '#DIV/0!';
      return l / r;
    }
    book.names.forEach(function(s){ Object.keys(book.sheets[s].cells).forEach(function(a){ value(s, a); }); });
    return {value:function(sheet, a){ return value(sheet, a); }, all:vals};
  }

  /* ------------------------------------------------------------------ data, grid, export */
  /* The numbers someone typed: not a formula, and a number. Labels (text) stay in the template. */
  function dataOf(book){
    var out = {};
    book.names.forEach(function(s){
      var cs = book.sheets[s].cells, d = {};
      Object.keys(cs).forEach(function(a){ var c = cs[a]; if(c.f == null && typeof c.v === 'number') d[a] = c.v; });
      out[s] = d;
    });
    return out;
  }
  /* A sheet as rows x columns of values (formulas worked out), the shape workbook.js reads -
     so the dashboard can read a book exactly as it reads the Excel today. */
  function grid(book, ev, sheet){
    var cs = book.sheets[sheet].cells, maxR = 0, maxC = 0, minR = Infinity, minC = Infinity;
    Object.keys(cs).forEach(function(a){ var p = split(a); if(p.r > maxR) maxR = p.r; if(p.c > maxC) maxC = p.c; if(p.r < minR) minR = p.r; if(p.c < minC) minC = p.c; });
    var rows = [];
    for(var r = minR; r <= maxR; r++){
      var row = [];
      for(var c = minC; c <= maxC; c++){ var a = addr(c,r), cell = cs[a]; var v = cell ? (cell.f != null ? ev.value(sheet, a) : cell.v) : ''; row.push(v == null ? '' : v); }
      rows.push(row);
    }
    return rows;
  }
  /* Put a year's data into its template and give back the .xlsx bytes. Only the <c> elements of
     typed cells and the cached values of formula cells are touched; styles, widths, merges and
     everything else are the template's own bytes. Excel recalculates on open (fullCalcOnLoad). */
  function exportFiles(book, data, ev){
    var files = {}, enc = new TextEncoder();
    Object.keys(book.files).forEach(function(n){ files[n] = book.files[n]; });
    delete files['xl/calcChain.xml'];          // Excel rebuilds it; a stale one makes it "repair" the file
    if(files['[Content_Types].xml']) files['[Content_Types].xml'] = enc.encode(txt(files['[Content_Types].xml']).replace(/<Override[^>]*calcChain[^>]*\/>/g, ''));
    var wr = files['xl/_rels/workbook.xml.rels']; if(wr) files['xl/_rels/workbook.xml.rels'] = enc.encode(txt(wr).replace(/<Relationship[^>]*calcChain[^>]*\/>/g, ''));
    var wbx = txt(files['xl/workbook.xml']);
    wbx = /<calcPr\b/.test(wbx) ? wbx.replace(/<calcPr\b([^>]*?)\/?>/, function(_, a){ return '<calcPr' + a.replace(/\s*fullCalcOnLoad="[^"]*"/,'') + ' fullCalcOnLoad="1"/>'; })
                                : wbx.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
    files['xl/workbook.xml'] = enc.encode(wbx);
    book.names.forEach(function(s){
      var sh = book.sheets[s], d = (data && data[s]) || {}, x = txt(files[sh.path]);
      var head = x.slice(0, x.indexOf('<sheetData')), tail = x.slice(x.indexOf('</sheetData>') + 12);
      var sd = /<sheetData\b[^>]*\/>/.test(x) ? '' : x.slice(x.indexOf('<sheetData'), x.indexOf('</sheetData>') + 12);
      var rowsXml = {}, rowAttrs = {};
      sd.replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, function(_, attrs, body){
        var r = +(/\br="(\d+)"/.exec(attrs)||[])[1]; rowAttrs[r] = attrs; var cells = {};
        (body||'').replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, function(m, ca){ var a = /\br="([A-Z]+\d+)"/.exec(ca)[1]; cells[a] = m; return m; });
        rowsXml[r] = cells; return _;
      });
      function put(a, xml){ var r = split(a).r; (rowsXml[r] = rowsXml[r] || {})[a] = xml; if(!(r in rowAttrs)) rowAttrs[r] = ' r="' + r + '"'; }
      /* A formula changed in Home-Brace (or new to the cell) is written out in full. When it belongs
         to one of Excel's "shared" formulas, the whole group is, so no other cell keeps pointing at
         a master that has moved on. An untouched formula keeps her file's own bytes. */
      var changedGroups = {};
      Object.keys(sh.cells).forEach(function(a){ var c = sh.cells[a]; if(c.si != null && c.f !== c.f0) changedGroups[c.si] = 1; });
      Object.keys(sh.cells).forEach(function(a){
        var c = sh.cells[a], sAttr = c.s != null ? ' s="' + c.s + '"' : '';
        if(c.f != null){
          var old = (rowsXml[split(a).r]||{})[a] || '', full = c.f0 === undefined || c.f !== c.f0 || (c.si != null && changedGroups[c.si]);
          var fTag = full ? '<f>' + toxml(c.f) + '</f>' : (/<f\b[^>]*?(?:\/>|>[\s\S]*?<\/f>)/.exec(old) || ['<f>' + toxml(c.f) + '</f>'])[0];
          var v = ev ? ev.value(s, a) : '', tAttr = isErr(v) ? ' t="e"' : (typeof v === 'string' ? ' t="str"' : '');
          put(a, '<c r="' + a + '"' + sAttr + tAttr + '>' + fTag + (v === '' && !tAttr ? '' : '<v>' + toxml(typeof v === 'number' ? String(v) : v) + '</v>') + '</c>');
        } else if(c.t === 'n' || c.t == null){
          var val = d[a];
          put(a, val == null || val === '' ? '<c r="' + a + '"' + sAttr + '/>' : '<c r="' + a + '"' + sAttr + '><v>' + String(val) + '</v></c>');
        }
      });
      var rows = Object.keys(rowAttrs).map(Number).sort(function(p,q){ return p - q; });
      var body = rows.map(function(r){
        var cells = rowsXml[r] || {}, ks = Object.keys(cells).sort(function(p,q){ return split(p).c - split(q).c; });
        return ks.length ? '<row' + rowAttrs[r] + '>' + ks.map(function(k){ return cells[k]; }).join('') + '</row>' : '<row' + rowAttrs[r] + '/>';
      }).join('');
      files[sh.path] = enc.encode(head + '<sheetData>' + body + '</sheetData>' + tail);
    });
    return files;
  }
  function exportXlsx(book, data, ev){ return writeZip(exportFiles(book, data, ev)); }
  function exportXlsxSmall(book, data, ev){ return writeZipSmall(exportFiles(book, data, ev)); }
  /* The template: the same workbook with every typed number taken out. */
  function blank(book){
    var copy = {names:book.names.slice(), sheets:{}, files:book.files, sst:book.sst};
    book.names.forEach(function(s){
      var cs = book.sheets[s].cells, out = {};
      Object.keys(cs).forEach(function(a){ var c = cs[a]; out[a] = (c.f == null && typeof c.v === 'number') ? {v:'', f:null, t:'n', s:c.s} : c; });
      copy.sheets[s] = {path:book.sheets[s].path, cells:out};
    });
    return copy;
  }
  /* A template with a year's data laid back in - what evaluate() and exportXlsx() work on.
     A number for a FORMULA cell wins over the formula, as typing over it in Excel does: that is
     how a goal set by hand in Enter Production lands. Labels (text) are never replaced. */
  function withData(template, data){
    var copy = {names:template.names.slice(), sheets:{}, files:template.files, sst:template.sst};
    template.names.forEach(function(s){
      var cs = template.sheets[s].cells, d = (data && data[s]) || {}, out = {};
      Object.keys(cs).forEach(function(a){ var c = cs[a], label = c.f == null && typeof c.v === 'string' && c.v !== '';
        /* keeps the shared group and first formula, so exportXlsx writes the rest of the group in full */
        out[a] = (!label && d[a] != null) ? {v:d[a], f:null, t:'n', s:c.s, si:c.si, f0:c.f0} : c; });
      Object.keys(d).forEach(function(a){ if(!out[a] && /^[A-Z]{1,3}\d+$/.test(a)) out[a] = {v:d[a], f:null, t:'n', s:null}; });   // a box, never a stray key
      copy.sheets[s] = {path:template.sheets[s].path, cells:out};
    });
    return copy;
  }
  function open(bytes){ return readZip(bytes).then(parseBook); }

  /* A NEW YEAR'S LAYOUT. Every year the workbook names - "2026 TC Production Goal", "Number of
     Production Days (2025)", "2026 Total" - moves on by one: this year, last year and the year
     before (from-2 .. from). Older years stay as written ("Number of NPE (2022)" is a 2022 figure
     whatever year it is). Formulas carry no years, so they are kept exactly. */
  function shiftYearsText(t, from){
    return String(t).replace(/\b(20\d\d)\b/g, function(m){ var y = +m; return (y >= from - 2 && y <= from) ? String(y + 1) : m; });
  }
  function shiftYears(book, from){
    var enc = new TextEncoder(), files = {};
    Object.keys(book.files).forEach(function(n){ files[n] = book.files[n]; });
    var tags = /(<t(?:\s[^>]*)?>)([\s\S]*?)(<\/t>)/g;
    if(files['xl/sharedStrings.xml']) files['xl/sharedStrings.xml'] = enc.encode(txt(files['xl/sharedStrings.xml']).replace(tags, function(_, a, b, c){ return a + shiftYearsText(b, from) + c; }));
    book.names.forEach(function(s){
      var p = book.sheets[s].path, x = files[p] ? txt(files[p]) : '';
      if(x.indexOf('<is>') >= 0) files[p] = enc.encode(x.replace(/<is>[\s\S]*?<\/is>/g, function(is){ return is.replace(tags, function(_, a, b, c){ return a + shiftYearsText(b, from) + c; }); }));
    });
    var copy = {names:book.names.slice(), sheets:{}, files:files, sst:(book.sst || []).map(function(x){ return shiftYearsText(x, from); })};
    book.names.forEach(function(s){
      var cs = book.sheets[s].cells, out = {};
      Object.keys(cs).forEach(function(a){ var c = cs[a]; out[a] = (c.f == null && typeof c.v === 'string') ? {v:shiftYearsText(c.v, from), f:null, t:c.t, s:c.s} : c; });
      copy.sheets[s] = {path:book.sheets[s].path, cells:out};
    });
    return copy;
  }

  /* The cell formats that are a solid black fill - how her workbook blacks out the months before an
     office counted ("theme 1", Excel's black, or plain black). Index into the workbook's formats. */
  function blackStyles(book){
    var x = book.files && book.files['xl/styles.xml'] ? txt(book.files['xl/styles.xml']) : '', out = {};
    var fl = /<fills\b[^>]*>([\s\S]*?)<\/fills>/.exec(x), xf = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(x);
    if(!fl || !xf) return out;
    var fills = []; fl[1].replace(/<fill>([\s\S]*?)<\/fill>|<fill\/>/g, function(m, f){ fills.push(f || ''); return m; });
    /* Black, or as good as: theme 1 untinted or barely lightened, or an RGB colour that dark. */
    var black = fills.map(function(f){
      if(!/patternType="solid"/.test(f)) return false;
      var th = /<fgColor theme="1"(?:\s+tint="([-0-9.E]+)")?\s*\/>/i.exec(f); if(th) return !th[1] || Math.abs(parseFloat(th[1])) < 0.25;
      var rgb = /<fgColor rgb="(?:FF)?([0-9A-F]{6})"/i.exec(f);
      return !!rgb && [0, 2, 4].every(function(k){ return parseInt(rgb[1].substr(k, 2), 16) <= 0x33; });
    });
    var i = 0; xf[1].replace(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g, function(m){ var f = /fillId="(\d+)"/.exec(m); if(f && black[+f[1]]) out[i] = true; i++; return m; });
    return out;
  }

  /* What a cell IS, in the workbook's own words: the row's label (column A) and the heading of
     its column (the nearest text above it - "October"). For the history of changes. */
  function labelAt(book, sheet, a){
    var cs = book.sheets[sheet] ? book.sheets[sheet].cells : {}, p = split(a), label = '', head = '';
    for(var c = p.c - 1; c >= 1 && !label; c--){ var x = cs[addr(c, p.r)]; if(x && typeof x.v === 'string' && x.f == null && x.v.trim()) label = x.v.trim(); }
    for(var r = p.r - 1; r >= 1 && !head; r--){ var y = cs[addr(p.c, r)]; if(y && typeof y.v === 'string' && y.f == null && y.v.trim()) head = y.v.trim(); }
    return {label:label, head:head};
  }
  /* The year a book is for: the year its goal rows are named after ("2026 TC Production Goal"). */
  function yearOf(book){
    var count = {};
    book.names.forEach(function(s){ var cs = book.sheets[s].cells;
      Object.keys(cs).forEach(function(a){ var v = cs[a].v; if(typeof v === 'string'){ var m = /\b(20\d\d)\b[^]*\bgoal\b/i.exec(v); if(m) count[m[1]] = (count[m[1]] || 0) + 1; } }); });
    var best = null; Object.keys(count).forEach(function(y){ if(best == null || count[y] > count[best]) best = y; });
    return best ? +best : null;
  }
  /* The layout, as text: every label, formula and cell format, tab by tab, plus the styles part.
     Two saves of the same workbook give the same fingerprint even though Excel rewrites its
     own save date - so "the layout changed" means a label, formula or format really changed. */
  function layoutText(book){
    var out = {};
    book.names.forEach(function(s){ var cs = book.sheets[s].cells;
      out[s] = Object.keys(cs).sort().map(function(a){ var c = cs[a];
        return a + '|' + (c.f != null ? '=' + c.f : (typeof c.v === 'string' && c.v !== '' ? 'T' + c.v : '')) + '|' + (c.s == null ? '' : c.s); }).join('\n'); });
    out['(styles)'] = book.files && book.files['xl/styles.xml'] ? txt(book.files['xl/styles.xml']) : '';
    out['(tabs)'] = book.names.join('\n');
    return out;
  }

  var API = {readZip:readZip, writeZip:writeZip, writeZipSmall:writeZipSmall, crc32:crc32, parseBook:parseBook, open:open, parse:parse, tokenize:tokenize,
             evaluate:evaluate, dataOf:dataOf, grid:grid, exportFiles:exportFiles, exportXlsx:exportXlsx, exportXlsxSmall:exportXlsxSmall,
             blank:blank, withData:withData, labelAt:labelAt, yearOf:yearOf, layoutText:layoutText, shiftYears:shiftYears, shiftYearsText:shiftYearsText, blackStyles:blackStyles,
             shift:shift, colNum:colNum, colName:colName, isErr:isErr};
  if(typeof module !== 'undefined' && module.exports) module.exports = API;
  global.PH_BOOK = API;
})(typeof window !== 'undefined' ? window : globalThis);
