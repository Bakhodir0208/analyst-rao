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
var BP_SPREADSHEET_ID = '1-Ec83kDyLZvZ_l7zNyu3VrH-XSutfa0oI4FJ16bZY5Y';

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

    if (action === 'getBpTasks') {
      return handleGetBpTasks();
    }

    if (action === 'getFbsActTask') {
      return handleGetFbsActTask(e.parameter.id);
    }

    if (action === 'getFbsVycherkTask') {
      return handleGetFbsVycherkTask(e.parameter.id);
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

    if (data.action === 'logBpResult') {
      return handleLogBpResult(data);
    }

    if (data.action === 'lockBpZone') {
      return handleLockBpZone(data);
    }

    if (data.action === 'unlockBpZone') {
      return handleUnlockBpZone(data);
    }

    if (data.action === 'logFbsActResult') {
      return handleLogFbsActResult(data);
    }

    if (data.action === 'releaseFbsAct') {
      return handleReleaseFbsAct(data);
    }

    if (data.action === 'logFbsVycherkResult') {
      return handleLogFbsVycherkResult(data);
    }

    if (data.action === 'releaseFbsVycherk') {
      return handleReleaseFbsVycherk(data);
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
    ? extraSheet.getRange(2, 1, extraSheet.getLastRow() - 1, extraSheet.getLastColumn()).getValues()
    : [];

  var logRows = (logLastRow >= 2)
    ? logSheet.getRange(2, 1, logLastRow - 1, logSheet.getLastColumn()).getValues()
    : [];

  var logHeaderMap   = buildHeaderMap(logSheet);
  var extraHeaderMap = buildHeaderMap(extraSheet);

  var percent = calculateEmployeeDailyPercent(employeeName, todayStr, logRows, extraWorkRows, logHeaderMap, extraHeaderMap);

  // Если за сегодня ещё нет записей — берём процент за самый свежий рабочий день
  if (percent === 0 && logRows.length > 0) {
    var empLower = employeeName.toLowerCase().trim();
    for (var i = logRows.length - 1; i >= 0; i--) {
      var rowEmp = String(logRows[i][2] || '').toLowerCase().trim();
      if (rowEmp === empLower && logRows[i][0]) {
        var latestDateStr = parseToDateStr(logRows[i][0], tz);
        var latestPercent = calculateEmployeeDailyPercent(employeeName, latestDateStr, logRows, extraWorkRows, logHeaderMap, extraHeaderMap);
        if (latestPercent > 0) {
          percent = latestPercent;
          break;
        }
      }
    }
  }

  return jsonOk({ success: true, percent: percent });
}

function buildHeaderMap(sheet) {
  var map = {};
  if (!sheet || sheet.getLastRow() < 1) return map;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').toLowerCase().trim();
    if (h) map[h] = i;
  }
  return map;
}

/**
 * Расчёт дневной производительности сотрудника за конкретную дату:
 * - Поиск Миссинга:
 *     • Найдено: 4.16%
 *     • Найдено + ошибка: 8.32%
 *     • Не найдено + ошибка: 8.32%
 * - Поиск БП: 0.79% за каждый проверенный СКУ (после проверки всех ячеек)
 * - Обработка БезШК: 0.66% за каждый УНИКАЛЬНЫЙ ШК сотрудника за данный день
 * - Доп работы: 9.09% за каждый ЧАС работы
 */
