/**
 * ═══════════════════════════════════════════════════════════
 *  РАО — Google Apps Script Backend
 *  Версия: 1.0  |  Автор: Antigravity
 * ═══════════════════════════════════════════════════════════
 *
 *  УСТАНОВКА:
 *  1. В Google Таблице: Расширения → Apps Script.
 *  2. Удалите стандартный код, вставьте этот файл.
 *  3. Сохраните (Ctrl+S).
 *  4. Запустите функцию initSheets() один раз вручную для
 *     создания необходимых листов.
 *  5. Нажмите «Новое развёртывание» → Веб-приложение:
 *       Запуск от имени: Вы
 *       Доступ: Все
 *  6. Скопируйте полученный URL и вставьте в настройки приложения.
 * ═══════════════════════════════════════════════════════════
 *
 *  СТРУКТУРА ТАБЛИЦЫ:
 *  Лист «Сотрудники» — A: ID, B: ФИО
 *  Лист «Журнал»     — логи всех операций
 * ═══════════════════════════════════════════════════════════
 */

// Имена листов
var SHEET_EMPLOYEES = 'Сотрудники';
var SHEET_LOG       = 'Журнал';

// ─────────────────────────────────────────
//  GET — Авторизация и чтение данных
// ─────────────────────────────────────────
function doGet(e) {
  try {
    var action = e.parameter.action;

    if (action === 'login') {
      return handleLogin(e.parameter.id);
    }

    if (action === 'getPlanPercent') {
      return handleGetPlanPercent(e.parameter.id);
    }

    if (action === 'getMissingTasks') {
      return handleGetMissingTasks(e.parameter.id);
    }

    if (action === 'getRazborTasks') {
      return handleGetRazborTasks(e.parameter.id);
    }

    return jsonOk({ success: false, error: 'Неизвестный action: ' + action });
  } catch (err) {
    return jsonOk({ success: false, error: err.toString() });
  }
}

// ─────────────────────────────────────────
//  POST — Запись данных
// ─────────────────────────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'logWork') {
      return handleLogWork(data);
    }

    if (data.action === 'logMissingResult') {
      return handleLogMissingResult(data);
    }

    if (data.action === 'logBezShkResult') {
      return handleLogBezShkResult(data);
    }

    return jsonOk({ success: false, error: 'Неизвестный action: ' + data.action });
  } catch (err) {
    return jsonOk({ success: false, error: err.toString() });
  }
}

// ─────────────────────────────────────────
//  Проверка ID сотрудника
// ─────────────────────────────────────────
function handleLogin(employeeId) {
  if (!employeeId) {
    return jsonOk({ success: false, error: 'ID не указан' });
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_EMPLOYEES);

  if (!sheet) {
    return jsonOk({ success: false, error: 'Лист «' + SHEET_EMPLOYEES + '» не найден. Запустите initSheets().' });
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonOk({ success: false, error: 'Список сотрудников пуст' });
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var idStr = String(employeeId).trim();

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === idStr) {
      return jsonOk({
        success: true,
        employee: {
          id:   rows[i][0],
          name: rows[i][1]
        }
      });
    }
  }

  return jsonOk({ success: false, error: 'Сотрудник с ID «' + employeeId + '» не найден' });
}

// ─────────────────────────────────────────
//  Запись в журнал операций
// ─────────────────────────────────────────
function handleLogWork(data) {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName(SHEET_LOG);

  if (!logSheet) {
    logSheet = createLogSheet(ss);
  }

  logSheet.appendRow([
    new Date(),                        // A: Дата/Время
    data.employeeId   || '',           // B: ID
    data.employeeName || '',           // C: ФИО
    data.workType     || '',           // D: Тип работы
    data.status       || '',           // E: Статус
    JSON.stringify(data.details || {}) // F: Доп. данные
  ]);

  return jsonOk({ success: true });
}

// ─────────────────────────────────────────
//  Инициализация структуры таблицы
//  (запускать вручную один раз)
// ─────────────────────────────────────────
function initSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Лист сотрудников ──────────────────
  var empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) {
    empSheet = ss.insertSheet(SHEET_EMPLOYEES);
    var empHeader = empSheet.getRange(1, 1, 1, 2);
    empSheet.appendRow(['ID', 'ФИО']);
    empHeader.setFontWeight('bold')
             .setBackground('#1a1a2e')
             .setFontColor('#ffffff')
             .setFontSize(11);
    empSheet.setFrozenRows(1);
    empSheet.setColumnWidth(1, 100);
    empSheet.setColumnWidth(2, 250);

    // Пример сотрудника — удалите или замените
    empSheet.appendRow(['1001', 'Иванов Иван Иванович']);
    empSheet.appendRow(['1002', 'Петрова Анна Сергеевна']);

    Logger.log('✓ Лист «' + SHEET_EMPLOYEES + '» создан.');
  } else {
    Logger.log('— Лист «' + SHEET_EMPLOYEES + '» уже существует.');
  }

  // ── Лист журнала ─────────────────────
  createLogSheet(ss);
  setup30MinTrigger();

  Logger.log('✓ Инициализация завершена.');
  SpreadsheetApp.getUi().alert(
    'Инициализация завершена!\n\n' +
    'Добавьте сотрудников в лист «' + SHEET_EMPLOYEES + '»:\n' +
    'Колонка A — ID сотрудника\n' +
    'Колонка B — ФИО сотрудника'
  );
}

