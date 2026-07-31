'use strict';

// ═══════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyVXJMkDo1w9cvKvxtbsTwb7lsrPT3vV_DwCcCsEyyuB26AmVtKTIzzd3jeRQMNJPDy/exec';

// ═══════════════════════════════════════════
//  GLOBAL STATE
// ═══════════════════════════════════════════
const state = {
  scriptUrl:    '',
  employeeId:   '',
  employeeName: '',
  planPercent:  null,
  missing: {
    tasks:        [],
    currentIndex: 0,
  },
};

// ═══════════════════════════════════════════
//  UI ELEMENT REFERENCES
// ═══════════════════════════════════════════
let ui = {};

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  loadSettings();
  setupEventListeners();
});

function initUI() {
  ui = {
    // Overlays
    loader:       document.getElementById('loaderOverlay'),
    loaderText:   document.getElementById('loaderText'),
    toastError:   document.getElementById('toastError'),
    toastSuccess: document.getElementById('toastSuccess'),
    welcomeChip:  document.getElementById('welcomeChip'),

    // Screens
    screens: {
      settings:  document.getElementById('screen-settings'),
      login:     document.getElementById('screen-login'),
      dashboard: document.getElementById('screen-dashboard'),
      missing:   document.getElementById('screen-missing'),
      bezshk:    document.getElementById('screen-bezshk'),
      bp:        document.getElementById('screen-bp'),
    },

    // Inputs
    scriptUrlInput:  document.getElementById('scriptUrlInput'),
    employeeIdInput: document.getElementById('employeeIdInput'),

    // Buttons
    btnSaveSettings:    document.getElementById('btnSaveSettings'),
    btnClearCache:      document.getElementById('btnClearCache'),
    btnLogin:           document.getElementById('btnLogin'),
    btnBackToSettings:  document.getElementById('btnBackToSettings'),
    btnMissing:         document.getElementById('btnMissing'),
    btnBezShk:          document.getElementById('btnBezShk'),
    btnBP:              document.getElementById('btnBP'),
    btnLogout:          document.getElementById('btnLogout'),
    btnBackFromMissing: document.getElementById('btnBackFromMissing'),
    btnBackFromBezShk:  document.getElementById('btnBackFromBezShk'),
    btnBackFromBP:      document.getElementById('btnBackFromBP'),
  };
}

// ═══════════════════════════════════════════
//  SCREEN MANAGEMENT
// ═══════════════════════════════════════════
function showScreen(id) {
  Object.values(ui.screens).forEach(s => s.classList.remove('active'));
  const screen = ui.screens[id];
  if (!screen) return;
  // Force animation restart
  screen.style.animation = 'none';
  void screen.offsetHeight; // reflow
  screen.style.animation = '';
  screen.classList.add('active');
}

// ═══════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════
function loadSettings() {
  const savedUrl = localStorage.getItem('rao_script_url');
  if (DEFAULT_SCRIPT_URL) {
    state.scriptUrl = DEFAULT_SCRIPT_URL;
    localStorage.setItem('rao_script_url', DEFAULT_SCRIPT_URL);
  } else {
    state.scriptUrl = savedUrl || '';
  }

  state.employeeId   = localStorage.getItem('rao_employee_id')     || '';
  state.employeeName = localStorage.getItem('rao_employee_name')   || '';

  if (ui.scriptUrlInput)  ui.scriptUrlInput.value  = state.scriptUrl;
  if (ui.employeeIdInput) ui.employeeIdInput.value = state.employeeId;

  if (!state.scriptUrl) {
    showScreen('settings');
  } else if (state.employeeId && state.employeeName) {
    updateWelcomeChip();
    showScreen('dashboard');
    fetchPlanPercent(); // подтянуть % плана в фоне
  } else {
    showScreen('login');
  }
}

function handleSaveSettings() {
  const url = ui.scriptUrlInput.value.trim();
  if (!url) {
    showError('Введите URL скрипта!');
    return;
  }
  if (!url.startsWith('https://script.google.com')) {
    showError('Неверный URL. Должен начинаться с https://script.google.com');
    return;
  }
  state.scriptUrl = url;
  localStorage.setItem('rao_script_url', url);
  showScreen('login');
}

// ═══════════════════════════════════════════
//  AUTHENTICATION
// ═══════════════════════════════════════════
async function handleLogin() {
  const id = ui.employeeIdInput.value.trim();
  if (!id) {
    showError('Введите ваш ID!');
    ui.employeeIdInput.focus();
    return;
  }

  showLoader('Проверка данных...');

  try {
    const result = await apiGet({ action: 'login', id });

    if (result.success) {
      state.employeeId   = String(result.employee.id);
      state.employeeName = result.employee.name;

      localStorage.setItem('rao_employee_id',   state.employeeId);
      localStorage.setItem('rao_employee_name', state.employeeName);

      hideLoader();
      updateWelcomeChip();
      showScreen('dashboard');
      showSuccess('Добро пожаловать, ' + firstName(state.employeeName) + '!');
      fetchPlanPercent(); // подтянуть % плана в фоне
    } else {
      hideLoader();
      showError(result.error || 'Сотрудник не найден');
    }
  } catch (err) {
    hideLoader();
    showError('Ошибка подключения. Проверьте интернет.');
    console.error('Login error:', err);
  }
}

