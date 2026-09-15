/* =============================================================================
 * Donovan Legal — Minimal in-engine .xlsx writer
 * -----------------------------------------------------------------------------
 * SheetJS-compatible API surface for the subset the Economics Tool uses:
 *   XLSX.writeFile(wb, filename)   — browser: triggers download; Node: returns Uint8Array
 *   XLSX.write(wb)                 — returns Uint8Array
 *
 * Input: wb = { SheetNames: [...], Sheets: { name: { '!ref': 'A1:H19', A1: {v,t,z?,f?}, ... }, ... } }
 *
 * Cell shape supported:
 *   { v: <number>, t: 'n', z?: '<format>' }
 *   { v: <string>, t: 's' }
 *   { v: <bool>,   t: 'b' }
 *   { f: '<formula>', t: 'n', z?: '<format>' }     (no v; Excel computes on open)
 *
 * Number formats supported (others fall back to General):
 *   '$#,##0', '0.00%', '0.0%', '0.00"x"'
 *
 * ZIP method: STORE only (no compression). Files are small (memo workbook ~30 KB
 * uncompressed); store-only keeps the writer dependency-free and at ~280 lines.
 * Excel/Numbers/Sheets all accept stored .xlsx files.
 *
 * No external dependencies. Pure ES5 with Uint8Array + TextEncoder.
 * (c) Donovan Legal PLLC — internal tooling. License: same as engine.
 * =============================================================================
 */