// ─────────────────────────────────────────
//  Вспомогательные функции
// ─────────────────────────────────────────
function createLogSheet(ss) {
  var logSheet = ss.getSheetByName(SHEET_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_LOG);
    var headers = ['Дата/Время', 'ID', 'ФИО', 'Тип работы', 'Статус', 'Детали'];
    logSheet.appendRow(headers);
    var hRange = logSheet.getRange(1, 1, 1, headers.length);
    hRange.setFontWeight('bold')
          .setBackground('#0d2137')
          .setFontColor('#ffffff')
          .setFontSize(11);
    logSheet.setFrozenRows(1);
    logSheet.setColumnWidth(1, 160);
    logSheet.setColumnWidth(2, 80);
    logSheet.setColumnWidth(3, 200);
    logSheet.setColumnWidth(4, 160);
    logSheet.setColumnWidth(5, 120);
    logSheet.setColumnWidth(6, 300);
    Logger.log('✓ Лист «' + SHEET_LOG + '» создан.');
  }
  return logSheet;
}

function jsonOk(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────
//  Получение % выполнения плана
// ─────────────────────────────────────────
/**
 * Вспомогательная функция приведения любой даты/строки к дд.мм.гггг
 */
function parseToDateStr(val, tz) {
  if (!val) return '';
  if (val instanceof Date) {
    var year  = val.getFullYear();
    var month = String(val.getMonth() + 1);
    if (month.length < 2) month = '0' + month;
    var day   = String(val.getDate());
    if (day.length < 2) day = '0' + day;
    return day + '.' + month + '.' + year;
  }
  var s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    var parts = s.split('T')[0].split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  }
  if (/^\d{2}\.\d{2}\.\d{4}/.test(s)) {
    return s.substring(0, 10);
  }
  try {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      var year  = d.getFullYear();
      var month = String(d.getMonth() + 1);
      if (month.length < 2) month = '0' + month;
      var day   = String(d.getDate());
      if (day.length < 2) day = '0' + day;
      return day + '.' + month + '.' + year;
    }
  } catch(e) {}
  return s;
}

var SHEET_EXTRA_WORK_PFX = 'Доп работы - ';

/**
 * Автоматическое создание/получение листа «Доп работы - [Месяц]»
 * Колонки: Дата (A), ФИО Сотрудника (B), Чем занимался (C), Сколько часов (D)
 */
function getOrCreateExtraWorkSheet(ss, monthName) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!monthName) monthName = MONTHS_RU[new Date().getMonth()];

  var sheetName = SHEET_EXTRA_WORK_PFX + monthName;
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = ['Дата', 'ФИО Сотрудника', 'Чем занимался', 'Сколько часов'];
    sheet.appendRow(headers);

    var hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setFontWeight('bold')
          .setBackground('#0d2137')
          .setFontColor('#ffffff')
          .setFontSize(10);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 240);
    sheet.setColumnWidth(3, 300);
    sheet.setColumnWidth(4, 140);
    Logger.log('✓ Автоматически создан лист «' + sheetName + '»');
  }
  return sheet;
}

/**
 * GET: getPlanPercent
 * Рассчитывает и возвращает процент выполнения за СЕГОДНЯ (или за последний рабочий день)
 */