function handleLogout() {
  state.employeeId   = '';
  state.employeeName = '';
  localStorage.removeItem('rao_employee_id');
  localStorage.removeItem('rao_employee_name');

  ui.employeeIdInput.value = '';
  ui.welcomeChip.style.display = 'none';
  ui.welcomeChip.textContent = '';

  showScreen('login');
}

function updateWelcomeChip() {
  if (state.employeeName) {
    ui.welcomeChip.textContent = state.employeeName;
    ui.welcomeChip.style.display = 'block';
  }
}

function firstName(fullName) {
  return fullName ? fullName.trim().split(' ')[0] : '';
}

// ═══════════════════════════════════════════
//  ПЛАН — ПРОЦЕНТ ВЫПОЛНЕНИЯ
// ═══════════════════════════════════════════
async function fetchPlanPercent() {
  if (!state.scriptUrl || !state.employeeId) return;
  try {
    const result = await apiGet({ action: 'getPlanPercent', id: state.employeeId });
    state.planPercent = result.success ? result.percent : null;
  } catch (err) {
    state.planPercent = null;
    console.warn('fetchPlanPercent error:', err);
  }
  updatePlanDisplay();
}

function updatePlanDisplay() {
  const fill = document.getElementById('planRingFill');
  const text = document.getElementById('planPctText');
  if (!fill || !text) return;

  const pct = state.planPercent;

  if (pct === null || pct === undefined) {
    text.textContent = '—';
    fill.setAttribute('stroke-dasharray', '0 100');
    fill.style.stroke = 'rgba(255,255,255,0.15)';
    return;
  }

  const val = Math.min(100, Math.max(0, Math.round(pct)));
  text.textContent = val + '%';
  fill.setAttribute('stroke-dasharray', val + ' ' + (100 - val));

  // Цвет по уровню выполнения
  if      (val >= 90) fill.style.stroke = '#10b981'; // зелёный
  else if (val >= 70) fill.style.stroke = '#6366f1'; // фиолет
  else if (val >= 50) fill.style.stroke = '#f59e0b'; // жёлтый
  else                fill.style.stroke = '#f43f5e'; // красный
}

