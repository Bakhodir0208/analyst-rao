/**
 * ═══════════════════════════════════════════════════════════
 *  FBS — ИМПОРТ АКТОВ «MISSING FBS RETURN (Support)»
 *  Отдельный файл для проекта Apps Script таблицы
 *  «Запросы от БП | Аналитика». Добавлять как НОВЫЙ файл
 *  (Файлы → + → Скрипт), существующие скрипты не трогать.
 *
 *  Источник: «НТВ ФФО» → лист «Ответы на форму (1)»
 *  Приёмник: эта таблица → лист «Поиск FBS»
 *  Берём: Отметка времени → Дата заявки, Номер акта, ШК товара.
 *  Каждый запуск сканирует ВСЮ таблицу-источник; дубли отсекаются
 *  по паре «Номер акта + ШК», уже существующей в «Поиск FBS».
 *
 *  Установка триггера: один раз запустить fbsImport_setupTrigger().
 *  Работает каждый час с 9:00 до 21:59 по Ташкенту.
 * ═══════════════════════════════════════════════════════════
 */
var FBSIMP = {
  SRC_ID:     '1077RwX9qsDgOb7thhtNltyEXQol1keaIw8XCr9isVFA', // НТВ ФФО
  SRC_GID:    22482935,                                        // «Ответы на форму (1)»
  SRC_NAME:   'Ответы на форму (1)',
  DST_ID:     '1-Ec83kDyLZvZ_l7zNyu3VrH-XSutfa0oI4FJ16bZY5Y', // Запросы от БП | Аналитика
  DST_NAME:   'Поиск FBS',
  ACT_TYPE:   'MISSING FBS RETURN (Support)',
  TZ:         'Asia/Tashkent',
  FROM_HOUR:  9,   // включительно
  TO_HOUR:    21   // включительно (последний запуск в 21:xx)
};

function fbsImport_norm_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.round(v));
  return String(v).replace(/\s+/g, '').trim().toUpperCase();
}

function fbsImport_text_(v) {
  return typeof v === 'number' ? String(Math.round(v)) : String(v).trim();
}

function fbsImport_col_(headers, prefixes) {
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').toLowerCase().replace(/\s+/g, ' ').trim();
    for (var p = 0; p < prefixes.length; p++) {
      if (h.indexOf(prefixes[p].toLowerCase()) === 0) return i;
    }
  }
  return -1;
}

function fbsImport_srcSheet_() {
  var ss = SpreadsheetApp.openById(FBSIMP.SRC_ID);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === FBSIMP.SRC_GID) return sheets[i];
  }
  return ss.getSheetByName(FBSIMP.SRC_NAME);
}

/** Импорт. Возвращает { added, skipped, total }. */
function fbsImport_run() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Импорт уже выполняется');
  try {
    // ── Источник ──
    var src = fbsImport_srcSheet_();
    if (!src) throw new Error('Не найден лист ответов в «НТВ ФФО»');
    var srcLastRow = src.getLastRow();
    if (srcLastRow < 2) return { added: 0, skipped: 0, total: 0 };

    var srcHeaders = src.getRange(1, 1, 1, src.getLastColumn()).getValues()[0];
    var cTime = fbsImport_col_(srcHeaders, ['отметка времени', 'timestamp']);
    var cType = fbsImport_col_(srcHeaders, ['тип акта']);
    var cAct  = fbsImport_col_(srcHeaders, ['номер акта']);
    var cSku  = fbsImport_col_(srcHeaders, ['шк товара']);
    if (cType < 0 || cAct < 0 || cSku < 0) {
      throw new Error('В «НТВ ФФО» не найдены колонки: Тип акта / Номер акта / Шк товара');
    }
    var readCols = Math.max(cTime, cType, cAct, cSku) + 1;
    var srcData = src.getRange(2, 1, srcLastRow - 1, readCols).getValues();

    // ── Приёмник ──
    var dst = SpreadsheetApp.openById(FBSIMP.DST_ID).getSheetByName(FBSIMP.DST_NAME);
    if (!dst) throw new Error('Не найден лист «' + FBSIMP.DST_NAME + '»');

    var dstHeaders = dst.getRange(1, 1, 1, dst.getLastColumn()).getValues()[0];
    var dDate = fbsImport_col_(dstHeaders, ['дата заявки']);
    var dAct  = fbsImport_col_(dstHeaders, ['номер акта']);
    var dSku  = fbsImport_col_(dstHeaders, ['шк товара']);
    if (dAct < 0 || dSku < 0) {
      throw new Error('В «' + FBSIMP.DST_NAME + '» не найдены колонки: Номер акта возврата / ШК товара');
    }

    // Уже импортированные пары + последняя реально заполненная строка
    var dstLastRow = Math.max(dst.getLastRow(), 1);
    var existing = {};
    var lastDataRow = 1;
    if (dstLastRow >= 2) {
      var actVals = dst.getRange(2, dAct + 1, dstLastRow - 1, 1).getValues();
      var skuVals = dst.getRange(2, dSku + 1, dstLastRow - 1, 1).getValues();
      for (var r = 0; r < actVals.length; r++) {
        var a = fbsImport_norm_(actVals[r][0]);
        var s = fbsImport_norm_(skuVals[r][0]);
        if (a || s) {
          existing[a + '|' + s] = true;
          lastDataRow = r + 2;
        }
      }
    }

    // ── Отбор новых ──
    var typeNeedle = FBSIMP.ACT_TYPE.toLowerCase();
    var toAdd = [], skipped = 0, total = 0;
    for (var i = 0; i < srcData.length; i++) {
      var row = srcData[i];
      if (String(row[cType] || '').trim().toLowerCase() !== typeNeedle) continue;
      total++;
      var key = fbsImport_norm_(row[cAct]) + '|' + fbsImport_norm_(row[cSku]);
      if (key === '|' || existing[key]) { skipped++; continue; }
      existing[key] = true;
      toAdd.push({
        date: cTime >= 0 ? row[cTime] : new Date(),
        act:  fbsImport_text_(row[cAct]),
        sku:  fbsImport_text_(row[cSku])
      });
    }

    // ── Запись ──
    if (toAdd.length) {
      var startRow = lastDataRow + 1;
      var n = toAdd.length;
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
    }

    return { added: toAdd.length, skipped: skipped, total: total };
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
    console.log('FBS импорт: добавлено ' + res.added + ', пропущено ' + res.skipped + ', всего ' + res.total);
  } catch (e) {
    console.error('FBS импорт: ' + e);
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