function handleGetPlanPercent(employeeId) {
  if (!employeeId) {
    return jsonOk({ success: false, error: 'ID не указан' });
  }

  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) return jsonOk({ success: true, percent: 0 });

  var empLastRow = empSheet.getLastRow();
  if (empLastRow < 2) return jsonOk({ success: true, percent: 0 });

  var empData      = empSheet.getRange(2, 1, empLastRow - 1, 2).getValues();
  var employeeName = null;
  for (var i = 0; i < empData.length; i++) {
    if (String(empData[i][0]).trim() === String(employeeId).trim()) {
      employeeName = String(empData[i][1]).trim();
      break;
    }
  }
  if (!employeeName) return jsonOk({ success: true, percent: 0 });

  var tz          = Session.getScriptTimeZone();
  var todayStr    = Utilities.formatDate(new Date(), tz, 'dd.MM.yyyy');
  var logSheet    = getOrCreateMissingLogSheet(ss);
  var logLastRow  = logSheet.getLastRow();

  var currentMonthName = MONTHS_RU[new Date().getMonth()];
  var extraSheet       = getOrCreateExtraWorkSheet(ss, currentMonthName);
  var extraWorkRows    = (extraSheet && extraSheet.getLastRow() >= 2)
    ? extraSheet.getRange(2, 1, extraSheet.getLastRow() - 1, 4).getValues()
    : [];

  var logRows = (logLastRow >= 2)
    ? logSheet.getRange(2, 1, logLastRow - 1, 16).getValues()
    : [];

  var percent = calculateEmployeeDailyPercent(employeeName, todayStr, logRows, extraWorkRows);

  // Если за сегодня ещё нет записей — берём процент за самый свежий рабочий день
  if (percent === 0 && logRows.length > 0) {
    var empLower = employeeName.toLowerCase().trim();
    for (var i = logRows.length - 1; i >= 0; i--) {
      var rowEmp = String(logRows[i][2] || '').toLowerCase().trim();
      if (rowEmp === empLower && logRows[i][0]) {
        var latestDateStr = parseToDateStr(logRows[i][0], tz);
        var latestPercent = calculateEmployeeDailyPercent(employeeName, latestDateStr, logRows, extraWorkRows);
        if (latestPercent > 0) {
          percent = latestPercent;
          break;
        }
      }
    }
  }

  return jsonOk({ success: true, percent: percent });
}

/**
 * Расчёт дневной производительности сотрудника за конкретную дату:
 * - Поиск Миссинга:
 *     • Найдено: 4.16%
 *     • Найдено + ошибка: 8.32%
 *     • Не найдено + ошибка: 8.32%
 * - Обработка БезШК: 0.66% за каждый УНИКАЛЬНЫЙ ШК сотрудника за данный день
 * - Доп работы: 9.09% за каждый ЧАС работы
 */
function calculateEmployeeDailyPercent(employeeName, targetDateStr, logRows, extraWorkRows) {
  if (!employeeName || !targetDateStr) return 0;

  var empLower = employeeName.toLowerCase().trim();
  var totalPercent = 0;
  var bezshkUniqueBarcodes = {};
  var tz = Session.getScriptTimeZone();

  // 1. Поиск Миссинга и Обработка БезШК
  if (logRows && logRows.length > 0) {
    for (var i = 0; i < logRows.length; i++) {
      var row = logRows[i];
      var rowEmp = String(row[2] || '').toLowerCase().trim(); // Col C: ФИО
      if (rowEmp !== empLower) continue;

      var rowDateStr = parseToDateStr(row[0], tz); // Col A: Дата/Время
      if (rowDateStr !== targetDateStr) continue;

      var workType = String(row[13] || '').trim(); // Col N: Тип работы
      var res      = String(row[10] || '').trim(); // Col K: Результат
      var barcode  = String(row[3] || '').trim();  // Col D: ШК

      if (res === 'Найдено') {
        totalPercent += 4.16;
      } else if (res === 'Найдено + ошибка' || res === 'Не найдено + ошибка') {
        totalPercent += 8.32;
      } else if (workType === 'Обработка БезШК' || res === 'MISSING/SHORTAGE' || res === 'Излишек' || res === 'MISSING / БРАК' || res === 'КОМПЕНСИРОВАН') {
        if (barcode) {
          bezshkUniqueBarcodes[barcode] = true;
        }
      }
    }
  }

  var uniqueBezshkCount = Object.keys(bezshkUniqueBarcodes).length;
  totalPercent += (uniqueBezshkCount * 0.66);

  // 2. Доп работы (каждый час = 9.09%)
  if (extraWorkRows && extraWorkRows.length > 0) {
    for (var j = 0; j < extraWorkRows.length; j++) {
      var exRow = extraWorkRows[j];
      var exEmp = String(exRow[1] || '').toLowerCase().trim(); // Col B: ФИО Сотрудника
      if (exEmp !== empLower) continue;

      var exDateStr = parseToDateStr(exRow[0], tz); // Col A: Дата
      if (exDateStr !== targetDateStr) continue;

      var hours = parseFloat(String(exRow[3] || '').replace(',', '.')) || 0; // Col D: Сколько часов
      if (hours > 0) {
        totalPercent += (hours * 9.09);
      }
    }
  }

  return Math.round(totalPercent * 100) / 100;
}

/**
 * Ручной запуск обновления сводной таблицы из меню Таблицы
 */
function updateSummarySheetManual() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  updateSummarySheet(ss);
  SpreadsheetApp.getUi().alert('✅ Сводная таблица успешно обновлена!');
}

/**
 * Функция фонового обновления каждые 30 минут
 */
function updateSummarySheetAuto() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  updateSummarySheet(ss);
}

/**
 * Создание 30-минутного фонового триггера
 */
