/**
 * ═══════════════════════════════════════════════════════════
 *  FBS — СИНХРОНИЗАЦИЯ АКТОВ С «ФБС компенсация (сергели)»
 *  Отдельный файл для проекта Apps Script таблицы
 *  «Запросы от БП | Аналитика».
 *
 *  1) ИМПОРТ: «ФБС компенсация (сергели)» → «Лист1»
 *       → эта таблица → «Поиск FBS»
 *     Берём: Дата заявки, Номер акта возврата, ШК товара,
 *            Количество ШК для поиска, Цена за 1 ед.
 *     Считаем: Сумма = цена × Количество для поиска,
 *              Сумма нашли = цена × Найдено (только после статуса).
 *     Вся таблица сканируется каждый раз; дубли отсекаются
 *     по паре «Номер акта + ШК». У уже перенесённых строк
 *     пустое «Количество для поиска» дозаполняется.
 *
 *  2) ОБРАТНО: «Поиск FBS» → «ФБС компенсация (сергели)»
 *     Колонки: Ячейка для поиска, Найдено в ячейке,
 *     Ячейка хранение акта, Статус, Найдено, Сотрудник Аналитики.
 *     Сопоставление по «акт + ШК». Наше значение перезаписывает
 *     их ячейку; если у нас пусто — их значение не трогаем.
 *
 *  Триггер: fbsImport_auto, каждый час, работает 9:00–21:59 (Ташкент).
 *  Установка: один раз запустить fbsImport_setupTrigger().
 * ═══════════════════════════════════════════════════════════
 */
var FBSIMP = {
  SRC_ID:    '1rkCY44yxdsYdEqyPj4q9-uhV9oX_ydF629K0ienOCjA', // ФБС компенсация (сергели)
  SRC_NAME:  'Лист1',
  DST_ID:    '1-Ec83kDyLZvZ_l7zNyu3VrH-XSutfa0oI4FJ16bZY5Y', // Запросы от БП | Аналитика
  DST_NAME:  'Поиск FBS',
  // Колонки, которые возвращаем в «ФБС компенсация» (точные названия в обеих таблицах)
  BACK_COLS: ['Ячейка для поиска', 'Найдено в ячейке', 'Ячейка хранение акта',
              'Статус', 'Найдено', 'Сотрудник Аналитики'],
  TZ:        'Asia/Tashkent',
  FROM_HOUR: 9,   // включительно
  TO_HOUR:   21   // включительно (последний запуск в 21:xx)
};

function fbsImport_norm_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.round(v));
  return String(v).replace(/\s+/g, '').trim().toUpperCase();
}

function fbsImport_text_(v) {
  if (v === null || v === undefined) return '';
  return typeof v === 'number' ? String(Math.round(v)) : String(v).trim();
}

function fbsImport_hdr_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h || '').toLowerCase().replace(/\s+/g, ' ').trim(); });
}

/** Индекс колонки: сначала точное совпадение, потом по началу названия. -1 если нет. */
function fbsImport_col_(headers, exact, prefixes) {
  var i = exact ? headers.indexOf(exact.toLowerCase()) : -1;
  if (i >= 0) return i;
  for (var k = 0; k < headers.length; k++) {
    for (var p = 0; p < (prefixes || []).length; p++) {
      if (headers[k].indexOf(prefixes[p].toLowerCase()) === 0) return k;
    }
  }
  return -1;
}

