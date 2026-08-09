/* Ассистент управляющего МЖД — логика приложения.
   Без бэкенда: всё состояние живёт в localStorage браузера. */

(function () {
  'use strict';

  var LS = {
    profile: 'mzhd.profile',
    theme: 'mzhd.theme',
    doc: function (id) { return 'mzhd.doc.' + id; },
    lastDoc: 'mzhd.lastDoc'
  };

  var H = window.DOC_HELPERS;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* приватный режим */ }
  }

  var profile = read(LS.profile, {});
  var current = null;      // активный шаблон
  var values = {};         // значения полей активного шаблона

  /* ---------------- Toast ---------------- */
  var toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.setAttribute('role', 'status');
  document.body.appendChild(toastEl);
  var toastTimer;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2200);
  }

  /* ---------------- Тема ---------------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    write(LS.theme, t);
  }

  applyTheme(read(LS.theme, window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  $('#themeBtn').addEventListener('click', function () {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ---------------- Навигация ---------------- */
  function showView(name) {
    $$('.view').forEach(function (v) { v.classList.toggle('is-active', v.id === 'view-' + name); });
    $$('.nav-item').forEach(function (b) { b.classList.toggle('is-active', b.dataset.view === name); });
    $('#sidebar').classList.remove('is-open');
    $('#burger').setAttribute('aria-expanded', 'false');
    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
    window.scrollTo({ top: 0 });
  }

  $$('.nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () { showView(btn.dataset.view); });
  });

  $('#burger').addEventListener('click', function () {
    var open = $('#sidebar').classList.toggle('is-open');
    this.setAttribute('aria-expanded', String(open));
  });

  /* ---------------- Реквизиты дома ---------------- */
  function buildProfileForm() {
    var form = $('#profileForm');
    form.innerHTML = window.PROFILE_FIELDS.map(function (f) {
      var val = profile[f.id] != null ? profile[f.id] : (f.value || '');
      if (f.type === 'select') {
        return '<label class="field"><span>' + H.esc(f.label) + '</span><select data-pid="' + f.id + '">' +
          f.options.map(function (o) {
            return '<option value="' + H.esc(o) + '"' + (o === val ? ' selected' : '') + '>' + H.esc(o) + '</option>';
          }).join('') + '</select></label>';
      }
      return '<label class="field"><span>' + H.esc(f.label) + '</span>' +
        '<input type="' + (f.type === 'number' ? 'number' : 'text') + '"' +
        (f.type === 'number' ? ' step="0.01" min="0"' : '') +
        ' data-pid="' + f.id + '" value="' + H.esc(val) + '"' +
        ' placeholder="' + H.esc(f.placeholder || '') + '"></label>';
    }).join('');
  }

  $('#profileForm').addEventListener('input', onProfileChange);
  $('#profileForm').addEventListener('change', onProfileChange);

  function onProfileChange(e) {
    var id = e.target.dataset.pid;
    if (!id) return;
    profile[id] = e.target.value;
    write(LS.profile, profile);
    updateHouseChip();
    $('#profileHint').textContent = 'Сохранено автоматически';
    if (current) renderPreview();
  }

  function updateHouseChip() {
    var chip = $('#houseChip');
    var name = [profile.orgForm, profile.orgName].filter(Boolean).join(' ');
    var text = name || profile.address || '';
    chip.textContent = text ? text + (profile.address && name ? ' · ' + profile.address : '') : 'Реквизиты не заполнены';
  }

  $('#btnProfileSave').addEventListener('click', function () {
    write(LS.profile, profile);
    $('#profileHint').textContent = '';
    toast('Реквизиты дома сохранены');
  });

  $('#btnProfileClear').addEventListener('click', function () {
    if (!confirm('Очистить все реквизиты дома? Действие нельзя отменить.')) return;
    profile = {};
    write(LS.profile, profile);
    buildProfileForm();
    updateHouseChip();
    if (current) renderPreview();
    toast('Реквизиты очищены');
  });

  /* ---------------- Список документов ---------------- */
  function buildDocList(filter) {
    var q = (filter || '').trim().toLowerCase();
    var list = $('#docList');
    var groups = {};
    var order = [];

    window.DOC_TEMPLATES.forEach(function (t) {
      if (q && t.title.toLowerCase().indexOf(q) === -1 && (t.note || '').toLowerCase().indexOf(q) === -1) return;
      if (!groups[t.group]) { groups[t.group] = []; order.push(t.group); }
      groups[t.group].push(t);
    });

    if (!order.length) {
      list.innerHTML = '<p class="hint" style="padding:10px">Ничего не найдено.</p>';
      return;
    }

    list.innerHTML = order.map(function (g) {
      return '<div class="doc-group">' + H.esc(g) + '</div>' +
        groups[g].map(function (t) {
          return '<button type="button" class="doc-btn' + (current && current.id === t.id ? ' is-active' : '') +
            '" data-id="' + t.id + '">' + H.esc(t.title) + '</button>';
        }).join('');
    }).join('');

    $$('.doc-btn', list).forEach(function (b) {
      b.addEventListener('click', function () { openDoc(b.dataset.id); });
    });
  }

  $('#docSearch').addEventListener('input', function () { buildDocList(this.value); });

  /* ---------------- Редактор документа ---------------- */
  function openDoc(id) {
    var tpl = window.DOC_TEMPLATES.filter(function (t) { return t.id === id; })[0];
    if (!tpl) return;
    current = tpl;
    write(LS.lastDoc, id);

    values = read(LS.doc(id), {});
    tpl.fields.forEach(function (f) {
      if (values[f.id] == null || values[f.id] === '') {
        if (f.fromProfile && profile[f.fromProfile]) values[f.id] = profile[f.fromProfile];
        else if (f.value) values[f.id] = f.value;
        else if (f.type === 'select') values[f.id] = f.options[0];
      }
    });

    $('#docEmpty').hidden = true;
    $('#docEditor').hidden = false;
    $('#docTitle').textContent = tpl.title;
    $('#docNote').textContent = tpl.note || '';

    buildDocForm(tpl);
    renderPreview();
    buildDocList($('#docSearch').value);
  }

  function buildDocForm(tpl) {
    var form = $('#docForm');
    form.innerHTML = '<div class="form-section">Поля документа</div>' + tpl.fields.map(function (f) {
      var val = values[f.id] != null ? values[f.id] : '';
      var hint = f.hint ? '<span class="field-hint">' + H.esc(f.hint) + '</span>' : '';
      var head = '<span>' + H.esc(f.label) + hint + '</span>';

      if (f.type === 'textarea') {
        return '<label class="field">' + head + '<textarea data-fid="' + f.id + '" rows="' + (f.rows || 4) +
          '" placeholder="' + H.esc(f.placeholder || '') + '">' + H.esc(val) + '</textarea></label>';
      }
      if (f.type === 'select') {
        return '<label class="field">' + head + '<select data-fid="' + f.id + '">' +
          f.options.map(function (o) {
            return '<option value="' + H.esc(o) + '"' + (o === val ? ' selected' : '') + '>' + H.esc(o) + '</option>';
          }).join('') + '</select></label>';
      }
      var type = f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text';
      return '<label class="field">' + head + '<input type="' + type + '"' +
        (type === 'number' ? ' step="0.01"' : '') +
        ' data-fid="' + f.id + '" value="' + H.esc(val) + '" placeholder="' + H.esc(f.placeholder || '') + '"></label>';
    }).join('');
  }

  $('#docForm').addEventListener('input', onDocInput);
  $('#docForm').addEventListener('change', onDocInput);

  var previewTimer;
  function onDocInput(e) {
    var id = e.target.dataset.fid;
    if (!id) return;
    values[id] = e.target.value;
    write(LS.doc(current.id), values);
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 100);
  }

  function renderPreview() {
    if (!current) return;
    var html;
    try {
      html = current.render({ p: profile, f: values });
    } catch (err) {
      html = '<p class="warn">Не удалось построить документ: ' + H.esc(err.message) + '</p>';
    }
    $('#docPreview').innerHTML = html;
  }

  $('#btnReset').addEventListener('click', function () {
    if (!current) return;
    if (!confirm('Очистить поля документа «' + current.title + '»?')) return;
    values = {};
    write(LS.doc(current.id), values);
    openDoc(current.id);
    toast('Поля очищены');
  });

  /* ---------------- Экспорт ---------------- */
  function docTitleLine() {
    var name = [profile.orgForm, profile.orgName].filter(Boolean).join(' ');
    return current.title + (name ? ' — ' + name : '');
  }

  /** HTML документа без экранной подсветки плейсхолдеров. */
  function cleanBody() {
    return $('#docPreview').innerHTML.replace(/class="ph"/g, '').replace(/class="warn"/g, '');
  }

  function wordHtml() {
    return '﻿<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><title>' + H.esc(docTitleLine()) + '</title>' +
      '<style>' +
      '@page { size: A4; margin: 2cm 1.5cm 2cm 3cm; }' +
      'body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.4; }' +
      'h1 { font-size: 14pt; text-align: center; text-transform: uppercase; margin: 0 0 4pt; }' +
      'h2 { font-size: 12pt; text-align: center; margin: 0 0 14pt; }' +
      'h3 { font-size: 12pt; margin: 14pt 0 6pt; }' +
      'p { margin: 0 0 8pt; text-align: justify; }' +
      '.center { text-align: center; } .right { text-align: right; }' +
      '.row { width: 100%; }' +
      '.head-right { width: 58%; margin-left: 42%; margin-bottom: 16pt; }' +
      'table { width: 100%; border-collapse: collapse; margin: 8pt 0 12pt; font-size: 11pt; }' +
      'th, td { border: 1px solid #000; padding: 4pt 6pt; vertical-align: top; }' +
      'th { background: #eee; } .num { text-align: right; } td.sig { height: 30pt; }' +
      '.small { font-size: 9.5pt; } .fill { display: inline-block; min-width: 170pt; border-bottom: 1px solid #000; }' +
      '.sign-row { margin-bottom: 14pt; }' +
      '</style></head><body>' + cleanBody() + '</body></html>';
  }

  function translit(s) {
    var map = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',
      н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',
      ь:'',э:'e',ю:'yu',я:'ya',' ':'-' };
    return s.toLowerCase().split('').map(function (ch) {
      return map[ch] != null ? map[ch] : (/[a-z0-9-]/.test(ch) ? ch : '');
    }).join('').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  $('#btnDownload').addEventListener('click', function () {
    if (!current) return;
    var blob = new Blob([wordHtml()], { type: 'application/msword;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = translit(current.title) + '-' + today() + '.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('Файл сохранён — открывается в Word');
  });

  $('#btnPrint').addEventListener('click', function () {
    if (!current) return;
    var w = window.open('', '_blank');
    if (!w) { toast('Разрешите всплывающие окна для печати'); return; }
    w.document.write(wordHtml().replace('﻿', ''));
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 300);
  });

  /** HTML предпросмотра -> простой текст. */
  function toPlainText(root) {
    var out = [];
    (function walk(node) {
      node.childNodes.forEach(function (n) {
        if (n.nodeType === 3) {
          var t = n.nodeValue.replace(/\s+/g, ' ');
          if (t.trim()) out.push(t);
          return;
        }
        if (n.nodeType !== 1) return;
        var tag = n.tagName.toLowerCase();
        if (tag === 'br') { out.push('\n'); return; }
        if (tag === 'td' || tag === 'th') { walk(n); out.push('\t'); return; }
        if (tag === 'tr') { walk(n); out.push('\n'); return; }
        if (tag === 'li') { out.push('— '); walk(n); out.push('\n'); return; }
        if (/^(p|h1|h2|h3|div|table|ol|ul)$/.test(tag)) { out.push('\n'); walk(n); out.push('\n'); return; }
        walk(n);
      });
    })(root);
    return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  $('#btnCopy').addEventListener('click', function () {
    if (!current) return;
    var text = toPlainText($('#docPreview'));
    copyText(text, 'Текст документа скопирован');
  });

  function copyText(text, okMsg) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast(okMsg); }
      catch (e) { toast('Не удалось скопировать — выделите текст вручную'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
    } else { fallback(); }
  }

  /* ---------------- Кворум и голоса ---------------- */
  var calcBasis = 'area';   // 'area' — по площади помещений, 'units' — по количеству собственников

  /* Целые голоса округлять незачем — сравниваем с допуском в зависимости от базы. */
  function eps() { return calcBasis === 'units' ? 0.5 : 0.01; }

  function fmtVotes(n) {
    if (calcBasis !== 'units') return H.money(n);
    var s = String(Math.round(Math.abs(n) * 100) / 100).replace('.', ',');
    return (n < 0 ? '−' : '') + s;
  }

  function plural(n, one, few, many) {
    var a = Math.abs(Math.round(n)) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    return b === 1 ? one : many;
  }

  function unitName(n) {
    return calcBasis === 'units' ? plural(n, 'голос', 'голоса', 'голосов') : 'м²';
  }

  /** «62 голоса» / «3 120,00 м²» */
  function withUnit(n) { return fmtVotes(n) + ' ' + unitName(n); }

  function setBasis(basis) {
    calcBasis = basis;
    $$('.mode-btn', $('#calcMode')).forEach(function (b) {
      var on = b.dataset.basis === basis;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
    ['#grpArea', '#grpArea2'].forEach(function (s) { $(s).hidden = basis !== 'area'; });
    ['#grpUnits', '#grpUnits2'].forEach(function (s) { $(s).hidden = basis !== 'units'; });
    $('#c_unitHint').textContent = basis === 'units' ? '(в голосах)' : '(в м²)';
    calc();
  }

  /* Два самостоятельных состава голосующих:
     'home' — собственники квартир и нежилых помещений (вопросы управления домом);
     'park' — собственники парковочных мест и кладовок (вопросы их содержания). */
  var GROUPS = {
    home: {
      title: 'Управление домом — квартиры и нежилые помещения',
      areaTotal: 'c_total', areaVoted: 'c_voted',
      unitParts: ['c_flats', 'c_nonres'], unitVoted: 'c_votedUnits', unitSum: 'c_unitsTotal',
      totalLabelArea: 'Общая площадь дома',
      totalLabelUnits: 'Всего голосов (квартиры и нежилые)',
      need: 'Заполните данные по квартирам и нежилым помещениям.'
    },
    park: {
      title: 'Паркинг и кладовки',
      areaTotal: 'c2_total', areaVoted: 'c2_voted',
      unitParts: ['c2_park', 'c2_store'], unitVoted: 'c2_votedUnits', unitSum: 'c2_unitsTotal',
      totalLabelArea: 'Площадь парковочных мест и кладовок',
      totalLabelUnits: 'Всего голосов (парковочные места и кладовки)',
      need: ''
    }
  };

  function groupData(g) {
    if (calcBasis === 'units') {
      var parts = g.unitParts.map(function (id) { return H.num($('#' + id).value); });
      var any = parts.some(function (n) { return !isNaN(n); });
      var total = any ? parts.reduce(function (a, n) { return a + (isNaN(n) ? 0 : n); }, 0) : NaN;
      return { total: total, voted: H.num($('#' + g.unitVoted).value), totalLabel: g.totalLabelUnits };
    }
    return {
      total: H.num($('#' + g.areaTotal).value),
      voted: H.num($('#' + g.areaVoted).value),
      totalLabel: g.totalLabelArea
    };
  }

  /** Блок результата по одному составу голосующих. */
  function groupBlock(g, d, rows, qThr, dThr, withHeading) {
    var total = d.total, voted = d.voted;
    var pct = voted / total * 100;
    var quorum = !isNaN(qThr) && pct >= qThr;

    var html = (withHeading ? '<h3 class="result-group">' + H.esc(g.title) + '</h3>' : '') +
      '<div class="metric"><span>' + H.esc(d.totalLabel) + '</span><b>' + withUnit(total) + '</b></div>' +
      '<div class="metric"><span>Приняли участие</span><b>' + withUnit(voted) + '</b></div>' +
      '<div class="metric"><span>Доля участников</span><b>' + pct.toFixed(2) + ' %</b></div>' +
      '<div class="metric"><span>Кворум (порог ' + (isNaN(qThr) ? '—' : qThr + ' %') + ')</span>' +
      '<span class="badge ' + (quorum ? 'badge-ok">имеется' : 'badge-no">отсутствует') + '</span></div>';

    if (voted > total) {
      html += '<p class="err">Ошибка: участников больше, чем всего голосов в этом составе (' +
        withUnit(voted) + ' против ' + withUnit(total) + ').</p>';
    }

    if (rows.length) {
      html += '<table class="calc-table"><thead><tr><th>Вопрос</th><th class="num">За</th><th class="num">Против</th>' +
        '<th class="num">Возд.</th><th class="num">Итог</th></tr></thead><tbody>';
      var warnings = [];
      rows.forEach(function (item) {
        var r = item.row;
        var za = H.num(r[1]), pr = H.num(r[2]), vo = H.num(r[3]);
        var sum = (isNaN(za) ? 0 : za) + (isNaN(pr) ? 0 : pr) + (isNaN(vo) ? 0 : vo);
        var share = voted > 0 ? (isNaN(za) ? 0 : za) / voted * 100 : 0;
        var passed = !isNaN(dThr) && quorum && share >= dThr;
        html += '<tr><td>' + H.esc(r[0] || '—') + '</td>' +
          '<td class="num">' + (isNaN(za) ? '—' : share.toFixed(2) + ' %') + '</td>' +
          '<td class="num">' + (isNaN(pr) ? '—' : (pr / voted * 100).toFixed(2) + ' %') + '</td>' +
          '<td class="num">' + (isNaN(vo) ? '—' : (vo / voted * 100).toFixed(2) + ' %') + '</td>' +
          '<td class="num"><span class="badge ' + (passed ? 'badge-ok">принято' : 'badge-no">не принято') + '</span></td></tr>';
        if (sum > 0 && Math.abs(sum - voted) > eps()) {
          warnings.push('Вопрос ' + item.no + ': сумма голосов ' + withUnit(sum) +
            ' не совпадает с числом голосов участников ' + withUnit(voted) +
            ' (разница ' + withUnit(sum - voted) + ').');
        }
      });
      html += '</tbody></table>';
      warnings.forEach(function (w) { html += '<p class="err">' + H.esc(w) + '</p>'; });
    }
    return html;
  }

  function calc() {
    var qThr = H.num($('#c_quorum').value);
    var dThr = H.num($('#c_decision').value);
    var out = $('#calcOut');

    var home = groupData(GROUPS.home);
    var park = groupData(GROUPS.park);

    if (calcBasis === 'units') {
      $('#c_unitsTotal').innerHTML = 'Всего голосов: <b>' + (isNaN(home.total) ? '—' : fmtVotes(home.total)) + '</b>';
      $('#c2_unitsTotal').innerHTML = 'Всего голосов: <b>' + (isNaN(park.total) ? '—' : fmtVotes(park.total)) + '</b>';
    }

    /* Вопросы с пятым полем «паркинг» или «кладовк» уходят во второй состав. */
    var qHome = [], qPark = [];
    H.ROWS($('#c_questions').value).forEach(function (r, i) {
      var item = { row: r, no: i + 1 };
      (/парк|клад/i.test(r[4] || '') ? qPark : qHome).push(item);
    });

    var homeReady = !isNaN(home.total) && home.total > 0 && !isNaN(home.voted);
    var parkReady = !isNaN(park.total) && park.total > 0 && !isNaN(park.voted);

    if (!homeReady && !parkReady) {
      out.innerHTML = '<p class="muted">' + (calcBasis === 'units'
        ? 'Укажите количество помещений и число участвовавших собственников.'
        : 'Укажите общую площадь дома и площадь участников голосования.') + '</p>';
      return;
    }

    var both = homeReady && parkReady;
    var html = '';

    if (homeReady) html += groupBlock(GROUPS.home, home, qHome, qThr, dThr, both);
    else if (qHome.length) html += '<p class="err">Есть вопросы по управлению домом, но данные о квартирах и нежилых помещениях не заполнены.</p>';

    if (parkReady) html += groupBlock(GROUPS.park, park, qPark, qThr, dThr, both);
    else if (qPark.length) html += '<p class="err">Есть вопросы по паркингу и кладовкам, но данные по ним не заполнены.</p>';

    html += '<p class="hint" style="margin-top:12px">Доли «за», «против» и «воздержался» рассчитаны от ' +
      (calcBasis === 'units' ? 'числа участвовавших собственников' : 'площади участников') +
      ' внутри своего состава голосующих.</p>';

    out.innerHTML = html;
  }

  $$('.mode-btn', $('#calcMode')).forEach(function (b) {
    b.addEventListener('click', function () { setBasis(b.dataset.basis); });
  });

  ['c_total', 'c_voted', 'c_flats', 'c_nonres', 'c_votedUnits',
    'c2_total', 'c2_voted', 'c2_park', 'c2_store', 'c2_votedUnits',
    'c_quorum', 'c_decision', 'c_questions']
    .forEach(function (id) { $('#' + id).addEventListener('input', calc); });

  /* ---------------- Консультации ---------------- */
  var qaCat = 'all';

  function catTitle(id) {
    var c = window.QA_CATEGORIES.filter(function (x) { return x.id === id; })[0];
    return c ? c.title : id;
  }

  function buildChips() {
    var chips = [{ id: 'all', title: 'Все вопросы' }].concat(window.QA_CATEGORIES);
    $('#qaChips').innerHTML = chips.map(function (c) {
      var n = c.id === 'all'
        ? window.QA_ITEMS.length
        : window.QA_ITEMS.filter(function (i) { return i.cat === c.id; }).length;
      return '<button type="button" class="chip' + (qaCat === c.id ? ' is-active' : '') +
        '" data-cat="' + c.id + '">' + H.esc(c.title) + ' <span class="muted">' + n + '</span></button>';
    }).join('');

    $$('.chip', $('#qaChips')).forEach(function (b) {
      b.addEventListener('click', function () {
        qaCat = b.dataset.cat;
        buildChips();
        buildQA($('#qaSearch').value);
      });
    });
  }

  function qaMatches(item, q) {
    if (!q) return true;
    var hay = [item.q, item.short, item.caution, (item.steps || []).join(' '),
      (item.basis || []).join(' '), (item.tags || []).join(' ')].join(' ').toLowerCase();
    return q.split(/\s+/).filter(Boolean).every(function (w) { return hay.indexOf(w) > -1; });
  }

  function buildQA(filter) {
    var q = (filter || '').trim().toLowerCase();
    var items = window.QA_ITEMS.filter(function (i) {
      return (qaCat === 'all' || i.cat === qaCat) && qaMatches(i, q);
    });

    $('#qaCount').textContent = items.length
      ? 'Показано вопросов: ' + items.length + ' из ' + window.QA_ITEMS.length
      : '';

    if (!items.length) {
      $('#qaList').innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div>' +
        '<h2>По этому запросу ничего нет</h2>' +
        '<p>Сформулируйте вопрос в блоке ниже — приложение соберёт его вместе с реквизитами дома и передаст Claude.</p></div>';
      return;
    }

    $('#qaList').innerHTML = items.map(function (item) {
      var idx = window.QA_ITEMS.indexOf(item);
      var docs = (item.docs || []).map(function (id) {
        var t = window.DOC_TEMPLATES.filter(function (x) { return x.id === id; })[0];
        return t ? '<button type="button" class="btn btn-sm" data-open-doc="' + id + '">' + H.esc(t.title) + '</button>' : '';
      }).join('');

      return '<details class="qa"><summary><span class="qa-tag">' + H.esc(catTitle(item.cat)) + '</span>' +
        H.esc(item.q) + '</summary><div class="qa-body">' +
        '<p class="qa-short">' + H.esc(item.short) + '</p>' +
        (item.steps && item.steps.length
          ? '<h4>Порядок действий</h4><ol>' + item.steps.map(function (s) { return '<li>' + H.esc(s) + '</li>'; }).join('') + '</ol>'
          : '') +
        (item.basis && item.basis.length
          ? '<h4>На что опереться</h4><ul>' + item.basis.map(function (s) { return '<li>' + H.esc(s) + '</li>'; }).join('') + '</ul>'
          : '') +
        (item.caution ? '<div class="qa-caution">⚠️ ' + H.esc(item.caution) + '</div>' : '') +
        '<div class="qa-foot">' +
        (item.cat === 'tax'
          ? '<a class="btn btn-sm" href="' + H.esc(window.QA_TAX_CODE.url) + '" target="_blank" rel="noopener" ' +
            'title="' + H.esc(window.QA_TAX_CODE.title) + '">Налоговый кодекс ↗</a>'
          : '') +
        (docs ? '<span class="label">Документы:</span>' + docs : '') +
        '<button type="button" class="btn btn-sm" data-ask="' + idx + '" style="margin-left:auto">Уточнить у Claude ↗</button>' +
        '</div></div></details>';
    }).join('');

    $$('[data-open-doc]', $('#qaList')).forEach(function (b) {
      b.addEventListener('click', function () {
        showView('docs');
        openDoc(b.dataset.openDoc);
      });
    });

    $$('[data-ask]', $('#qaList')).forEach(function (b) {
      b.addEventListener('click', function () {
        var item = window.QA_ITEMS[Number(b.dataset.ask)];
        $('#askQuestion').value = item.q;
        renderAsk();
        $('#askCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('#askContext').focus();
      });
    });
  }

  $('#qaSearch').addEventListener('input', function () { buildQA(this.value); });

  /* --- Сборка запроса для Claude --- */
  var PROFILE_LABELS = {
    orgForm: 'Форма управления', orgName: 'Наименование', bin: 'БИН', address: 'Адрес дома',
    totalArea: 'Общая полезная площадь дома, м²', units: 'Количество помещений',
    chairman: 'Председатель', manager: 'Управляющий'
  };

  function buildPrompt() {
    var question = ($('#askQuestion').value || '').trim();
    var context = ($('#askContext').value || '').trim();

    var parts = ['Ты — ассистент управляющего многоквартирным жилым домом в Республике Казахстан (ОСИ, КСК, простое товарищество). Отвечай применительно к законодательству РК.'];

    parts.push('\nВОПРОС\n' + (question || '[сформулируйте вопрос]'));

    if (context) parts.push('\nОБСТОЯТЕЛЬСТВА\n' + context);

    if ($('#askIncludeProfile').checked) {
      var lines = Object.keys(PROFILE_LABELS)
        .filter(function (k) { return (profile[k] || '').toString().trim(); })
        .map(function (k) { return '- ' + PROFILE_LABELS[k] + ': ' + profile[k]; });
      if (lines.length) parts.push('\nРЕКВИЗИТЫ ДОМА\n' + lines.join('\n'));
    }

    var rules = [
      '- Официально-деловой стиль, по существу, на «вы».',
      '- Ссылайся на конкретный закон и статью. Если не уверен в номере или в действующей редакции — скажи об этом прямо и не выдумывай реквизиты.',
      '- Предупреди, что законодательство и типовые формы могли измениться, и порекомендуй сверить редакцию на adilet.zan.kz.',
      '- Если ситуация спорная или судебная — укажи, что нужен юрист.',
      '- Проверь арифметику, если в ответе есть суммы, доли голосов или кворум.',
      '- Недостающие данные обозначай как ___ или [указать], не придумывай их.'
    ];
    if ($('#askWantDoc').checked) {
      rules.push('- Подготовь готовый документ в официально-деловом стиле и выдай его файлом Word.');
    }
    parts.push('\nКАК ОТВЕЧАТЬ\n' + rules.join('\n'));

    return parts.join('\n');
  }

  function renderAsk() {
    if (!$('#askPreview').hidden) $('#askPreview').textContent = buildPrompt();
  }

  ['askQuestion', 'askContext', 'askIncludeProfile', 'askWantDoc'].forEach(function (id) {
    $('#' + id).addEventListener('input', renderAsk);
    $('#' + id).addEventListener('change', renderAsk);
  });

  $('#btnAskToggle').addEventListener('click', function () {
    var pre = $('#askPreview');
    pre.hidden = !pre.hidden;
    this.textContent = pre.hidden ? 'Показать запрос' : 'Скрыть запрос';
    renderAsk();
  });

  $('#btnAskCopy').addEventListener('click', function () {
    copyText(buildPrompt(), 'Запрос скопирован — вставьте его в чат с Claude');
  });

  $('#btnAskClaude').addEventListener('click', function () {
    if (!($('#askQuestion').value || '').trim()) {
      toast('Сначала сформулируйте вопрос');
      $('#askQuestion').focus();
      return;
    }
    var prompt = buildPrompt();
    var url = 'https://claude.ai/new?q=' + encodeURIComponent(prompt);
    if (url.length > 7500) {
      copyText(prompt, 'Запрос длинный — он скопирован, вставьте его в чат');
      window.open('https://claude.ai/new', '_blank', 'noopener');
      return;
    }
    window.open(url, '_blank', 'noopener');
  });

  /* ---------------- Судебные споры ---------------- */
  function docButtons(ids) {
    return (ids || []).map(function (id) {
      var t = window.DOC_TEMPLATES.filter(function (x) { return x.id === id; })[0];
      return t ? '<button type="button" class="btn btn-sm" data-open-doc="' + id + '">' + H.esc(t.title) + '</button>' : '';
    }).join('');
  }

  function bindDocButtons(root) {
    $$('[data-open-doc]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        showView('docs');
        openDoc(b.dataset.openDoc);
      });
    });
  }

  function ulOf(arr) {
    return '<ul>' + (arr || []).map(function (s) { return '<li>' + H.esc(s) + '</li>'; }).join('') + '</ul>';
  }

  function buildCourt() {
    $('#courtSources').innerHTML = window.COURT_SOURCES.map(function (s) {
      return '<article class="source-card"><h3>' + H.esc(s.title) + '</h3>' +
        '<p>' + H.esc(s.desc) + '</p>' +
        (s.how && s.how.length
          ? '<h4>Как искать</h4><ol>' + s.how.map(function (h) { return '<li>' + H.esc(h) + '</li>'; }).join('') + '</ol>'
          : '') +
        '<a class="btn btn-sm" href="' + H.esc(s.url) + '" target="_blank" rel="noopener">Открыть ↗</a></article>';
    }).join('');

    $('#courtCount').textContent = 'Разобрано споров: ' + window.COURT_TOPICS.length;

    $('#courtList').innerHTML = window.COURT_TOPICS.map(function (c) {
      return '<details class="qa"><summary><span class="qa-tag">Спор</span>' + H.esc(c.title) + '</summary>' +
        '<div class="qa-body">' +
        '<p class="qa-short">' + H.esc(c.short) + '</p>' +
        '<div class="court-parties"><span class="label">Стороны:</span>' + H.esc(c.parties) + '</div>' +
        '<h4>Что решает исход</h4>' + ulOf(c.decides) +
        '<h4 class="h-bad">Ошибки, которые проигрывают спор</h4>' + ulOf(c.mistakes) +
        '<h4>Что готовить заранее</h4>' + ulOf(c.prepare) +
        '<div class="qa-caution">⚠️ ' + H.esc(c.caution) + '</div>' +
        '<div class="qa-foot">' +
        (c.docs && c.docs.length ? '<span class="label">Документы:</span>' + docButtons(c.docs) : '') +
        '</div></div></details>';
    }).join('');

    bindDocButtons($('#courtList'));
  }

  /* ---------------- Идеи и новости ---------------- */
  var ideaArea = 'all';

  function areaTitle(id) {
    var a = window.IDEA_AREAS.filter(function (x) { return x.id === id; })[0];
    return a ? a.title : id;
  }

  function buildIdeaChips() {
    var chips = [{ id: 'all', title: 'Все направления' }].concat(window.IDEA_AREAS);
    $('#ideaChips').innerHTML = chips.map(function (c) {
      var n = c.id === 'all'
        ? window.IDEA_ITEMS.length
        : window.IDEA_ITEMS.filter(function (i) { return i.area === c.id; }).length;
      return '<button type="button" class="chip' + (ideaArea === c.id ? ' is-active' : '') +
        '" data-area="' + c.id + '">' + H.esc(c.title) + ' <span class="muted">' + n + '</span></button>';
    }).join('');

    $$('.chip', $('#ideaChips')).forEach(function (b) {
      b.addEventListener('click', function () {
        ideaArea = b.dataset.area;
        buildIdeaChips();
        buildIdeas();
      });
    });
  }

  function buildIdeas() {
    var items = window.IDEA_ITEMS.filter(function (i) { return ideaArea === 'all' || i.area === ideaArea; });
    $('#ideaCount').textContent = 'Показано идей: ' + items.length + ' из ' + window.IDEA_ITEMS.length;

    $('#ideaList').innerHTML = items.map(function (i) {
      return '<details class="qa"><summary><span class="qa-tag">' + H.esc(areaTitle(i.area)) + '</span>' +
        H.esc(i.title) + '</summary><div class="qa-body">' +
        '<p class="qa-short">' + H.esc(i.short) + '</p>' +
        '<h4>Что это даёт дому</h4>' + ulOf(i.gains) +
        '<h4>Как внедрить</h4><ol>' + (i.steps || []).map(function (s) { return '<li>' + H.esc(s) + '</li>'; }).join('') + '</ol>' +
        '<div class="qa-caution">⚠️ ' + H.esc(i.risks) + '</div>' +
        (i.origin ? '<p class="origin-note">' + H.esc(i.origin) + '</p>' : '') +
        '<div class="qa-foot">' +
        (i.meeting ? '<span class="meet-flag">Нужно решение собрания</span>' : '') +
        (i.docs && i.docs.length ? '<span class="label">Документы:</span>' + docButtons(i.docs) : '') +
        '</div></div></details>';
    }).join('');

    bindDocButtons($('#ideaList'));
  }

  function sourceCards(list) {
    return list.map(function (s) {
      return '<article class="legal-card"><h3>' + H.esc(s.title) + '</h3>' +
        '<p class="desc">' + H.esc(s.desc) + '</p>' +
        '<div class="foot"><a class="btn" href="' + H.esc(s.url) + '" target="_blank" rel="noopener">Открыть ↗</a></div></article>';
    }).join('');
  }

  function buildSources() {
    $('#sourcesKz').innerHTML = sourceCards(window.NEWS_SOURCES.kz);
    $('#sourcesWorld').innerHTML = sourceCards(window.NEWS_SOURCES.world);
  }

  /* --- Дайджест новостей через Claude --- */
  function buildDigestPrompt() {
    var topic = $('#digestTopic').value;
    var period = $('#digestPeriod').value;
    var extra = ($('#digestExtra').value || '').trim();

    var lines = [
      'Подготовь обзор для управляющего многоквартирным жилым домом в Республике Казахстан (ОСИ, КСК, простое товарищество).',
      '',
      'ТЕМА',
      topic + ' — ' + period + '.' + (extra ? ' Уточнение: ' + extra + '.' : ''),
      '',
      'ЧТО НУЖНО',
      '- Найди актуальную информацию поиском по сети: без него обзор будет устаревшим.',
      '- 5–8 пунктов, каждый: что произошло, с какой даты действует и что конкретно меняется для дома.',
      '- Отдельно выдели то, что требует действий от управляющего, и укажи срок.',
      '- Международные практики давай только с пометкой, применимы ли они в РК и что для этого нужно.',
      '',
      'КАК ОТВЕЧАТЬ',
      '- По каждому пункту указывай источник и дату публикации.',
      '- Не выдумывай номера и даты нормативных актов. Если не уверен — скажи прямо.',
      '- Реквизиты нормативных актов рекомендуй сверять на adilet.zan.kz.',
      '- Не приводи ставки, пороги и размер МРП по памяти — только со ссылкой на источник.',
      '- Отделяй факты от прогнозов и мнений комментаторов.'
    ];
    return lines.join('\n');
  }

  function renderDigest() {
    if (!$('#digestPreview').hidden) $('#digestPreview').textContent = buildDigestPrompt();
  }

  ['digestTopic', 'digestPeriod', 'digestExtra'].forEach(function (id) {
    $('#' + id).addEventListener('input', renderDigest);
    $('#' + id).addEventListener('change', renderDigest);
  });

  $('#btnDigestToggle').addEventListener('click', function () {
    var pre = $('#digestPreview');
    pre.hidden = !pre.hidden;
    this.textContent = pre.hidden ? 'Показать запрос' : 'Скрыть запрос';
    renderDigest();
  });

  $('#btnDigestCopy').addEventListener('click', function () {
    copyText(buildDigestPrompt(), 'Запрос скопирован — вставьте его в чат с Claude');
  });

  $('#btnDigestClaude').addEventListener('click', function () {
    var p = buildDigestPrompt();
    var url = 'https://claude.ai/new?q=' + encodeURIComponent(p);
    if (url.length > 7500) {
      copyText(p, 'Запрос длинный — он скопирован, вставьте его в чат');
      window.open('https://claude.ai/new', '_blank', 'noopener');
      return;
    }
    window.open(url, '_blank', 'noopener');
  });

  /* ---------------- Правовая база ---------------- */
  function buildLegal() {
    $('#legalList').innerHTML = window.LEGAL_BASE.map(function (l) {
      var href = l.url || ('https://adilet.zan.kz/rus/search/docs?fulltext=' + encodeURIComponent(l.search || l.title));
      var chip = l.verified
        ? '<span class="chip-ok">ссылка проверена</span>'
        : '<span class="chip-check">требует проверки</span>';
      return '<article class="legal-card"><h3>' + H.esc(l.title) + '</h3>' +
        '<p class="meta">' + H.esc(l.meta) + '</p>' +
        '<p class="desc">' + H.esc(l.desc) + '</p>' +
        '<div class="foot"><a class="btn" href="' + H.esc(href) + '" target="_blank" rel="noopener">Открыть на adilet.zan.kz ↗</a>' +
        chip + '</div></article>';
    }).join('');
  }

  /* ---------------- Инструкция ---------------- */
  function buildInstruction() {
    $('#instructionText').textContent = window.ASSISTANT_INSTRUCTION;
    $('#btnCopyInstruction').addEventListener('click', function () {
      copyText(window.ASSISTANT_INSTRUCTION, 'Инструкция скопирована — вставьте в Project instructions');
    });
  }

  /* ---------------- О продукте ---------------- */
  function buildAbout() {
    $('#aboutDocList').innerHTML = window.DOC_TEMPLATES.map(function (t) {
      return '<li>' + H.esc(t.title) + ' <span class="muted">— ' + H.esc(t.group) + '</span></li>';
    }).join('');
    $$('.doc-count').forEach(function (el) { el.textContent = window.DOC_TEMPLATES.length; });
    $$('.qa-total').forEach(function (el) { el.textContent = window.QA_ITEMS.length; });
    $$('.court-total').forEach(function (el) { el.textContent = window.COURT_TOPICS.length; });
    $$('.idea-total').forEach(function (el) { el.textContent = window.IDEA_ITEMS.length; });
  }

  /* ---------------- Старт ---------------- */
  buildProfileForm();
  updateHouseChip();
  buildDocList('');
  buildChips();
  buildQA('');
  buildCourt();
  buildIdeaChips();
  buildIdeas();
  buildSources();
  buildLegal();

  if (profile.totalArea && !$('#c_total').value) $('#c_total').value = profile.totalArea;
  if (profile.units && !$('#c_flats').value) $('#c_flats').value = profile.units;
  buildInstruction();
  buildAbout();
  calc();

  var last = read(LS.lastDoc, null);
  if (last && window.DOC_TEMPLATES.some(function (t) { return t.id === last; })) openDoc(last);

  var hash = location.hash.slice(1);
  if (hash && $('#view-' + hash)) showView(hash);
})();