function setup30MinTrigger() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'updateSummarySheetAuto') {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }

    ScriptApp.newTrigger('updateSummarySheetAuto')
      .timeBased()
      .everyMinutes(30)
      .create();

    if (SpreadsheetApp.getUi()) {
      SpreadsheetApp.getUi().alert('✅ Авто-обновление каждые 30 минут успешно включено!');
    }
  } catch(e) {}
}

/**
 * Автоматическое создание/синхронизация сводного листа «Сводная - [Месяц]»
 */
function getOrCreateSummarySheet(ss, monthName) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!monthName) monthName = MONTHS_RU[new Date().getMonth()];

  var sheetName = 'Сводная - ' + monthName;
  var sheet = ss.getSheetByName(sheetName);

  var empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  var empNames = [];
  if (empSheet && empSheet.getLastRow() >= 2) {
    var rawEmps = empSheet.getRange(2, 2, empSheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < rawEmps.length; i++) {
      var name = String(rawEmps[i][0] || '').trim();
      if (name) empNames.push(name);
    }
  }

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);

    var now = new Date();
    var year = now.getFullYear();
    var monthIdx = MONTHS_RU.indexOf(monthName);
    if (monthIdx === -1) monthIdx = now.getMonth();

    var daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    var headers = ['Сотрудник'];

    for (var d = 1; d <= daysInMonth; d++) {
      var dayStr = (d < 10 ? '0' + d : d) + '.' + ((monthIdx + 1) < 10 ? '0' + (monthIdx + 1) : (monthIdx + 1)) + '.' + year;
      headers.push(dayStr);
    }

    sheet.appendRow(headers);
    var hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setFontWeight('bold')
          .setBackground('#0d2137')
          .setFontColor('#ffffff')
          .setFontSize(10);
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(1);
    sheet.setColumnWidth(1, 240);

    for (var e = 0; e < empNames.length; e++) {
      sheet.appendRow([empNames[e]]);
    }
    Logger.log('✓ Автоматически создан сводный лист «' + sheetName + '»');
  } else {
    // Если лист существует — автоматически дописываем новых сотрудников
    var existingLastRow = sheet.getLastRow();
    var existingEmps = {};
    if (existingLastRow >= 2) {
      var raw = sheet.getRange(2, 1, existingLastRow - 1, 1).getValues();
      for (var r = 0; r < raw.length; r++) {
        var n = String(raw[r][0] || '').trim().toLowerCase();
        if (n) existingEmps[n] = true;
      }
    }

    for (var e = 0; e < empNames.length; e++) {
      if (!existingEmps[empNames[e].toLowerCase()]) {
        sheet.appendRow([empNames[e]]);
      }
    }
  }

  return sheet;
}

/**
 * Пересчёт и обновление всех сводных листов «Сводная - [Месяц]»
 */
function updateSummarySheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();

  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var currentMonthName = MONTHS_RU[now.getMonth()];

  // Автоматически создаем текущий лог, доп работы и текущую сводку за месяц
  getOrCreateMissingLogSheet(ss);
  getOrCreateExtraWorkSheet(ss, currentMonthName);
  getOrCreateSummarySheet(ss, currentMonthName);

  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sName = sheets[s].getName();
    if (sName.indexOf('Сводная - ') !== 0) continue;

    var monthName = sName.replace('Сводная - ', '').trim();
    var logSheetName   = SHEET_LOG_MISSING_PFX + monthName;
    var extraSheetName = SHEET_EXTRA_WORK_PFX + monthName;

    var logSheet   = ss.getSheetByName(logSheetName);
    var extraSheet = ss.getSheetByName(extraSheetName);

    var logRows = (logSheet && logSheet.getLastRow() >= 2)
      ? logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 16).getValues()
      : [];

    var extraWorkRows = (extraSheet && extraSheet.getLastRow() >= 2)
      ? extraSheet.getRange(2, 1, extraSheet.getLastRow() - 1, 4).getValues()
      : [];

    var summarySheet = sheets[s];

    // Синхронизируем сотрудников из листа «Сотрудники»
    getOrCreateSummarySheet(ss, monthName);

    var lastCol = summarySheet.getLastColumn();
    if (lastCol < 2) continue;

    var dateHeaders = summarySheet.getRange(1, 2, 1, lastCol - 1).getValues()[0];
    var empDataRows = summarySheet.getRange(2, 1, Math.max(1, summarySheet.getLastRow() - 1), lastCol).getValues();

    for (var r = 0; r < empDataRows.length; r++) {
      var empName = String(empDataRows[r][0] || '').trim();
      if (!empName) continue;

      for (var c = 0; c < dateHeaders.length; c++) {
        var dVal = dateHeaders[c];
        if (!dVal) continue;

        var dateStr = parseToDateStr(dVal, tz);
        var calcPercent = calculateEmployeeDailyPercent(empName, dateStr, logRows, extraWorkRows);

        summarySheet.getRange(r + 2, c + 2).setValue(calcPercent > 0 ? calcPercent + '%' : '');
      }
    }
  }
}