function fbsImport_num_(v) {
  if (typeof v === 'number') return v;
  var n = parseFloat(String(v === null || v === undefined ? '' : v).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function fbsImport_cmp_(v) {
  if (v instanceof Date) return String(v.getTime());
  if (typeof v === 'number') return String(v);
  return String(v === null || v === undefined ? '' : v).trim();
}

/** Синхронизация. Возвращает статистику. */
function fbsImport_run() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Синхронизация уже выполняется');
  try {
    // ── Источник ──
    var srcSs = SpreadsheetApp.openById(FBSIMP.SRC_ID);
    var src = srcSs.getSheetByName(FBSIMP.SRC_NAME) || srcSs.getSheets()[0];
    var srcLastRow = src.getLastRow();
    var srcH = fbsImport_hdr_(src);
    var sDate = fbsImport_col_(srcH, 'дата заявки', ['дата заявки']);
    var sAct  = fbsImport_col_(srcH, 'номер акта возврата', ['номер акта']);
    var sSku  = fbsImport_col_(srcH, 'шк товара', ['шк товара']);
    var sQty  = fbsImport_col_(srcH, 'количество шк для поиска', ['количество']);
    var sPrice= fbsImport_col_(srcH, 'цена за 1 ед товара вычеркнутого шк', ['цена за 1', 'цена']);
    if (sAct < 0 || sSku < 0) throw new Error('В «ФБС компенсация» не найдены колонки: Номер акта возврата / ШК товара');
    var srcData = srcLastRow >= 2 ? src.getRange(2, 1, srcLastRow - 1, src.getLastColumn()).getValues() : [];

    // ── Приёмник ──
    var dst = SpreadsheetApp.openById(FBSIMP.DST_ID).getSheetByName(FBSIMP.DST_NAME);
    if (!dst) throw new Error('Не найден лист «' + FBSIMP.DST_NAME + '»');
    var dstH = fbsImport_hdr_(dst);
    var dDate = fbsImport_col_(dstH, 'дата заявки', ['дата заявки']);
    var dAct  = fbsImport_col_(dstH, 'номер акта возврата', ['номер акта']);
    var dSku  = fbsImport_col_(dstH, 'шк товара', ['шк товара']);
    var dQty  = fbsImport_col_(dstH, 'количество для поиска', ['количество']);
    var dPrice= fbsImport_col_(dstH, 'цена', ['цена']);
    var dSum  = fbsImport_col_(dstH, 'сумма', null);
    var dSumF = fbsImport_col_(dstH, 'сумма нашли', ['сумма нашл']);
    var dStat = fbsImport_col_(dstH, 'статус', null);
    var dFound= fbsImport_col_(dstH, 'найдено', null);
    if (dAct < 0 || dSku < 0) throw new Error('В «' + FBSIMP.DST_NAME + '» не найдены колонки: Номер акта возврата / ШК товара');

    var dstLastRow = Math.max(dst.getLastRow(), 1);
    var dstData = dstLastRow >= 2 ? dst.getRange(2, 1, dstLastRow - 1, dst.getLastColumn()).getValues() : [];

    // Карта приёмника: ключ → индекс строки; последняя реально заполненная строка
    var dstByKey = {};
    var lastDataRow = 1;
    for (var r = 0; r < dstData.length; r++) {
      var a = fbsImport_norm_(dstData[r][dAct]), s = fbsImport_norm_(dstData[r][dSku]);
      if (!a && !s) continue;
      lastDataRow = r + 2;
      var k = a + '|' + s;
      if (!(k in dstByKey)) dstByKey[k] = r;
    }

    // ── 1. Импорт новых строк + дозаполнение количества ──
    var toAdd = [], qtyFill = [], seen = {}, srcPrice = {};
    for (var i = 0; i < srcData.length; i++) {
      var row = srcData[i];
      var key = fbsImport_norm_(row[sAct]) + '|' + fbsImport_norm_(row[sSku]);
      if (!fbsImport_norm_(row[sAct]) || !fbsImport_norm_(row[sSku])) continue;
      var qty = sQty >= 0 ? (parseInt(row[sQty], 10) || '') : '';
      var price = sPrice >= 0 ? fbsImport_num_(row[sPrice]) : null;
      if (price !== null && !(key in srcPrice)) srcPrice[key] = price;
      if (key in dstByKey) {
        var di = dstByKey[key];
        if (dQty >= 0 && qty !== '' && fbsImport_text_(dstData[di][dQty]) === '') {
          qtyFill.push({ row: di + 2, qty: qty });
          dstData[di][dQty] = qty;
        }
        continue;
      }
      if (seen[key]) continue;
      seen[key] = true;
      toAdd.push({
        date: sDate >= 0 ? row[sDate] : new Date(),
        act:  fbsImport_text_(row[sAct]),
        sku:  fbsImport_text_(row[sSku]),
        qty:  qty,
        price: price === null ? '' : price
      });
    }

    if (toAdd.length) {
      var startRow = lastDataRow + 1, n = toAdd.length;
      var needRows = startRow + n - 1 - dst.getMaxRows();
      if (needRows > 0) dst.insertRowsAfter(dst.getMaxRows(), needRows);
      dst.getRange(startRow, dAct + 1, n, 1).setNumberFormat('@')
         .setValues(toAdd.map(function (x) { return [x.act]; }));
      dst.getRange(startRow, dSku + 1, n, 1).setNumberFormat('@')
         .setValues(toAdd.map(function (x) { return [x.sku]; }));
      if (dDate >= 0) {
        dst.getRange(startRow, dDate + 1, n, 1).setNumberFormat('dd.MM.yyyy HH:mm:ss')
           .setValues(toAdd.map(function (x) { return [x.date]; }));
      }
      if (dQty >= 0) {
        dst.getRange(startRow, dQty + 1, n, 1)
           .setValues(toAdd.map(function (x) { return [x.qty]; }));
      }
    }
    qtyFill.forEach(function (q) { dst.getRange(q.row, dQty + 1).setValue(q.qty); });

    // ── 1б. Цена, Сумма, Сумма нашли — пересчёт по всем строкам ──
    var sumsChanged = 0;
    if (dPrice >= 0 || dSum >= 0 || dSumF >= 0) {
      var lastRowNow = Math.max(dst.getLastRow(), 1);
      if (lastRowNow >= 2) {
        var all = dst.getRange(2, 1, lastRowNow - 1, dst.getLastColumn()).getValues();
        var colPrice = [], colSum = [], colSumF = [];
        for (var x = 0; x < all.length; x++) {
          var rr = all[x];
          var rk = fbsImport_norm_(rr[dAct]) + '|' + fbsImport_norm_(rr[dSku]);
          var hasKey = rk !== '|';
          var pr = (rk in srcPrice) ? srcPrice[rk] : (dPrice >= 0 ? fbsImport_num_(rr[dPrice]) : null);
          var q  = dQty   >= 0 ? fbsImport_num_(rr[dQty])   : null;
          var f  = dFound >= 0 ? fbsImport_num_(rr[dFound]) : null;
          var st = dStat  >= 0 ? fbsImport_text_(rr[dStat]) : '';
          var newPrice = !hasKey ? rr[dPrice] : (pr === null ? '' : pr);
          var newSum   = !hasKey ? rr[dSum]   : (pr !== null && q !== null ? pr * q : '');
          var newSumF  = !hasKey ? rr[dSumF]  : (pr !== null && st ? pr * (f || 0) : '');
          if (dPrice >= 0) { if (fbsImport_cmp_(rr[dPrice]) !== fbsImport_cmp_(newPrice)) sumsChanged++; colPrice.push([newPrice]); }
          if (dSum   >= 0) { if (fbsImport_cmp_(rr[dSum])   !== fbsImport_cmp_(newSum))   sumsChanged++; colSum.push([newSum]); }
          if (dSumF  >= 0) { if (fbsImport_cmp_(rr[dSumF])  !== fbsImport_cmp_(newSumF))  sumsChanged++; colSumF.push([newSumF]); }
        }
        if (sumsChanged) {
          if (dPrice >= 0) dst.getRange(2, dPrice + 1, colPrice.length, 1).setValues(colPrice);
          if (dSum   >= 0) dst.getRange(2, dSum   + 1, colSum.length,   1).setValues(colSum);
          if (dSumF  >= 0) dst.getRange(2, dSumF  + 1, colSumF.length,  1).setValues(colSumF);
        }
      }
    }

    // ── 2. Обратная синхронизация результатов ──
    var pairs = [];   // [{ s: индекс в источнике, d: индекс в приёмнике }]
    FBSIMP.BACK_COLS.forEach(function (name) {
      var si = srcH.indexOf(name.toLowerCase());
      var di = dstH.indexOf(name.toLowerCase());
      if (si >= 0 && di >= 0) pairs.push({ s: si, d: di });
    });

    var backWritten = 0;
    if (pairs.length) {
      for (var j = 0; j < srcData.length; j++) {
        var sr = srcData[j];
        var bk = fbsImport_norm_(sr[sAct]) + '|' + fbsImport_norm_(sr[sSku]);
        if (!(bk in dstByKey)) continue;
        var dr = dstData[dstByKey[bk]];
        for (var c = 0; c < pairs.length; c++) {
          var ourVal = dr[pairs[c].d];
          if (fbsImport_cmp_(ourVal) === '') continue;                     // у нас пусто — не трогаем
          if (fbsImport_cmp_(ourVal) === fbsImport_cmp_(sr[pairs[c].s])) continue;  // уже совпадает
          src.getRange(j + 2, pairs[c].s + 1).setValue(ourVal);
          backWritten++;
        }
      }
    }

    return { added: toAdd.length, qtyFilled: qtyFill.length, sumsChanged: sumsChanged,
             backWritten: backWritten, backCols: pairs.length };
  } finally {
    lock.releaseLock();
  }
}

/** Обработчик часового триггера: работает только с 9:00 до 21:59 по Ташкенту. */
function fbsImport_auto() {
  var hour = Number(Utilities.formatDate(new Date(), FBSIMP.TZ, 'H'));
  if (hour < FBSIMP.FROM_HOUR || hour > FBSIMP.TO_HOUR) return;
  try {
    var res = fbsImport_run();
    console.log('FBS синхронизация: новых строк ' + res.added + ', дозаполнено кол-во ' + res.qtyFilled + ', цен/сумм обновлено ' + res.sumsChanged +
                ', обратно записано ячеек ' + res.backWritten + ' (колонок ' + res.backCols + ')');
  } catch (e) {
    console.error('FBS синхронизация: ' + e);
  }
}

/**
 * ОДИН РАЗ запустить вручную из редактора (выбрать fbsImport_setupTrigger → «Выполнить»).
 * Создаёт часовой триггер fbsImport_auto; повторный запуск не плодит дубли.
 */
function fbsImport_setupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'fbsImport_auto') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('fbsImport_auto').timeBased().everyHours(1).create();
  console.log('✅ Триггер fbsImport_auto создан: каждый час, 9:00–21:59 (Asia/Tashkent)');
}