// ═══════════════════════════════════════════
//  API HELPERS
// ═══════════════════════════════════════════
async function apiGet(params) {
  const url = new URL(state.scriptUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const resp = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-cache',
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function apiPost(data) {
  const resp = await fetch(state.scriptUrl, {
    method: 'POST',
    redirect: 'follow',
    cache: 'no-cache',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// ═══════════════════════════════════════════
//  UI UTILITIES
// ═══════════════════════════════════════════
let _toastTimer = null;

function showError(msg) {
  clearTimeout(_toastTimer);
  ui.toastSuccess.style.display = 'none';
  ui.toastError.textContent = msg;
  ui.toastError.style.display = 'block';
  _toastTimer = setTimeout(() => { ui.toastError.style.display = 'none'; }, 3500);
}

function showSuccess(msg) {
  clearTimeout(_toastTimer);
  ui.toastError.style.display = 'none';
  ui.toastSuccess.textContent = msg;
  ui.toastSuccess.style.display = 'block';
  _toastTimer = setTimeout(() => { ui.toastSuccess.style.display = 'none'; }, 3500);
}

function showLoader(text = 'Загрузка...') {
  ui.loaderText.textContent = text;
  ui.loader.style.display = 'flex';
}

function hideLoader() {
  ui.loader.style.display = 'none';
}

// ═══════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════
function setupEventListeners() {

  // Settings screen
  ui.btnSaveSettings.addEventListener('click', handleSaveSettings);
  ui.scriptUrlInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') handleSaveSettings();
  });
  ui.btnClearCache.addEventListener('click', () => {
    if (confirm('Сбросить все настройки приложения?')) {
      localStorage.clear();
      location.reload();
    }
  });

  // Login screen
  ui.btnLogin.addEventListener('click', handleLogin);
  ui.employeeIdInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') handleLogin();
  });
  ui.btnBackToSettings.addEventListener('click', () => showScreen('settings'));

  // Dashboard
  ui.btnMissing.addEventListener('click', () => {
    showScreen('missing');
    initMissingScreen();
  });
  ui.btnBezShk.addEventListener('click',  () => {
    showScreen('bezshk');
    initBezShkScreen();
  });
  ui.btnBP.addEventListener('click',      () => showScreen('bp'));
  ui.btnLogout.addEventListener('click',  handleLogout);

  // Back buttons
  ui.btnBackFromMissing.addEventListener('click', () => showScreen('dashboard'));
  ui.btnBackFromBezShk.addEventListener('click',  () => showScreen('dashboard'));
  ui.btnBackFromBP.addEventListener('click',      () => showScreen('dashboard'));

  // Missing module
  document.getElementById('btnMissingRefresh').addEventListener('click', initMissingScreen);
  document.getElementById('btnMissingRetry').addEventListener('click', initMissingScreen);
  document.getElementById('btnMissingBackToDash').addEventListener('click', () => showScreen('dashboard'));



  // Copy buttons
  document.getElementById('missing-barcode').addEventListener('click', function() {
    copyText(document.getElementById('missing-barcode-text').textContent, this);
  });
  document.getElementById('missing-key').addEventListener('click', function() {
    copyText(document.getElementById('missing-key-text').textContent, this);
  });
}

// ═══════════════════════════════════════════
//  ПОИСК МИССИНГА — MODULE
// ═══════════════════════════════════════════

/**
 * Вызывается при каждом входе в экран "Поиск Миссинга".
 * Загружает список задач, назначенных сотруднику.
 */
let missingSyncTimer = null;

function startMissingAutoSync() {
  stopMissingAutoSync();
  missingSyncTimer = setInterval(async () => {
    if (state.currentScreen !== 'screen-missing') {
      stopMissingAutoSync();
      return;
    }
    await refreshMissingTasksInBackground();
  }, 20000);
}

function stopMissingAutoSync() {
  if (missingSyncTimer) {
    clearInterval(missingSyncTimer);
    missingSyncTimer = null;
  }
}

async function refreshMissingTasksInBackground() {
  if (!state.scriptUrl || !state.employeeId) return;
  try {
    const result = await apiGet({ action: 'getMissingTasks', id: state.employeeId });
    if (result && result.success) {
      const newTasks = result.tasks || [];
      const newRazbor = result.razborTasks || [];

      state.missing.razborTasks = newRazbor;
      updateRazborBadge();

      const prevTask = state.missing.tasks[state.missing.currentIndex];
      state.missing.tasks = newTasks;

      if (newTasks.length === 0) {
        setMissingState('empty');
      } else {
        let foundIdx = -1;
        if (prevTask) {
          foundIdx = newTasks.findIndex(t => t.row === prevTask.row || t.barcode === prevTask.barcode);
        }
        state.missing.currentIndex = (foundIdx !== -1) ? foundIdx : 0;
        setMissingState('tasks');
        renderMissingTask();
      }
    }
  } catch(e) {}
}

async function initMissingScreen() {
  setMissingState('loading');
  fetchPlanPercent();
  startMissingAutoSync();

  try {
    const result = await apiGet({ action: 'getMissingTasks', id: state.employeeId });

    if (!result.success) {
      setMissingState('error', result.error || 'Ошибка получения задач');
      return;
    }

    state.missing.tasks        = result.tasks || [];
    state.missing.razborTasks  = result.razborTasks || [];
    state.missing.currentIndex = 0;
    updateRazborBadge();

    if (state.missing.tasks.length === 0) {
      setMissingState('empty');
    } else {
      setMissingState('tasks');
      renderMissingTask();
    }
  } catch (err) {
    setMissingState('error', 'Ошибка подключения к серверу');
    console.error('[Missing] load error:', err);
  }
}

/**
 * Переключает видимый под-экран внутри "screen-missing".
 * @param {'loading'|'empty'|'tasks'|'done'|'error'} name
 * @param {string} [message] - текст ошибки (только для 'error')
 */
function setMissingState(name, message) {
  ['loading', 'empty', 'tasks', 'done', 'error'].forEach(s => {
    const el = document.getElementById('missing-' + s);
    if (el) el.style.display = 'none';
  });

  const target = document.getElementById('missing-' + name);
  if (target) target.style.display = (name === 'tasks') ? 'flex' : 'flex';

  if (name === 'error' && message) {
    const msgEl = document.getElementById('missing-error-msg');
    if (msgEl) msgEl.textContent = message;
  }
}

/**
 * Рендерит карточку текущего товара и обновляет прогресс-бар.
 */
function renderMissingTask() {
  const tasks = state.missing.tasks;
  const idx   = state.missing.currentIndex;
  const task  = tasks[idx];
  if (!task) return;

  const total = tasks.length;
  const currentNum = idx + 1;
  const pct   = Math.round(((idx) / total) * 100);

  // Прогресс
  document.getElementById('missing-progress-text').textContent =
    `Задача ${currentNum} из ${total}`;
  document.getElementById('missing-progress-pct').textContent  = pct + '%';
  document.getElementById('missing-progress-bar').style.width  = pct + '%';

  // Копируемые поля
  const barcode = String(task.barcode || '');
  const key     = String(task.key     || '');
  document.getElementById('missing-barcode-text').textContent = barcode || '—';
  document.getElementById('missing-key-text').textContent     = key || '—';

  // Ссылка на WMS
  const wmsLinkEl = document.getElementById('missing-wms-link');
  if (wmsLinkEl) {
    wmsLinkEl.href = barcode ? `https://wms.uzum.uz/information/product/${encodeURIComponent(barcode)}` : '#';
  }

  // Сброс состояния "скопировано"
  ['missing-barcode', 'missing-key'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.remove('copied');
  });

  // Обычные поля
  const nameEl = document.getElementById('missing-name');
  if (nameEl) {
    nameEl.innerHTML = (task.result === 'На разбор')
      ? `<span class="razbor-card-tag">🔎 На разборе</span> ${task.name || '—'}`
      : (task.name || '—');
  }

  document.getElementById('missing-zone').textContent     = task.zone     || '—';
  document.getElementById('missing-process').textContent  = task.process  || '—';
  document.getElementById('missing-category').textContent = task.category || '—';
  document.getElementById('missing-qty').textContent      = (task.qty || 0) + ' шт.';
  document.getElementById('missing-price').textContent    = formatSum(task.priceTotal);
}