// ─────────────────────────────────────────────────────────
//  Меню «РАО» в Google Sheets (триггер onOpen)
// ─────────────────────────────────────────────────────────
function onOpen() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var exists = false;
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'updateSummarySheetAuto') {
        exists = true;
        break;
      }
    }
    if (!exists) setup30MinTrigger();
  } catch(e) {}

  SpreadsheetApp.getUi()
    .createMenu('РАО')
    .addItem('Распределить миссинг', 'distributeMissingTasks')
    .addItem('Включить фоновое обновление (30 мин)', 'setup30MinTrigger')
    .addItem('Обновить сводную таблицу сейчас', 'updateSummarySheetManual')
    .addSeparator()
    .addItem('Инициализация листов', 'initSheets')
    .addToUi();
}

/**
 * Автоматический триггер при ручном редактировании ячеек (например, добавление Доп работ)
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheetName = e.range.getSheet().getName();
    if (sheetName.indexOf('Доп работы') === 0 || sheetName.indexOf('Лог обработки') === 0) {
      updateSummarySheet(e.range.getSheet().getParent());
    }
  } catch(err) {}
}

// ═══════════════════════════════════════════════════════
//  ПОИСК МИССИНГА — BACKEND
// ═══════════════════════════════════════════════════════

// ── Имена листов ────────────────────────────────────────
var SHEET_MISSING          = 'На поиск';
var SHEET_LOG_MISSING_PFX  = 'Лог обработки - ';

// ── Колонки листа «На поиск» (0-based индексы) ─────────
var MC_BARCODE    = 0;   // A: ШК
var MC_PRICE_EA   = 1;   // B: Цена Продажи (единица)
var MC_PRICE_ALL  = 2;   // C: Цена все товар (итог — для распределения)
var MC_NAME       = 3;   // D: Описание
var MC_QTY        = 4;   // E: Товаров
var MC_PROCESS    = 5;   // F: Процесс
var MC_ZONE       = 6;   // G: Зона
var MC_WAREHOUSE  = 7;   // H: Склад
var MC_KEY        = 8;   // I: key (ячейка)
var MC_CATEGORY   = 12;  // M: h1_title
var MC_ASSIGNEE   = 13;  // N: У кого задана
var MC_RESULT     = 14;  // O: Статус/Результат
var MC_FLAG       = 15;  // P: Флажок (TRUE = финально обработан)

// ── Колонки листа «Сотрудники» (0-based) ───────────────
var EC_ID      = 0;  // A: ID
var EC_NAME    = 1;  // B: ФИО
var EC_MISSING = 2;  // C: На поиске (checkbox TRUE/FALSE)

// Русские названия месяцев
var MONTHS_RU = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
];

// ─────────────────────────────────────────────────────────
//  Меню «РАО» в Google Sheets (триггер onOpen)
// ─────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('РАО')
    .addItem('Распределить миссинг', 'distributeMissingTasks')
    .addSeparator()
    .addItem('Инициализация листов', 'initSheets')
    .addToUi();
}

// ─────────────────────────────────────────────────────────
//  Вспомогательная функция с кэшированием ID ➔ ФИО
// ─────────────────────────────────────────────────────────
function getEmployeeNameById(ss, employeeId) {
  if (!employeeId) return null;
  var targetId = String(employeeId).trim();
  var cache    = CacheService.getScriptCache();
  var cached   = cache.get('EMP_NAME_' + targetId);
  if (cached) return cached;

  var empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) return null;

  var empLastRow = empSheet.getLastRow();
  if (empLastRow < 2) return null;

  var empData = empSheet.getRange(2, 1, empLastRow - 1, 2).getValues();
  var foundName = null;

  for (var i = 0; i < empData.length; i++) {
    var id   = String(empData[i][0]).trim();
    var name = String(empData[i][1]).trim();
    if (id && name) {
      try { cache.put('EMP_NAME_' + id, name, 21600); } catch(e) {} // 6 часов
    }
    if (id === targetId) foundName = name;
  }
  return foundName;
}

/**
 * GET: getMissingTasks
 * Возвращает задачи миссинга, назначенные конкретному сотруднику
 */