(function () {
  'use strict';

  // ---- UTF-8 encoding -----------------------------------------------------
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    var bytes = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if ((c & 0xfc00) === 0xd800) {
        c = 0x10000 + ((c & 0x3ff) << 10) + (s.charCodeAt(++i) & 0x3ff);
        bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return new Uint8Array(bytes);
  }

  // ---- CRC-32 (precomputed table) -----------------------------------------
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  function crc32(buf) {
    var c = 0xffffffff;
    for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // ---- XML escape ---------------------------------------------------------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&apos;';
    });
  }

  // ---- Ref parsing --------------------------------------------------------
  function colNum(letters) {
    var n = 0;
    for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
    return n;
  }
  function colLetter(n) {
    var s = '';
    while (n > 0) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }
  function parseRef(ref) {
    var m = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!m) return null;
    return { c0: colNum(m[1]), r0: +m[2], c1: colNum(m[3]), r1: +m[4] };
  }

  // ---- Style table: 5 cellXfs (style 0 = General + 4 custom number formats) ----
  function styleIdForFormat(z) {
    if (z === '$#,##0') return 1;
    if (z === '0.00%') return 2;
    if (z === '0.0%') return 3;
    if (z === '0.00"x"') return 4;
    return 0;
  }

  // ---- OOXML parts --------------------------------------------------------
  function makeContentTypes(numSheets) {
    var s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>';
    for (var i = 1; i <= numSheets; i++) {
      s += '<Override PartName="/xl/worksheets/sheet' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }
    return s + '</Types>';
  }

  var ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  function makeWorkbookXml(sheetNames) {
    var s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
    sheetNames.forEach(function (name, i) {
      s += '<sheet name="' + esc(name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
    });
    return s + '</sheets></workbook>';
  }

  function makeWorkbookRels(numSheets) {
    var s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for (var i = 1; i <= numSheets; i++) {
      s += '<Relationship Id="rId' + i + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + i + '.xml"/>';
    }
    s += '<Relationship Id="rId' + (numSheets + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
    s += '<Relationship Id="rId' + (numSheets + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>';
    return s + '</Relationships>';
  }

  var STYLE_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="4">' +
    '<numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0"/>' +
    '<numFmt numFmtId="165" formatCode="0.00%"/>' +
    '<numFmt numFmtId="166" formatCode="0.0%"/>' +
    '<numFmt numFmtId="167" formatCode="0.00&quot;x&quot;"/>' +
    '</numFmts>' +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
    '<borders count="1"><border/></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="5">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  function makeSharedStringsXml(list) {
    var s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' +
      list.length + '" uniqueCount="' + list.length + '">';
    list.forEach(function (str) {
      s += '<si><t xml:space="preserve">' + esc(str) + '</t></si>';
    });
    return s + '</sst>';
  }

  function makeSheetXml(sheet, addString) {
    var ref = sheet['!ref'] || 'A1:A1';
    var dim = parseRef(ref);
    var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="' + ref + '"/><sheetData>';
    if (!dim) return xml + '</sheetData></worksheet>';

    for (var r = dim.r0; r <= dim.r1; r++) {
      var rowCells = [];
      for (var c = dim.c0; c <= dim.c1; c++) {
        var addr = colLetter(c) + r;
        var cell = sheet[addr];
        if (!cell || (cell.v == null && cell.f == null)) continue;
        var styleId = styleIdForFormat(cell.z);
        var t = cell.t || (typeof cell.v === 'number' ? 'n' : typeof cell.v === 'boolean' ? 'b' : 's');
        var x = '<c r="' + addr + '"';
        if (styleId) x += ' s="' + styleId + '"';
        if (t === 'n') x += ' t="n">';
        else if (t === 'b') x += ' t="b">';
        else if (t === 's') x += ' t="s">';
        else x += '>';
        if (cell.f) x += '<f>' + esc(cell.f) + '</f>';
        if (cell.v != null) {
          if (t === 's') {
            x += '<v>' + addString(String(cell.v)) + '</v>';
          } else if (t === 'b') {
            x += '<v>' + (cell.v ? 1 : 0) + '</v>';
          } else {
            var n = Number(cell.v);
            x += '<v>' + (isFinite(n) ? n : 0) + '</v>';
          }
        }
        x += '</c>';
        rowCells.push(x);
      }
      if (rowCells.length) xml += '<row r="' + r + '">' + rowCells.join('') + '</row>';
    }
    return xml + '</sheetData></worksheet>';
  }

  // ---- ZIP-STORE writer ---------------------------------------------------
  function pack16(n) { return [n & 0xff, (n >>> 8) & 0xff]; }
  function pack32(n) { return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]; }

  function zipStore(entries) {
    var locals = [];
    var central = [];
    var offset = 0;

    entries.forEach(function (f) {
      var nameBytes = utf8(f.name);
      var local = pack32(0x04034b50).concat(
        pack16(20), pack16(0), pack16(0), pack16(0), pack16(0),
        pack32(f.crc), pack32(f.size), pack32(f.size),
        pack16(nameBytes.length), pack16(0)
      );
      var localBytes = new Uint8Array(local.length + nameBytes.length);
      localBytes.set(local, 0);
      localBytes.set(nameBytes, local.length);
      locals.push(localBytes, f.data);

      var cent = pack32(0x02014b50).concat(
        pack16(20), pack16(20), pack16(0), pack16(0), pack16(0), pack16(0),
        pack32(f.crc), pack32(f.size), pack32(f.size),
        pack16(nameBytes.length), pack16(0), pack16(0),
        pack16(0), pack16(0), pack32(0),
        pack32(offset)
      );
      var centBytes = new Uint8Array(cent.length + nameBytes.length);
      centBytes.set(cent, 0);
      centBytes.set(nameBytes, cent.length);
      central.push(centBytes);

      offset += localBytes.length + f.data.length;
    });

    var cdStart = offset;
    var cdSize = 0;
    central.forEach(function (e) { cdSize += e.length; });
    var eocd = new Uint8Array(
      pack32(0x06054b50).concat(
        pack16(0), pack16(0),
        pack16(entries.length), pack16(entries.length),
        pack32(cdSize), pack32(cdStart),
        pack16(0)
      )
    );

    var total = 0;
    locals.forEach(function (p) { total += p.length; });
    central.forEach(function (p) { total += p.length; });
    total += eocd.length;

    var out = new Uint8Array(total);
    var pos = 0;
    locals.forEach(function (p) { out.set(p, pos); pos += p.length; });
    central.forEach(function (p) { out.set(p, pos); pos += p.length; });
    out.set(eocd, pos);
    return out;
  }

  // ---- Main API ----------------------------------------------------------
  function write(wb) {
    var sharedList = [];
    var sharedMap = Object.create(null);
    function addString(s) {
      if (sharedMap[s] !== undefined) return sharedMap[s];
      var i = sharedList.length;
      sharedMap[s] = i;
      sharedList.push(s);
      return i;
    }

    var sheetXmls = wb.SheetNames.map(function (name) {
      return makeSheetXml(wb.Sheets[name], addString);
    });

    var parts = [
      { name: '[Content_Types].xml', xml: makeContentTypes(wb.SheetNames.length) },
      { name: '_rels/.rels', xml: ROOT_RELS },
      { name: 'xl/_rels/workbook.xml.rels', xml: makeWorkbookRels(wb.SheetNames.length) },
      { name: 'xl/workbook.xml', xml: makeWorkbookXml(wb.SheetNames) },
      { name: 'xl/styles.xml', xml: STYLE_XML },
      { name: 'xl/sharedStrings.xml', xml: makeSharedStringsXml(sharedList) }
    ];
    sheetXmls.forEach(function (xml, i) {
      parts.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', xml: xml });
    });

    var entries = parts.map(function (p) {
      var data = utf8(p.xml);
      return { name: p.name, data: data, crc: crc32(data), size: data.length };
    });

    return zipStore(entries);
  }

  function writeFile(wb, filename) {
    var bytes = write(wb);
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof document !== 'undefined') {
      var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || 'workbook.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 250);
      return true;
    }
    return bytes;
  }

  var api = { write: write, writeFile: writeFile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.XLSX = api;
})();