function calculateEmployeeDailyPercent(employeeName, targetDateStr, logRows, extraWorkRows, logHeaderMap, extraHeaderMap) {
  if (!employeeName || !targetDateStr) return 0;

  var empLower = employeeName.toLowerCase().trim();
  var totalPercent = 0;
  var bezshkUniqueBarcodes = {};
  var bpUniqueSkus = {};
  var tz = Session.getScriptTimeZone();

  // 1. Поиск Миссинга, Поиск БП и Обработка БезШК
  if (logRows && logRows.length > 0) {
    for (var i = 0; i < logRows.length; i++) {
      var row = logRows[i];
      if (!row || row.length === 0) continue;

      // Находим колонку ФИО
      var colEmp = (logHeaderMap && logHeaderMap['фио'] !== undefined) ? logHeaderMap['фио'] : 2;
      var rowEmp = String(row[colEmp] !== undefined ? row[colEmp] : (row[2] || '')).toLowerCase().trim();
      if (rowEmp !== empLower) continue;

      // Находим колонку даты
      var colDate = (logHeaderMap && logHeaderMap['дата/время'] !== undefined) ? logHeaderMap['дата/время'] : 0;
      var rowDateStr = parseToDateStr(row[colDate] !== undefined ? row[colDate] : row[0], tz);
      if (rowDateStr !== targetDateStr) continue;

      // Ищем результат в названной колонке или универсально сканируем ячейки строки
      var res = '';
      if (logHeaderMap && logHeaderMap['результат'] !== undefined) {
        res = String(row[logHeaderMap['результат']] || '').trim();
      }
      if (!res) {
        for (var c = 0; c < row.length; c++) {
          var valStr = String(row[c] || '').trim();
          if (valStr === 'Найдено' || valStr === 'Найдено + ошибка' || valStr === 'Не найдено + ошибка' || valStr === 'Обработка БезШК') {
            res = valStr;
            break;
          }
        }
      }

      var workType = '';
      if (logHeaderMap && logHeaderMap['тип работы'] !== undefined) {
        workType = String(row[logHeaderMap['тип работы']] || '').trim();
      } else {
        workType = String(row[row.length - 1] || '').trim();
      }

      var barcode = '';
      if (logHeaderMap && logHeaderMap['шк'] !== undefined) {
        barcode = String(row[logHeaderMap['шк']] || '').trim();
      } else {
        barcode = String(row[3] || '').trim();
      }

      var col7Val = String(row[7] || '').trim();

      if (workType === 'Поиск БП' || col7Val === 'Поиск БП' || res === 'Поиск БП') {
        var key = barcode || ('bp_idx_' + i);
        bpUniqueSkus[key] = true;
      } else if (res === 'Найдено') {
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

  var uniqueBpCount = Object.keys(bpUniqueSkus).length;
  totalPercent += (uniqueBpCount * 0.79);

  var uniqueBezshkCount = Object.keys(bezshkUniqueBarcodes).length;
  totalPercent += (uniqueBezshkCount * 0.66);

  // 2. Доп работы (каждый час = 9.09%)
  if (extraWorkRows && extraWorkRows.length > 0) {
    for (var j = 0; j < extraWorkRows.length; j++) {
      var exRow = extraWorkRows[j];
      if (!exRow || exRow.length === 0) continue;

      var colExEmp = (extraHeaderMap && extraHeaderMap['фио сотрудника'] !== undefined) ? extraHeaderMap['фио сотрудника'] : ((extraHeaderMap && extraHeaderMap['фио'] !== undefined) ? extraHeaderMap['фио'] : 1);
      var colExDate = (extraHeaderMap && extraHeaderMap['дата'] !== undefined) ? extraHeaderMap['дата'] : 0;
      var colExHours = (extraHeaderMap && extraHeaderMap['сколько часов'] !== undefined) ? extraHeaderMap['сколько часов'] : 3;

      var exEmp = String(exRow[colExEmp] !== undefined ? exRow[colExEmp] : (exRow[1] || '')).toLowerCase().trim();
      if (exEmp !== empLower) continue;

      var exDateStr = parseToDateStr(exRow[colExDate] !== undefined ? exRow[colExDate] : exRow[0], tz);
      if (exDateStr !== targetDateStr) continue;

      var rawHours = exRow[colExHours] !== undefined ? exRow[colExHours] : exRow[3];
      var hours = parseFloat(String(rawHours || '').replace(',', '.')) || 0;
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
    headers.push('Итог');

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
    // Если лист существует — проверяем наличие заголовка «Итог» и дописываем новых сотрудников
    var lastColHeader = String(sheet.getRange(1, sheet.getLastColumn()).getValue() || '').trim().toLowerCase();
    if (lastColHeader.indexOf('итог') === -1 && lastColHeader.indexOf('среднее') === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Итог')
           .setFontWeight('bold')
           .setBackground('#0d2137')
           .setFontColor('#ffffff')
           .setFontSize(10);
    }

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
 * Условное форматирование сводной таблицы
 * - до 50% — красное
 * - от 50% до 99.99% — жёлтое
 * - начиная от 100% — зелёное
 */
function applySummaryConditionalFormatting(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 2) return;

  var range = sheet.getRange(2, 2, lastRow - 1, lastCol - 1);

  // Правило 1: Зелёное (>= 100%)
  var ruleGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThanOrEqualTo(1)
    .setBackground('#e6f4ea')
    .setFontColor('#137333')
    .setRanges([range])
    .build();

  // Правило 2: Жёлтое (от 50% до 99.99%)
  var ruleYellow = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(0.5, 0.999999)
    .setBackground('#fef7e0')
    .setFontColor('#b06000')
    .setRanges([range])
    .build();

  // Правило 3: Красное (до 50%)
  var ruleRed = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0.5)
    .setBackground('#fce8e6')
    .setFontColor('#c5221f')
    .setRanges([range])
    .build();

  sheet.setConditionalFormatRules([ruleGreen, ruleYellow, ruleRed]);
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

    // Синхронизируем сотрудников и заголовок «Итог»
    getOrCreateSummarySheet(ss, monthName);

    var lastCol = summarySheet.getLastColumn();
    var lastRow = summarySheet.getLastRow();
    if (lastCol < 2 || lastRow < 2) continue;

    var dateHeaders = summarySheet.getRange(1, 2, 1, lastCol - 1).getValues()[0];
    var empDataRows = summarySheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    var numRows = empDataRows.length;
    var numCols = dateHeaders.length;
    if (numRows === 0 || numCols === 0) continue;

    var outputValues = [];
    var outputBgColors = [];
    var outputFontColors = [];
    var outputFormats = [];

    for (var r = 0; r < numRows; r++) {
      var rowVals = [];
      var rowBgs = [];
      var rowFonts = [];
      var rowFormats = [];
      var empName = String(empDataRows[r][0] || '').trim();

      var dailyPercents = [];

      for (var c = 0; c < numCols; c++) {
        var dVal = String(dateHeaders[c] || '').trim();
        var dValLower = dVal.toLowerCase();

        if (dValLower.indexOf('итог') !== -1 || dValLower.indexOf('среднее') !== -1) {
          // Расчёт среднего значения по всем рабочим дням сотрудника
          if (dailyPercents.length > 0) {
            var sumP = 0;
            for (var p = 0; p < dailyPercents.length; p++) {
              sumP += dailyPercents[p];
            }
            var avgPercent = sumP / dailyPercents.length;
            rowVals.push(avgPercent / 100);
            rowFormats.push('0.00%');

            if (avgPercent >= 100) {
              rowBgs.push('#e6f4ea');   // Мягкий зелёный
              rowFonts.push('#137333');
            } else if (avgPercent >= 50) {
              rowBgs.push('#fef7e0');   // Мягкий жёлтый
              rowFonts.push('#b06000');
            } else {
              rowBgs.push('#fce8e6');   // Мягкий красный
              rowFonts.push('#c5221f');
            }
          } else {
            rowVals.push('');
            rowBgs.push('#ffffff');
            rowFonts.push('#000000');
            rowFormats.push('@');
          }
          continue;
        }

        if (!empName || !dVal) {
          rowVals.push('');
          rowBgs.push('#ffffff');
          rowFonts.push('#000000');
          rowFormats.push('@');
          continue;
        }

        var dateStr = parseToDateStr(dVal, tz);
        var calcPercent = calculateEmployeeDailyPercent(empName, dateStr, logRows, extraWorkRows);

        if (calcPercent > 0) {
          dailyPercents.push(calcPercent);
          var val = calcPercent / 100;
          rowVals.push(val);
          rowFormats.push('0.00%');

          if (calcPercent >= 100) {
            rowBgs.push('#e6f4ea');   // Мягкий зелёный
            rowFonts.push('#137333'); // Тёмно-зелёный текст
          } else if (calcPercent >= 50) {
            rowBgs.push('#fef7e0');   // Мягкий жёлтый
            rowFonts.push('#b06000'); // Тёмно-жёлтый текст
          } else {
            rowBgs.push('#fce8e6');   // Мягкий красный
            rowFonts.push('#c5221f'); // Тёмно-красный текст
          }
        } else {
          rowVals.push('');
          rowBgs.push('#ffffff');
          rowFonts.push('#000000');
          rowFormats.push('@');
        }
      }

      outputValues.push(rowVals);
      outputBgColors.push(rowBgs);
      outputFontColors.push(rowFonts);
      outputFormats.push(rowFormats);
    }

    var targetRange = summarySheet.getRange(2, 2, numRows, numCols);
    targetRange.setValues(outputValues)
               .setNumberFormats(outputFormats)
               .setBackgrounds(outputBgColors)
               .setFontColors(outputFontColors);

    applySummaryConditionalFormatting(summarySheet);
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

// ── Колонки листа «На поиск» (дефолтные 0-based индексы) ─────────
var MC_BARCODE    = 0;   // A: ШК
var MC_PRICE_EA   = 1;   // B: Цена Продажи (единица)
var MC_PRICE_ALL  = 2;   // C: Цена все товар (итог — для распределения)
var MC_NAME       = 3;   // D: Описание
var MC_QTY        = 4;   // E: Товаров
var MC_PROCESS    = 5;   // F: Процесс
var MC_ZONE       = 6;   // G: Зона
var MC_WAREHOUSE  = 7;   // H: Склад
var MC_KEY        = 8;   // I: key (ячейка)
var MC_CATEGORY   = 12;  // M: h1_title / Категория
var MC_ASSIGNEE   = 13;  // N: У кого задана
var MC_RESULT     = 14;  // O: Статус/Результат
var MC_FLAG       = 15;  // P: Флажок (TRUE = финально обработан)

/**
 * Динамическое определение индексов колонок листа «На поиск» по заголовкам (первая строка)
 */
function getMissingColumnMap(sheet) {
  var map = {
    barcode:    MC_BARCODE,
    priceUnit:  MC_PRICE_EA,
    priceTotal: MC_PRICE_ALL,
    name:       MC_NAME,
    qty:        MC_QTY,
    process:    MC_PROCESS,
    zone:       MC_ZONE,
    warehouse:  MC_WAREHOUSE,
    key:        MC_KEY,
    category:   MC_CATEGORY,
    assignee:   MC_ASSIGNEE,
    result:     MC_RESULT,
    flag:       MC_FLAG,
    maxCol:     MC_FLAG + 1
  };

  if (!sheet || sheet.getLastColumn() < 1) return map;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  map.maxCol = headers.length;

  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || '').toLowerCase().trim();
    if (!h) continue;

    if (h === 'шк' || h === 'штрихкод' || h === 'barcode') map.barcode = c;
    else if (h.indexOf('цена продажи') !== -1 || h === 'цена товара' || h === 'price_ea') map.priceUnit = c;
    else if (h.indexOf('цена все') !== -1 || h === 'сумма' || h === 'price_all') map.priceTotal = c;
    else if (h === 'описание' || h === 'наименование' || h === 'название' || h === 'name') map.name = c;
    else if (h === 'товаров' || h === 'кол-во' || h === 'количество' || h === 'qty') map.qty = c;
    else if (h === 'процесс' || h === 'process') map.process = c;
    else if (h === 'зона' || h === 'zone') map.zone = c;
    else if (h === 'склад' || h === 'warehouse') map.warehouse = c;
    else if (h === 'key' || h === 'ячейка') map.key = c;
    else if (h === 'категория' || h === 'category' || h === 'h1_title' || h === 'h1' || h === 'h1_name') map.category = c;
    else if (h.indexOf('у кого') !== -1 || h === 'исполнитель' || h === 'assignee') map.assignee = c;
    else if (h === 'статус' || h === 'результат' || h === 'result') map.result = c;
    else if (h === 'флажок' || h === 'обработано' || h === 'flag') map.flag = c;
  }

  return map;
}

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

  var taskSheet = ss.getSheetByName(SHEET_MISSING);
  if (!taskSheet) return jsonOk({ success: true, tasks: [], razborTasks: [], employeeName: employeeName });

  var lastRow = taskSheet.getLastRow();
  if (lastRow < 2) return jsonOk({ success: true, tasks: [], razborTasks: [], employeeName: employeeName });

  var colMap       = getMissingColumnMap(taskSheet);
  var data         = taskSheet.getRange(2, 1, lastRow - 1, colMap.maxCol).getValues();
  var empNameLower = employeeName.toLowerCase();
  var tasks        = [];
  var razborTasks  = [];

  for (var i = 0; i < data.length; i++) {
    var assignee  = String(data[i][colMap.assignee] || '').trim().toLowerCase();
    var result    = String(data[i][colMap.result]   || '').trim();
    var isFlagged = (data[i][colMap.flag] === true || String(data[i][colMap.flag]).toUpperCase() === 'TRUE');

    if (assignee === empNameLower && !isFlagged) {
      var item = {
        row:        i + 2,
        barcode:    data[i][colMap.barcode],
        name:       data[i][colMap.name],
        priceUnit:  data[i][colMap.priceUnit],
        priceTotal: data[i][colMap.priceTotal],
        qty:        data[i][colMap.qty],
        process:    data[i][colMap.process],
        zone:       data[i][colMap.zone],
        key:        data[i][colMap.key],
        category:   data[i][colMap.category],
        result:     result
      };

      tasks.push(item);
      if (result === 'На разбор') {
        razborTasks.push(item);
      }
    }
  }

  function getPriceTier(price) {
    var p = Number(price) || 0;
    if (p >= 1000000) return 3;
    if (p >= 500000)  return 2;
    return 1;
  }

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

  var taskSheet = ss.getSheetByName(SHEET_MISSING);
  var colMap    = getMissingColumnMap(taskSheet);

  var catVal     = String(data.category || '').trim();
  var procVal    = String(data.process  || '').trim();
  var zoneVal    = String(data.zone     || '').trim();
  var nameVal    = String(data.name     || '').trim();
  var barcodeVal = String(data.barcode  || '').trim();
  var keyVal     = String(data.key      || '').trim();

  // 1. Обновляем статус в «На поиск» и считываем отсутствующие данные из строки источника
  if (data.row && Number(data.row) > 1 && taskSheet) {
    var rowNum = Number(data.row);
    taskSheet.getRange(rowNum, colMap.result + 1).setValue(resultText);

    if (!isRazbor) {
      taskSheet.getRange(rowNum, colMap.flag + 1).setValue(true);
    }

    // Если данные (категория/процесс/зона и др.) не переданы с фронтенда, считываем их напрямую из исходной строки
    if (!catVal || !procVal || !zoneVal || !nameVal || !barcodeVal || !keyVal) {
      try {
        var rowValues = taskSheet.getRange(rowNum, 1, 1, colMap.maxCol).getValues()[0];
        if (!catVal     && rowValues[colMap.category] !== undefined) catVal     = String(rowValues[colMap.category] || '').trim();
        if (!procVal    && rowValues[colMap.process]  !== undefined) procVal    = String(rowValues[colMap.process]  || '').trim();
        if (!zoneVal    && rowValues[colMap.zone]     !== undefined) zoneVal    = String(rowValues[colMap.zone]     || '').trim();
        if (!nameVal    && rowValues[colMap.name]     !== undefined) nameVal    = String(rowValues[colMap.name]     || '').trim();
        if (!barcodeVal && rowValues[colMap.barcode]  !== undefined) barcodeVal = String(rowValues[colMap.barcode]  || '').trim();
        if (!keyVal     && rowValues[colMap.key]      !== undefined) keyVal     = String(rowValues[colMap.key]      || '').trim();
      } catch(eRow) {}
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
      barcodeVal,                           // D: ШК
      nameVal,                              // E: Описание
      zoneVal,                              // F: Зона
      catVal,                               // G: Категория
      procVal,                              // H: Процесс
      keyVal,                               // I: Ячейка (исходная)
      data.foundKey     || keyVal || '',    // J: Где нашли
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

  var colMap       = getMissingColumnMap(taskSheet);
  var data         = taskSheet.getRange(2, 1, lastRow - 1, colMap.maxCol).getValues();
  var empNameLower = employeeName.toLowerCase();
  var tasks        = [];

  for (var i = 0; i < data.length; i++) {
    var assignee = String(data[i][colMap.assignee] || '').trim().toLowerCase();
    var result   = String(data[i][colMap.result]   || '').trim();

    if (assignee === empNameLower && result === 'На разбор') {
      tasks.push({
        row:        i + 2,
        barcode:    data[i][colMap.barcode],
        name:       data[i][colMap.name],
        priceUnit:  data[i][colMap.priceUnit],
        priceTotal: data[i][colMap.priceTotal],
        qty:        data[i][colMap.qty],
        process:    data[i][colMap.process],
        zone:       data[i][colMap.zone],
        key:        data[i][colMap.key],
        category:   data[i][colMap.category]
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

  var colMap  = getMissingColumnMap(taskSheet);
  var allData = taskSheet.getRange(2, 1, lastRow - 1, colMap.maxCol).getValues();

  var itemsToDistribute     = [];
  var alreadyCompletedCount = 0;

  for (var i = 0; i < allData.length; i++) {
    var flag   = allData[i][colMap.flag];
    var result = String(allData[i][colMap.result] || '').trim();

    var isFlagTrue = (flag === true) || (String(flag).toUpperCase() === 'TRUE');
    var isFinished = isFlagTrue || (result !== '' && result !== 'На разбор');

    if (isFinished) {
      alreadyCompletedCount++;
    } else {
      itemsToDistribute.push({
        dataIdx:    i,
        priceTotal: parseFloat(allData[i][colMap.priceTotal]) || 0
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

  // 5. Пакетная запись в колонку назначения с зафиксированной выгрузкой в таблицу
  try {
    var assigneeCol = taskSheet.getRange(2, colMap.assignee + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < itemsToDistribute.length; i++) {
      assigneeCol[itemsToDistribute[i].dataIdx][0] = itemsToDistribute[i].assignedTo;
    }
    taskSheet.getRange(2, colMap.assignee + 1, lastRow - 1, 1).setValues(assigneeCol);
    SpreadsheetApp.flush(); // Гарантированная запись изменений на диск таблицы
  } catch (errWrite) {
    ui.alert(
      '❌ Ошибка записи распределения!\n\n' +
      'У вас нет прав на редактирование защищенных диапазонов на листе «' + SHEET_MISSING + '».\n' +
      'Попросите владельца таблицы разрешить редактирование колонки распределения или снять защиту.\n\n' +
      'Детали: ' + errWrite.message
    );
    return;
  }

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

// ─────────────────────────────────────────────────────────
//  ПОИСК БП (БИЗНЕС ПОДДЕРЖКА) — БЭКЕНД ФУНКЦИИ
// ─────────────────────────────────────────────────────────

function isEmployeeMatch(a, b) {
  var strA = String(a || '').trim().toLowerCase();
  var strB = String(b || '').trim().toLowerCase();
  if (!strA || !strB) return false;
  return strA === strB || strA.indexOf(strB) !== -1 || strB.indexOf(strA) !== -1;
}

function getBpSpreadsheet() {
  try {
    return SpreadsheetApp.openById(BP_SPREADSHEET_ID);
  } catch (e) {
    return null;
  }
}

function mapBpHeaders(headers) {
  var colMap = {
    ticketLink: -1,
    barcode: -1,
    targetQty: -1,
    searchDate: -1,
    cells: -1,
    warehouse: -1,
    status: -1,
    foundQty: -1,
    employee: -1,
    productId: -1
  };
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim().toLowerCase();
    if (h.indexOf('ссылка') === 0 || h.indexOf('заявк') !== -1) {
      colMap.ticketLink = i;
    } else if (h === 'шк' || h === 'штрихкод' || h === 'штрих-код') {
      colMap.barcode = i;
    } else if (h.indexOf('кол-во для поиска') !== -1 || h.indexOf('кол во для поиска') !== -1 || h.indexOf('кол-во поиска') !== -1) {
      colMap.targetQty = i;
    } else if ((h.indexOf('кол-во') === 0 || h.indexOf('кол во') === 0 || h.indexOf('количество') !== -1) && colMap.targetQty === -1 && h.indexOf('найден') === -1) {
      colMap.targetQty = i;
    } else if (h === 'дата поиска' || h.indexOf('дата поис') !== -1) {
      colMap.searchDate = i;
    } else if (h.indexOf('ячейка') === 0 || h.indexOf('ячейка для') !== -1) {
      colMap.cells = i;
    } else if (h === 'склад') {
      colMap.warehouse = i;
    } else if (h === 'статус') {
      colMap.status = i;
    } else if (h.indexOf('найден') !== -1) {
      colMap.foundQty = i;
    } else if (h.indexOf('сотрудник') !== -1) {
      colMap.employee = i;
    } else if (h === 'sku_id' || h === 'skuid' || h === 'product_id' || h === 'productid' || h.indexOf('product') !== -1 || h.indexOf('sku') !== -1 || h.indexOf('айди') !== -1) {
      colMap.productId = i;
    }
  }
  return colMap;
}

function cleanExpiredBpLocks(bpSs) {
  if (!bpSs) return;
  var lockSheet = bpSs.getSheetByName('Блокировки');
  if (!lockSheet) return;
  var data = lockSheet.getDataRange().getValues();
  if (data.length < 2) return;
  var now = new Date().getTime();
  var fourHoursMs = 4 * 60 * 60 * 1000;

  var validRows = [data[0]];
  var changed = false;

  for (var i = 1; i < data.length; i++) {
    var lockTime = new Date(data[i][3]).getTime();
    if (!isNaN(lockTime) && (now - lockTime <= fourHoursMs)) {
      validRows.push(data[i]);
    } else {
      changed = true;
    }
  }

  if (changed) {
    lockSheet.clearContents();
    if (validRows.length > 0) {
      lockSheet.getRange(1, 1, validRows.length, validRows[0].length).setValues(validRows);
    }
  }
}

function handleGetBpTasks() {
  var bpSs = getBpSpreadsheet();
  if (!bpSs) return jsonOk({ success: false, error: 'Не удалось открыть таблицу БП по ID' });

  cleanExpiredBpLocks(bpSs);

  var mainSheet = bpSs.getSheetByName('Рабочий лист') || bpSs.getSheets()[0];
  var logSheet  = bpSs.getSheetByName('Детали поиска');

  var mainData = mainSheet.getDataRange().getValues();
  if (mainData.length < 2) {
    return jsonOk({ success: true, tasks: [], locks: [] });
  }

  var headers = mainData[0];
  var colMap  = mapBpHeaders(headers);

  var checkedCells = {};
  if (logSheet) {
    var logData = logSheet.getDataRange().getValues();
    for (var i = 1; i < logData.length; i++) {
      var rowIdx = String(logData[i][1]).trim();
      var cellName = String(logData[i][3]).trim();
      if (!checkedCells[rowIdx]) checkedCells[rowIdx] = {};
      checkedCells[rowIdx][cellName] = true;
    }
  }

  var tasks = [];
  for (var r = 1; r < mainData.length; r++) {
    var row = mainData[r];
    var status    = String(row[colMap.status] || '').trim();
    var warehouse = String(row[colMap.warehouse] || '').trim();

    if (status === '' && warehouse !== '') {
      var barcode    = String(row[colMap.barcode] || '').trim();
      var cellText   = String(row[colMap.cells] || '').trim();
      var rawTarget = colMap.targetQty !== -1 ? row[colMap.targetQty] : 1;
      var targetQty = 1;
      if (rawTarget !== undefined && rawTarget !== null && rawTarget !== '') {
        var parsedT = parseInt(String(rawTarget).replace(/\s+/g, ''));
        if (!isNaN(parsedT) && parsedT > 0) targetQty = parsedT;
      }
      var ticketLink = colMap.ticketLink !== -1 ? String(row[colMap.ticketLink] || '').trim() : '';

      if (!barcode || !cellText) continue;

      var rawCells = cellText.split(/[\n,;]+/);
      var cellsForThisRow = [];

      for (var c = 0; c < rawCells.length; c++) {
        var cell = rawCells[c].trim();
        if (!cell || !/^[A-Za-z0-9]+(\.\d+)+$/.test(cell)) continue;
        var isChecked = checkedCells[r + 1] && checkedCells[r + 1][cell];
        if (!isChecked) cellsForThisRow.push(cell);
      }

      var totalValidCellsCount = rawCells.filter(function(x) {
        return x.trim() !== '' && /^[A-Za-z0-9]+(\.\d+)+$/.test(x.trim());
      }).length;

      for (var k = 0; k < cellsForThisRow.length; k++) {
        var cellItem = cellsForThisRow[k];
        var finalWarehouse = warehouse;
        if (cellItem.indexOf('SR') === 0 || cellItem.indexOf('BR') === 0) {
          finalWarehouse = 'Сергели';
        }
        tasks.push({
          rowIndex: r + 1,
          barcode: barcode,
          warehouse: finalWarehouse,
          cell: cellItem,
          targetQty: targetQty,
          ticketLink: ticketLink,
          totalCellsCount: totalValidCellsCount,
          assignedTo: colMap.employee !== -1 ? String(row[colMap.employee] || '').trim() : '',
          productId: colMap.productId !== -1 ? String(row[colMap.productId] || '').trim() : ''
        });
      }
    }
  }

  var locksList = [];
  var lockSheet = bpSs.getSheetByName('Блокировки');
  if (lockSheet) {
    var lockData = lockSheet.getDataRange().getValues();
    for (var i = 1; i < lockData.length; i++) {
      locksList.push({
        warehouse: String(lockData[i][0] || '').trim(),
        floor:     String(lockData[i][1] || '').trim(),
        employee:  String(lockData[i][2] || '').trim(),
        date:      lockData[i][3]
      });
    }
  }

  return jsonOk({ success: true, tasks: tasks, locks: locksList });
}

function handleLogBpResult(data) {
  var rowIndex   = parseInt(data.rowIndex);
  var barcode    = String(data.barcode || '').trim();
  var targetCell = String(data.cell || '').trim();
  var cell       = String(data.foundKey || data.cell || '').trim();
  var foundQty   = parseInt(data.foundQty) || 0;
  var employee   = String(data.employeeName || data.employee || '').trim();

  if (!rowIndex || !barcode || !cell || !employee) {
    return jsonOk({ success: false, error: 'Неполные параметры записи БП' });
  }

  var bpSs = getBpSpreadsheet();
  if (!bpSs) return jsonOk({ success: false, error: 'Ошибка подключения к внешней базе БП' });

  var mainSheet = bpSs.getSheetByName('Рабочий лист') || bpSs.getSheets()[0];
  var logSheet  = bpSs.getSheetByName('Детали поиска');
  if (!logSheet) {
    logSheet = bpSs.insertSheet('Детали поиска');
    logSheet.appendRow(['Дата проверки', 'Индекс строки', 'Штрихкод', 'Ячейка', 'Найдено шт.', 'Сотрудник ФИО']);
  }

  // 1. Запись во внешнюю таблицу БП (Детали поиска) - фиксируем проверку конкретной ячейки задачи
  var checkCellKey = targetCell || cell;
  logSheet.appendRow([new Date(), rowIndex, barcode, checkCellKey, foundQty, employee]);

  var headers = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0];
  var colMap  = mapBpHeaders(headers);

  var rowRange  = mainSheet.getRange(rowIndex, 1, 1, mainSheet.getLastColumn());
  var rowValues = rowRange.getValues()[0];

  var cellText = String(rowValues[colMap.cells] || '').trim();
  var rawCells = cellText.split(/[\n,;]+/);
  var allRequiredCells = [];
  for (var c = 0; c < rawCells.length; c++) {
    var cl = rawCells[c].trim();
    if (cl && /^[A-Za-z0-9]+(\.\d+)+$/.test(cl)) allRequiredCells.push(cl);
  }

  var logData = logSheet.getDataRange().getValues();
  var checkedCellsInfo = {};
  for (var i = 1; i < logData.length; i++) {
    if (parseInt(logData[i][1]) === rowIndex) {
      var lCell = String(logData[i][3] || '').trim();
      var lQty  = parseInt(logData[i][4]) || 0;
      checkedCellsInfo[lCell] = lQty;
    }
  }

  var allChecked = true;
  var totalFoundQty = 0;
  for (var k = 0; k < allRequiredCells.length; k++) {
    var reqCell = allRequiredCells[k];
    if (checkedCellsInfo[reqCell] === undefined) {
      allChecked = false;
    } else {
      totalFoundQty += checkedCellsInfo[reqCell];
    }
  }

  // 2. Только после проверки ВСЕХ ячеек СКУ записываем финальный итог сотруднику в Лог РАО и обновляем Главную таблицу
  if (allChecked) {
    var todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy');
    var finalStatus = totalFoundQty > 0 ? 'Найден' : 'Не найден';

    if (colMap.status !== -1)     mainSheet.getRange(rowIndex, colMap.status + 1).setValue(finalStatus);
    if (colMap.foundQty !== -1)   mainSheet.getRange(rowIndex, colMap.foundQty + 1).setValue(totalFoundQty);
    if (colMap.employee !== -1)   mainSheet.getRange(rowIndex, colMap.employee + 1).setValue(employee);
    if (colMap.searchDate !== -1) mainSheet.getRange(rowIndex, colMap.searchDate + 1).setValue(todayStr);

    // Запись 1 проверенного СКУ в локальный лог РАО сотрудника (Лог обработки - [Месяц])
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var raoLogSheet = getOrCreateMissingLogSheet(ss);
      raoLogSheet.appendRow([
        new Date(),
        data.employeeId   || '',
        employee,
        barcode,
        '', '', '', 'Поиск БП',
        checkCellKey,
        cell,
        (totalFoundQty > 0 ? 'Найдено' : 'Не найдено'),
        1, 0, totalFoundQty, 0,
        'Поиск БП'
      ]);
    } catch (eRaoLog) {}
  }

  return jsonOk({ success: true, allChecked: allChecked, totalFoundQty: totalFoundQty });
}

function handleLockBpZone(data) {
  var warehouse = String(data.warehouse || '').trim();
  var floor     = String(data.floor || '').trim();
  var employee  = String(data.employee || '').trim();
  if (!warehouse || !floor || !employee) return jsonOk({ success: false, error: 'Неполные данные' });

  // Персональный поиск по назначенным задачам не зависит от общих блокировок свободного поиска
  if (warehouse === 'Назначено мне') {
    return jsonOk({ success: true });
  }

  var bpSs = getBpSpreadsheet();
  if (!bpSs) return jsonOk({ success: false, error: 'Ошибка подключения к БП' });

  cleanExpiredBpLocks(bpSs);

  var lockSheet = bpSs.getSheetByName('Блокировки');
  if (!lockSheet) {
    lockSheet = bpSs.insertSheet('Блокировки');
    lockSheet.appendRow(['Склад', 'Этаж', 'Сотрудник ФИО', 'Дата блокировки']);
  }

  var lockData = lockSheet.getDataRange().getValues();

  // 1. Проверяем, не занята ли эта зона ДРУГИМ сотрудником
  for (var i = 1; i < lockData.length; i++) {
    var lW = String(lockData[i][0] || '').trim();
    var lF = String(lockData[i][1] || '').trim();
    var lE = String(lockData[i][2] || '').trim();

    if (lW === warehouse && lF === floor) {
      if (!isEmployeeMatch(lE, employee)) {
        return jsonOk({ success: false, error: 'Эта зона уже занята сотрудником: ' + lE });
      }
    }
  }

  // 2. Удаляем предыдущие блокировки ЭТОГО сотрудника на ЭТОМ складе
  var validRows = [lockData[0]];
  for (var k = 1; k < lockData.length; k++) {
    var rowW = String(lockData[k][0] || '').trim();
    var rowE = String(lockData[k][2] || '').trim();
    if (!isEmployeeMatch(rowE, employee) || rowW !== warehouse) {
      validRows.push(lockData[k]);
    }
  }

  // 3. Добавляем новую актуальную блокировку
  validRows.push([warehouse, floor, employee, new Date()]);

  lockSheet.clearContents();
  lockSheet.getRange(1, 1, validRows.length, validRows[0].length).setValues(validRows);

  return jsonOk({ success: true });
}

function handleUnlockBpZone(data) {
  var warehouse = String(data.warehouse || '').trim();
  var floor     = String(data.floor || '').trim();
  var employee  = String(data.employee || '').trim();
  if (!employee) return jsonOk({ success: true });
  if (warehouse === 'Назначено мне') return jsonOk({ success: true });

  var bpSs = getBpSpreadsheet();
  if (!bpSs) return jsonOk({ success: true });

  var lockSheet = bpSs.getSheetByName('Блокировки');
  if (!lockSheet) return jsonOk({ success: true });

  var lockData = lockSheet.getDataRange().getValues();
  if (lockData.length < 2) return jsonOk({ success: true });

  var validRows = [lockData[0]];
  var changed = false;

  for (var i = 1; i < lockData.length; i++) {
    var lW = String(lockData[i][0] || '').trim();
    var lF = String(lockData[i][1] || '').trim();
    var lE = String(lockData[i][2] || '').trim();

    var isEmp = isEmployeeMatch(lE, employee);
    var isWh  = !warehouse || lW === warehouse;
    var isFl  = !floor || lF === floor;

    if (isEmp && isWh && isFl) {
      changed = true;
    } else {
      validRows.push(lockData[i]);
    }
  }

  if (changed) {
    lockSheet.clearContents();
    if (validRows.length > 0) {
      lockSheet.getRange(1, 1, validRows.length, validRows[0].length).setValues(validRows);
    }
  }

  return jsonOk({ success: true });
}


// ═══════════════════════════════════════════════════════════
//  FBS — ПОИСК АКТОВ (лист «Поиск FBS» в таблице БП)
//  • Очередь: строки с Номером акта + ШК + «Ячейка для поиска»
//    и пустым «Статус». Группируются по акту, порядок актов —
//    по первой строке акта сверху вниз; внутри акта — сверху вниз.
//  • Бронь: сотрудник получает целый акт; бронь пишется в лист
//    «Блокировки» (Склад = FBS_ACT_LOCK_TAG, Этаж = № акта),
//    протухает через 4 часа (cleanExpiredBpLocks).
//  • Результат: «Найден» / «Не найден» → Статус, Найдено в ячейке,
//    Найдено (кол-во), Сотрудник Аналитики.
// ═══════════════════════════════════════════════════════════
var SHEET_FBS_SEARCH  = 'Поиск FBS';
var FBS_ACT_LOCK_TAG  = 'FBS: Поиск актов';
var FBS_ACT_RESULTS   = ['Найден', 'Не найден'];

function fbsNorm(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.round(v));
  return String(v).replace(/\s+/g, '').trim().toUpperCase();
}

function fbsText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.round(v));
  return String(v).trim();
}

/** Колонки листа «Поиск FBS» по заголовкам (точное совпадение, затем начало строки). */
function getFbsSearchColumns(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h || '').toLowerCase().replace(/\s+/g, ' ').trim(); });
  function find(exact, prefix) {
    var i = headers.indexOf(exact);
    if (i >= 0) return i;
    if (prefix) {
      for (var k = 0; k < headers.length; k++) if (headers[k].indexOf(prefix) === 0) return k;
    }
    return -1;
  }
  return {
    date:      find('дата заявки', 'дата заявки'),
    request:   find('заявка'),
    act:       find('номер акта возврата', 'номер акта'),
    sku:       find('шк товара', 'шк'),
    desc:      find('описание', 'описание'),
    qty:       find('количество для поиска', 'количество для поиска'),
    cells:     find('ячейка для поиска', 'ячейка для поиска'),
    foundCell: find('найдено в ячейке', 'найдено в ячейке'),
    storage:   find('ячейка хранение акта', 'ячейка хранен'),
    status:    find('статус'),
    foundQty:  find('найдено'),
    employee:  find('сотрудник аналитики', 'сотрудник')
  };
}

function getFbsSearchSheet() {
  var bpSs = getBpSpreadsheet();
  if (!bpSs) return { error: 'Нет доступа к таблице «Запросы от БП | Аналитика»' };
  var sheet = bpSs.getSheetByName(SHEET_FBS_SEARCH);
  if (!sheet) return { error: 'Не найден лист «' + SHEET_FBS_SEARCH + '»' };
  var cols = getFbsSearchColumns(sheet);
  var required = ['act', 'sku', 'cells', 'status', 'foundCell', 'foundQty', 'employee'];
  for (var i = 0; i < required.length; i++) {
    if (cols[required[i]] < 0) return { error: 'В «' + SHEET_FBS_SEARCH + '» не найдена колонка: ' + required[i] };
  }
  return { bpSs: bpSs, sheet: sheet, cols: cols };
}

function fbsFormatDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tashkent', 'dd.MM.yyyy HH:mm');
  return fbsText(v);
}

/** Ячейки для поиска: в одной ячейке таблицы может быть несколько через перенос строки / запятую. */
function fbsSplitCells(v) {
  return fbsText(v).split(/[\n,;]+/).map(function (x) { return x.trim(); }).filter(String);
}

/** Все необработанные строки, сгруппированные по акту (в порядке листа). */
function readFbsPendingActs(sheet, cols) {
  var lastRow = sheet.getLastRow();
  var acts = [];      // [{ key, act, rows: [...] }]
  var byKey = {};
  if (lastRow < 2) return acts;
  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var actKey = fbsNorm(r[cols.act]);
    var sku    = fbsText(r[cols.sku]);
    if (!actKey || !sku) continue;
    if (fbsText(r[cols.status])) continue;                 // уже обработано
    var cells = fbsSplitCells(r[cols.cells]);
    if (!cells.length) continue;                           // ещё не подготовлено к поиску
    if (!byKey[actKey]) {
      byKey[actKey] = { key: actKey, act: fbsText(r[cols.act]), rows: [] };
      acts.push(byKey[actKey]);
    }
    byKey[actKey].rows.push({
      row:         i + 2,
      sku:         sku,
      desc:        cols.desc    >= 0 ? fbsText(r[cols.desc])    : '',
      qty:         cols.qty     >= 0 ? (parseInt(r[cols.qty], 10) || 1) : 1,
      cells:       cells,
      storageCell: cols.storage >= 0 ? fbsText(r[cols.storage]) : '',
      request:     cols.request >= 0 ? fbsText(r[cols.request]) : '',
      date:        cols.date    >= 0 ? fbsFormatDate(r[cols.date]) : ''
    });
  }
  return acts;
}

function getOrCreateLockSheet(bpSs) {
  var lockSheet = bpSs.getSheetByName('Блокировки');
  if (!lockSheet) {
    lockSheet = bpSs.insertSheet('Блокировки');
    lockSheet.appendRow(['Склад', 'Этаж', 'Сотрудник ФИО', 'Дата блокировки']);
  }
  return lockSheet;
}

/** { actKey: employeeName } — текущие брони актов FBS. */
function readFbsActLocks(bpSs) {
  var res = {};
  var lockSheet = bpSs.getSheetByName('Блокировки');
  if (!lockSheet) return res;
  var data = lockSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() !== FBS_ACT_LOCK_TAG) continue;
    res[fbsNorm(data[i][1])] = String(data[i][2] || '').trim();
  }
  return res;
}