/**
 * Копирует текст в буфер обмена с визуальным фидбеком на кнопке.
 */
function copyText(text, btnEl) {
  if (!text || text === '—') return;
  const str = String(text);

  const onSuccess = () => {
    if (btnEl) {
      btnEl.classList.add('copied');
      setTimeout(() => btnEl.classList.remove('copied'), 1800);
    }
    showSuccess('Скопировано!');
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(str).then(onSuccess).catch(() => copyFallback(str, onSuccess));
  } else {
    copyFallback(str, onSuccess);
  }
}

function copyFallback(str, onSuccess) {
  const el = document.createElement('textarea');
  el.value = str;
  el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(el);
  el.select();
  try { document.execCommand('copy'); onSuccess(); } catch(e) {}
  document.body.removeChild(el);
}


/**
 * Отправляет результат (Найдено / Не найдено / + ошибка / На разбор) на сервер.
 * @param {string} result - значение кнопки (data-result)
 */
async function submitMissingResult(result, foundQty, foundKey, targetTask) {
  const task = targetTask || state.missing.tasks[state.missing.currentIndex];
  if (!task) return;

  // 1. Оптимистичное удаление/обновление локального состояния
  state.missing.tasks = state.missing.tasks.map(t => {
    if (t.row === task.row) {
      const item = {
        ...t,
        result: result,
        priceUnit: t.priceUnit || (t.priceTotal / (t.qty || 1)),
        foundKey: foundKey || t.key || '',
        priceTotal: t.priceTotal,
        qty: t.qty || 1,
        row: t.row,
        barcode: t.barcode,
        name: t.name,
        zone: t.zone,
        category: t.category,
        process: t.process,
        key: t.key
      };
      if (foundKey && String(foundKey).trim()) item.key = String(foundKey).trim();
      return item;
    }
    return t;
  }).filter(t => result === 'На разбор' || t.result === 'На разбор' || !t.result);

  state.missing.razborTasks = state.missing.razborTasks.map(t => {
    if (t.row === task.row) {
      const item = {
        ...t,
        result: result,
        priceUnit: t.priceUnit || (t.priceTotal / (t.qty || 1)),
        foundKey: foundKey || t.key || '',
        priceTotal: t.priceTotal,
        qty: t.qty || 1,
        row: t.row,
        barcode: t.barcode,
        name: t.name,
        zone: t.zone,
        category: t.category,
        process: t.process
      };
      if (foundKey && String(foundKey).trim()) item.key = String(foundKey).trim();
      return item;
    }
    return t;
  });

  if (result === 'На разбор') {
    if (!state.missing.razborTasks.some(t => t.row === task.row)) {
      state.missing.razborTasks.push({ ...task, result: 'На разбор' });
      updateRazborBadge();
    }
  }

  // Корректируем currentIndex, если он вышел за пределы массива оставшихся задач
  if (state.missing.currentIndex >= state.missing.tasks.length) {
    state.missing.currentIndex = Math.max(0, state.missing.tasks.length - 1);
  }

  // Обновляем отображение UI карточки и списка
  if (state.missing.tasks.length === 0) {
    setMissingState('empty');
  } else {
    renderMissingTask();
    renderTaskList();
  }

  // 2. Фоновая отправка на сервер
  try {
    const res = await apiPost({
      action:       'logMissingResult',
      employeeId:   state.employeeId,
      employeeName: state.employeeName,
      barcode:      task.barcode,
      name:         task.name,
      zone:         task.zone,
      category:     task.category,
      process:      task.process,
      key:          task.key,
      foundKey:     foundKey || task.key || '',
      result:       result,
      foundQty:     foundQty || null,
      priceUnit:    task.priceUnit || (task.priceTotal / (task.qty || 1)),
      priceTotal:   task.priceTotal,
      qty:          task.qty,
      row:          task.row,
    });
    fetchPlanPercent();
    return res;
  } catch (err) {
    console.error('[Missing] background submit error:', err);
    showError('Ошибка связи с сервером при отправке!');
  }
}