function handleGetMissingTasks(employeeId) {
  if (!employeeId) return jsonOk({ success: false, error: 'ID не указан' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var employeeName = getEmployeeNameById(ss, employeeId);
  if (!employeeName) return jsonOk({ success: false, error: 'Сотрудник не найден' });

  // 2. Читаем задачи
  var taskSheet = ss.getSheetByName(SHEET_MISSING);
  if (!taskSheet) return jsonOk({ success: true, tasks: [], razborTasks: [], employeeName: employeeName });

  var lastRow = taskSheet.getLastRow();
  if (lastRow < 2) return jsonOk({ success: true, tasks: [], razborTasks: [], employeeName: employeeName });

  var numCols      = MC_FLAG + 1;
  var data         = taskSheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  var empNameLower = employeeName.toLowerCase();
  var tasks        = [];
  var razborTasks  = [];

  for (var i = 0; i < data.length; i++) {
    var assignee  = String(data[i][MC_ASSIGNEE] || '').trim().toLowerCase();
    var result    = String(data[i][MC_RESULT]   || '').trim();
    var isFlagged = (data[i][MC_FLAG] === true || String(data[i][MC_FLAG]).toUpperCase() === 'TRUE');

    // Назначенные этому сотруднику и ещё не зафиксированные (флажок P пустой)
    if (assignee === empNameLower && !isFlagged) {
      var item = {
        row:        i + 2,                       // номер строки в таблице (1-based)
        barcode:    data[i][MC_BARCODE],
        name:       data[i][MC_NAME],
        priceUnit:  data[i][MC_PRICE_EA],
        priceTotal: data[i][MC_PRICE_ALL],
        qty:        data[i][MC_QTY],
        process:    data[i][MC_PROCESS],
        zone:       data[i][MC_ZONE],
        key:        data[i][MC_KEY],
        category:   data[i][MC_CATEGORY],
        result:     result                        // '' или 'На разбор'
      };

      tasks.push(item);
      if (result === 'На разбор') {
        razborTasks.push(item);
      }
    }
  }

  // ─── Пороговые значения ценовых блоков ───
  //  Блок 3: Свыше 1 000 000 сум
  //  Блок 2: От 500 000 до 1 000 000 сум
  //  Блок 1: До 500 000 сум
  function getPriceTier(price) {
    var p = Number(price) || 0;
    if (p >= 1000000) return 3;
    if (p >= 500000)  return 2;
    return 1;
  }

  // Сортировка:
  //  1. По блоку цен (от более дорогого к более дешевому)
  //  2. Внутри каждого блока — по возрастанию ячейки (key) для оптимального маршрута
  tasks.sort(function(a, b) {
    var tierDiff = getPriceTier(b.priceTotal) - getPriceTier(a.priceTotal);
    if (tierDiff !== 0) return tierDiff;
    return String(a.key || '').localeCompare(
      String(b.key || ''), undefined, { numeric: true, sensitivity: 'base' }
    );
  });

  return jsonOk({
    success: true,
    tasks: tasks,
    razborTasks: razborTasks,
    employeeName: employeeName
  });
}

// ─────────────────────────────────────────────────────────
//  POST: logMissingResult
//  Пишет результат в лог и обновляет «На поиск»
// ─────────────────────────────────────────────────────────
function handleLogMissingResult(data) {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var RAZBOR   = 'На разбор';
  var isRazbor = (data.result === RAZBOR);

  var resultText = data.result || '';

  // 1. Обновляем статус в «На поиск» (всегда)
  if (data.row && Number(data.row) > 1) {
    var taskSheet = ss.getSheetByName(SHEET_MISSING);
    if (taskSheet) {
      var rowNum = Number(data.row);
      taskSheet.getRange(rowNum, MC_RESULT + 1).setValue(resultText);

      if (!isRazbor) {
        // Финальный результат → ставим флажок ✅ в колонке P
        taskSheet.getRange(rowNum, MC_FLAG + 1).setValue(true);
      }
    }
  }

  // 2. В ежемесячный лог пишем ТОЛЬКО финальные результаты (КАТЕГОРИЧЕСКИ НЕ «На разбор»)
  if (!isRazbor) {
    var logSheet = getOrCreateMissingLogSheet(ss);

    var isFound     = (data.result && data.result.indexOf('Найдено') !== -1);
    var taskQty     = parseInt(data.qty) || 1;
    var priceUnit   = parseFloat(data.priceUnit) || (parseFloat(data.priceTotal) / taskQty) || 0;
    var foundQtyNum = isFound ? (parseInt(data.foundQty) || taskQty) : 0;
    var foundSumNum = foundQtyNum * priceUnit;

    logSheet.appendRow([
      new Date(),                           // A: Дата/Время
      data.employeeId   || '',              // B: ID
      data.employeeName || '',              // C: ФИО
      data.barcode      || '',              // D: ШК
      data.name         || '',              // E: Описание
      data.zone         || '',              // F: Зона
      data.category     || '',              // G: Категория
      data.process      || '',              // H: Процесс
      data.key          || '',              // I: Ячейка (исходная)
      data.foundKey     || data.key || '',  // J: Где нашли
      resultText,                           // K: Результат
      taskQty,                              // L: Количество (по заданию)
      priceUnit,                            // M: Цена товара (1 шт)
      foundQtyNum,                          // N: Найденное количество
      foundSumNum,                          // O: Сумма найденно
      'Поиск Миссинга'                      // P: Тип работы
    ]);
  }

  return jsonOk({ success: true });
}

// ─────────────────────────────────────────────────────────
//  GET: getRazborTasks
//  Возвращает список задач «На разбор» для сотрудника
// ─────────────────────────────────────────────────────────
function handleGetRazborTasks(employeeId) {
  if (!employeeId) return jsonOk({ success: false, error: 'ID не указан' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Определяем ФИО
  var empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) return jsonOk({ success: true, tasks: [] });

  var empLastRow = empSheet.getLastRow();
  if (empLastRow < 2) return jsonOk({ success: true, tasks: [] });

  var empData      = empSheet.getRange(2, 1, empLastRow - 1, 2).getValues();
  var employeeName = null;
  for (var i = 0; i < empData.length; i++) {
    if (String(empData[i][0]).trim() === String(employeeId).trim()) {
      employeeName = String(empData[i][1]).trim();
      break;
    }
  }
  if (!employeeName) return jsonOk({ success: true, tasks: [] });

  var taskSheet = ss.getSheetByName(SHEET_MISSING);
  if (!taskSheet) return jsonOk({ success: true, tasks: [] });

  var lastRow = taskSheet.getLastRow();
  if (lastRow < 2) return jsonOk({ success: true, tasks: [] });

  var data         = taskSheet.getRange(2, 1, lastRow - 1, MC_RESULT + 1).getValues();
  var empNameLower = employeeName.toLowerCase();
  var tasks        = [];

  for (var i = 0; i < data.length; i++) {
    var assignee = String(data[i][MC_ASSIGNEE] || '').trim().toLowerCase();
    var result   = String(data[i][MC_RESULT]   || '').trim();

    if (assignee === empNameLower && result === 'На разбор') {
      tasks.push({
        row:        i + 2,
        barcode:    data[i][MC_BARCODE],
        name:       data[i][MC_NAME],
        priceUnit:  data[i][MC_PRICE_EA],
        priceTotal: data[i][MC_PRICE_ALL],
        qty:        data[i][MC_QTY],
        process:    data[i][MC_PROCESS],
        zone:       data[i][MC_ZONE],
        key:        data[i][MC_KEY],
        category:   data[i][MC_CATEGORY]
      });
    }
  }

  return jsonOk({ success: true, tasks: tasks });
}


// ─────────────────────────────────────────────────────────
//  Создание / получение ежемесячного листа лога
// ─────────────────────────────────────────────────────────
function getOrCreateMissingLogSheet(ss) {
  var monthName = MONTHS_RU[new Date().getMonth()];
  var sheetName = SHEET_LOG_MISSING_PFX + monthName;

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [
      'Дата/Время', 'ID', 'ФИО', 'ШК', 'Описание',
      'Зона', 'Категория', 'Процесс', 'Ячейка', 'Где нашли',
      'Результат', 'Количество', 'Цена товара', 'Найденное количество',
      'Сумма найденно', 'Тип работы'
    ];
    sheet.appendRow(headers);
    var hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setFontWeight('bold')
          .setBackground('#1a1a2e')
          .setFontColor('#ffffff')
          .setFontSize(11);
    sheet.setFrozenRows(1);
    var widths = [165, 70, 210, 145, 260, 165, 150, 120, 125, 125, 160, 110, 120, 150, 140, 135];
    widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });
    Logger.log('✓ Создан лист «' + sheetName + '»');
  }
  return sheet;
}