/** Снимает все брони актов сотрудника и (если actText задан) ставит новую / обновляет время. */
function setFbsActLock(bpSs, employeeName, actText) {
  var lockSheet = getOrCreateLockSheet(bpSs);
  var data = lockSheet.getDataRange().getValues();
  var header = ['Склад', 'Этаж', 'Сотрудник ФИО', 'Дата блокировки'];
  if (!data.length || data[0].length < 4 || !String(data[0][0] || '').trim()) data = [header];
  var keep = [data[0].slice(0, 4)];
  for (var i = 1; i < data.length; i++) {
    var isMine = String(data[i][0] || '').trim() === FBS_ACT_LOCK_TAG &&
                 isEmployeeMatch(data[i][2], employeeName);
    if (!isMine) keep.push(data[i].slice(0, 4));
  }
  if (actText) keep.push([FBS_ACT_LOCK_TAG, actText, employeeName, new Date()]);
  lockSheet.clearContents();
  lockSheet.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
}

/**
 * GET getFbsActTask&id=...
 * Возвращает акт сотрудника (уже забронированный или следующий свободный) со списком позиций.
 */
function handleGetFbsActTask(employeeId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var employeeName = getEmployeeNameById(ss, employeeId);
  if (!employeeName) return jsonOk({ success: false, error: 'Сотрудник не найден' });

  var ctx = getFbsSearchSheet();
  if (ctx.error) return jsonOk({ success: false, error: ctx.error });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return jsonOk({ success: false, error: 'Сервер занят, попробуйте ещё раз' });
  try {
    cleanExpiredBpLocks(ctx.bpSs);
    var acts  = readFbsPendingActs(ctx.sheet, ctx.cols);
    var locks = readFbsActLocks(ctx.bpSs);

    var mine = null, free = [], lockedByOthers = 0;
    for (var i = 0; i < acts.length; i++) {
      var owner = locks[acts[i].key];
      if (owner && isEmployeeMatch(owner, employeeName)) { if (!mine) mine = acts[i]; }
      else if (owner) lockedByOthers++;
      else free.push(acts[i]);
    }

    var current = mine || free.shift() || null;
    if (!current) {
      setFbsActLock(ctx.bpSs, employeeName, null);
      return jsonOk({ success: true, act: null, lockedByOthers: lockedByOthers });
    }

    setFbsActLock(ctx.bpSs, employeeName, current.act);
    return jsonOk({
      success:        true,
      act:            current.act,
      rows:           current.rows,
      actsLeft:       free.length,       // свободных актов после текущего
      lockedByOthers: lockedByOthers
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * POST logFbsActResult
 * { employeeId, act, sku, row, result: 'Найден'|'Не найден', foundCell, foundQty }
 */
function handleLogFbsActResult(data) {
  var result = String(data.result || '').trim();
  if (FBS_ACT_RESULTS.indexOf(result) < 0) return jsonOk({ success: false, error: 'Неизвестный результат: ' + result });
  if (!data.act || !data.sku) return jsonOk({ success: false, error: 'Неполные данные' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var employeeName = getEmployeeNameById(ss, data.employeeId);
  if (!employeeName) return jsonOk({ success: false, error: 'Сотрудник не найден' });

  var isFound   = result === 'Найден';
  var foundCell = String(data.foundCell || '').trim();
  var foundQty  = parseInt(data.foundQty, 10) || 0;
  if (isFound && (!foundCell || foundQty < 1)) {
    return jsonOk({ success: false, error: 'Укажите ячейку и количество' });
  }

  var ctx = getFbsSearchSheet();
  if (ctx.error) return jsonOk({ success: false, error: ctx.error });
  var sheet = ctx.sheet, cols = ctx.cols;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return jsonOk({ success: false, error: 'Сервер занят, попробуйте ещё раз' });
  try {
    var actKey = fbsNorm(data.act), skuKey = fbsNorm(data.sku);
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var all = sheet.getRange(2, 1, Math.max(lastRow - 1, 1), lastCol).getValues();

    function matches(r) {
      return r && fbsNorm(r[cols.act]) === actKey && fbsNorm(r[cols.sku]) === skuKey;
    }

    // Строка по номеру; если строки сдвинулись — ищем первую необработанную с тем же Акт+ШК
    var rowNum = parseInt(data.row, 10) || 0;
    var r = rowNum >= 2 ? all[rowNum - 2] : null;
    if (!matches(r) || fbsText(r[cols.status])) {
      rowNum = 0;
      for (var i = 0; i < all.length; i++) {
        if (matches(all[i]) && !fbsText(all[i][cols.status])) { rowNum = i + 2; break; }
      }
      if (!rowNum) return jsonOk({ success: false, error: 'Позиция уже обработана или удалена', alreadyDone: true });
    }

    sheet.getRange(rowNum, cols.status   + 1).setValue(result);
    sheet.getRange(rowNum, cols.foundCell + 1).setValue(isFound ? foundCell : '');
    sheet.getRange(rowNum, cols.foundQty + 1).setValue(isFound ? foundQty : 0);
    sheet.getRange(rowNum, cols.employee + 1).setValue(employeeName);
    all[rowNum - 2][cols.status] = result;

    // Остались ли в акте необработанные строки?
    var actLeft = 0;
    for (var j = 0; j < all.length; j++) {
      if (fbsNorm(all[j][cols.act]) === actKey && !fbsText(all[j][cols.status]) &&
          fbsSplitCells(all[j][cols.cells]).length) actLeft++;
    }
    setFbsActLock(ctx.bpSs, employeeName, actLeft ? fbsText(data.act) : null);

    return jsonOk({ success: true, actLeft: actLeft });
  } finally {
    lock.releaseLock();
  }
}

/** POST releaseFbsAct { employeeId } — снять бронь при выходе из экрана. */
function handleReleaseFbsAct(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var employeeName = getEmployeeNameById(ss, data.employeeId);
  if (!employeeName) return jsonOk({ success: true });
  var bpSs = getBpSpreadsheet();
  if (!bpSs) return jsonOk({ success: true });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return jsonOk({ success: false, error: 'Сервер занят' });
  try {
    setFbsActLock(bpSs, employeeName, null);
  } finally {
    lock.releaseLock();
  }
  return jsonOk({ success: true });
}


// ═══════════════════════════════════════════════════════════
//  FBS — ПОИСК ВЫЧЕРКОВ (лист «Поиск FBS» в этой KPI-таблице)
//  Данные кладёт Python-скрипт каждое утро (fbs_vycherki_export.py).
//  • Очередь: строки с ШК и пустым «Статус», сортировка по «Сумма»
//    по убыванию (при равенстве — раньше вычеркнутые первыми).
//  • Бронь: одна позиция на сотрудника, в CacheService на 30 минут
//    (продлевается при каждом запросе). Брони по содержимому строки,
//    поэтому переживают утреннюю перезапись листа.
//  • Результат: «Найден» (+ ячейка) / «Не найден» →
//    Статус, Ячейка где найдено, Сотрудник Аналитики, Дата и время поиска.
// ═══════════════════════════════════════════════════════════
var SHEET_FBS_VYCH     = 'Поиск FBS';
var FBS_VYCH_RESULTS   = ['Найден', 'Не найден'];
var FBS_VYCH_LOCK_SEC  = 30 * 60;

function getFbsVychColumns(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h || '').toLowerCase().replace(/\s+/g, ' ').trim(); });
  function find(exact, prefix) {
    var i = headers.indexOf(exact);
    if (i >= 0) return i;
    if (prefix) for (var k = 0; k < headers.length; k++) if (headers[k].indexOf(prefix) === 0) return k;
    return -1;
  }
  return {
    date:      find('дата вычерка', 'дата вычерка'),
    sku:       find('шк товара', 'шк товара'),
    desc:      find('описание'),
    category:  find('категория 1', 'категория'),
    cell:      find('ячейка'),
    qty:       find('товаров'),
    price:     find('цена продажи', 'цена'),
    sum:       find('сумма'),
    worker:    find('работник'),
    status:    find('статус'),
    foundCell: find('ячейка где найдено', 'ячейка где'),
    foundQty:  find('найдено'),
    employee:  find('сотрудник аналитики', 'сотрудник'),
    searchAt:  find('дата и время поиска', 'дата и время')
  };
}

function getFbsVychSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_FBS_VYCH);
  if (!sheet) return { error: 'Не найден лист «' + SHEET_FBS_VYCH + '»' };
  if (sheet.getLastRow() < 1) return { error: 'Лист «' + SHEET_FBS_VYCH + '» пуст' };
  var cols = getFbsVychColumns(sheet);
  var required = { sku: 'ШК товара', status: 'Статус', foundCell: 'Ячейка где найдено', foundQty: 'Найдено',
                   employee: 'Сотрудник Аналитики', searchAt: 'Дата и время поиска' };
  for (var k in required) {
    if (cols[k] < 0) return { error: 'В «' + SHEET_FBS_VYCH + '» нет колонки «' + required[k] + '»' };
  }
  return { ss: ss, sheet: sheet, cols: cols };
}

function fbsNum(v) {
  if (typeof v === 'number') return v;
  var n = parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

/** Ключ позиции: дата + ШК + ячейка + работник (как в Python-выгрузке). */
function fbsVychKey(r, cols) {
  function part(i) { return i >= 0 ? fbsNorm(r[i] instanceof Date ? fbsFormatDate(r[i]) : r[i]) : ''; }
  return [part(cols.date), part(cols.sku), part(cols.cell), part(cols.worker)].join('|');
}

function fbsVychTask(r, cols, rowNum, key) {
  function g(i) { return i >= 0 ? r[i] : ''; }
  return {
    row:      rowNum,
    key:      key,
    date:     g(cols.date) instanceof Date ? fbsFormatDate(g(cols.date)) : fbsText(g(cols.date)),
    sku:      fbsText(g(cols.sku)),
    desc:     fbsText(g(cols.desc)),
    category: fbsText(g(cols.category)),
    cell:     fbsText(g(cols.cell)),
    qty:      parseInt(g(cols.qty), 10) || 1,
    price:    fbsNum(g(cols.price)),
    sum:      fbsNum(g(cols.sum)),
    worker:   fbsText(g(cols.worker))
  };
}

/**
 * GET getFbsVycherkTask&id=...
 * Возвращает одну позицию (уже забронированную сотрудником или самую дорогую свободную).
 */
function handleGetFbsVycherkTask(employeeId) {
  var ctx = getFbsVychSheet();
  if (ctx.error) return jsonOk({ success: false, error: ctx.error });
  var employeeName = getEmployeeNameById(ctx.ss, employeeId);
  if (!employeeName) return jsonOk({ success: false, error: 'Сотрудник не найден' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return jsonOk({ success: false, error: 'Сервер занят, попробуйте ещё раз' });
  try {
    var sheet = ctx.sheet, cols = ctx.cols;
    var lastRow = sheet.getLastRow();
    var data = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues() : [];

    var pending = [];
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      if (!fbsText(r[cols.sku]) || fbsText(r[cols.status])) continue;
      pending.push({ i: i, key: fbsVychKey(r, cols), sum: cols.sum >= 0 ? fbsNum(r[cols.sum]) : 0 });
    }
    // Дорогие первыми; при равной сумме — по порядку в листе (раньше вычеркнутые)
    pending.sort(function (a, b) { return (b.sum - a.sum) || (a.i - b.i); });

    var cache   = CacheService.getScriptCache();
    var empKey  = 'VYCH_EMP_' + fbsNorm(employeeName);
    var myKey   = cache.get(empKey);
    var locks   = pending.length ? cache.getAll(pending.map(function (p) { return 'VYCH_LOCK_' + p.key; })) : {};

    var chosen = null, lockedByOthers = 0, free = 0;
    for (var k = 0; k < pending.length; k++) {
      var owner = locks['VYCH_LOCK_' + pending[k].key];
      var mine  = (myKey && myKey === pending[k].key) || (owner && isEmployeeMatch(owner, employeeName));
      if (mine && !chosen) { chosen = pending[k]; continue; }
      if (owner && !mine) { lockedByOthers++; continue; }
      free++;
    }
    if (!chosen) {
      for (var m = 0; m < pending.length; m++) {
        if (!locks['VYCH_LOCK_' + pending[m].key]) { chosen = pending[m]; free--; break; }
      }
    }

    if (!chosen) {
      cache.remove(empKey);
      return jsonOk({ success: true, task: null, lockedByOthers: lockedByOthers });
    }

    cache.put('VYCH_LOCK_' + chosen.key, employeeName, FBS_VYCH_LOCK_SEC);
    cache.put(empKey, chosen.key, FBS_VYCH_LOCK_SEC);

    return jsonOk({
      success:        true,
      task:           fbsVychTask(data[chosen.i], cols, chosen.i + 2, chosen.key),
      left:           Math.max(free, 0),      // свободных позиций, кроме текущей
      lockedByOthers: lockedByOthers
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * POST logFbsVycherkResult
 * { employeeId, key, row, result: 'Найден'|'Не найден', foundCell, foundQty }
 */
function handleLogFbsVycherkResult(data) {
  var result = String(data.result || '').trim();
  if (FBS_VYCH_RESULTS.indexOf(result) < 0) return jsonOk({ success: false, error: 'Неизвестный результат: ' + result });
  if (!data.key) return jsonOk({ success: false, error: 'Неполные данные' });
  var isFound   = result === 'Найден';
  var foundCell = String(data.foundCell || '').trim();
  var foundQty  = parseInt(data.foundQty, 10) || 0;
  if (isFound && !foundCell) return jsonOk({ success: false, error: 'Укажите ячейку, где нашли товар' });
  if (isFound && foundQty < 1) return jsonOk({ success: false, error: 'Укажите найденное количество' });

  var ctx = getFbsVychSheet();
  if (ctx.error) return jsonOk({ success: false, error: ctx.error });
  var employeeName = getEmployeeNameById(ctx.ss, data.employeeId);
  if (!employeeName) return jsonOk({ success: false, error: 'Сотрудник не найден' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return jsonOk({ success: false, error: 'Сервер занят, попробуйте ещё раз' });
  try {
    var sheet = ctx.sheet, cols = ctx.cols;
    var lastRow = sheet.getLastRow();
    var data2 = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues() : [];

    // Строка по номеру; если лист перезаписан — ищем по ключу
    var rowNum = parseInt(data.row, 10) || 0;
    var r = rowNum >= 2 ? data2[rowNum - 2] : null;
    if (!r || fbsVychKey(r, cols) !== data.key) {
      rowNum = 0;
      for (var i = 0; i < data2.length; i++) {
        if (fbsVychKey(data2[i], cols) === data.key) { rowNum = i + 2; r = data2[i]; break; }
      }
    }
    if (!rowNum) return jsonOk({ success: false, error: 'Позиция не найдена (лист обновился)', alreadyDone: true });
    if (fbsText(r[cols.status])) return jsonOk({ success: false, error: 'Позиция уже обработана', alreadyDone: true });
    var maxQty = cols.qty >= 0 ? (parseInt(r[cols.qty], 10) || 1) : foundQty;
    if (isFound && foundQty > maxQty) return jsonOk({ success: false, error: 'Найдено больше, чем вычеркнуто (' + maxQty + ')' });

    sheet.getRange(rowNum, cols.status    + 1).setValue(result);
    sheet.getRange(rowNum, cols.foundCell + 1).setNumberFormat('@').setValue(isFound ? foundCell : '');
    sheet.getRange(rowNum, cols.foundQty  + 1).setValue(isFound ? foundQty : 0);
    sheet.getRange(rowNum, cols.employee  + 1).setValue(employeeName);
    sheet.getRange(rowNum, cols.searchAt  + 1).setNumberFormat('dd.MM.yyyy HH:mm:ss').setValue(new Date());

    var cache = CacheService.getScriptCache();
    cache.remove('VYCH_LOCK_' + data.key);
    cache.remove('VYCH_EMP_' + fbsNorm(employeeName));

    return jsonOk({ success: true });
  } finally {
    lock.releaseLock();
  }
}

/** POST releaseFbsVycherk { employeeId } — снять бронь при выходе. */
function handleReleaseFbsVycherk(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var employeeName = getEmployeeNameById(ss, data.employeeId);
  if (!employeeName) return jsonOk({ success: true });
  var cache  = CacheService.getScriptCache();
  var empKey = 'VYCH_EMP_' + fbsNorm(employeeName);
  var myKey  = cache.get(empKey);
  if (myKey) cache.remove('VYCH_LOCK_' + myKey);
  cache.remove(empKey);
  return jsonOk({ success: true });
}