/**
 * Форматирует число как "1 234 567 сум".
 * @param {number|string} num
 * @returns {string}
 */
function formatSum(num) {
  if (num === null || num === undefined || num === '') return '—';
  const n = Number(num);
  if (isNaN(n)) return String(num);
  return n.toLocaleString('ru-RU') + ' сум';
}


// ═══════════════════════════════════════════
//  MISSING MODULE v2 — CONFIRMATION, RAZBOR, LIST VIEW
// ═══════════════════════════════════════════

// Расширяем state.missing
Object.assign(state.missing, {
  razborTasks:      [],
  pendingResult:    null,   // ожидает подтверждения (string)
  pendingIsRazbor:  false,  // true если pending из экрана разбора
  pendingRazborTask: null,  // задача из разбора для финального ответа
});



function updateRazborBadge() {
  const cnt = state.missing.razborTasks.length;
  const badge = document.getElementById('btnOpenRazbor');
  const span  = document.getElementById('razborCount');
  if (badge) badge.style.display = cnt > 0 ? 'flex' : 'none';
  if (span)  span.textContent = cnt;
}

// ── Переключение подсостояний (override v1) ─────────────
const _origSetMissingState = setMissingState;
setMissingState = function(name, message) {
  ['loading','empty','tasks','razbor','done','error'].forEach(s => {
    const el = document.getElementById('missing-' + s);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById('missing-' + name);
  if (target) target.style.display = 'flex';
  if (name === 'error' && message) {
    const msgEl = document.getElementById('missing-error-msg');
    if (msgEl) msgEl.textContent = message;
  }
};

// ── Confirmation bottom sheet ─────────────────────────────
function showConfirmation(result, isRazborFinal, razborTask) {
  state.missing.pendingResult     = result;
  state.missing.pendingIsRazbor   = !!isRazborFinal;
  state.missing.pendingRazborTask = razborTask || null;

  const currentTask = isRazborFinal ? razborTask : state.missing.tasks[state.missing.currentIndex];
  const maxQty = (currentTask && currentTask.qty) ? parseInt(currentTask.qty) || 1 : 1;
  const targetKey = (currentTask && currentTask.key) ? String(currentTask.key) : '';
  const isFound = (result === 'Найдено' || result === 'Найдено + ошибка');

  const titleEl = document.getElementById('confirmTitleText');
  if (titleEl) {
    titleEl.textContent = isFound
      ? 'Подтвердите данные найденного товара:'
      : 'Вы уверены, что хотите отметить товар?';
  }

  const labelEl = document.getElementById('confirmResultLabel');
  if (labelEl) {
    const emoji = {
      'Найдено':             '✅ Найдено',
      'Не найдено':          '❌ Не найдено',
      'Найдено + ошибка':    '✅⚠ Найдено + ошибка',
      'Не найдено + ошибка': '❌⚠ Не найдено + ошибка',
      'На разбор':           '🔎 На разбор',
    };
    labelEl.textContent = emoji[result] || result;
  }

  const foundWrap = document.getElementById('confirmFoundWrap');
  const qtyInput  = document.getElementById('confirmQtyInput');
  const qtyMaxSpan= document.getElementById('confirmQtyMax');
  const keyInput  = document.getElementById('confirmFoundKeyInput');

  if (isFound && foundWrap) {
    foundWrap.style.display = 'block';
    if (qtyInput) {
      qtyInput.value = maxQty;
      qtyInput.max = maxQty;
    }
    if (qtyMaxSpan) qtyMaxSpan.textContent = maxQty;
    if (keyInput) {
      keyInput.value = ''; // Пустое поле под сканирование
      setTimeout(() => keyInput.focus(), 150);
    }
  } else if (foundWrap) {
    foundWrap.style.display = 'none';
  }

  const overlay = document.getElementById('confirmOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function hideConfirmation() {
  state.missing.pendingResult     = null;
  state.missing.pendingIsRazbor   = false;
  state.missing.pendingRazborTask = null;
  const overlay = document.getElementById('confirmOverlay');
  if (overlay) overlay.style.display = 'none';
}

function highlightInvalidInput(el) {
  if (!el) return;
  el.focus();
  el.style.borderColor = '#ef4444';
  el.style.boxShadow = '0 0 14px rgba(239, 68, 68, 0.45)';
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
  }, 2200);
}

async function confirmAndSubmit() {
  const result   = state.missing.pendingResult;
  const isRazbor = state.missing.pendingIsRazbor;
  const rtask    = state.missing.pendingRazborTask;

  const isFound  = (result === 'Найдено' || result === 'Найдено + ошибка');
  let foundQty = null;
  let foundKey = null;

  if (isFound) {
    const qtyInput = document.getElementById('confirmQtyInput');
    if (qtyInput) foundQty = parseInt(qtyInput.value) || 1;

    const keyInput = document.getElementById('confirmFoundKeyInput');
    let rawKey = keyInput ? keyInput.value.trim().toUpperCase() : '';
    if (keyInput) keyInput.value = rawKey;

    if (!rawKey) {
      showError('Отсканируйте или введите ячейку!');
      highlightInvalidInput(keyInput);
      return;
    }

    // Жесткая валидация: обязательно с буквой в начале, ровно 5 блоков через точку (напр. M3.76.94.2.4)
    const cellRegex = /^[A-Z][A-Z0-9]*(\.[A-Z0-9]+){4}$/;
    if (!cellRegex.test(rawKey)) {
      showError('Формат должен быть с буквой: X.X.X.X.X (напр. M3.76.94.2.4)');
      highlightInvalidInput(keyInput);
      return;
    }

    foundKey = rawKey;
  }

  hideConfirmation();

  if (!result) return;

  if (isRazbor && rtask) {
    await submitRazborFinalResult(result, rtask, foundQty, foundKey);
  } else {
    await submitMissingResult(result, foundQty, foundKey);
  }
}

// ── Card / List view toggle ───────────────────────────────
function showCardView() {
  document.getElementById('missing-card-view').style.display = 'block';
  document.getElementById('missing-list-view').style.display = 'none';
}

function showListView() {
  document.getElementById('missing-card-view').style.display = 'none';
  document.getElementById('missing-list-view').style.display = 'block';
  renderTaskList();
}

function renderTaskList() {
  const container = document.getElementById('taskListItems');
  if (!container) return;

  const tasks   = state.missing.tasks;
  const current = state.missing.currentIndex;

  container.innerHTML = '';

  tasks.forEach((task, idx) => {
    const isCurrent = idx === current;
    const isRaz     = (task.result === 'На разбор');

    const statusIcon = isRaz ? '🔎' : isCurrent ? '▶' : '⬜';
    const cls = ['task-list-item'];
    if (isCurrent) cls.push('is-current');
    if (isRaz)     cls.push('is-razbor');

    const cleanZone = String(task.zone || '').replace(/\s*\([^)]*сектор[^)]*\)/gi, '').trim();
    const qtyStr    = (task.qty > 0) ? ` · ${task.qty} шт.` : '';

    const item = document.createElement('div');
    item.className = cls.join(' ');
    item.innerHTML = `
      <span class="tli-status">${statusIcon}</span>
      <div class="tli-info">
        <div class="tli-name">${task.name || '—'}</div>
        <div class="tli-meta">${task.key || ''} · ${cleanZone}${qtyStr}</div>
      </div>
      <span class="tli-price">${formatSum(task.priceTotal)}</span>`;

    item.addEventListener('click', () => {
      state.missing.currentIndex = idx;
      renderMissingTask();
      showCardView();
    });

    container.appendChild(item);
  });
}

