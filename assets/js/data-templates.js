/* Шаблоны документов дома.
   Каждый шаблон: { id, group, title, note, fields[], render(ctx) -> HTML }
   ctx = { p: реквизиты дома, f: значения полей формы }
   Пустые значения всегда выводятся плейсхолдером — ничего не додумывается за пользователя. */

(function () {
  'use strict';

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Значение или плейсхолдер. */
  function V(x, ph) {
    var s = (x == null ? '' : String(x)).trim();
    if (!s) return '<span class="ph">' + esc(ph || '___') + '</span>';
    return esc(s);
  }

  /** Дата в формате «08» августа 2026 года. */
  function D(iso) {
    if (!iso) return '<span class="ph">«___» ____________ 20__ года</span>';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return V(iso);
    return '«' + String(d.getDate()).padStart(2, '0') + '» ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ' года';
  }

  /** Короткая дата 08.08.2026 */
  function Dshort(iso) {
    if (!iso) return '<span class="ph">__.__.20__</span>';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return V(iso);
    return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
  }

  function num(x) {
    if (x == null) return NaN;
    var s = String(x).replace(/\s+/g, '').replace(',', '.');
    if (!s) return NaN;
    var n = Number(s);
    return isNaN(n) ? NaN : n;
  }

  /** 1234.5 -> «1 234,50» */
  function money(n) {
    if (isNaN(n)) return '___';
    var neg = n < 0;
    var parts = Math.abs(n).toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (neg ? '−' : '') + parts[0] + ',' + parts[1];
  }

  /** Целое с разделителями разрядов — для количества голосов и помещений. */
  function n0(n) {
    if (isNaN(n)) return '___';
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function plural(n, one, few, many) {
    var a = Math.abs(Math.round(n)) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    return b === 1 ? one : many;
  }

  function fmt(x, suffix) {
    var n = num(x);
    if (isNaN(n)) return '<span class="ph">___</span>';
    return money(n) + (suffix ? ' ' + suffix : '');
  }

  /** Непустые строки текстового поля. */
  function L(text) {
    if (!text) return [];
    return String(text).split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /** Строки вида «а | б | в» -> массив массивов. */
  function ROWS(text) {
    return L(text).map(function (line) {
      return line.split('|').map(function (c) { return c.trim(); });
    });
  }

  /** Нумерованный список или плейсхолдер. */
  function OL(text, ph) {
    var items = L(text);
    if (!items.length) return '<ol><li><span class="ph">' + esc(ph || '[указать]') + '</span></li></ol>';
    return '<ol>' + items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ol>';
  }

  function UL(text, ph) {
    var items = L(text);
    if (!items.length) return '<ul><li><span class="ph">' + esc(ph || '[указать]') + '</span></li></ul>';
    return '<ul>' + items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
  }

  /** Шапка документа с реквизитами дома. */
  function HEAD(p) {
    return '<p class="center"><strong>' + V(p.orgForm, 'ОСИ') + ' ' + V(p.orgName, '«наименование»') + '</strong><br>' +
      '<span class="small">БИН ' + V(p.bin) + ' · Адрес дома: ' + V(p.address, '[адрес дома]') + '</span></p>';
  }

  /** Подпись: должность / линия / расшифровка. */
  function SIGN(role, name) {
    return '<div class="sign-row"><span>' + role + '</span>' +
      '<span><span class="fill">&nbsp;</span> ' + V(name, '________________') + '</span></div>';
  }

  function place(p, f) {
    return V((f && f.place) || p.city, '[населённый пункт]');
  }

  /** Таблица «наименование | сумма» с автоитогом. Возвращает {html, total}. */
  function sumTable(text, colName, ph) {
    var rows = ROWS(text);
    var total = 0, hasNum = false;
    var body = rows.map(function (r, i) {
      var n = num(r[1]);
      if (!isNaN(n)) { total += n; hasNum = true; }
      return '<tr><td class="num">' + (i + 1) + '</td><td>' + esc(r[0] || '—') + '</td>' +
        '<td class="num">' + (isNaN(n) ? '<span class="ph">___</span>' : money(n)) + '</td></tr>';
    }).join('');
    if (!rows.length) {
      body = '<tr><td class="num">1</td><td><span class="ph">' + esc(ph || '[статья]') +
        '</span></td><td class="num"><span class="ph">___</span></td></tr>';
    }
    var html = '<table><thead><tr><th class="num" style="width:36px">№</th><th>' + esc(colName) +
      '</th><th class="num" style="width:150px">Сумма, тенге</th></tr></thead><tbody>' + body +
      '<tr class="total"><td></td><td>ИТОГО</td><td class="num">' +
      (hasNum ? money(total) : '<span class="ph">___</span>') + '</td></tr></tbody></table>';
    return { html: html, total: hasNum ? total : NaN };
  }

  /** Таблица объектов собственности голосующего: постоянные строки
      «Квартира», «Помещение», «Паркинг». Пустые номера остаются под заполнение от руки. */
  function objTable(f) {
    var rows = [
      ['Квартира', f.flatNo],
      ['Помещение', f.roomNo],
      ['Паркинг', f.parkNo]
    ];
    return '<table><thead><tr><th>Вид объекта</th><th style="width:170px">Номер</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var val = (r[1] == null ? '' : String(r[1])).trim();
        return '<tr><td>' + r[0] + '</td><td>' + (val ? esc(val) : '&nbsp;') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /** Таблица вопросов: собственник расписывается в одной из трёх граф. */
  function voteTable(text, ph) {
    var qs = L(text);
    if (!qs.length) qs = [ph || '[формулировка вопроса]'];
    function head(word) {
      return '<th class="num" style="width:96px">' + word + '<br><span class="small">(подпись)</span></th>';
    }
    return '<table><thead><tr><th class="num" style="width:34px">№</th><th>Вопрос, поставленный на голосование</th>' +
      head('За') + head('Против') + head('Воздер-жался') + '</tr></thead><tbody>' +
      qs.map(function (q, i) {
        return '<tr><td class="num">' + (i + 1) + '</td><td>' + esc(q) +
          '</td><td class="sig">&nbsp;</td><td class="sig">&nbsp;</td><td class="sig">&nbsp;</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /** Поля номеров объектов для листа голосования и листа опроса. */
  var OBJ_FIELDS = [
    { id: 'flatNo', label: 'Квартира №', placeholder: '42' },
    { id: 'roomNo', label: 'Помещение №', placeholder: '3Н' },
    { id: 'parkNo', label: 'Паркинг, место №', placeholder: '17' }
  ];

  window.DOC_HELPERS = { esc: esc, V: V, D: D, Dshort: Dshort, num: num, money: money, L: L, ROWS: ROWS };

  var MEETING_FORMS = ['очное голосование', 'письменный опрос (заочное голосование)', 'смешанное голосование'];

  window.DOC_TEMPLATES = [

    /* ============ ОБЩЕЕ СОБРАНИЕ ============ */
    {
      id: 'notice',
      group: 'Общее собрание',
      title: 'Уведомление о созыве общего собрания',
      note: 'Размещается на доске объявлений и/или вручается собственникам заранее. Срок уведомления сверьте с уставом и действующей редакцией закона.',
      fields: [
        { id: 'noticeDate', label: 'Дата уведомления', type: 'date' },
        { id: 'meetingDate', label: 'Дата собрания', type: 'date' },
        { id: 'meetingTime', label: 'Время начала', placeholder: '19:00' },
        { id: 'meetingPlace', label: 'Место проведения', placeholder: 'двор дома, у подъезда № 1' },
        { id: 'meetingForm', label: 'Форма голосования', type: 'select', options: MEETING_FORMS },
        { id: 'initiator', label: 'Инициатор собрания', placeholder: 'председатель ОСИ / группа собственников' },
        { id: 'agenda', label: 'Повестка дня', type: 'textarea', rows: 5, placeholder: 'Утверждение сметы расходов на 2026 год\nОтчёт управляющего за 2025 год\nИзбрание членов ревизионной комиссии' },
        { id: 'materials', label: 'Где ознакомиться с материалами', placeholder: 'офис ОСИ, подъезд № 1, будни 10:00–18:00' },
        { id: 'contact', label: 'Контакт для вопросов', placeholder: '+7 (700) 000-00-00' }
      ],
      render: function (c) {
        var p = c.p, f = c.f;
        return HEAD(p) +
          '<h1>Уведомление</h1>' +
          '<h2>о проведении общего собрания собственников квартир и нежилых помещений</h2>' +
          '<div class="row"><span>' + place(p, f) + '</span><span>' + D(f.noticeDate) + '</span></div>' +
          '<p>Уважаемые собственники! Настоящим уведомляем вас о проведении общего собрания собственников квартир и нежилых помещений многоквартирного жилого дома по адресу: ' +
          V(p.address, '[адрес дома]') + '.</p>' +
          '<p><strong>Инициатор проведения собрания:</strong> ' + V(f.initiator, '[инициатор]') + '.</p>' +
          '<p><strong>Дата проведения:</strong> ' + D(f.meetingDate) + '<br>' +
          '<strong>Время начала:</strong> ' + V(f.meetingTime, '__:__') + '<br>' +
          '<strong>Место проведения:</strong> ' + V(f.meetingPlace, '[место проведения]') + '<br>' +
          '<strong>Форма голосования:</strong> ' + V(f.meetingForm, MEETING_FORMS[0]) + '</p>' +
          '<h3>Повестка дня</h3>' + OL(f.agenda, '[вопрос повестки дня]') +
          '<p>С материалами, выносимыми на рассмотрение собрания, можно ознакомиться: ' + V(f.materials, '[место и время ознакомления]') + '.</p>' +
          '<p>При себе иметь документ, удостоверяющий личность, и документ, подтверждающий право собственности на помещение. Представитель собственника участвует в собрании при наличии доверенности, оформленной в установленном законодательством порядке.</p>' +
          '<p>Собрание проводится в соответствии с законодательством Республики Казахстан о жилищных отношениях и уставом ' + V(p.orgForm, 'ОСИ') + '.</p>' +
          '<p>Вопросы по проведению собрания: ' + V(f.contact || p.phone, '[телефон]') + '.</p>' +
          '<div class="sign">' + SIGN(V(p.orgForm, 'ОСИ') + ', председатель', p.chairman) + '</div>';
      }
    },

    {
      id: 'protocol',
      group: 'Общее собрание',
      title: 'Протокол общего собрания собственников',
      note: 'Голоса считаются по количеству собственников помещений. Приложение проверяет кворум и сумму голосов по каждому вопросу — расхождения подсвечиваются. Вопросы содержания парковочных мест выносятся в отдельный раздел: их решает свой состав собственников.',
      fields: [
        { id: 'protocolNo', label: 'Номер протокола', placeholder: '3' },
        { id: 'meetingDate', label: 'Дата собрания', type: 'date' },
        { id: 'meetingPlace', label: 'Место проведения', placeholder: 'двор дома, у подъезда № 1' },
        { id: 'meetingForm', label: 'Форма голосования', type: 'select', options: MEETING_FORMS },
        { id: 'totalUnits', label: 'Всего помещений в доме (квартиры и нежилые)', type: 'number', fromProfile: 'units' },
        { id: 'presentCount', label: 'Приняли участие собственников (голосов)', type: 'number' },
        { id: 'quorumPct', label: 'Порог кворума, % от общего числа голосов', type: 'number', value: '50' },
        { id: 'chair', label: 'Председатель собрания', placeholder: 'Ф.И.О.' },
        { id: 'secretary', label: 'Секретарь собрания', placeholder: 'Ф.И.О.' },
        { id: 'counters', label: 'Счётная комиссия', type: 'textarea', rows: 3, placeholder: 'Ф.И.О., кв. №' },
        { id: 'votes', label: 'Вопросы и голоса', type: 'textarea', rows: 6,
          hint: 'Формат строки: вопрос | за | против | воздержался (в голосах)',
          placeholder: 'Утверждение сметы расходов на 2026 год | 2400 | 520 | 200\nИзбрание председателя ОСИ | 2900 | 120 | 100' },
        { id: 'decisions', label: 'Принятые решения (по пунктам)', type: 'textarea', rows: 5,
          placeholder: 'Утвердить смету расходов на 2026 год в сумме ___ тенге.\nИзбрать председателем ОСИ ___.' },

        { id: 'parkTotalUnits', label: 'Паркинг: всего парковочных мест', type: 'number',
          hint: 'Заполняйте, только если рассматривались вопросы содержания паркинга' },
        { id: 'parkPresentCount', label: 'Паркинг: приняли участие собственников', type: 'number' },
        { id: 'parkVotes', label: 'Паркинг: вопросы и голоса', type: 'textarea', rows: 4,
          hint: 'Формат строки: вопрос | за | против | воздержался',
          placeholder: 'Утверждение текущего взноса на содержание парковочных мест | 30 | 6 | 4\nЦелевой взнос на ремонт ворот паркинга | 28 | 8 | 4' },
        { id: 'parkDecisions', label: 'Паркинг: принятые решения', type: 'textarea', rows: 3,
          placeholder: 'Утвердить текущий взнос на содержание парковочных мест в размере ___ тенге.' },

        { id: 'attachments', label: 'Приложения', type: 'textarea', rows: 3,
          placeholder: 'Список зарегистрированных участников на ___ л.\nБюллетени голосования — ___ шт.' }
      ],
      render: function (c) {
        var p = c.p, f = c.f;
        var unit = 'голосов';
        var thr = isNaN(num(f.quorumPct)) ? 50 : num(f.quorumPct);
        var fmtV = n0;
        var tol = 0.5;

        /* Один состав голосующих: строка о кворуме, повестка и результаты.
           Статья 42 Закона «О жилищных отношениях» разделяет собственников квартир
           и нежилых помещений (управление домом) и собственников парковочных мест
           (их содержание) — поэтому составы считаются раздельно. */
        function group(total, present, votesText, cfg) {
          var pct = (!isNaN(total) && total > 0 && !isNaN(present)) ? present / total * 100 : NaN;
          var rows = ROWS(votesText);

          var quorumLine;
          if (isNaN(pct)) {
            quorumLine = 'Кворум: <span class="ph">___ %</span> — заполните ' + cfg.needText + '.';
          } else {
            quorumLine = 'Приняли участие собственники ' + n0(present) + ' ' +
              plural(present, cfg.objOne, cfg.objMany, cfg.objMany) +
              ' (' + pct.toFixed(2) + ' % от ' + cfg.baseWord + '). Кворум ' +
              (pct >= thr ? '<strong>имеется</strong>' : '<span class="warn">отсутствует</span>') +
              ' (порог — ' + money(thr) + ' %).';
          }

          var agenda = rows.length
            ? '<ol>' + rows.map(function (r) { return '<li>' + esc(r[0] || '[вопрос]') + '</li>'; }).join('') + '</ol>'
            : '<ol><li><span class="ph">[вопрос повестки дня]</span></li></ol>';

          var results = rows.length
            ? rows.map(function (r, i) {
                var za = num(r[1]), pr = num(r[2]), vo = num(r[3]);
                var sum = (isNaN(za) ? 0 : za) + (isNaN(pr) ? 0 : pr) + (isNaN(vo) ? 0 : vo);
                var base = !isNaN(present) && present > 0 ? present : sum;
                function cell(x) {
                  if (isNaN(x)) return '<td class="num"><span class="ph">___</span></td><td class="num"><span class="ph">___</span></td>';
                  return '<td class="num">' + fmtV(x) + '</td><td class="num">' +
                    (base > 0 ? (x / base * 100).toFixed(2) + ' %' : '—') + '</td>';
                }
                var mismatch = '';
                if (!isNaN(present) && present > 0 && sum > 0 && Math.abs(sum - present) > tol) {
                  mismatch = '<p class="small warn">Внимание: сумма голосов по вопросу (' + fmtV(sum) +
                    ' ' + unit + ') не совпадает с числом голосов участников (' + fmtV(present) + ' ' + unit +
                    '). Разница ' + fmtV(sum - present) + ' ' + unit + '.</p>';
                }
                return '<h3>' + cfg.qPrefix + ' № ' + (i + 1) + '. ' + esc(r[0] || '[формулировка вопроса]') + '</h3>' +
                  '<table><thead><tr><th>Результат голосования</th><th class="num">Голосов</th>' +
                  '<th class="num">Доля</th></tr></thead><tbody>' +
                  '<tr><td>«За»</td>' + cell(za) + '</tr>' +
                  '<tr><td>«Против»</td>' + cell(pr) + '</tr>' +
                  '<tr><td>«Воздержался»</td>' + cell(vo) + '</tr>' +
                  '<tr class="total"><td>Всего учтено</td><td class="num">' + fmtV(sum) + '</td><td class="num">' +
                  (base > 0 ? (sum / base * 100).toFixed(2) + ' %' : '—') + '</td></tr>' +
                  '</tbody></table>' + mismatch;
              }).join('')
            : '<p><span class="ph">[Заполните поле «' + cfg.emptyField + '»: вопрос | за | против | воздержался]</span></p>';

          return { quorumLine: quorumLine, agenda: agenda, results: results, rows: rows };
        }

        var home = group(
          num(f.totalUnits) || num(p.units),
          num(f.presentCount),
          f.votes,
          {
            baseWord: 'общего числа квартир и нежилых помещений',
            needText: 'количество помещений в доме и число участвовавших собственников',
            objOne: 'помещения', objMany: 'помещений',
            qPrefix: 'Вопрос', emptyField: 'Вопросы и голоса'
          });

        var parkTotal = num(f.parkTotalUnits);
        var parkPresent = num(f.parkPresentCount);
        var hasPark = (!isNaN(parkTotal) && parkTotal > 0) || ROWS(f.parkVotes).length || L(f.parkDecisions).length;

        var park = hasPark ? group(parkTotal, parkPresent, f.parkVotes, {
          baseWord: 'общего числа парковочных мест',
          needText: 'количество парковочных мест и число участвовавших собственников',
          objOne: 'парковочного места', objMany: 'парковочных мест',
          qPrefix: 'Вопрос', emptyField: 'Паркинг: вопросы и голоса'
        }) : null;

        var h2 = hasPark
          ? 'общего собрания собственников квартир, нежилых помещений и парковочных мест'
          : 'общего собрания собственников квартир и нежилых помещений';

        var parkBlock = '';
        if (hasPark) {
          parkBlock =
            '<h3>Раздел II. Вопросы содержания парковочных мест</h3>' +
            '<p>Вопросы настоящего раздела рассматриваются собственниками парковочных мест. ' +
            'Голоса собственников квартир и нежилых помещений по этим вопросам не учитываются.</p>' +
            '<p><strong>Всего парковочных мест:</strong> ' + V(f.parkTotalUnits, '___') + '<br>' +
            '<strong>Приняли участие:</strong> ' +
            (isNaN(num(f.parkPresentCount))
              ? '<span class="ph">___</span> собственников'
              : n0(num(f.parkPresentCount)) + ' ' + plural(num(f.parkPresentCount), 'собственник', 'собственника', 'собственников')) + '</p>' +
            '<p>' + park.quorumLine + '</p>' +
            '<p><strong>Повестка дня раздела:</strong></p>' + park.agenda +
            '<p><strong>Результаты голосования:</strong></p>' + park.results +
            '<p><strong>Решили:</strong></p>' + OL(f.parkDecisions, '[формулировка решения]');
        }

        return HEAD(p) +
          '<h1>Протокол № ' + V(f.protocolNo) + '</h1>' +
          '<h2>' + h2 + '</h2>' +
          '<div class="row"><span>' + place(p, f) + '</span><span>' + D(f.meetingDate) + '</span></div>' +
          '<p><strong>Адрес дома:</strong> ' + V(p.address, '[адрес дома]') + '<br>' +
          '<strong>Место проведения:</strong> ' + V(f.meetingPlace, '[место проведения]') + '<br>' +
          '<strong>Форма голосования:</strong> ' + V(f.meetingForm, MEETING_FORMS[0]) + '<br>' +
          '<strong>Подсчёт голосов:</strong> по количеству собственников помещений</p>' +
          (hasPark ? '<h3>Раздел I. Вопросы управления объектом кондоминиума</h3>' +
            '<p>Вопросы настоящего раздела рассматриваются собственниками квартир и нежилых помещений.</p>' : '') +
          '<p><strong>Всего помещений в доме (квартиры и нежилые):</strong> ' + V(f.totalUnits || p.units, '___') + '<br>' +
          '<strong>Приняли участие:</strong> ' +
          (isNaN(num(f.presentCount))
            ? '<span class="ph">___</span> собственников'
            : n0(num(f.presentCount)) + ' ' + plural(num(f.presentCount), 'собственник', 'собственника', 'собственников')) + '</p>' +
          '<p>' + home.quorumLine + '</p>' +
          '<p><strong>Председатель собрания:</strong> ' + V(f.chair || p.chairman, '[Ф.И.О.]') + '<br>' +
          '<strong>Секретарь собрания:</strong> ' + V(f.secretary, '[Ф.И.О.]') + '</p>' +
          '<p><strong>Счётная комиссия:</strong></p>' + UL(f.counters, '[Ф.И.О., кв. №]') +
          '<h3>' + (hasPark ? 'Повестка дня раздела I' : 'Повестка дня') + '</h3>' + home.agenda +
          '<h3>Результаты голосования</h3>' + home.results +
          '<h3>Решили</h3>' + OL(f.decisions, '[формулировка решения]') +
          parkBlock +
          '<h3>Приложения</h3>' + OL(f.attachments, '[перечень приложений]') +
          '<div class="sign">' +
          SIGN('Председатель собрания', f.chair || p.chairman) +
          SIGN('Секретарь собрания', f.secretary) +
          '</div>';
      }
    },

    {
      id: 'ballot',
      group: 'Общее собрание',
      title: 'Лист (бюллетень) голосования',
      note: 'По одному листу на каждого собственника. В таблице объектов заполняются номера квартиры, помещения и парковочного места. Вопросы содержания паркинга вынесены в отдельный блок: их заполняют только собственники парковочных мест.',
      fields: [
        { id: 'meetingDate', label: 'Дата собрания', type: 'date' },
        { id: 'ownerName', label: 'Собственник, Ф.И.О.', placeholder: 'оставьте пустым для печати бланков' }
      ].concat(OBJ_FIELDS).concat([
        { id: 'questions', label: 'Вопросы управления домом', type: 'textarea', rows: 5,
          hint: 'Голосуют собственники квартир и нежилых помещений',
          placeholder: 'Утверждение сметы расходов на 2026 год\nИзбрание председателя ОСИ' },
        { id: 'parkQuestions', label: 'Вопросы содержания паркинга', type: 'textarea', rows: 4,
          hint: 'Необязательно. Голосуют собственники парковочных мест',
          placeholder: 'Утверждение текущего взноса на содержание парковочных мест\nЦелевой взнос на ремонт ворот паркинга' }
      ]),
      render: function (c) {
        var p = c.p, f = c.f;
        var hasPark = L(f.parkQuestions).length > 0;

        return HEAD(p) +
          '<h1>Лист голосования</h1>' +
          '<h2>общего собрания собственников' +
          (hasPark ? ' квартир, нежилых помещений и парковочных мест' : ' квартир и нежилых помещений') +
          ' от ' + D(f.meetingDate) + '</h2>' +
          '<p><strong>Адрес дома:</strong> ' + V(p.address, '[адрес дома]') + '</p>' +
          '<p><strong>Собственник (Ф.И.О.):</strong> ' + V(f.ownerName, '____________________________________') + '</p>' +
          '<p><strong>Объекты собственности:</strong></p>' + objTable(f) +
          '<p>По каждому вопросу подпись ставится только в одной графе.</p>' +
          (hasPark ? '<h3>I. Вопросы управления объектом кондоминиума</h3>' +
            '<p class="small">Заполняется собственниками квартир и нежилых помещений.</p>' : '') +
          voteTable(f.questions) +
          (hasPark
            ? '<h3>II. Вопросы содержания парковочных мест</h3>' +
              '<p class="small">Заполняется только собственниками парковочных мест. ' +
              'Голоса по этим вопросам учитываются отдельно от вопросов управления домом.</p>' +
              voteTable(f.parkQuestions)
            : '') +
          '<p class="small">Лист, в котором по вопросу подпись проставлена более чем в одной графе либо не проставлена ни в одной, по данному вопросу не учитывается. Исправления заверяются подписью собственника.</p>' +
          '<div class="sign">' +
          '<div class="sign-row"><span>Собственник: <span class="fill">&nbsp;</span></span>' +
          '<span>Дата: <span class="fill" style="min-width:120px">&nbsp;</span></span></div>' +
          '<p class="small right">(подпись, расшифровка)</p>' +
          '<div class="sign-row"><span>Лист принял (счётная комиссия): <span class="fill">&nbsp;</span></span>' +
          '<span>Дата: <span class="fill" style="min-width:120px">&nbsp;</span></span></div>' +
          '</div>';
      }
    },

    {
      id: 'survey',
      group: 'Общее собрание',
      title: 'Лист письменного опроса (заочное голосование)',
      note: 'Применяется при заочной форме. Обязательно фиксируются срок сбора листов и место их возврата. В таблице объектов заполняются номера квартиры, помещения и парковочного места.',
      fields: [
        { id: 'startDate', label: 'Дата начала опроса', type: 'date' },
        { id: 'endDate', label: 'Дата окончания опроса', type: 'date' },
        { id: 'returnPlace', label: 'Место возврата листа', placeholder: 'офис ОСИ, подъезд № 1' },
        { id: 'initiator', label: 'Инициатор опроса', placeholder: 'председатель ОСИ' },
        { id: 'ownerName', label: 'Собственник, Ф.И.О.' }
      ].concat(OBJ_FIELDS).concat([
        { id: 'questions', label: 'Вопросы управления домом', type: 'textarea', rows: 5,
          hint: 'Голосуют собственники квартир и нежилых помещений',
          placeholder: 'Утверждение размера взноса на содержание общего имущества\nПроведение ремонта кровли' },
        { id: 'parkQuestions', label: 'Вопросы содержания паркинга', type: 'textarea', rows: 4,
          hint: 'Необязательно. Голосуют собственники парковочных мест',
          placeholder: 'Утверждение текущего взноса на содержание парковочных мест' }
      ]),
      render: function (c) {
        var p = c.p, f = c.f;
        var hasPark = L(f.parkQuestions).length > 0;

        return HEAD(p) +
          '<h1>Лист письменного опроса</h1>' +
          '<h2>(заочное голосование собственников' +
          (hasPark ? ' квартир, нежилых помещений и парковочных мест' : ' квартир и нежилых помещений') + ')</h2>' +
          '<p><strong>Адрес дома:</strong> ' + V(p.address, '[адрес дома]') + '<br>' +
          '<strong>Инициатор опроса:</strong> ' + V(f.initiator, '[инициатор]') + '<br>' +
          '<strong>Срок проведения опроса:</strong> с ' + Dshort(f.startDate) + ' по ' + Dshort(f.endDate) + '<br>' +
          '<strong>Место возврата заполненного листа:</strong> ' + V(f.returnPlace, '[место возврата]') + '</p>' +
          '<p><strong>Собственник (Ф.И.О.):</strong> ' + V(f.ownerName, '____________________________________') + '</p>' +
          '<p><strong>Объекты собственности:</strong></p>' + objTable(f) +
          '<p>По каждому вопросу подпись ставится только в одной графе.</p>' +
          (hasPark ? '<h3>I. Вопросы управления объектом кондоминиума</h3>' +
            '<p class="small">Заполняется собственниками квартир и нежилых помещений.</p>' : '') +
          voteTable(f.questions) +
          (hasPark
            ? '<h3>II. Вопросы содержания парковочных мест</h3>' +
              '<p class="small">Заполняется только собственниками парковочных мест. ' +
              'Голоса по этим вопросам учитываются отдельно от вопросов управления домом.</p>' +
              voteTable(f.parkQuestions)
            : '') +
          '<p class="small">Лист, возвращённый после ' + Dshort(f.endDate) + ', при подведении итогов не учитывается. Исправления заверяются подписью собственника.</p>' +
          '<div class="sign">' +
          '<div class="sign-row"><span>Собственник: <span class="fill">&nbsp;</span></span>' +
          '<span>Дата: <span class="fill" style="min-width:120px">&nbsp;</span></span></div>' +
          '<p class="small right">(подпись, расшифровка)</p>' +
          '</div>';
      }
    },

    /* ============ ОТЧЁТНОСТЬ ============ */
    {
      id: 'report-month',
      group: 'Отчётность',
      title: 'Ежемесячный отчёт управляющего',
      note: 'Итоги по доходам и расходам и остаток на конец периода считаются автоматически из введённых строк.',
      fields: [
        { id: 'period', label: 'Отчётный период', placeholder: 'июль 2026 года' },
        { id: 'reportDate', label: 'Дата составления', type: 'date' },
        { id: 'openBalance', label: 'Остаток на начало периода, тенге', type: 'number' },
        { id: 'income', label: 'Поступления', type: 'textarea', rows: 5,
          hint: 'Формат строки: наименование | сумма',
          placeholder: 'Взносы на содержание общего имущества | 1450000\nЦелевые взносы | 300000\nАренда общего имущества | 60000' },
        { id: 'expense', label: 'Расходы', type: 'textarea', rows: 6,
          hint: 'Формат строки: наименование | сумма',
          placeholder: 'Заработная плата и налоги | 620000\nЭлектроэнергия мест общего пользования | 145000\nВывоз мусора | 180000\nТекущий ремонт | 240000' },
        { id: 'debt', label: 'Задолженность собственников на конец периода, тенге', type: 'number' },
        { id: 'saveBalance', label: 'Остаток на сберегательном счёте, тенге', type: 'number' },
        { id: 'works', label: 'Выполненные работы за период', type: 'textarea', rows: 4,
          placeholder: 'Замена участка трубопровода ГВС в подвале\nРемонт входной двери подъезда № 2' },
        { id: 'notes', label: 'Примечания', type: 'textarea', rows: 3 }
      ],
      render: function (c) {
        var p = c.p, f = c.f;
        var inc = sumTable(f.income, 'Наименование поступления', '[вид поступления]');
        var exp = sumTable(f.expense, 'Статья расходов', '[статья расходов]');
        var open = num(f.openBalance);
        var close = NaN;
        if (!isNaN(open) || !isNaN(inc.total) || !isNaN(exp.total)) {
          close = (isNaN(open) ? 0 : open) + (isNaN(inc.total) ? 0 : inc.total) - (isNaN(exp.total) ? 0 : exp.total);
        }
        var incomplete = isNaN(open) || isNaN(inc.total) || isNaN(exp.total);

        return HEAD(p) +
          '<h1>Отчёт управляющего</h1>' +
          '<h2>о доходах и расходах за ' + V(f.period, '[период]') + '</h2>' +
          '<div class="row"><span>' + place(p, f) + '</span><span>' + D(f.reportDate) + '</span></div>' +
          '<p><strong>Адрес дома:</strong> ' + V(p.address, '[адрес дома]') + '</p>' +
          '<p><strong>Остаток денежных средств на начало периода:</strong> ' + fmt(f.openBalance, 'тенге') + '</p>' +
          '<h3>1. Поступления</h3>' + inc.html +
          '<h3>2. Расходы</h3>' + exp.html +
          '<h3>3. Итоги периода</h3>' +
          '<table><tbody>' +
          '<tr><td>Остаток на начало периода</td><td class="num">' + fmt(f.openBalance) + '</td></tr>' +
          '<tr><td>Поступило за период</td><td class="num">' + (isNaN(inc.total) ? '<span class="ph">___</span>' : money(inc.total)) + '</td></tr>' +
          '<tr><td>Израсходовано за период</td><td class="num">' + (isNaN(exp.total) ? '<span class="ph">___</span>' : money(exp.total)) + '</td></tr>' +
          '<tr class="total"><td>Остаток на конец периода</td><td class="num">' + (isNaN(close) ? '<span class="ph">___</span>' : money(close)) + '</td></tr>' +
          '</tbody></table>' +
          (incomplete ? '<p class="small warn">Остаток на конец периода рассчитан по заполненным данным. Заполните все три показателя, чтобы итог был корректным.</p>' : '') +
          (close < 0 ? '<p class="small warn">Расчётный остаток отрицательный — проверьте суммы.</p>' : '') +
          '<p><strong>Задолженность собственников на конец периода:</strong> ' + fmt(f.debt, 'тенге') + '<br>' +
          '<strong>Остаток на сберегательном счёте:</strong> ' + fmt(f.saveBalance, 'тенге') + '</p>' +
          '<h3>4. Выполненные работы</h3>' + OL(f.works, '[выполненная работа]') +
          (L(f.notes).length ? '<h3>5. Примечания</h3><p>' + esc(f.notes).replace(/\n/g, '<br>') + '</p>' : '') +
          '<p class="small">Подтверждающие документы (договоры, счета, акты выполненных работ, платёжные поручения) хранятся у управляющего и предоставляются собственникам для ознакомления.</p>' +
          '<div class="sign">' +
          SIGN('Управляющий', p.manager || p.chairman) +
          SIGN('Бухгалтер', p.accountant) +
          '</div>';
      }
    },

    {
      id: 'report-year',
      group: 'Отчётность',
      title: 'Годовой отчёт',
      note: 'Выносится на утверждение общего собрания. Суммы по разделам считаются автоматически.',
      fields: [
        { id: 'year', label: 'Отчётный год', placeholder: '2026' },
        { id: 'reportDate', label: 'Дата составления', type: 'date' },
        { id: 'openBalance', label: 'Остаток на начало года, тенге', type: 'number' },
        { id: 'income', label: 'Поступления за год', type: 'textarea', rows: 5,
          hint: 'Формат строки: наименование | сумма',
          placeholder: 'Взносы на содержание общего имущества | 17400000\nВзносы на капитальный ремонт | 3600000' },
        { id: 'expense', label: 'Расходы за год', type: 'textarea', rows: 6,
          hint: 'Формат строки: наименование | сумма',
          placeholder: 'Заработная плата и налоги | 7440000\nКоммунальные услуги мест общего пользования | 1740000\nТекущий ремонт | 2900000' },
        { id: 'works', label: 'Выполненные работы за год', type: 'textarea', rows: 5 },
        { id: 'plans', label: 'План работ на следующий год', type: 'textarea', rows: 5 },
        { id: 'debt', label: 'Задолженность собственников на конец года, тенге', type: 'number' },
        { id: 'saveBalance', label: 'Остаток на сберегательном счёте, тенге', type: 'number' },
        { id: 'auditNote', label: 'Отметка ревизионной комиссии', type: 'textarea', rows: 2 }
      ],
      render: function (c) {
        var p = c.p, f = c.f;
        var inc = sumTable(f.income, 'Наименование поступления', '[вид поступления]');
        var exp = sumTable(f.expense, 'Статья расходов', '[статья расходов]');
        var open = num(f.openBalance);
        var close = (isNaN(open) ? 0 : open) + (isNaN(inc.total) ? 0 : inc.total) - (isNaN(exp.total) ? 0 : exp.total);

        return HEAD(p) +
          '<h1>Годовой отчёт</h1>' +
          '<h2>о деятельности и об исполнении сметы за ' + V(f.year, '20__') + ' год</h2>' +
          '<div class="row"><span>' + place(p, f) + '</span><span>' + D(f.reportDate) + '</span></div>' +
          '<p><strong>Адрес дома:</strong> ' + V(p.address, '[адрес дома]') + '<br>' +
          '<strong>Общая полезная площадь дома:</strong> ' + fmt(p.totalArea, 'м²') + '<br>' +
          '<strong>Количество помещений:</strong> ' + V(p.units, '___') + '</p>' +
          '<h3>1. Поступления за год</h3>' + inc.html +
          '<h3>2. Расходы за год</h3>' + exp.html +
          '<h3>3. Движение денежных средств</h3>' +
          '<table><tbody>' +
          '<tr><td>Остаток на начало года</td><td class="num">' + fmt(f.openBalance) + '</td></tr>' +
          '<tr><td>Поступило за год</td><td class="num">' + (isNaN(inc.total) ? '<span class="ph">___</span>' : money(inc.total)) + '</td></tr>' +
          '<tr><td>Израсходовано за год</td><td class="num">' + (isNaN(exp.total) ? '<span class="ph">___</span>' : money(exp.total)) + '</td></tr>' +
          '<tr class="total"><td>Остаток на конец года</td><td class="num">' + money(close) + '</td></tr>' +
          '</tbody></table>' +
          '<p><strong>Задолженность собственников на конец года:</strong> ' + fmt(f.debt, 'тенге') + '<br>' +
          '<strong>Остаток на сберегательном счёте:</strong> ' + fmt(f.saveBalance, 'тенге') + '</p>' +
          '<h3>4. Выполненные работы</h3>' + OL(f.works, '[выполненная работа]') +
          '<h3>5. План работ на следующий год</h3>' + OL(f.plans, '[планируемая работа]') +
          '<h3>6. Заключение ревизионной комиссии</h3>' +
          '<p>' + (L(f.auditNote).length ? esc(f.auditNote).replace(/\n/g, '<br>') : '<span class="ph">[отметка ревизионной комиссии]</span>') + '</p>' +
          '<p>Отчёт выносится на рассмотрение и утверждение общего собрания собственников квартир и нежилых помещений.</p>' +
          '<div class="sign">' +
          SIGN('Председатель ' + V(p.orgForm, 'ОСИ'), p.chairman) +
          SIGN('Бухгалтер', p.accountant) +
          '</div>';
      }
    },

    {
      id: 'act-reconciliation',
      group: 'Отчётность',
      title: 'Акт сверки взаиморасчётов',
      note: 'Двусторонний документ. Итоги по дебету и кредиту и конечное сальдо считаются автоматически.',
      fields: [
        { id: 'counterparty', label: 'Контрагент', placeholder: 'ТОО «Подрядчик»' },
        { id: 'counterpartyBin', label: 'БИН контрагента' },
        { id: 'contract', label: 'Договор', placeholder: 'договор № 12 от 01.02.2026' },
        { id: 'periodFrom', label: 'Период с', type: 'date' },
        { id: 'periodTo', label: 'Период по', type: 'date' },
        { id: 'openBalance', label: 'Сальдо на начало периода, тенге', type: 'number',
          hint: 'Положительное — задолженность контрагента, отрицательное — наша' },
        { id: 'ops', label: 'Операции за период', type: 'textarea', rows: 6,
          hint: 'Формат строки: дата | документ | дебет | кредит',
          placeholder: '05.03.2026 | Акт выполненных работ № 7 | 450000 | 0\n12.03.2026 | Платёжное поручение № 118 | 0 | 450000' },
        { id: 'actDate', label: 'Дата составления акта', type: 'date' }
      ],
      render: function (c) {
        var p = c.p, f = c.f;
        var rows = ROWS(f.ops);
        var dt = 0, kt = 0, has = false;
        var body = rows.map(function (r) {
          var d = num(r[2]), k = num(r[3]);
          if (!isNaN(d)) { dt += d; has = true; }
          if (!isNaN(k)) { kt += k; has = true; }
          return '<tr><td>' + esc(r[0] || '—') + '</td><td>' + esc(r[1] || '—') + '</td>' +
            '<td class="num">' + (isNaN(d) ? '—' : money(d)) + '</td>' +
            '<td class="num">' + (isNaN(k) ? '—' : money(k)) + '</td></tr>';
        }).join('');
        if (!rows.length) {
          body = '<tr><td><span class="ph">__.__.____</span></td><td><span class="ph">[документ]</span></td>' +
            '<td class="num"><span class="ph">___</span></td><td class="num"><span class="ph">___</span></td></tr>';
        }
        var open = num(f.openBalance);
        var close = (isNaN(open) ? 0 : open) + dt - kt;

        return '<h1>Акт сверки взаимных расчётов</h1>' +
          '<p class="center">за период с ' + Dshort(f.periodFrom) + ' по ' + Dshort(f.periodTo) + '</p>' +
          '<div class="row"><span>' + place(p, f) + '</span><span>' + D(f.actDate) + '</span></div>' +
          '<p>Мы, нижеподписавшиеся, ' + V(p.orgForm, 'ОСИ') + ' ' + V(p.orgName, '«наименование»') +
          ' (БИН ' + V(p.bin) + '), с одной стороны, и ' + V(f.counterparty, '[контрагент]') +
          ' (БИН ' + V(f.counterpartyBin) + '), с другой стороны, составили настоящий акт о том, что состояние взаимных расчётов по ' +
          V(f.contract, '[договор, номер и дата]') + ' по данным учёта следующее.</p>' +
          '<p><strong>Сальдо на начало периода:</strong> ' + fmt(f.openBalance, 'тенге') + '</p>' +
          '<table><thead><tr><th style="width:100px">Дата</th><th>Документ, основание</th>' +
          '<th class="num" style="width:130px">Дебет</th><th class="num" style="width:130px">Кредит</th></tr></thead>' +
          '<tbody>' + body +
          '<tr class="total"><td colspan="2">Обороты за период</td><td class="num">' +
          (has ? money(dt) : '<span class="ph">___</span>') + '</td><td class="num">' +
          (has ? money(kt) : '<span class="ph">___</span>') + '</td></tr></tbody></table>' +
          '<p><strong>Сальдо на конец периода:</strong> ' + money(close) + ' тенге' +
          (close > 0 ? ' — задолженность в пользу ' + V(p.orgForm, 'ОСИ') + '.'
            : close < 0 ? ' — задолженность перед контрагентом.' : ' — взаимная задолженность отсутствует.') + '</p>' +
          '<p class="small">Акт составлен в двух экземплярах, имеющих одинаковую юридическую силу, по одному для каждой стороны. При наличии расхождений сторона указывает их в графе возражений и прилагает подтверждающие документы.</p>' +
          '<div class="sign">' +
          '<div class="sign-row" style="align-items:flex-start">' +
          '<span style="width:47%">От ' + V(p.orgForm, 'ОСИ') + ' ' + V(p.orgName, '«наименование»') +
          '<br><br><span class="fill">&nbsp;</span><br><span class="small">' + V(p.chairman, '[Ф.И.О.]') + '</span></span>' +
          '<span style="width:47%">От ' + V(f.counterparty, '[контрагент]') +
          '<br><br><span class="fill">&nbsp;</span><br><span class="small">[Ф.И.О.]</span></span>' +
          '</div></div>';
      }
    },

    /* ============ АКТЫ ============ */
    {
      id: 'act-flood',
      group: 'Акты',
      title: 'Акт о затоплении',
      note: 'Составляется комиссией по возможности в день происшествия. Фиксируйте только наблюдаемые факты; вывод о виновном лице делается отдельно.',
      fields: [
        { id: 'actNo', label: 'Номер акта' },
        { id: 'actDate', label: 'Дата составления', type: 'date' },
        { id: 'eventDate', label: 'Дата затопления', type: 'date' },
        { id: 'eventTime', label: 'Время обнаружения', placeholder: '14:30' },
        { id: 'victimUnit', label: 'Пострадавшее помещение №', placeholder: '42' },
        { id: 'victimOwner', label: 'Собственник пострадавшего помещения, Ф.И.О.' },
        { id: 'sourceUnit', label: 'Источник затопления', placeholder: 'кв. № 46 / общедомовой стояк ГВС' },
        { id: 'cause', label: 'Причина затопления', type: 'textarea', rows: 3,
          placeholder: 'Разрыв гибкой подводки к смесителю в помещении № 46' },
        { id: 'damage', label: 'Перечень повреждений', type: 'textarea', rows: 6,
          placeholder: 'Кухня: намокание потолка площадью 3 м², отслоение обоев на стене 2 м²\nКоридор: вздутие ламината площадью 4 м²' },
        { id: 'commission', label: 'Состав комиссии', type: 'textarea', rows: 4,
          placeholder: 'Ахметов А. А., председатель ОСИ\nСериков С. С., сантехник\nИванова И. И., собственник кв. 44' },
        { id: 'presentParties', label: 'Присутствовали при осмотре', type: 'textarea', rows: 3 },
        { id: 'refusal', label: 'Отметка об отказе от подписи', type: 'textarea', rows: 2,
          placeholder: 'Собственник помещения № 46 от подписания акта отказался' },
        { id: 'attachments', label: 'Приложения', type: 'textarea', rows: 3,
          placeholder: 'Фотоматериалы на ___ л.' }
      ],
      render: function (c) {
        var p = c.p, f = c.f;
        return HEAD(p) +
          '<h1>Акт № ' + V(f.actNo) + '</h1>' +
          '<h2>о затоплении помещения</h2>' +
          '<div class="row"><span>' + place(p, f) + '</span><span>' + D(f.actDate) + '</span></div>' +
          '<p>Комиссия в составе:</p>' + UL(f.commission, '[Ф.И.О., должность]') +
          '<p>произвела осмотр помещения № ' + V(f.victimUnit, '___') + ' в многоквартирном жилом доме по адресу: ' +
          V(p.address, '[адрес дома]') + ', и составила настоящий акт о нижеследующем.</p>' +
          '<p><strong>1.</strong> ' + D(f.eventDate) + ' в ' + V(f.eventTime, '__:__') +
          ' обнаружено затопление помещения № ' + V(f.victimUnit, '___') + ', собственник — ' +
          V(f.victimOwner, '[Ф.И.О. собственника]') + '.</p>' +
          '<p><strong>2. Источник поступления воды:</strong> ' + V(f.sourceUnit, '[источник затопления]') + '.</p>' +
          '<p><strong>3. Причина затопления:</strong> ' +
          (L(f.cause).length ? esc(f.cause).replace(/\n/g, '<br>') : '<span class="ph">[причина, установленная при осмотре]</span>') + '</p>' +
          '<p><strong>4. При осмотре зафиксированы следующие повреждения:</strong></p>' + OL(f.damage, '[повреждение, место, объём]') +
          '<p><strong>5. При осмотре присутствовали:</strong></p>' + UL(f.presentParties, '[Ф.И.О., статус]') +
          (L(f.refusal).length ? '<p><strong>6. Отметка:</strong> ' + esc(f.refusal).replace(/\n/g, '<br>') + '</p>' : '') +
          '<p>Акт составлен в ___ экземплярах. Размер ущерба настоящим актом не определяется и устанавливается отдельно, в том числе на основании заключения оценщика.</p>' +
          '<h3>Приложения</h3>' + OL(f.attachments, '[фотоматериалы, иные документы]') +
          '<div class="sign"><p><strong>Подписи членов комиссии:</strong></p>' +
          (L(f.commission).length
            ? L(f.commission).map(function (m) { return SIGN(esc(m), ''); }).join('')
            : SIGN('[Ф.И.О., должность]', '')) +
          SIGN('Собственник пострадавшего помещения', f.victimOwner) +
          '</div>';
      }
    },

    {
      id: 'act-damage',
      group: 'Акты',
      title: 'Акт о повреждении общего имущества',
      note: 'Подходит и для повреждения имущества собственника. Основание для претензии и требования о возмещении вреда.',
      fields: [
        { id: 'actNo', label: 'Номер акта' },
        { id: 'actDate', label: 'Дата составления', type: 'date' },
        { id: 'eventDate', label: 'Дата повреждения / обнаружения', type: 'date' },
        { id: 'object', label: 'Что повреждено', placeholder: 'входная дверь подъезда № 2, домофонная панель' },
        { id: 'location', label: 'Место нахождения объекта', placeholder: 'подъезд № 2, 1 этаж' },
        { id: 'circumstances', label: 'Обстоятельства', type: 'textarea', rows: 4 },
        { id: 'damage', label: 'Характер и объём повреждений', type: 'textarea', rows: 5 },
        { id: 'culprit', label: 'Лицо, причинившее вред (если установлено)', placeholder: 'не установлено' },
        { id: 'estimate', label: 'Предварительная стоимость восстановления, тенге', type: 'number' },
        { id: 'measures', label: 'Принятые меры', type: 'textarea', rows: 3,
          placeholder: 'Вызов сотрудников органов внутренних дел, регистрация обращения № ___' },
        { id: 'commission', label: 'Состав комиссии', type: 'textarea', rows: 4 },
        { id: 'attachments', label: 'Приложения', type: 'textarea', rows: 3 }
      ],
      render: function (c) {
        var p = c.p, f = c.f;
        return HEAD(p) +
          '<h1>Акт № ' + V(f.actNo) + '</h1>' +
          '<h2>о повреждении имущества</h2>' +
          '<div class="row"><span>' + place(p, f) + '</span><span>' + D(f.actDate) + '</span></div>' +
          '<p>Комиссия в составе:</p>' + UL(f.commission, '[Ф.И.О., должность]') +
          '<p>составила настоящий акт о повреждении имущества в многоквартирном жилом доме по адресу: ' +
          V(p.address, '[адрес дома]') + '.</p>' +
          '<p><strong>1. Объект:</strong> ' + V(f.object, '[что повреждено]') + '<br>' +
          '<strong>Место нахождения:</strong> ' + V(f.location, '[место]') + '<br>' +
          '<strong>Дата повреждения (обнаружения):</strong> ' + D(f.eventDate) + '</p>' +
          '<p><strong>2. Обстоятельства:</strong> ' +
          (L(f.circumstances).length ? esc(f.circumstances).replace(/\n/g, '<br>') : '<span class="ph">[обстоятельства произошедшего]</span>') + '</p>' +
          '<p><strong>3. Характер и объём повреждений:</strong></p>' + OL(f.damage, '[повреждение и его объём]') +
          '<p><strong>4. Лицо, причинившее вред:</strong> ' + V(f.culprit, 'на момент составления акта не установлено') + '</p>' +
          '<p><strong>5. Предварительная стоимость восстановительного ремонта:</strong> ' + fmt(f.estimate, 'тенге') +
          ' (определена предварительно и подлежит уточнению на основании сметы либо заключения оценщика).</p>' +
          '<p><strong>6. Принятые меры:</strong></p>' + UL(f.measures, '[принятые меры]') +
          '<h3>Приложения</h3>' + OL(f.attachments, '[фотоматериалы, иные документы]') +
          '<div class="sign"><p><strong>Подписи членов комиссии:</strong></p>' +
          (L(f.commission).length
            ? L(f.commission).map(function (m) { return SIGN(esc(m), ''); }).join('')
            : SIGN('[Ф.И.О., должность]', '')) +
          '</div>';
      }
    },

    /* ============ ВЗЫСКАНИЕ И ПРЕТЕНЗИИ ============ */
    {
      id: 'debt-notice',
      group: 'Взыскание и претензии',
      title: 'Уведомление о задолженности по взносам',
      note: 'Досудебное уведомление. Итоговая сумма считается автоматически; сведения о задолженности передаются только самому собственнику.',
      fields: [
        { id: 'noticeNo', label: 'Исходящий номер' },
        { id: 'noticeDate', label: 'Дата уведомления', type: 'date' },
        { id: 'ownerName', label: 'Собственник, Ф.И.О.' },
        { id: 'unitNo', label: 'Помещение №' },
        { id: 'unitArea', label: 'Площадь помещения, м²', type: 'number' },
        { id: 'periodFrom', label: 'Задолженность с', type: 'date' },
        { id: 'periodTo', label: 'Задолженность по', type: 'date' },
        { id: 'items', label: 'Состав задолженности', type: 'textarea', rows: 5,
          hint: 'Формат строки: вид взноса | сумма',
          placeholder: 'Взнос на содержание общего имущества | 84000\nВзнос на капитальный ремонт (сберегательный счёт) | 21000' },
        { id: 'penalty', label: 'Начисленная пеня, тенге', type: 'number' },
        { id: 'payBefore', label: 'Срок погашения', type: 'date' }
      ],
      render: function (c) {
        var p = c.p, f = c.f;
        var t = sumTable(f.items, 'Вид взноса (платежа)', '[вид взноса]');
        var pen = num(f.penalty);
        var grand = (isNaN(t.total) ? NaN : t.total + (isNaN(pen) ? 0 : pen));

        return HEAD(p) +
          '<div class="head-right"><p>' + V(f.ownerName, '[Ф.И.О. собственника]') + '<br>' +
          'собственнику помещения № ' + V(f.unitNo, '___') + '<br>' +
          'по адресу: ' + V(p.address, '[адрес дома]') + '</p></div>' +
          '<h1>Уведомление о задолженности</h1>' +
          '<div class="row"><span>Исх. № ' + V(f.noticeNo) + '</span><span>' + D(f.noticeDate) + '</span></div>' +
          '<p>Уважаемый(ая) ' + V(f.ownerName, '[Ф.И.О.]') + '!</p>' +
          '<p>Сообщаем, что по помещению № ' + V(f.unitNo, '___') + ' площадью ' +
          (f.unitArea ? fmt(f.unitArea, 'м²') : '<span class="ph">___ м²</span>') +
          ' за период с ' + Dshort(f.periodFrom) + ' по ' + Dshort(f.periodTo) +
          ' образовалась задолженность по обязательным платежам на содержание общего имущества объекта кондоминиума.</p>' +
          t.html +
          '<p><strong>Начисленная пеня:</strong> ' + fmt(f.penalty, 'тенге') + '<br>' +
          '<strong>Итого к погашению:</strong> ' + (isNaN(grand) ? '<span class="ph">___</span>' : '<strong>' + money(grand) + ' тенге</strong>') + '</p>' +
          '<p>Просим погасить задолженность в срок до ' + D(f.payBefore) + ' по реквизитам:</p>' +
          '<p>Получатель: ' + V(p.orgForm, 'ОСИ') + ' ' + V(p.orgName, '«наименование»') + '<br>' +
          'БИН: ' + V(p.bin) + '<br>' +
          'ИИК (текущий счёт): ' + V(p.iik) + '<br>' +
          'ИИК (сберегательный счёт): ' + V(p.iikSave) + '<br>' +
          'Банк: ' + V(p.bank) + '</p>' +
          '<p>В случае непогашения задолженности в указанный срок ' + V(p.orgForm, 'ОСИ') +
          ' вправе обратиться за её взысканием к нотариусу за совершением исполнительной надписи ' +
          'либо в судебном порядке с отнесением всех расходов на должника.</p>' +
          '<p>Если задолженность уже погашена либо вы не согласны с расчётом — обратитесь по адресу ' +
          V(p.office, '[место приёма]') + ' или по телефону ' + V(p.phone, '[телефон]') + ' для сверки расчётов.</p>' +
          '<div class="sign">' + SIGN('Председатель ' + V(p.orgForm, 'ОСИ'), p.chairman) + '</div>';
      }
    },

    {
      id: 'claim',
      group: 'Взыскание и претензии',
      title: 'Претензия контрагенту',
      note: 'Досудебный порядок. Требование формулируйте конкретно: что сделать, в какой срок, на какую сумму.',
      fields: [
        { id: 'claimNo', label: 'Исходящий номер' },
        { id: 'claimDate', label: 'Дата претензии', type: 'date' },
        { id: 'addressee', label: 'Кому (наименование)', placeholder: 'ТОО «Подрядчик», директору Ф.И.О.' },
        { id: 'addresseeAddr', label: 'Адрес адресата', type: 'textarea', rows: 2 },
        { id: 'contract', label: 'Основание (договор)', placeholder: 'договор подряда № 12 от 01.02.2026' },
        { id: 'subject', label: 'Предмет обязательства', type: 'textarea', rows: 3,
          placeholder: 'Ремонт кровли над подъездами № 1–3 в срок до 30.05.2026' },
        { id: 'violation', label: 'В чём нарушение', type: 'textarea', rows: 4,
          placeholder: 'Работы в установленный срок не завершены; выявлены протечки в местах примыкания.' },
        { id: 'demand', label: 'Требования', type: 'textarea', rows: 4,
          placeholder: 'Безвозмездно устранить недостатки работ в срок до ___\nУплатить неустойку в размере ___ тенге' },
        { id: 'deadline', label: 'Срок для ответа', type: 'date' },
        { id: 'attachments', label: 'Приложения', type: 'textarea', rows: 3 }
      ],
      render: function (c) {
        var p = c.p, f = c.f;
        return HEAD(p) +
          '<div class="head-right"><p>' + V(f.addressee, '[наименование адресата]') + '<br>' +
          (L(f.addresseeAddr).length ? esc(f.addresseeAddr).replace(/\n/g, '<br>') : '<span class="ph">[адрес]</span>') + '</p></div>' +
          '<h1>Претензия</h1>' +
          '<div class="row"><span>Исх. № ' + V(f.claimNo) + '</span><span>' + D(f.claimDate) + '</span></div>' +
          '<p>Между ' + V(p.orgForm, 'ОСИ') + ' ' + V(p.orgName, '«наименование»') + ' и ' +
          V(f.addressee, '[адресат]') + ' заключён ' + V(f.contract, '[договор, номер и дата]') + '.</p>' +
          '<p><strong>Предмет обязательства:</strong> ' +
          (L(f.subject).length ? esc(f.subject).replace(/\n/g, '<br>') : '<span class="ph">[что и в какой срок должно быть исполнено]</span>') + '</p>' +
          '<p><strong>Обязательство надлежащим образом не исполнено:</strong> ' +
          (L(f.violation).length ? esc(f.violation).replace(/\n/g, '<br>') : '<span class="ph">[в чём выразилось нарушение, со ссылкой на пункты договора]</span>') + '</p>' +
          '<p>На основании изложенного и в соответствии с условиями договора и гражданским законодательством Республики Казахстан <strong>требуем</strong>:</p>' +
          OL(f.demand, '[конкретное требование, срок, сумма]') +
          '<p>Ответ на настоящую претензию просим направить в срок до ' + D(f.deadline) +
          ' по адресу: ' + V(p.address, '[адрес]') + ', либо на электронный адрес ' + V(p.email, '[e-mail]') + '.</p>' +
          '<p>В случае неудовлетворения требований в указанный срок мы будем вынуждены обратиться в суд за защитой нарушенных прав с отнесением на вас судебных расходов.</p>' +
          '<h3>Приложения</h3>' + OL(f.attachments, '[копии документов, подтверждающих требования]') +
          '<div class="sign">' + SIGN('Председатель ' + V(p.orgForm, 'ОСИ'), p.chairman) + '</div>';
      }
    },

    /* ============ ПРОЧЕЕ ============ */
    {
      id: 'contract',
      group: 'Прочее',
      title: 'Договор с подрядчиком (работы/услуги)',
      note: 'Рамочный черновик. Перед подписанием договор должен быть проверен юристом — особенно предмет, сроки, гарантия и ответственность.',
      fields: [
        { id: 'contractNo', label: 'Номер договора' },
        { id: 'contractDate', label: 'Дата договора', type: 'date' },
        { id: 'contractor', label: 'Подрядчик (наименование)', placeholder: 'ТОО «Подрядчик»' },
        { id: 'contractorBin', label: 'БИН подрядчика' },
        { id: 'contractorHead', label: 'Подписант подрядчика', placeholder: 'директор Ф.И.О., на основании устава' },
        { id: 'contractorAddr', label: 'Адрес и реквизиты подрядчика', type: 'textarea', rows: 3 },
        { id: 'subject', label: 'Предмет договора', type: 'textarea', rows: 3,
          placeholder: 'Ремонт кровли над подъездами № 1–3 общей площадью ___ м²' },
        { id: 'price', label: 'Цена договора, тенге', type: 'number' },
        { id: 'payment', label: 'Порядок оплаты', type: 'textarea', rows: 3,
          placeholder: 'Аванс 30 % в течение 5 рабочих дней с даты подписания; окончательный расчёт — в течение 10 рабочих дней с даты подписания акта выполненных работ.' },
        { id: 'startDate', label: 'Начало работ', type: 'date' },
        { id: 'endDate', label: 'Окончание работ', type: 'date' },
        { id: 'warranty', label: 'Гарантийный срок', placeholder: '24 месяца с даты подписания акта' },
        { id: 'penalty', label: 'Неустойка за просрочку', placeholder: '0,1 % от цены договора за каждый день просрочки' }
      ],
      render: function (c) {
        var p = c.p, f = c.f;
        return '<h1>Договор № ' + V(f.contractNo) + '</h1>' +
          '<h2>на выполнение работ (оказание услуг)</h2>' +
          '<div class="row"><span>' + place(p, f) + '</span><span>' + D(f.contractDate) + '</span></div>' +
          '<p>' + V(p.orgForm, 'ОСИ') + ' ' + V(p.orgName, '«наименование»') + ' (БИН ' + V(p.bin) +
          '), именуемое в дальнейшем «Заказчик», в лице председателя ' + V(p.chairman, '[Ф.И.О.]') +
          ', действующего на основании устава, с одной стороны, и ' + V(f.contractor, '[подрядчик]') +
          ' (БИН ' + V(f.contractorBin) + '), именуемое в дальнейшем «Подрядчик», в лице ' +
          V(f.contractorHead, '[должность, Ф.И.О., основание полномочий]') +
          ', с другой стороны, заключили настоящий договор о нижеследующем.</p>' +
          '<h3>1. Предмет договора</h3>' +
          '<p>1.1. Подрядчик обязуется выполнить по заданию Заказчика следующие работы: ' +
          (L(f.subject).length ? esc(f.subject).replace(/\n/g, '<br>') : '<span class="ph">[предмет работ]</span>') +
          ' на объекте по адресу: ' + V(p.address, '[адрес дома]') + ', а Заказчик обязуется принять их результат и оплатить.</p>' +
          '<p>1.2. Работы выполняются иждивением Подрядчика — его силами, средствами и материалами, если сторонами письменно не согласовано иное.</p>' +
          '<h3>2. Цена и порядок расчётов</h3>' +
          '<p>2.1. Цена договора составляет ' + fmt(f.price, 'тенге') + ' и включает стоимость работ, материалов и все налоги.</p>' +
          '<p>2.2. Порядок оплаты: ' +
          (L(f.payment).length ? esc(f.payment).replace(/\n/g, '<br>') : '<span class="ph">[порядок и сроки оплаты]</span>') + '</p>' +
          '<p>2.3. Оплата производится в безналичном порядке на счёт Подрядчика.</p>' +
          '<h3>3. Сроки</h3>' +
          '<p>3.1. Начало работ — ' + D(f.startDate) + '. Окончание работ — ' + D(f.endDate) + '.</p>' +
          '<h3>4. Порядок сдачи и приёмки</h3>' +
          '<p>4.1. Приёмка оформляется актом выполненных работ, подписываемым обеими сторонами.</p>' +
          '<p>4.2. При обнаружении недостатков Заказчик указывает их в акте; Подрядчик устраняет их безвозмездно в согласованный срок.</p>' +
          '<h3>5. Гарантия</h3>' +
          '<p>5.1. Гарантийный срок на результат работ — ' + V(f.warranty, '[срок]') +
          '. Недостатки, выявленные в течение гарантийного срока, устраняются Подрядчиком безвозмездно.</p>' +
          '<h3>6. Ответственность сторон</h3>' +
          '<p>6.1. За нарушение сроков выполнения работ Подрядчик уплачивает неустойку: ' + V(f.penalty, '[размер неустойки]') + '.</p>' +
          '<p>6.2. В остальном стороны несут ответственность в соответствии с гражданским законодательством Республики Казахстан.</p>' +
          '<h3>7. Разрешение споров</h3>' +
          '<p>7.1. Споры разрешаются путём переговоров, а при недостижении согласия — в судебном порядке по законодательству Республики Казахстан. Претензионный порядок обязателен, срок ответа на претензию — ___ рабочих дней.</p>' +
          '<h3>8. Заключительные положения</h3>' +
          '<p>8.1. Договор вступает в силу с даты подписания и действует до полного исполнения сторонами обязательств.</p>' +
          '<p>8.2. Изменения оформляются письменными дополнительными соглашениями.</p>' +
          '<p>8.3. Договор составлен в двух экземплярах, имеющих одинаковую юридическую силу.</p>' +
          '<h3>9. Реквизиты и подписи сторон</h3>' +
          '<table><tbody><tr><td style="width:50%"><strong>Заказчик</strong><br>' +
          V(p.orgForm, 'ОСИ') + ' ' + V(p.orgName, '«наименование»') + '<br>БИН: ' + V(p.bin) +
          '<br>Адрес: ' + V(p.address) + '<br>ИИК: ' + V(p.iik) + '<br>Банк: ' + V(p.bank) +
          '<br>Тел.: ' + V(p.phone) + '<br><br>Председатель<br><br><span class="fill">&nbsp;</span> ' +
          V(p.chairman, '[Ф.И.О.]') + '</td>' +
          '<td style="width:50%"><strong>Подрядчик</strong><br>' + V(f.contractor, '[наименование]') +
          '<br>БИН: ' + V(f.contractorBin) + '<br>' +
          (L(f.contractorAddr).length ? esc(f.contractorAddr).replace(/\n/g, '<br>') : '<span class="ph">[адрес, банковские реквизиты]</span>') +
          '<br><br>' + V(f.contractorHead, '[должность]') + '<br><br><span class="fill">&nbsp;</span> [Ф.И.О.]</td>' +
          '</tr></tbody></table>';
      }
    },

    {
      id: 'announcement',
      group: 'Прочее',
      title: 'Объявление жильцам',
      note: 'Для доски объявлений и подъездов. Короткий текст, крупная дата, контакт для вопросов.',
      fields: [
        { id: 'subject', label: 'Тема объявления', placeholder: 'Отключение горячей воды' },
        { id: 'body', label: 'Текст объявления', type: 'textarea', rows: 6,
          placeholder: 'В связи с проведением плановых работ на внутридомовых сетях горячее водоснабжение будет отключено.' },
        { id: 'when', label: 'Дата и время', placeholder: '12 августа 2026 года, с 09:00 до 18:00' },
        { id: 'noticeDate', label: 'Дата размещения', type: 'date' },
        { id: 'contact', label: 'Контакт', placeholder: '+7 (700) 000-00-00' }
      ],
      render: function (c) {
        var p = c.p, f = c.f;
        return HEAD(p) +
          '<h1>Объявление</h1>' +
          '<h2>' + V(f.subject, '[тема объявления]') + '</h2>' +
          '<p>Уважаемые собственники и жильцы дома по адресу ' + V(p.address, '[адрес дома]') + '!</p>' +
          '<p>' + (L(f.body).length ? esc(f.body).replace(/\n/g, '<br>') : '<span class="ph">[текст объявления]</span>') + '</p>' +
          '<p class="center"><strong>Дата и время: ' + V(f.when, '[дата и время]') + '</strong></p>' +
          '<p>По всем вопросам обращайтесь: ' + V(f.contact || p.phone, '[телефон]') + ', ' +
          V(p.office, '[место приёма]') + '.</p>' +
          '<div class="row" style="margin-top:24px"><span class="small">Размещено: ' + D(f.noticeDate) + '</span>' +
          '<span>' + V(p.orgForm, 'ОСИ') + ' ' + V(p.orgName, '«наименование»') + '</span></div>';
      }
    }
  ];
})();