// ─────────────────────────────────────────────────────────
//  РАСПРЕДЕЛЕНИЕ ЗАДАЧ МИССИНГА
//  Запускается кнопкой в меню РАО → «Распределить миссинг»
//
//  Алгоритм: жадный по сумме.
//  Товары сортируются от дорогого к дешёвому.
//  Каждый следующий товар идёт сотруднику с наименьшей
//  накопленной суммой → нагрузка выравнивается.
// ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────
//  РАСПРЕДЕЛЕНИЕ / ПЕРЕРАСПРЕДЕЛЕНИЕ ЗАДАЧ МИССИНГА
//  Запускается кнопкой в меню РАО → «Распределить миссинг»
// ─────────────────────────────────────────────────────────
function distributeMissingTasks() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Сотрудники на смене (чекбокс = TRUE в колонке C листа «Сотрудники»)
  var empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) { ui.alert('Лист «' + SHEET_EMPLOYEES + '» не найден!'); return; }

  var empLastRow = empSheet.getLastRow();
  if (empLastRow < 2) { ui.alert('Список сотрудников пуст.'); return; }

  var empData  = empSheet.getRange(2, 1, empLastRow - 1, EC_MISSING + 1).getValues();
  var onShift  = [];
  for (var i = 0; i < empData.length; i++) {
    if (empData[i][EC_MISSING] === true || String(empData[i][EC_MISSING]).toUpperCase() === 'TRUE') {
      onShift.push({ name: String(empData[i][EC_NAME]).trim(), totalSum: 0 });
    }
  }

  if (onShift.length === 0) {
    ui.alert(
      'Никто не отмечен на смене!\n\n' +
      'В листе «' + SHEET_EMPLOYEES + '» поставьте ✔ в колонке «На поиске» (C) для активных сотрудников.'
    );
    return;
  }

  // 2. Считываем позиции из «На поиск»
  var taskSheet = ss.getSheetByName(SHEET_MISSING);
  if (!taskSheet) { ui.alert('Лист «' + SHEET_MISSING + '» не найден!'); return; }

  var lastRow = taskSheet.getLastRow();
  if (lastRow < 2) { ui.alert('Лист «' + SHEET_MISSING + '» пуст.'); return; }

  var numCols = MC_FLAG + 1; // 16 колонок
  var allData = taskSheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  var itemsToDistribute     = [];
  var alreadyCompletedCount = 0;

  for (var i = 0; i < allData.length; i++) {
    var flag   = allData[i][MC_FLAG];                           // Col P: TRUE если обработано
    var result = String(allData[i][MC_RESULT] || '').trim();     // Col O: Результат

    var isFlagTrue = (flag === true) || (String(flag).toUpperCase() === 'TRUE');
    var isFinished = isFlagTrue || (result !== '' && result !== 'На разбор');

    if (isFinished) {
      // Завершённые позиции НЕ трогаем!
      alreadyCompletedCount++;
    } else {
      // Незавершённые задачи отзываем и отправляем на перераспределение
      itemsToDistribute.push({
        dataIdx:    i,
        priceTotal: parseFloat(allData[i][MC_PRICE_ALL]) || 0
      });
    }
  }

  if (itemsToDistribute.length === 0) {
    ui.alert('Все задачи в таблице уже окончательно выполнены! (Завершено: ' + alreadyCompletedCount + ' шт.)');
    return;
  }

  // 3. Сортировка от дорогих к дешёвым
  itemsToDistribute.sort(function(a, b) { return b.priceTotal - a.priceTotal; });

  // 4. Жадное выравнивание нагрузки между активными сотрудниками на смене
  for (var i = 0; i < itemsToDistribute.length; i++) {
    var minEmp = onShift[0];
    for (var j = 1; j < onShift.length; j++) {
      if (onShift[j].totalSum < minEmp.totalSum) minEmp = onShift[j];
    }
    itemsToDistribute[i].assignedTo = minEmp.name;
    minEmp.totalSum += itemsToDistribute[i].priceTotal;
  }

  // 5. Пакетная запись в колонку N («У кого задана»)
  var assigneeCol = taskSheet.getRange(2, MC_ASSIGNEE + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < itemsToDistribute.length; i++) {
    assigneeCol[itemsToDistribute[i].dataIdx][0] = itemsToDistribute[i].assignedTo;
  }
  taskSheet.getRange(2, MC_ASSIGNEE + 1, lastRow - 1, 1).setValues(assigneeCol);

  // 6. Итоговый отчёт
  var summary = onShift.map(function(e) {
    return '• ' + e.name + ': ' + Math.round(e.totalSum).toLocaleString() + ' сум';
  }).join('\n');

  ui.alert(
    '✅ Перераспределено ' + itemsToDistribute.length + ' невыполненных позиций\n' +
    'между ' + onShift.length + ' сотрудниками на смене:\n\n' + summary +
    '\n\n(Завершённые позиции не затрагивались: ' + alreadyCompletedCount + ' шт.)'
  );
}

// ─────────────────────────────────────────────────────────
//  POST: logBezShkResult
//  Запись операции «Обработка БезШК» в ежемесячный лог
// ─────────────────────────────────────────────────────────
function handleLogBezShkResult(data) {
  if (!data || !data.barcode || !data.result) {
    return jsonOk({ success: false, error: 'Неполные данные' });
  }

  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = getOrCreateMissingLogSheet(ss);
  var bezshkQty= parseInt(data.qty) || 1;

  logSheet.appendRow([
    new Date(),                           // A: Дата/Время
    data.employeeId   || '',              // B: ID
    data.employeeName || '',              // C: ФИО
    String(data.barcode).trim(),          // D: ШК (13 цифр)
    '',                                   // E: Описание
    '',                                   // F: Зона
    '',                                   // G: Категория
    '',                                   // H: Процесс
    '',                                   // I: Ячейка
    '',                                   // J: Где нашли
    String(data.result).trim(),           // K: Результат
    bezshkQty,                            // L: Количество
    0,                                    // M: Цена товара
    bezshkQty,                            // N: Найденное количество
    0,                                    // O: Сумма найденно
    'Обработка БезШК'                     // P: Тип работы
  ]);

  return jsonOk({ success: true });
}