// ── Razbor list screen ────────────────────────────────────
function openRazborScreen() {
  setMissingState('razbor');
  document.getElementById('razbor-list-view').style.display  = 'block';
  document.getElementById('razbor-card-view').style.display  = 'none';
  renderRazborList();
}

function closeRazborScreen() {
  setMissingState('tasks');
}

function renderRazborList() {
  const tasks   = state.missing.razborTasks;
  const cnt     = document.getElementById('razborListCount');
  if (cnt) cnt.textContent = tasks.length;

  const container = document.getElementById('razborListItems');
  if (!container) return;
  container.innerHTML = '';

  if (tasks.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:32px 0;">Список пуст</p>';
    return;
  }

  tasks.forEach(task => {
    const item = document.createElement('div');
    item.className = 'razbor-list-item';
    item.innerHTML = `
      <div class="rli-name">${task.name || '—'}</div>
      <div class="rli-meta">ШК: ${task.barcode || '—'} · Ячейка: ${task.key || '—'}</div>
      <div class="rli-price">${formatSum(task.priceTotal)}</div>`;
    item.addEventListener('click', () => openRazborItem(task));
    container.appendChild(item);
  });
}

function openRazborItem(task) {
  document.getElementById('razbor-list-view').style.display = 'none';
  document.getElementById('razbor-card-view').style.display = 'block';

  const barcode = String(task.barcode || '');
  document.getElementById('razbor-name').textContent         = task.name         || '—';
  document.getElementById('razbor-barcode-text').textContent = barcode           || '—';
  document.getElementById('razbor-key').textContent          = task.key          || '—';
  document.getElementById('razbor-zone').textContent         = task.zone         || '—';
  document.getElementById('razbor-process').textContent      = task.process      || '—';
  document.getElementById('razbor-category').textContent     = task.category     || '—';
  document.getElementById('razbor-qty').textContent          = (task.qty || 0)   + ' шт.';
  document.getElementById('razbor-price').textContent        = formatSum(task.priceTotal);

  // Ссылка на WMS в разборе
  const rwmsEl = document.getElementById('razbor-wms-link');
  if (rwmsEl) {
    rwmsEl.href = barcode ? `https://wms.uzum.uz/information/product/${encodeURIComponent(barcode)}` : '#';
  }

  // Запоминаем текущий разбор-товар для кнопок
  document.querySelectorAll('.razbor-final-btn').forEach(btn => {
    btn.onclick = () => showConfirmation(btn.dataset.result, true, task);
  });
}

async function submitRazborFinalResult(result, task, foundQty, foundKey) {
  document.querySelectorAll('.razbor-final-btn').forEach(b => b.disabled = true);
  try {
    await apiPost({
      action:       'logMissingResult',
      employeeId:   state.employeeId,
      employeeName: state.employeeName,
      barcode:      task.barcode,
      name:         task.name,
      zone:         task.zone,
      key:          task.key,
      result:       result,
      foundQty:     foundQty || null,
      row:          task.row,
    });

    showSuccess('Результат записан!');
    // Убираем из всех локальных списков
    state.missing.razborTasks = state.missing.razborTasks.filter(t => t.row !== task.row);
    state.missing.tasks       = state.missing.tasks.filter(t => t.row !== task.row);
    updateRazborBadge();

    if (state.missing.tasks.length === 0) {
      setMissingState('done');
    } else {
      document.getElementById('razbor-list-view').style.display = 'block';
      document.getElementById('razbor-card-view').style.display = 'none';
      renderRazborList();
    }
  } catch(e) {
    showError('Ошибка. Попробуйте снова.');
  } finally {
    document.querySelectorAll('.razbor-final-btn').forEach(b => b.disabled = false);
  }
}

// ── Event listeners v2 ───────────────────────────────────
(function setupMissingV2Listeners() {
  // Кнопки результата → показываем подтверждение (не прямой submit)
  document.querySelectorAll('.result-btn:not(.razbor-final-btn)').forEach(btn => {
    btn.onclick = () => showConfirmation(btn.dataset.result, false, null);
  });

  // Кнопка «На разбор»
  const rbRazbor = document.getElementById('rbRazbor');
  if (rbRazbor) rbRazbor.onclick = () => showConfirmation('На разбор', false, null);

  // Предотвращение случайной отправки по Enter от сканера штрихкодов
  const foundKeyInput = document.getElementById('confirmFoundKeyInput');
  if (foundKeyInput) {
    foundKeyInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this.blur();
      }
    });
  }

  // Кнопки - и + для ввода количества
  const btnMinus = document.getElementById('btnQtyMinus');
  const btnPlus  = document.getElementById('btnQtyPlus');
  const qtyInput = document.getElementById('confirmQtyInput');

  if (btnMinus && qtyInput) {
    btnMinus.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      let val = parseInt(qtyInput.value) || 1;
      if (val > 1) qtyInput.value = val - 1;
    });
  }
  if (btnPlus && qtyInput) {
    btnPlus.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      let val = parseInt(qtyInput.value) || 1;
      qtyInput.value = val + 1;
    });
  }

  // Копирование ШК в разборе
  const razborBcBtn = document.getElementById('razbor-barcode');
  if (razborBcBtn) {
    razborBcBtn.onclick = function() {
      copyText(document.getElementById('razbor-barcode-text').textContent, this);
    };
  }

  // Подтверждение
  document.getElementById('btnConfirmOk').addEventListener('click', confirmAndSubmit);
  document.getElementById('btnConfirmCancel').addEventListener('click', hideConfirmation);
  document.getElementById('confirmOverlay').addEventListener('click', function(e) {
    if (e.target === this) hideConfirmation();
  });

  // Список задач
  document.getElementById('btnShowList').addEventListener('click', showListView);
  document.getElementById('btnHideList').addEventListener('click', showCardView);

  // Разбор
  document.getElementById('btnOpenRazbor').addEventListener('click', openRazborScreen);
  document.getElementById('btnCloseRazbor').addEventListener('click', closeRazborScreen);
  document.getElementById('btnBackToRazborList').addEventListener('click', () => {
    document.getElementById('razbor-list-view').style.display = 'block';
    document.getElementById('razbor-card-view').style.display = 'none';
  });

  // ── БезШК Module Listeners ─────────────────────────────────
  const bMinus = document.getElementById('btnBezshkQtyMinus');
  const bPlus  = document.getElementById('btnBezshkQtyPlus');
  const bQty   = document.getElementById('bezshkQty');
  if (bMinus && bQty) {
    bMinus.addEventListener('click', e => {
      e.preventDefault();
      let v = parseInt(bQty.value) || 1;
      if (v > 1) bQty.value = v - 1;
    });
  }
  if (bPlus && bQty) {
    bPlus.addEventListener('click', e => {
      e.preventDefault();
      let v = parseInt(bQty.value) || 1;
      bQty.value = v + 1;
    });
  }

  // Сканер Enter на поле ШК БезШК
  const bBcInput = document.getElementById('bezshkBarcode');
  if (bBcInput) {
    bBcInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this.blur();
      }
    });
  }

  // Кнопки БезШК
  document.getElementById('btnBezshkShortage')?.addEventListener('click', () => handleBezshkAction('MISSING/SHORTAGE'));
  document.getElementById('btnBezshkIzlishek')?.addEventListener('click', () => handleBezshkAction('Излишек'));
  document.getElementById('btnBezshkBrak')?.addEventListener('click', () => handleBezshkAction('MISSING / БРАК'));
  document.getElementById('btnBezshkCompensated')?.addEventListener('click', () => handleBezshkAction('КОМПЕНСИРОВАН'));
  document.getElementById('btnBezshkConfirmOk')?.addEventListener('click', confirmAndSubmitBezshk);
  document.getElementById('btnBezshkCancel')?.addEventListener('click', hideBezshkConfirmation);
  document.getElementById('bezshkConfirmOverlay')?.addEventListener('click', function(e) {
    if (e.target === this) hideBezshkConfirmation();
  });
})();

// ═══════════════════════════════════════════
//  ОБРАБОТКА БЕЗШК — MODULE FUNCTIONS
// ═══════════════════════════════════════════
state.bezshk = {
  pendingBarcode: '',
  pendingQty: 1,
  pendingResult: ''
};

function initBezShkScreen() {
  fetchPlanPercent();
  const bcInput = document.getElementById('bezshkBarcode');
  const qtyInput = document.getElementById('bezshkQty');
  if (bcInput) {
    bcInput.value = '';
    setTimeout(() => bcInput.focus(), 150);
  }
  if (qtyInput) qtyInput.value = 1;
  hideBezshkConfirmation();
}

function handleBezshkAction(resultType) {
  const bcInput = document.getElementById('bezshkBarcode');
  const qtyInput = document.getElementById('bezshkQty');

  const barcode = bcInput ? bcInput.value.trim() : '';
  const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;

  // Валидация: строго 13 цифр
  if (!/^\d{13}$/.test(barcode)) {
    showError('Штрих код введен не правильно');
    highlightInvalidInput(bcInput);
    return;
  }

  state.bezshk.pendingBarcode = barcode;
  state.bezshk.pendingQty     = qty;
  state.bezshk.pendingResult  = resultType;

  showBezshkConfirmation();
}

function showBezshkConfirmation() {
  const labelEl   = document.getElementById('bezshkConfirmResultLabel');
  const summaryEl = document.getElementById('bezshkConfirmSummary');
  const overlay   = document.getElementById('bezshkConfirmOverlay');

  if (labelEl) {
    labelEl.textContent = (state.bezshk.pendingResult === 'Излишек')
      ? '➕ Излишек'
      : '⚠️ MISSING/SHORTAGE';
  }

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div><strong>ШК:</strong> ${state.bezshk.pendingBarcode}</div>
      <div><strong>Количество:</strong> ${state.bezshk.pendingQty} шт.</div>
    `;
  }

  if (overlay) overlay.style.display = 'flex';
}

function hideBezshkConfirmation() {
  const overlay = document.getElementById('bezshkConfirmOverlay');
  if (overlay) overlay.style.display = 'none';
}

async function confirmAndSubmitBezshk() {
  const btnOk     = document.getElementById('btnBezshkConfirmOk');
  const btnCancel = document.getElementById('btnBezshkCancel');
  if (btnOk) btnOk.disabled = true;
  if (btnCancel) btnCancel.disabled = true;

  try {
    const res = await apiPost({
      action:       'logBezShkResult',
      employeeId:   state.employeeId,
      employeeName: state.employeeName,
      barcode:      state.bezshk.pendingBarcode,
      qty:          state.bezshk.pendingQty,
      result:       state.bezshk.pendingResult
    });

    if (res && res.success) {
      showSuccess('Запись БезШК сохранена!');
      hideBezshkConfirmation();
      fetchPlanPercent();
      initBezShkScreen(); // Сброс для следующего сканирования
    } else {
      showError(res && res.error ? res.error : 'Ошибка записи!');
    }
  } catch(e) {
    showError('Ошибка соединения с сервером');
  } finally {
    if (btnOk) btnOk.disabled = false;
    if (btnCancel) btnCancel.disabled = false;
  }
}
