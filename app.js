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
      fbs:       document.getElementById('screen-fbs'),
      vozv:      document.getElementById('screen-vozv'),
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
    btnFBS:             document.getElementById('btnFBS'),
    btnLogout:          document.getElementById('btnLogout'),
    btnBackFromMissing: document.getElementById('btnBackFromMissing'),
    btnBackFromBezShk:  document.getElementById('btnBackFromBezShk'),
    btnBackFromBP:      document.getElementById('btnBackFromBP'),
    btnBackFromFBS:     document.getElementById('btnBackFromFBS'),
    btnFbsActs:         document.getElementById('btnFbsActs'),
    btnFbsVycherki:     document.getElementById('btnFbsVycherki'),
    btnBackToFbsSelectFromActs:     document.getElementById('btnBackToFbsSelectFromActs'),
    btnBackToFbsSelectFromVycherki: document.getElementById('btnBackToFbsSelectFromVycherki'),
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
  state.role         = localStorage.getItem('rao_role')            || 'staff';
  applyRole();

  if (ui.scriptUrlInput)  ui.scriptUrlInput.value  = state.scriptUrl;
  if (ui.employeeIdInput) ui.employeeIdInput.value = state.employeeId;

  if (!state.scriptUrl) {
    showScreen('settings');
  } else if (state.employeeId && state.employeeName) {
    updateWelcomeChip();
    showScreen('dashboard');
    if (state.role !== 'helper') fetchPlanPercent(); // подтянуть % плана в фоне
  } else {
    showScreen('login');
  }
}

// Роль: 'staff' — все блоки; 'helper' — только «Поиск вычерков (возвраты)»
function applyRole() {
  document.body.classList.toggle('role-helper', state.role === 'helper');
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
      state.role         = result.employee.role === 'helper' ? 'helper' : 'staff';

      localStorage.setItem('rao_employee_id',   state.employeeId);
      localStorage.setItem('rao_employee_name', state.employeeName);
      localStorage.setItem('rao_role',          state.role);
      applyRole();

      hideLoader();
      updateWelcomeChip();
      showScreen('dashboard');
      showSuccess('Добро пожаловать, ' + firstName(state.employeeName) + '!');
      if (state.role !== 'helper') fetchPlanPercent(); // подтянуть % плана в фоне
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
  releaseFbsAct();
  releaseFbsVycherk();
  state.employeeId   = '';
  state.employeeName = '';
  localStorage.removeItem('rao_employee_id');
  localStorage.removeItem('rao_employee_name');
  localStorage.removeItem('rao_role');
  state.role = 'staff';
  applyRole();

  ui.employeeIdInput.value = '';
  ui.welcomeChip.style.display = 'none';
  ui.welcomeChip.textContent = '';
  const header = document.getElementById('appHeader');
  if (header) header.classList.remove('is-auth');

  showScreen('login');
}

function updateWelcomeChip() {
  const header = document.getElementById('appHeader');
  if (header) header.classList.toggle('is-auth', !!state.employeeName);
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
    text.style.color = '';
    return;
  }

  const val = Math.min(100, Math.max(0, Math.round(pct)));
  text.textContent = (Math.round(pct * 100) / 100) + '%';
  fill.setAttribute('stroke-dasharray', val + ' ' + (100 - val));

  // Цвет по уровню выполнения:
  // До 50% — красный (#f43f5e)
  // От 50% до 99.99% — жёлтый (#f59e0b)
  // Начиная от 100% — зелёный (#10b981)
  if (pct >= 100) {
    fill.style.stroke = '#10b981';
    text.style.color = '#10b981';
  } else if (pct >= 50) {
    fill.style.stroke = '#f59e0b';
    text.style.color = '#f59e0b';
  } else {
    fill.style.stroke = '#f43f5e';
    text.style.color = '#f43f5e';
  }
}

// ═══════════════════════════════════════════
//  API HELPERS
// ═══════════════════════════════════════════
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return resp;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Превышено время ожидания ответа сервера (таймаут)');
    }
    throw err;
  }
}

async function apiGet(params) {
  const url = new URL(state.scriptUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const resp = await fetchWithTimeout(url.toString(), {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-cache',
  }, 30000);

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function apiPost(data) {
  const resp = await fetchWithTimeout(state.scriptUrl, {
    method: 'POST',
    redirect: 'follow',
    cache: 'no-cache',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data),
  }, 30000);

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
  ui.btnBP.addEventListener('click', () => {
    showScreen('bp');
    initBpScreen();
  });
  if (ui.btnFBS) {
    ui.btnFBS.addEventListener('click', () => {
      showScreen('fbs');
      renderFbsSubscreen('fbs-select-view');
    });
  }
  ui.btnLogout.addEventListener('click',  handleLogout);

  // Back buttons
  ui.btnBackFromMissing.addEventListener('click', () => showScreen('dashboard'));
  ui.btnBackFromBezShk.addEventListener('click',  () => showScreen('dashboard'));
  ui.btnBackFromBP.addEventListener('click', () => {
    if (state.bp && state.bp.currentSubscreen === 'bp-task-view') {
      exitBpZone();
    } else {
      showScreen('dashboard');
    }
  });
  if (ui.btnBackFromFBS) {
    ui.btnBackFromFBS.addEventListener('click', () => {
      if (state.fbs && (state.fbs.currentSubscreen === 'fbs-acts-view' || state.fbs.currentSubscreen === 'fbs-vycherki-view')) {
        if (state.fbs.currentSubscreen === 'fbs-acts-view') releaseFbsAct();
        if (state.fbs.currentSubscreen === 'fbs-vycherki-view') releaseFbsVycherk();
        renderFbsSubscreen('fbs-select-view');
      } else {
        showScreen('dashboard');
      }
    });
  }

  // FBS directions listeners
  if (ui.btnFbsActs) {
    ui.btnFbsActs.addEventListener('click', () => {
      renderFbsSubscreen('fbs-acts-view');
      initFbsActsScreen();
    });
  }
  if (ui.btnFbsVycherki) {
    ui.btnFbsVycherki.addEventListener('click', () => {
      renderFbsSubscreen('fbs-vycherki-view');
      initFbsVycherkiScreen();
    });
  }
  if (ui.btnBackToFbsSelectFromActs) {
    ui.btnBackToFbsSelectFromActs.addEventListener('click', () => {
      renderFbsSubscreen('fbs-select-view');
    });
  }
  if (ui.btnBackToFbsSelectFromVycherki) {
    ui.btnBackToFbsSelectFromVycherki.addEventListener('click', () => {
      renderFbsSubscreen('fbs-select-view');
    });
  }

  setupBpEventListeners();
  setupFbsActsEventListeners();
  setupFbsVycherkiEventListeners();
  setupVozvEventListeners();

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
  const cardEl = document.getElementById('missing-card-view');
  if (cardEl) {
    cardEl.classList.remove('card-refresh-flash');
    void cardEl.offsetHeight; // Force reflow
    cardEl.classList.add('card-refresh-flash');
  }

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

  const zoneEl = document.getElementById('missing-zone');
  if (zoneEl) zoneEl.textContent = task.zone || '—';
  const procEl = document.getElementById('missing-process');
  if (procEl) procEl.textContent = task.process || '—';
  const catEl = document.getElementById('missing-category');
  if (catEl) catEl.textContent = task.category || '—';
  const qtyEl = document.getElementById('missing-qty');
  if (qtyEl) qtyEl.textContent = (task.qty || 0) + ' шт.';
  const priceEl = document.getElementById('missing-price');
  if (priceEl) priceEl.textContent = formatSum(task.priceTotal);
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

  // Показываем мгновенное пуш-уведомление
  showSuccess(result === 'Перезапись / Товар найден' ? 'Товар найден и перезаписан! 🔄' : 'Запись сохранена! ✅');

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
      'Найдено':                   '✅ Найдено',
      'Не найдено':                '❌ Не найдено',
      'Найдено + ошибка':          '✅⚠ Найдено + ошибка',
      'Не найдено + ошибка':       '❌⚠ Не найдено + ошибка',
      'На разбор':                 '🔎 На разбор',
      'Перезапись / Товар найден': '🔄 Перезапись / Товар найден',
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

  const finalResult = result;

  const isFound  = (finalResult === 'Найдено' || finalResult === 'Найдено + ошибка');
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

  if (!finalResult) return;

  if (isRazbor && rtask) {
    await submitRazborFinalResult(finalResult, rtask, foundQty, foundKey);
  } else {
    await submitMissingResult(finalResult, foundQty, foundKey);
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

    const procStr = String(task.process || '').trim();
    const keyStr  = String(task.key || '').trim();
    const qtyStr  = (task.qty > 0) ? `${task.qty} шт.` : '';

    const metaParts = [];
    if (keyStr)  metaParts.push(keyStr);
    if (procStr) metaParts.push(procStr);
    if (qtyStr)  metaParts.push(qtyStr);

    const metaText = metaParts.join(' · ');

    const item = document.createElement('div');
    item.className = cls.join(' ');
    item.innerHTML = `
      <span class="tli-status">${statusIcon}</span>
      <div class="tli-info">
        <div class="tli-name">${task.name || '—'}</div>
        <div class="tli-meta">${metaText}</div>
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
  const rZoneEl = document.getElementById('razbor-zone');
  if (rZoneEl) rZoneEl.textContent = task.zone || '—';
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
      zone:         task.zone || '',
      category:     task.category || '',
      process:      task.process || '',
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

  // Кнопка «Перезапись / Товар найден»
  const rbSkip = document.getElementById('rbSkip');
  if (rbSkip) rbSkip.onclick = () => showConfirmation('Перезапись / Товар найден', false, null);

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

  // Сканер Enter на поле ШК БезШК (без вызова blur, предотвращает зависание TSD)
  const bBcInput = document.getElementById('bezshkBarcode');
  if (bBcInput) {
    bBcInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
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

function getBezshkHistoryKey() {
  return 'rao_bezshk_history_' + (state.employeeId || 'default');
}

function getBezshkHistory() {
  try {
    const raw = localStorage.getItem(getBezshkHistoryKey());
    return raw ? JSON.parse(raw) : [];
  } catch(e) {
    return [];
  }
}

function addBezShkHistoryItem(item) {
  let history = getBezshkHistory();
  history.unshift(item);
  if (history.length > 10) history = history.slice(0, 10);
  try {
    localStorage.setItem(getBezshkHistoryKey(), JSON.stringify(history));
  } catch(e) {}
  renderBezShkHistory();
}

function renderBezShkHistory() {
  const container = document.getElementById('bezshkHistoryList');
  const countEl   = document.getElementById('bezshkHistoryCount');
  if (!container) return;

  const history = getBezshkHistory();
  if (countEl) countEl.textContent = `${history.length}/10`;

  container.innerHTML = '';

  if (history.length === 0) {
    container.innerHTML = '<div class="bezshk-history-empty">История обработанных ШК пуста</div>';
    return;
  }

  const badgeMap = {
    'Излишек':          { text: '➕ Излишек',          cls: 'bhi-badge-izlishek' },
    'MISSING/SHORTAGE': { text: '⚠️ SHORTAGE',         cls: 'bhi-badge-shortage' },
    'MISSING / БРАК':   { text: '🚨 БРАК',             cls: 'bhi-badge-brak' },
    'КОМПЕНСИРОВАН':    { text: '💳 КОМПЕНСИРОВАН',    cls: 'bhi-badge-compensated' }
  };

  history.forEach(item => {
    const badgeInfo = badgeMap[item.result] || { text: item.result, cls: '' };
    const el = document.createElement('div');
    el.className = 'bhi-item';
    el.innerHTML = `
      <div class="bhi-left">
        <span class="bhi-barcode">${item.barcode || '—'}</span>
        <span class="bhi-meta">${item.qty || 1} шт. · ${item.time || ''}</span>
      </div>
      <span class="bhi-badge ${badgeInfo.cls}">${badgeInfo.text}</span>
    `;
    container.appendChild(el);
  });
}

function initBezShkScreen() {
  fetchPlanPercent();
  const bcInput = document.getElementById('bezshkBarcode');
  const qtyInput = document.getElementById('bezshkQty');
  if (bcInput) {
    bcInput.value = '';
    setTimeout(() => {
      try { bcInput.focus(); } catch(e) {}
    }, 150);
  }
  if (qtyInput) qtyInput.value = 1;
  hideBezshkConfirmation();
  renderBezShkHistory();
}

function handleBezshkAction(resultType) {
  const bcInput = document.getElementById('bezshkBarcode');
  const qtyInput = document.getElementById('bezshkQty');

  // Очистка от переносов строк, пробелов и управляющих символов сканера
  const rawValue = bcInput ? bcInput.value : '';
  const barcode  = rawValue.replace(/[^\d]/g, '').trim();
  const qty      = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;

  // Проверка корректности ШК (допускается от 7 до 15 цифр, охватывает все стандартные штрихкоды)
  if (!barcode || barcode.length < 7 || barcode.length > 15) {
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
    const resMap = {
      'Излишек':          '➕ Излишек',
      'MISSING/SHORTAGE': '⚠️ MISSING/SHORTAGE',
      'MISSING / БРАК':   '🚨 MISSING / БРАК',
      'КОМПЕНСИРОВАН':    '💳 КОМПЕНСИРОВАН'
    };
    labelEl.textContent = resMap[state.bezshk.pendingResult] || state.bezshk.pendingResult;
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
      const now = new Date();
      const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      addBezShkHistoryItem({
        barcode: state.bezshk.pendingBarcode,
        qty:     state.bezshk.pendingQty,
        result:  state.bezshk.pendingResult,
        time:    timeStr
      });
      showSuccess('Запись БезШК сохранена!');
      hideBezshkConfirmation();
      const bcInput = document.getElementById('bezshkBarcode');
      const qtyInput = document.getElementById('bezshkQty');
      if (bcInput) bcInput.value = '';
      if (qtyInput) qtyInput.value = 1;
      setTimeout(() => {
          try { if (bcInput) bcInput.focus(); } catch(e) {}
      }, 100);
      fetchPlanPercent();
    } else {
      showError(res && res.error ? res.error : 'Ошибка записи!');
    }
  } catch(e) {
    showError(e.message || 'Ошибка соединения с сервером');
  } finally {
    if (btnOk) btnOk.disabled = false;
    if (btnCancel) btnCancel.disabled = false;
  }
}

// ═══════════════════════════════════════════
//  ПОИСК БП (БИЗНЕС ПОДДЕРЖКА) — MODULE FUNCTIONS
// ═══════════════════════════════════════════

state.bp = {
  tasks: [],
  locks: [],
  warehouse: 'Фулфилмент',
  selectedFloor: '',
  filteredTasks: [],
  currentIndex: 0,
  currentFoundQty: 0,
  currentSubscreen: 'bp-select-view'
};

async function initBpScreen() {
  renderBpSubscreen('bp-select-view');
  showLoader('Загрузка задач БП...');
  try {
    const res = await apiGet({ action: 'getBpTasks' });
    if (res && res.success) {
      state.bp.tasks = res.tasks || [];
      state.bp.locks = res.locks || [];
      updateBpWarehouseTabs();
      renderBpFloorGrid();
    } else {
      const errText = (res && res.error) ? res.error : 'Ошибка загрузки задач БП';
      if (errText.indexOf('Неизвестный action') !== -1) {
        showError('Необходим деплой Code.gs в Google Apps Script!');
      } else {
        showError(errText);
      }
    }
  } catch (err) {
    showError(err && err.message ? err.message : 'Ошибка связи с сервером при получении задач БП');
  } finally {
    hideLoader();
  }
}

function renderBpSubscreen(subscreenId) {
  state.bp.currentSubscreen = subscreenId;
  const subscreens = ['bp-select-view', 'bp-task-view', 'bp-done-view'];
  subscreens.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === subscreenId) ? 'block' : 'none';
  });
}

function isEmployeeMatchJS(a, b) {
  const strA = String(a || '').trim().toLowerCase();
  const strB = String(b || '').trim().toLowerCase();
  if (!strA || !strB) return false;
  return strA === strB || strA.indexOf(strB) !== -1 || strB.indexOf(strA) !== -1;
}

function updateBpWarehouseTabs() {
  const fulfillmentTasks = state.bp.tasks.filter(t => t.warehouse === 'Фулфилмент');
  const sergeliTasks     = state.bp.tasks.filter(t => t.warehouse === 'Сергели');
  const personalTasks    = state.bp.tasks.filter(t => isEmployeeMatchJS(t.assignedTo, state.employeeName));

  const tabFulfillment = document.getElementById('bpTabFulfillment');
  const tabSergeli     = document.getElementById('bpTabSergeli');
  const tabPersonal    = document.getElementById('bpTabPersonal');

  if (tabFulfillment) tabFulfillment.textContent = `Фулфилмент (${fulfillmentTasks.length})`;
  if (tabSergeli)     tabSergeli.textContent     = `Сергели (${sergeliTasks.length})`;
  if (tabPersonal)    tabPersonal.textContent    = `На мне (${personalTasks.length})`;
}

function renderBpFloorGrid() {
  const gridContainer = document.getElementById('bpFloorSelectGrid');
  const noTasksMsg    = document.getElementById('bpNoTasksMsg');
  const startBtn      = document.getElementById('btnBpStartSearch');
  if (!gridContainer) return;

  gridContainer.innerHTML = '';
  state.bp.selectedFloor = '';
  if (startBtn) startBtn.disabled = true;

  let whTasks = [];
  if (state.bp.warehouse === 'Назначено мне') {
    whTasks = state.bp.tasks.filter(t => isEmployeeMatchJS(t.assignedTo, state.employeeName));
  } else {
    whTasks = state.bp.tasks.filter(t => t.warehouse === state.bp.warehouse);
  }

  if (whTasks.length === 0) {
    if (noTasksMsg) noTasksMsg.style.display = 'block';
    return;
  } else {
    if (noTasksMsg) noTasksMsg.style.display = 'none';
  }

  // Группировка по этажам (например M1, M2, S1 из ячейки M1.76.5.1)
  const floorMap = {};
  whTasks.forEach(task => {
    const parts = (task.cell || '').split('.');
    const floor = parts[0] || 'Прочие';
    if (!floorMap[floor]) floorMap[floor] = [];
    floorMap[floor].push(task);
  });

  const floors = Object.keys(floorMap).sort();

  const isPersonalTab = (state.bp.warehouse === 'Назначено мне');

  floors.forEach(floor => {
    const count = floorMap[floor].length;
    const lock  = isPersonalTab ? null : state.bp.locks.find(l => l.warehouse === state.bp.warehouse && l.floor === floor);

    const btn = document.createElement('button');
    btn.className = 'grid-option-btn';
    btn.type = 'button';

    if (lock) {
      if (isEmployeeMatchJS(lock.employee, state.employeeName)) {
        btn.classList.add('active');
        btn.innerHTML = `
          <div class="opt-val">${floor}</div>
          <div class="opt-sub">${count} ячеек (Ваша бронь)</div>
        `;
      } else {
        btn.disabled = true;
        btn.classList.add('locked');
        btn.innerHTML = `
          <div class="opt-val" style="color: #f43f5e;">🔒 ${floor}</div>
          <div class="opt-sub" style="color: #f43f5e; font-weight: 700;">Занят: ${lock.employee}</div>
        `;
      }
    } else {
      const subLabel = isPersonalTab ? `${count} ячеек` : `${count} ячеек`;
      btn.innerHTML = `
        <div class="opt-val">${floor}</div>
        <div class="opt-sub">${subLabel}</div>
      `;
    }

    if (!lock || isEmployeeMatchJS(lock.employee, state.employeeName)) {
      btn.onclick = () => {
        document.querySelectorAll('#bpFloorSelectGrid .grid-option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.bp.selectedFloor = floor;
        if (startBtn) startBtn.disabled = false;
      };
    }

    gridContainer.appendChild(btn);
  });
}

function parseCellSegments(cellStr) {
  const str = String(cellStr || '').trim().toUpperCase();
  const parts = str.split('.');
  return parts.map(part => {
    const num = parseInt(part.replace(/\D/g, ''));
    return {
      raw: part,
      num: isNaN(num) ? 0 : num
    };
  });
}

function compareCellsAsc(cellA, cellB) {
  const segsA = parseCellSegments(cellA);
  const segsB = parseCellSegments(cellB);
  const maxLen = Math.max(segsA.length, segsB.length);

  for (let i = 0; i < maxLen; i++) {
    const a = segsA[i];
    const b = segsB[i];
    if (!a) return -1;
    if (!b) return 1;

    if (a.raw !== b.raw) {
      if (a.num !== b.num) {
        return a.num - b.num;
      }
      return a.raw.localeCompare(b.raw, undefined, { numeric: true });
    }
  }
  return 0;
}

async function startBpSearch() {
  if (!state.bp.selectedFloor) return;
  showLoader('Зазервирование зоны...');
  try {
    const lockRes = await apiPost({
      action: 'lockBpZone',
      warehouse: state.bp.warehouse,
      floor: state.bp.selectedFloor,
      employee: state.employeeName
    });

    if (lockRes && !lockRes.success) {
      if (lockRes.error && lockRes.error.indexOf('Неизвестный action') !== -1) {
        showError('Обновите деплой Code.gs в Apps Script!');
      } else {
        showError(lockRes.error || 'Не удалось заблокировать зону');
        hideLoader();
        initBpScreen();
        return;
      }
    }

    // Фильтруем задачи выбранного этажа
    let whTasks = [];
    if (state.bp.warehouse === 'Назначено мне') {
      whTasks = state.bp.tasks.filter(t => isEmployeeMatchJS(t.assignedTo, state.employeeName));
    } else {
      whTasks = state.bp.tasks.filter(t => t.warehouse === state.bp.warehouse);
    }

    state.bp.filteredTasks = whTasks.filter(t => (t.cell || '').indexOf(state.bp.selectedFloor) === 0);
    state.bp.filteredTasks.sort((a, b) => compareCellsAsc(a.cell, b.cell));
    state.bp.currentIndex = 0;

    if (state.bp.filteredTasks.length === 0) {
      renderBpSubscreen('bp-done-view');
    } else {
      renderBpSubscreen('bp-task-view');
      renderBpTaskCard();
    }
  } catch (e) {
    showError(e && e.message ? e.message : 'Ошибка блокировки зоны!');
  } finally {
    hideLoader();
  }
}

function renderBpTaskCard() {
  const tasks = state.bp.filteredTasks;
  if (state.bp.currentIndex >= tasks.length) {
    renderBpSubscreen('bp-done-view');
    return;
  }

  const task = tasks[state.bp.currentIndex];
  state.bp.currentFoundQty = task.targetQty || 1;

  // Элементы
  const progressLabel = document.getElementById('bpTaskProgressLabel');
  const percentLabel  = document.getElementById('bpTaskPercentLabel');
  const progressBar   = document.getElementById('bpTaskProgressBar');

  const total = tasks.length;
  const curr  = state.bp.currentIndex + 1;
  const pct   = Math.round(((curr - 1) / total) * 100);

  if (progressLabel) progressLabel.textContent = `Товар ${curr} из ${total}`;
  if (percentLabel)  percentLabel.textContent  = `${pct}%`;
  if (progressBar)   progressBar.style.width   = `${pct}%`;

  const cellEl        = document.getElementById('bpTaskCell');
  const productLinkEl = document.getElementById('bpTaskProductLink');
  const barcodeTextEl = document.getElementById('bpTaskBarcodeText');
  const wmsLinkEl     = document.getElementById('bpTaskWmsLink');
  const targetQtyEl   = document.getElementById('bpTaskTargetQty');
  const cellsCountEl  = document.getElementById('bpTaskCellsCount');
  const qtyValEl      = document.getElementById('bpQtyVal');

  if (cellEl) cellEl.textContent = task.cell || '—';

  const pId = task.productId || task.skuId || '';
  if (productLinkEl) {
    if (pId) {
      productLinkEl.href = `https://uzum.uz/product/${pId}`;
      productLinkEl.style.display = 'flex';
    } else {
      productLinkEl.style.display = 'none';
    }
  }

  if (barcodeTextEl) barcodeTextEl.textContent = task.barcode || '—';

  if (wmsLinkEl) {
    wmsLinkEl.href = `https://wms.uzum.uz/information/product/${task.barcode}`;
  }

  if (targetQtyEl)  targetQtyEl.textContent = `${task.targetQty || 1} шт.`;
  if (cellsCountEl) cellsCountEl.textContent = task.totalCellsCount || 1;

  if (qtyValEl) qtyValEl.textContent = state.bp.currentFoundQty;
}

function updateBpQty(delta) {
  const task = state.bp.filteredTasks[state.bp.currentIndex];
  const maxQty = task ? (task.targetQty || 999) : 999;
  let newQty = state.bp.currentFoundQty + delta;
  if (newQty < 0) newQty = 0;
  if (newQty > maxQty) newQty = maxQty;
  state.bp.currentFoundQty = newQty;
  const qtyValEl = document.getElementById('bpQtyVal');
  if (qtyValEl) qtyValEl.textContent = newQty;
}

function showBpConfirmation(resultType) {
  const tasks = state.bp.filteredTasks;
  if (state.bp.currentIndex >= tasks.length) return;
  const task = tasks[state.bp.currentIndex];

  state.bp.pendingResult = resultType;

  const overlay   = document.getElementById('bpConfirmOverlay');
  const titleEl   = document.getElementById('bpConfirmTitleText');
  const labelEl   = document.getElementById('bpConfirmResultLabel');
  const summaryEl = document.getElementById('bpConfirmSummary');
  const foundWrap = document.getElementById('bpConfirmFoundKeyWrap');
  const foundInput= document.getElementById('bpConfirmFoundKeyInput');

  const isFound = (resultType === 'Найдено');

  if (titleEl) {
    titleEl.textContent = isFound
      ? 'Подтвердите данные решения'
      : 'Подтвердите отказ от поиска';
  }

  if (labelEl) {
    labelEl.textContent = isFound ? '✅ Найдено' : '❌ Не найдено';
    labelEl.className = isFound ? 'bp-modal-badge' : 'bp-modal-badge badge-notfound';
  }

  const foundQty = isFound ? (state.bp.currentFoundQty || task.targetQty || 1) : 0;

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="bp-summary-card">
        <span class="bp-summary-key">Ячейка поиска</span>
        <span class="bp-summary-val monospace" style="color: #818cf8;">${task.cell}</span>
      </div>
      <div class="bp-summary-card">
        <span class="bp-summary-key">Штрихкод (ШК)</span>
        <span class="bp-summary-val monospace">${task.barcode}</span>
      </div>
      <div class="bp-summary-card" style="grid-column: span 2;">
        <span class="bp-summary-key">Найденное количество</span>
        <span class="bp-summary-val" style="color: ${isFound ? '#34d399' : '#f43f5e'}; font-size: 1.1rem;">
          ${foundQty} шт. <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">(из ${task.targetQty || 1} шт.)</span>
        </span>
      </div>
    `;
  }

  if (foundWrap) {
    foundWrap.style.display = isFound ? 'flex' : 'none';
  }

  if (foundInput && isFound) {
    foundInput.value = task.cell;
    setTimeout(() => {
      try { foundInput.focus(); foundInput.select(); } catch(e) {}
    }, 150);
  }

  if (overlay) overlay.style.display = 'flex';
}

function hideBpConfirmation() {
  const overlay = document.getElementById('bpConfirmOverlay');
  if (overlay) overlay.style.display = 'none';
}

async function confirmAndSubmitBpModal() {
  const resultType = state.bp.pendingResult || 'Найдено';
  const tasks = state.bp.filteredTasks;
  if (state.bp.currentIndex >= tasks.length) return;
  const task = tasks[state.bp.currentIndex];

  let foundKey = null;
  if (resultType === 'Найдено') {
    const input = document.getElementById('bpConfirmFoundKeyInput');
    const val = input ? input.value.trim().toUpperCase() : '';
    if (!val) {
      showError('Отсканируйте или введите ячейку!');
      highlightInvalidInput(input);
      return;
    }
    foundKey = val;
  }

  hideBpConfirmation();
  await submitBpTaskResult(resultType, foundKey);
}

async function submitBpTaskResult(resultType, foundKey) {
  const tasks = state.bp.filteredTasks;
  if (state.bp.currentIndex >= tasks.length) return;
  const task = tasks[state.bp.currentIndex];

  let foundQty = 0;
  if (resultType === 'Найдено') {
    foundQty = state.bp.currentFoundQty;
  } else {
    foundQty = 0;
  }

  showLoader('Сохранение результата БП...');

  try {
    const res = await apiPost({
      action: 'logBpResult',
      rowIndex: task.rowIndex,
      barcode: task.barcode,
      cell: task.cell,
      foundKey: foundKey || task.cell,
      foundQty: foundQty,
      employeeId: state.employeeId,
      employeeName: state.employeeName
    });

    if (res && res.success) {
      showSuccess(foundQty > 0 ? 'Товар найден! ✅' : 'Запись сохранена! ✅');
      state.bp.currentIndex++;
      fetchPlanPercent();

      if (state.bp.currentIndex >= tasks.length) {
        renderBpSubscreen('bp-done-view');
      } else {
        renderBpTaskCard();
      }
    } else {
      showError(res && res.error ? res.error : 'Ошибка записи БП');
    }
  } catch (e) {
    showError(e.message || 'Ошибка связи с сервером');
  } finally {
    hideLoader();
  }
}

async function exitBpZone() {
  if (state.bp.selectedFloor && state.employeeName) {
    try {
      await apiPost({
        action: 'unlockBpZone',
        warehouse: state.bp.warehouse,
        floor: state.bp.selectedFloor,
        employee: state.employeeName
      });
    } catch (e) {}
  }
  initBpScreen();
}

function setupBpEventListeners() {
  const btnRefresh = document.getElementById('btnBpRefreshTasks');
  if (btnRefresh) btnRefresh.onclick = initBpScreen;

  // Переключение складов
  const warehouseSelect = document.getElementById('bpWarehouseSelect');
  if (warehouseSelect) {
    warehouseSelect.querySelectorAll('.segment-btn').forEach(btn => {
      btn.onclick = () => {
        warehouseSelect.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.bp.warehouse = btn.dataset.value;
        renderBpFloorGrid();
      };
    });
  }

  // Кнопка «Начать поиск»
  const btnStart = document.getElementById('btnBpStartSearch');
  if (btnStart) btnStart.onclick = startBpSearch;

  // Копирование ШК в задаче БП
  const bpBarcodeBtn = document.getElementById('bpTaskBarcode');
  if (bpBarcodeBtn) {
    bpBarcodeBtn.onclick = function() {
      const txt = document.getElementById('bpTaskBarcodeText');
      if (txt) copyText(txt.textContent, this);
    };
  }

  // Количество +/-
  const btnMinus = document.getElementById('btnBpQtyMinus');
  const btnPlus  = document.getElementById('btnBpQtyPlus');
  if (btnMinus) btnMinus.onclick = () => updateBpQty(-1);
  if (btnPlus)  btnPlus.onclick  = () => updateBpQty(1);

  // Кнопки решений
  const btnFound    = document.getElementById('btnBpFound');
  const btnNotFound = document.getElementById('btnBpNotFound');
  const btnSkip     = document.getElementById('btnBpSkip');
  const btnExit     = document.getElementById('btnBpExit');
  const btnDoneBack = document.getElementById('btnBpDoneBack');

  if (btnFound)    btnFound.onclick    = () => showBpConfirmation('Найдено');
  if (btnNotFound) btnNotFound.onclick = () => showBpConfirmation('Не найдено');
  if (btnSkip)     btnSkip.onclick     = () => {
    state.bp.currentIndex++;
    if (state.bp.currentIndex >= state.bp.filteredTasks.length) {
      renderBpSubscreen('bp-done-view');
    } else {
      renderBpTaskCard();
    }
  };

  const btnCancelModal  = document.getElementById('btnBpCancelModal');
  const btnConfirmOk    = document.getElementById('btnBpConfirmModalOk');
  if (btnCancelModal) btnCancelModal.onclick = hideBpConfirmation;
  if (btnConfirmOk)   btnConfirmOk.onclick   = confirmAndSubmitBpModal;
  if (btnExit)     btnExit.onclick     = exitBpZone;
  if (btnDoneBack) btnDoneBack.onclick = exitBpZone;
}

// ═══════════════════════════════════════════
//  FBS MODULE
// ═══════════════════════════════════════════
function renderFbsSubscreen(subscreenId) {
  if (!state.fbs) state.fbs = {};
  state.fbs.currentSubscreen = subscreenId;
  const subscreens = ['fbs-select-view', 'fbs-acts-view', 'fbs-vycherki-view'];
  subscreens.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === subscreenId) ? 'flex' : 'none';
  });

  const tagEl = document.getElementById('fbsCurrentTag');
  if (tagEl) {
    if (subscreenId === 'fbs-acts-view') {
      tagEl.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        Поиск актов
      `;
    } else if (subscreenId === 'fbs-vycherki-view') {
      tagEl.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          <line x1="9" y1="11" x2="15" y2="17"/>
          <line x1="15" y1="11" x2="9" y2="17"/>
        </svg>
        Поиск вычерков
      `;
    } else {
      tagEl.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
        Поиск FBS
      `;
    }
  }
}


// ═══════════════════════════════════════════
//  FBS — ПОИСК АКТОВ
//  Сервер выдаёт сотруднику один акт (бронь), внутри — позиции
//  в порядке листа сверху вниз. После последней позиции акта
//  автоматически подгружается следующий свободный акт.
// ═══════════════════════════════════════════
function fbsActsState() {
  if (!state.fbs) state.fbs = {};
  if (!state.fbs.acts) state.fbs.acts = { act: null, rows: [], total: 0, done: 0, actsLeft: 0, pending: null, busy: false };
  return state.fbs.acts;
}

function setFbsActsState(name, message) {
  const tb = document.getElementById('fbsActsToolbar');
  if (tb) tb.style.display = (name === 'history') ? 'none' : 'flex';
  ['loading', 'empty', 'error', 'task', 'history'].forEach(s => {
    const el = document.getElementById('fbsacts-' + s);
    if (el) el.style.display = 'none';
  });
  const el = document.getElementById('fbsacts-' + name);
  if (el) el.style.display = 'flex';
  if (name === 'error' && message) {
    const msg = document.getElementById('fbsacts-error-msg');
    if (msg) msg.textContent = message;
  }
}

async function initFbsActsScreen() {
  const st = fbsActsState();
  setFbsActsState('loading');
  fetchPlanPercent();
  try {
    const res = await apiGet({ action: 'getFbsActTask', id: state.employeeId });
    if (!res.success) {
      setFbsActsState('error', res.error || 'Ошибка получения акта');
      return;
    }
    if (!res.act) {
      st.act = null; st.rows = [];
      const desc = document.getElementById('fbsacts-empty-desc');
      if (desc) {
        desc.innerHTML = res.lockedByOthers
          ? `Свободных актов нет.<br>В работе у других сотрудников: <b>${res.lockedByOthers}</b>.`
          : 'Все акты обработаны или ещё не подготовлены к поиску.';
      }
      setFbsActsState('empty');
      return;
    }
    st.act      = res.act;
    st.rows     = res.rows || [];
    st.total    = st.rows.length;
    st.done     = 0;
    st.actsLeft = res.actsLeft || 0;
    setFbsActsState('task');
    renderFbsActTask();
    if (res.fromSkipped) showError('Других свободных актов нет — открыт ранее пропущенный');
  } catch (err) {
    console.error('[FBS acts] load error:', err);
    setFbsActsState('error', 'Ошибка подключения к серверу');
  }
}

function makeCopyChip(text) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy-btn monospace';
  btn.title = 'Нажмите для копирования';
  const span = document.createElement('span');
  span.className = 'copy-val';
  span.textContent = text;
  btn.appendChild(span);
  btn.insertAdjacentHTML('beforeend',
    '<svg class="copy-icon-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>');
  btn.addEventListener('click', () => copyText(text, btn));
  return btn;
}

function renderFbsActTask() {
  const st  = fbsActsState();
  const row = st.rows[0];
  if (!row) return;

  const card = document.getElementById('fbsacts-card-view');
  if (card) {
    card.classList.remove('card-refresh-flash');
    void card.offsetHeight;
    card.classList.add('card-refresh-flash');
  }

  // Акт
  document.getElementById('fbsacts-act-text').textContent = st.act || '—';
  document.getElementById('fbsacts-act').classList.remove('copied');
  const left = document.getElementById('fbsacts-acts-left');
  if (left) left.textContent = st.actsLeft ? `В очереди ещё актов: ${st.actsLeft}` : 'Последний акт в очереди';

  // ГМ — уникальные номера по всем позициям акта
  const gmEl = document.getElementById('fbsacts-gm');
  if (gmEl) {
    gmEl.innerHTML = '';
    const gms = [...new Set(st.rows.map(r => String(r.gm || '').trim()).filter(Boolean))].sort();
    if (gms.length) {
      const lbl = document.createElement('div');
      lbl.className = 'fbs-act-gm-label';
      lbl.textContent = gms.length > 1 ? `ГМ (${gms.length})` : 'ГМ';
      gmEl.appendChild(lbl);
      gms.forEach(g => gmEl.appendChild(makeCopyChip(g)));
    }
  }
  renderFbsActItems();

  // Прогресс внутри акта
  const num = st.done + 1;
  const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
  document.getElementById('fbsacts-progress-text').textContent = `Позиция ${num} из ${st.total}`;
  document.getElementById('fbsacts-progress-pct').textContent  = pct + '%';
  document.getElementById('fbsacts-progress-bar').style.width  = pct + '%';

  // Описание (пока может быть пустым — будет подтягиваться скриптом)
  const descEl = document.getElementById('fbsacts-desc');
  if (row.desc) {
    descEl.textContent = row.desc;
    descEl.classList.remove('task-name-muted');
  } else {
    descEl.textContent = 'Описание товара появится позже';
    descEl.classList.add('task-name-muted');
  }

  // ШК + WMS
  const sku = String(row.sku || '');
  document.getElementById('fbsacts-sku-text').textContent = sku || '—';
  document.getElementById('fbsacts-sku').classList.remove('copied');
  const wms = document.getElementById('fbsacts-wms-link');
  if (wms) wms.href = sku ? `https://wms.uzum.uz/information/product/${encodeURIComponent(sku)}` : '#';

  // Ячейки поиска — каждая отдельной копируемой «таблеткой»
  const cellsEl = document.getElementById('fbsacts-cells');
  cellsEl.innerHTML = '';
  (row.cells || []).forEach(c => cellsEl.appendChild(makeCopyChip(c)));
  if (!cellsEl.children.length) cellsEl.textContent = '—';

  document.getElementById('fbsacts-qty').textContent     = (row.qty || 1) + ' шт.';
  document.getElementById('fbsacts-storage').textContent = row.storageCell || '—';
  document.getElementById('fbsacts-date').textContent    = row.date || '—';
  const reqRow = document.getElementById('fbsacts-request-row');
  if (reqRow) reqRow.style.display = row.request ? '' : 'none';
  document.getElementById('fbsacts-request').textContent = row.request || '—';
}

// Список позиций акта (кнопка «Подробности»)
function renderFbsActItems() {
  const st = fbsActsState();
  const box = document.getElementById('fbsActItems');
  if (!box) return;
  box.innerHTML = '';
  st.rows.forEach((r, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fbs-act-item' + (i === 0 ? ' current' : '');
    const sku = document.createElement('span'); sku.className = 'fbs-act-item-sku'; sku.textContent = r.sku || '—';
    const qty = document.createElement('span'); qty.className = 'fbs-act-item-qty'; qty.textContent = (r.qty || 1) + ' шт.';
    const desc = document.createElement('span'); desc.className = 'fbs-act-item-desc'; desc.textContent = r.desc || 'Без описания';
    b.append(sku, qty, desc);
    b.addEventListener('click', () => selectFbsActRow(i));
    box.appendChild(b);
  });
  const lbl = document.getElementById('fbsActDetailsLabel');
  if (lbl) lbl.textContent = `Подробности · ${st.rows.length} поз.`;
}

function toggleFbsActDetails(force) {
  const box = document.getElementById('fbsActItems');
  const btn = document.getElementById('fbsActDetailsBtn');
  if (!box || !btn) return;
  const open = typeof force === 'boolean' ? force : box.style.display === 'none';
  box.style.display = open ? 'flex' : 'none';
  btn.classList.toggle('open', open);
}

// Выбор позиции из списка: она становится текущей, порядок остальных сохраняется
function selectFbsActRow(i) {
  const st = fbsActsState();
  if (st.busy || i <= 0 || i >= st.rows.length) { toggleFbsActDetails(false); return; }
  const [row] = st.rows.splice(i, 1);
  st.rows.unshift(row);
  toggleFbsActDetails(false);
  renderFbsActTask();
}

function showFbsActConfirm(result) {
  const st  = fbsActsState();
  const row = st.rows[0];
  if (st.busy || (!row && result !== 'recheck')) return;
  st.pending = result;

  const qtyGroup = document.getElementById('fbsActQtyGroup');
  if (qtyGroup) qtyGroup.style.display = '';

  if (result === 'recheck') {
    const h = st.recheckItem;
    document.getElementById('fbsActConfirmTitle').textContent = 'Повторный поиск: где нашли товар?';
    document.getElementById('fbsActConfirmLabel').textContent = `✅ Найден · ${h.sku}`;
    document.getElementById('fbsActFoundWrap').style.display = 'block';
    const max = parseInt(h.qty, 10) || 1;
    const qty = document.getElementById('fbsActFoundQty');
    qty.value = max; qty.max = max;
    document.getElementById('fbsActQtyMax').textContent = max;
    const cell = document.getElementById('fbsActFoundCell');
    cell.value = '';
    setTimeout(() => cell.focus(), 150);
    document.getElementById('fbsActConfirmOverlay').style.display = 'flex';
    return;
  }

  if (result === 'actFound' || result === 'actNotFound') {
    const n = st.rows.length;
    const found = result === 'actFound';
    document.getElementById('fbsActConfirmTitle').textContent = found
      ? `Отметить весь акт найденным? Позиций: ${n}. Где нашли акт?`
      : `Отметить весь акт как не найденный? Позиций: ${n}`;
    document.getElementById('fbsActConfirmLabel').textContent = (found ? '✅ Акт найден · ' : '❌ Акт не найден · ') + st.act;
    document.getElementById('fbsActFoundWrap').style.display = found ? 'block' : 'none';
    if (qtyGroup) qtyGroup.style.display = 'none';
    if (found) {
      const cell = document.getElementById('fbsActFoundCell');
      cell.value = '';
      setTimeout(() => cell.focus(), 150);
    }
    document.getElementById('fbsActConfirmOverlay').style.display = 'flex';
    return;
  }

  if (result === 'skipAct') {
    document.getElementById('fbsActConfirmTitle').textContent = 'Пропустить акт целиком?';
    document.getElementById('fbsActConfirmLabel').textContent = `⏩ ${st.act}`;
    document.getElementById('fbsActFoundWrap').style.display = 'none';
    document.getElementById('fbsActConfirmOverlay').style.display = 'flex';
    return;
  }

  const isFound = result === 'Найден';
  document.getElementById('fbsActConfirmTitle').textContent = isFound
    ? 'Подтвердите данные найденного товара:'
    : 'Отметить товар как не найденный?';
  document.getElementById('fbsActConfirmLabel').textContent = isFound ? '✅ Найден' : '❌ Не найден';

  const wrap = document.getElementById('fbsActFoundWrap');
  wrap.style.display = isFound ? 'block' : 'none';
  if (isFound) {
    const max = parseInt(row.qty, 10) || 1;
    const qty = document.getElementById('fbsActFoundQty');
    qty.value = max;
    qty.max   = max;
    document.getElementById('fbsActQtyMax').textContent = max;
    const cell = document.getElementById('fbsActFoundCell');
    cell.value = '';
    setTimeout(() => cell.focus(), 150);
  }
  document.getElementById('fbsActConfirmOverlay').style.display = 'flex';
}

function hideFbsActConfirm() {
  fbsActsState().pending = null;
  document.getElementById('fbsActConfirmOverlay').style.display = 'none';
}

async function submitFbsActResult() {
  const st     = fbsActsState();
  const row    = st.rows[0];
  const result = st.pending;
  if (result === 'recheck') return submitFbsRecheck();
  if (!row || !result || st.busy) return;
  if (result === 'skipAct') return submitFbsSkipAct();
  if (result === 'actFound' || result === 'actNotFound') return submitFbsActBulk(result === 'actFound');

  const isFound = result === 'Найден';
  let foundCell = '', foundQty = 0;
  if (isFound) {
    const cellEl = document.getElementById('fbsActFoundCell');
    const qtyEl  = document.getElementById('fbsActFoundQty');
    foundCell = cellEl.value.trim();
    foundQty  = parseInt(qtyEl.value, 10) || 0;
    const max = parseInt(row.qty, 10) || 1;
    if (!foundCell) { highlightInvalidInput(cellEl); showError('Укажите ячейку, где нашли товар'); return; }
    if (foundQty < 1 || foundQty > max) { highlightInvalidInput(qtyEl); showError(`Количество от 1 до ${max}`); return; }
  }

  st.busy = true;
  showLoader('Сохранение...');
  try {
    const res = await apiPost({
      action:     'logFbsActResult',
      employeeId: state.employeeId,
      act:        st.act,
      sku:        row.sku,
      row:        row.row,
      result,
      foundCell,
      foundQty
    });

    if (!res.success && !res.alreadyDone) {
      showError(res.error || 'Ошибка сохранения');
      return;
    }

    hideFbsActConfirm();
    if (res.alreadyDone) showError('Позиция уже обработана другим сотрудником');
    else showSuccess(isFound ? 'Найден — записано' : 'Не найден — записано');

    st.rows.shift();
    st.done++;

    if (st.rows.length) {
      renderFbsActTask();
    } else {
      showSuccess(`Акт ${st.act} закрыт`);
      await initFbsActsScreen();   // следующий свободный акт
    }
  } catch (err) {
    console.error('[FBS acts] submit error:', err);
    showError('Ошибка подключения к серверу');
  } finally {
    st.busy = false;
    hideLoader();
  }
}

// Пропустить позицию: в конец акта (на сервере запоминается, чтобы порядок сохранился после перезахода)
function skipFbsActPosition() {
  const st  = fbsActsState();
  const row = st.rows[0];
  if (!row || st.busy) return;
  if (st.rows.length < 2) {
    showError('Это последняя позиция акта. Можно пропустить акт целиком.');
    return;
  }
  st.rows.push(st.rows.shift());
  apiPost({ action: 'skipFbsActPos', employeeId: state.employeeId, act: st.act, sku: row.sku }).catch(() => {});
  showSuccess('Позиция перенесена в конец акта');
  renderFbsActTask();
}

async function submitFbsActBulk(isFound) {
  const st = fbsActsState();
  if (!st.act || st.busy) return;
  let foundCell = '';
  if (isFound) {
    const cellEl = document.getElementById('fbsActFoundCell');
    foundCell = cellEl.value.trim();
    if (!foundCell) { highlightInvalidInput(cellEl); showError('Укажите ячейку, где нашли акт'); return; }
  }
  st.busy = true;
  showLoader('Сохранение акта...');
  try {
    const res = await apiPost({
      action: 'logFbsActBulk', employeeId: state.employeeId, act: st.act,
      result: isFound ? 'Найден' : 'Не найден', foundCell
    });
    if (!res.success) { showError(res.error || 'Ошибка сохранения'); return; }
    hideFbsActConfirm();
    showSuccess(`Акт ${st.act}: ${isFound ? 'найден' : 'не найден'} · позиций ${res.marked || 0}`);
    st.act = null; st.rows = [];
    st.busy = false;
    await initFbsActsScreen();
  } catch (err) {
    console.error('[FBS acts] bulk error:', err);
    showError('Ошибка подключения к серверу');
  } finally {
    st.busy = false;
    hideLoader();
  }
}

async function submitFbsSkipAct() {
  const st = fbsActsState();
  if (!st.act || st.busy) return;
  st.busy = true;
  showLoader('Пропуск акта...');
  try {
    const res = await apiPost({ action: 'skipFbsAct', employeeId: state.employeeId, act: st.act });
    if (!res.success) { showError(res.error || 'Ошибка'); return; }
    hideFbsActConfirm();
    showSuccess(`Акт ${st.act} пропущен`);
    st.act = null; st.rows = [];
    st.busy = false;
    await initFbsActsScreen();
  } catch (err) {
    console.error('[FBS acts] skip error:', err);
    showError('Ошибка подключения к серверу');
  } finally {
    st.busy = false;
    hideLoader();
  }
}

// ── История и повторный поиск ──
async function openFbsActsHistory() {
  const st = fbsActsState();
  st.historyFilter = st.historyFilter || 'all';
  setFbsActsState('history');
  const list = document.getElementById('fbsHistoryList');
  list.innerHTML = '<div class="missing-state-hint" style="text-align:center;padding:20px;">Загрузка...</div>';
  try {
    const res = await apiGet({ action: 'getFbsActHistory', id: state.employeeId });
    if (!res.success) { list.innerHTML = ''; showError(res.error || 'Ошибка загрузки истории'); return; }
    st.history = res.items || [];
    renderFbsActsHistory();
  } catch (err) {
    console.error('[FBS acts] history error:', err);
    list.innerHTML = '';
    showError('Ошибка подключения к серверу');
  }
}

function renderFbsActsHistory() {
  const st = fbsActsState();
  const all = st.history || [];

  // Группировка по акту (порядок — как пришло: новые сверху)
  const acts = [];
  const byAct = {};
  all.forEach(h => {
    let a = byAct[h.act];
    if (!a) { a = byAct[h.act] = { act: h.act, storage: h.storage || '', items: [] }; acts.push(a); }
    if (!a.storage && h.storage) a.storage = h.storage;
    a.items.push(h);
  });
  acts.forEach(a => {
    a.nf = a.items.filter(h => h.status === 'Не найден');
    a.allFound = a.nf.length === 0;
  });

  const f = st.historyFilter;
  const shown = acts.filter(a => f === 'all' || (f === 'Найден' ? a.allFound : !a.allFound));
  document.getElementById('fbsHistoryTitle').textContent =
    `Актов ${acts.length} · с ненайденными ${acts.filter(a => !a.allFound).length}`;
  document.querySelectorAll('.fbs-hf-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));

  const list = document.getElementById('fbsHistoryList');
  list.innerHTML = '';
  if (!shown.length) {
    list.innerHTML = '<div class="missing-state-hint" style="text-align:center;padding:20px;">Пока пусто</div>';
    return;
  }
  st.historyOpen = st.historyOpen || {};

  shown.forEach(a => {
    const wrap = document.createElement('div');
    wrap.className = 'fbs-hact' + (a.allFound ? '' : ' has-nf');

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'fbs-hact-head';
    const actEl = document.createElement('span'); actEl.className = 'fbs-hact-act'; actEl.textContent = a.act;
    const stEl  = document.createElement('span');
    stEl.className = 'fbs-hist-status ' + (a.allFound ? 'ok' : 'no');
    stEl.textContent = a.allFound ? 'Найден'
      : (a.nf.length === a.items.length ? 'Не найден' : `Не найден ${a.nf.length} из ${a.items.length}`);
    const stor = document.createElement('span'); stor.className = 'fbs-hact-storage'; stor.textContent = a.storage || '—';
    head.append(actEl, stEl, stor);
    wrap.appendChild(head);

    if (!a.allFound) {
      const body = document.createElement('div');
      body.className = 'fbs-hact-body';
      body.style.display = st.historyOpen[a.act] ? 'flex' : 'none';
      a.nf.forEach(h => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'fbs-hact-pos';
        const sku = document.createElement('span'); sku.className = 'fbs-hist-sku'; sku.textContent = h.sku;
        const cells = document.createElement('span'); cells.className = 'fbs-hist-meta'; cells.textContent = 'Искали: ' + ((h.cells || []).join(', ') || '—');
        const re = document.createElement('span'); re.className = 'fbs-hist-recheck'; re.textContent = '🔁 Нашёл';
        row.append(sku, re, cells);
        row.addEventListener('click', e => { e.stopPropagation(); st.recheckItem = h; showFbsActConfirm('recheck'); });
        body.appendChild(row);
      });
      wrap.appendChild(body);
      head.addEventListener('click', () => {
        st.historyOpen[a.act] = !st.historyOpen[a.act];
        body.style.display = st.historyOpen[a.act] ? 'flex' : 'none';
      });
    }
    list.appendChild(wrap);
  });
}

async function submitFbsRecheck() {
  const st = fbsActsState();
  const h = st.recheckItem;
  if (!h || st.busy) return;
  const cellEl = document.getElementById('fbsActFoundCell');
  const qtyEl  = document.getElementById('fbsActFoundQty');
  const max = parseInt(h.qty, 10) || 1;
  const foundCell = cellEl.value.trim();
  const foundQty  = parseInt(qtyEl.value, 10) || 0;
  if (!foundCell) { highlightInvalidInput(cellEl); showError('Укажите ячейку, где нашли товар'); return; }
  if (foundQty < 1 || foundQty > max) { highlightInvalidInput(qtyEl); showError(`Количество от 1 до ${max}`); return; }

  st.busy = true;
  showLoader('Перезапись...');
  try {
    const res = await apiPost({ action: 'logFbsActRecheck', employeeId: state.employeeId,
      row: h.row, act: h.act, sku: h.sku, foundCell, foundQty });
    if (!res.success) { showError(res.error || 'Ошибка сохранения'); return; }
    hideFbsActConfirm();
    h.status = 'Найден'; h.foundCell = foundCell; h.foundQty = foundQty;
    st.recheckItem = null;
    renderFbsActsHistory();
    showSuccess(res.pushedToSupport ? 'Перезаписано: Найден (и у саппортов)' : 'Перезаписано: Найден (саппортам уйдёт при синхронизации)');
  } catch (err) {
    console.error('[FBS acts] recheck error:', err);
    showError('Ошибка подключения к серверу');
  } finally {
    st.busy = false;
    hideLoader();
  }
}

function releaseFbsAct() {
  const st = fbsActsState();
  if (!st.act || !state.employeeId) return;
  st.act = null;
  st.rows = [];
  apiPost({ action: 'releaseFbsAct', employeeId: state.employeeId }).catch(() => {});
}

function setupFbsActsEventListeners() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

  on('fbsActFound',    () => showFbsActConfirm('Найден'));
  on('fbsActSkipPos',  skipFbsActPosition);
  on('fbsActSkipAct',  () => showFbsActConfirm('skipAct'));
  on('fbsActBulkFound',    () => showFbsActConfirm('actFound'));
  on('fbsActBulkNotFound', () => showFbsActConfirm('actNotFound'));
  on('fbsActDetailsBtn',   () => toggleFbsActDetails());
  on('btnFbsActsHistory',  openFbsActsHistory);
  on('btnFbsHistoryBack',  initFbsActsScreen);
  document.querySelectorAll('.fbs-hf-btn').forEach(b => b.addEventListener('click', () => {
    fbsActsState().historyFilter = b.dataset.filter;
    renderFbsActsHistory();
  }));
  on('fbsActNotFound', () => showFbsActConfirm('Не найден'));
  on('btnFbsActCancel',    hideFbsActConfirm);
  on('btnFbsActConfirmOk', submitFbsActResult);
  on('btnFbsActsRefresh',  initFbsActsScreen);
  on('btnFbsActsRetry',    initFbsActsScreen);

  on('fbsacts-act', function () { copyText(fbsActsState().act, this); });
  on('fbsacts-sku', function () { copyText((fbsActsState().rows[0] || {}).sku, this); });

  const qtyEl = document.getElementById('fbsActFoundQty');
  const step = d => {
    const max = parseInt(qtyEl.max, 10) || 1;
    qtyEl.value = Math.min(max, Math.max(1, (parseInt(qtyEl.value, 10) || 1) + d));
  };
  on('btnFbsActQtyMinus', () => step(-1));
  on('btnFbsActQtyPlus',  () => step(1));

  const overlay = document.getElementById('fbsActConfirmOverlay');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) hideFbsActConfirm(); });

  const cellEl = document.getElementById('fbsActFoundCell');
  if (cellEl) cellEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitFbsActResult(); } });
}


// ═══════════════════════════════════════════
//  FBS — ПОИСК ВЫЧЕРКОВ
//  Сервер выдаёт одну позицию (бронь), самые дорогие по сумме — первыми.
// ═══════════════════════════════════════════
function fbsVychState() {
  if (!state.fbs) state.fbs = {};
  if (!state.fbs.vych) state.fbs.vych = { task: null, left: 0, pending: null, busy: false };
  return state.fbs.vych;
}

function setFbsVychState(name, message) {
  ['loading', 'empty', 'error', 'task'].forEach(s => {
    const el = document.getElementById('fbsvych-' + s);
    if (el) el.style.display = 'none';
  });
  const el = document.getElementById('fbsvych-' + name);
  if (el) el.style.display = 'flex';
  if (name === 'error' && message) {
    const msg = document.getElementById('fbsvych-error-msg');
    if (msg) msg.textContent = message;
  }
}

async function initFbsVycherkiScreen() {
  const st = fbsVychState();
  setFbsVychState('loading');
  fetchPlanPercent();
  try {
    const res = await apiGet({ action: 'getFbsVycherkTask', id: state.employeeId });
    if (!res.success) {
      setFbsVychState('error', res.error || 'Ошибка получения позиции');
      return;
    }
    if (!res.task) {
      st.task = null;
      const desc = document.getElementById('fbsvych-empty-desc');
      if (desc) {
        desc.innerHTML = res.lockedByOthers
          ? `Свободных позиций нет.<br>В работе у других сотрудников: <b>${res.lockedByOthers}</b>.`
          : 'Все позиции обработаны. Новые придут утром.';
      }
      setFbsVychState('empty');
      return;
    }
    st.task = res.task;
    st.left = res.left || 0;
    setFbsVychState('task');
    renderFbsVychTask();
  } catch (err) {
    console.error('[FBS vych] load error:', err);
    setFbsVychState('error', 'Ошибка подключения к серверу');
  }
}

function renderFbsVychTask() {
  const st = fbsVychState();
  const t  = st.task;
  if (!t) return;

  const card = document.getElementById('fbsvych-card-view');
  if (card) {
    card.classList.remove('card-refresh-flash');
    void card.offsetHeight;
    card.classList.add('card-refresh-flash');
  }

  document.getElementById('fbsvych-left').textContent = st.left ? `В очереди ещё: ${st.left}` : 'Последняя позиция';
  document.getElementById('fbsvych-sum').textContent  = formatSum(t.sum);

  document.getElementById('fbsvych-desc').textContent = t.desc || '—';

  const sku = String(t.sku || '');
  document.getElementById('fbsvych-sku-text').textContent = sku || '—';
  const wms = document.getElementById('fbsvych-wms-link');
  if (wms) wms.href = sku ? `https://wms.uzum.uz/information/product/${encodeURIComponent(sku)}` : '#';

  document.getElementById('fbsvych-cell-text').textContent = t.cell || '—';
  ['fbsvych-sku', 'fbsvych-cell'].forEach(id => document.getElementById(id).classList.remove('copied'));

  document.getElementById('fbsvych-category').textContent = t.category || '—';
  document.getElementById('fbsvych-qty').textContent      = (t.qty || 1) + ' шт.';
  document.getElementById('fbsvych-price').textContent    = formatSum(t.price);
  document.getElementById('fbsvych-date').textContent     = t.date || '—';
}

function showFbsVychConfirm(result) {
  const st = fbsVychState();
  if (!st.task || st.busy) return;
  st.pending = result;
  const isFound = result === 'Найден';
  document.getElementById('fbsVychConfirmTitle').textContent = isFound
    ? 'Где нашли товар?'
    : 'Отметить товар как не найденный?';
  document.getElementById('fbsVychConfirmLabel').textContent = isFound ? '✅ Найден' : '❌ Не найден';
  document.getElementById('fbsVychFoundWrap').style.display = isFound ? 'block' : 'none';
  if (isFound) {
    const max = parseInt(st.task.qty, 10) || 1;
    const qty = document.getElementById('fbsVychFoundQty');
    qty.value = max;
    qty.max   = max;
    document.getElementById('fbsVychQtyMax').textContent = max;
    const cell = document.getElementById('fbsVychFoundCell');
    cell.value = '';
    setTimeout(() => cell.focus(), 150);
  }
  document.getElementById('fbsVychConfirmOverlay').style.display = 'flex';
}

function hideFbsVychConfirm() {
  fbsVychState().pending = null;
  document.getElementById('fbsVychConfirmOverlay').style.display = 'none';
}

async function submitFbsVychResult() {
  const st = fbsVychState();
  const t = st.task, result = st.pending;
  if (!t || !result || st.busy) return;

  const isFound = result === 'Найден';
  let foundCell = '', foundQty = 0;
  if (isFound) {
    const cellEl = document.getElementById('fbsVychFoundCell');
    const qtyEl  = document.getElementById('fbsVychFoundQty');
    const max    = parseInt(t.qty, 10) || 1;
    foundCell = cellEl.value.trim();
    foundQty  = parseInt(qtyEl.value, 10) || 0;
    if (!foundCell) { highlightInvalidInput(cellEl); showError('Укажите ячейку, где нашли товар'); return; }
    if (foundQty < 1 || foundQty > max) { highlightInvalidInput(qtyEl); showError(`Количество от 1 до ${max}`); return; }
  }

  st.busy = true;
  showLoader('Сохранение...');
  try {
    const res = await apiPost({
      action: 'logFbsVycherkResult',
      employeeId: state.employeeId,
      key: t.key,
      row: t.row,
      result,
      foundCell,
      foundQty
    });
    if (!res.success && !res.alreadyDone) {
      showError(res.error || 'Ошибка сохранения');
      return;
    }
    hideFbsVychConfirm();
    if (res.alreadyDone) showError(res.error || 'Позиция уже обработана');
    else showSuccess(isFound ? 'Найден — записано' : 'Не найден — записано');
    st.task = null;
    await initFbsVycherkiScreen();     // следующая позиция
  } catch (err) {
    console.error('[FBS vych] submit error:', err);
    showError('Ошибка подключения к серверу');
  } finally {
    st.busy = false;
    hideLoader();
  }
}

function releaseFbsVycherk() {
  const st = fbsVychState();
  if (!st.task || !state.employeeId) return;
  st.task = null;
  apiPost({ action: 'releaseFbsVycherk', employeeId: state.employeeId }).catch(() => {});
}

function setupFbsVycherkiEventListeners() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  on('fbsVychFound',        () => showFbsVychConfirm('Найден'));
  on('fbsVychNotFound',     () => showFbsVychConfirm('Не найден'));
  on('btnFbsVychCancel',    hideFbsVychConfirm);
  on('btnFbsVychConfirmOk', submitFbsVychResult);
  on('btnFbsVychRefresh',   initFbsVycherkiScreen);
  on('btnFbsVychRetry',     initFbsVycherkiScreen);
  on('fbsvych-sku',  function () { copyText((fbsVychState().task || {}).sku, this); });
  on('fbsvych-cell', function () { copyText((fbsVychState().task || {}).cell, this); });

  const qtyEl = document.getElementById('fbsVychFoundQty');
  const step = d => {
    const max = parseInt(qtyEl.max, 10) || 1;
    qtyEl.value = Math.min(max, Math.max(1, (parseInt(qtyEl.value, 10) || 1) + d));
  };
  on('btnFbsVychQtyMinus', () => step(-1));
  on('btnFbsVychQtyPlus',  () => step(1));

  const overlay = document.getElementById('fbsVychConfirmOverlay');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) hideFbsVychConfirm(); });
  const cellEl = document.getElementById('fbsVychFoundCell');
  if (cellEl) cellEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitFbsVychResult(); } });
}


// ═══════════════════════════════════════════
//  ПОИСК ВЫЧЕРКОВ (ВОЗВРАТЫ)
//  Список назначенных позиций приходит один раз при открытии
//  (уже в нужном порядке: дорогие → дешёвые, по ячейкам).
// ═══════════════════════════════════════════
function vozvState() {
  if (!state.vozv) state.vozv = { tasks: [], done: 0, total: 0, pending: null, busy: false };
  return state.vozv;
}

function setVozvState(name, message) {
  ['loading', 'empty', 'error', 'task', 'done'].forEach(s => {
    const el = document.getElementById('vozv-' + s);
    if (el) el.style.display = 'none';
  });
  const el = document.getElementById('vozv-' + name);
  if (el) el.style.display = 'flex';
  if (name === 'error' && message) document.getElementById('vozv-error-msg').textContent = message;
}

async function initVozvScreen() {
  const st = vozvState();
  setVozvState('loading');
  try {
    const res = await apiGet({ action: 'getVozvTasks', id: state.employeeId });
    if (!res.success) { setVozvState('error', res.error || 'Ошибка получения списка'); return; }
    st.tasks = res.tasks || [];
    st.done  = res.done || 0;
    st.total = st.tasks.length + st.done;
    if (!st.tasks.length) {
      setVozvState(st.done ? 'done' : 'empty');
      if (st.done) document.getElementById('vozv-done-desc').textContent = `Отработано: ${st.done}. Сообщите ведущему — он выдаст новые.`;
      return;
    }
    setVozvState('task');
    renderVozvTask();
  } catch (err) {
    console.error('[Vozv] load error:', err);
    setVozvState('error', 'Ошибка подключения к серверу');
  }
}

function renderVozvTask() {
  const st = vozvState();
  const t  = st.tasks[0];
  if (!t) return;

  const card = document.getElementById('vozv-card-view');
  if (card) { card.classList.remove('card-refresh-flash'); void card.offsetHeight; card.classList.add('card-refresh-flash'); }

  const num = st.done + 1;
  const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
  document.getElementById('vozv-progress-text').textContent = `Позиция ${num} из ${st.total}`;
  document.getElementById('vozv-progress-pct').textContent  = pct + '%';
  document.getElementById('vozv-progress-bar').style.width  = pct + '%';

  document.getElementById('vozv-cell-text').textContent = t.cell || '—';
  document.getElementById('vozv-desc').textContent      = t.desc || '—';
  const sku = String(t.sku || '');
  document.getElementById('vozv-sku-text').textContent  = sku || '—';
  ['vozv-cell', 'vozv-sku'].forEach(id => document.getElementById(id).classList.remove('copied'));
  const wms = document.getElementById('vozv-wms-link');
  wms.href = sku ? `https://wms.uzum.uz/information/product/${encodeURIComponent(sku)}` : '#';
  const uz = document.getElementById('vozv-uzum-link');
  if (t.productId) { uz.href = `https://uzum.uz/product/${encodeURIComponent(t.productId)}`; uz.style.display = 'flex'; }
  else uz.style.display = 'none';

  document.getElementById('vozv-category').textContent = t.category || '—';
  document.getElementById('vozv-qty').textContent      = (t.qty || 1) + ' шт.';
  document.getElementById('vozv-total').textContent    = formatSum(t.total);
}

function showVozvConfirm(result) {
  const st = vozvState();
  const t  = st.tasks[0];
  if (!t || st.busy) return;
  st.pending = result;
  const isFound = result === 'Найден';
  document.getElementById('vozvConfirmTitle').textContent = isFound ? 'Где нашли товар?' : 'Отметить товар как не найденный?';
  document.getElementById('vozvConfirmLabel').textContent = isFound ? '✅ Найден' : '❌ Не найден';
  document.getElementById('vozvFoundWrap').style.display = isFound ? 'block' : 'none';
  if (isFound) {
    const max = parseInt(t.qty, 10) || 1;
    const qty = document.getElementById('vozvFoundQty');
    qty.value = max; qty.max = max;
    document.getElementById('vozvQtyMax').textContent = max;
    const cell = document.getElementById('vozvFoundCell');
    cell.value = '';
    setTimeout(() => cell.focus(), 150);
  }
  document.getElementById('vozvConfirmOverlay').style.display = 'flex';
}

function hideVozvConfirm() {
  vozvState().pending = null;
  document.getElementById('vozvConfirmOverlay').style.display = 'none';
}

async function submitVozvResult() {
  const st = vozvState();
  const t = st.tasks[0], result = st.pending;
  if (!t || !result || st.busy) return;
  const isFound = result === 'Найден';
  let foundCell = '', foundQty = 0;
  if (isFound) {
    const cellEl = document.getElementById('vozvFoundCell');
    const qtyEl  = document.getElementById('vozvFoundQty');
    const max    = parseInt(t.qty, 10) || 1;
    foundCell = cellEl.value.trim();
    foundQty  = parseInt(qtyEl.value, 10) || 0;
    if (!foundCell) { highlightInvalidInput(cellEl); showError('Укажите ячейку, где нашли товар'); return; }
    if (foundQty < 1 || foundQty > max) { highlightInvalidInput(qtyEl); showError(`Количество от 1 до ${max}`); return; }
  }

  st.busy = true;
  showLoader('Сохранение...');
  try {
    const res = await apiPost({ action: 'logVozvResult', employeeId: state.employeeId, row: t.row, sku: t.sku, result, foundCell, foundQty });
    if (!res.success) {
      if (res.reassigned) {
        hideVozvConfirm();
        showError(res.error || 'Список обновлён');
        st.busy = false; hideLoader();
        await initVozvScreen();
        return;
      }
      if (!res.alreadyDone) { showError(res.error || 'Ошибка сохранения'); return; }
    }
    hideVozvConfirm();
    showSuccess(res.alreadyDone ? 'Уже было отмечено' : (isFound ? 'Найден — записано' : 'Не найден — записано'));
    st.tasks.shift();
    st.done++;
    if (st.tasks.length) renderVozvTask();
    else { setVozvState('done'); document.getElementById('vozv-done-desc').textContent = `Отработано: ${st.done}. Сообщите ведущему — он выдаст новые.`; }
  } catch (err) {
    console.error('[Vozv] submit error:', err);
    showError('Ошибка подключения к серверу');
  } finally {
    st.busy = false;
    hideLoader();
  }
}

function setupVozvEventListeners() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  on('btnVozv', () => { showScreen('vozv'); initVozvScreen(); });
  on('btnBackFromVozv', () => showScreen('dashboard'));
  on('btnVozvRefresh', initVozvScreen);
  on('btnVozvEmptyRefresh', initVozvScreen);
  on('btnVozvDoneRefresh', initVozvScreen);
  on('btnVozvRetry', initVozvScreen);
  on('vozvFound',    () => showVozvConfirm('Найден'));
  on('vozvNotFound', () => showVozvConfirm('Не найден'));
  on('btnVozvCancel',    hideVozvConfirm);
  on('btnVozvConfirmOk', submitVozvResult);
  on('vozv-cell', function () { copyText((vozvState().tasks[0] || {}).cell, this); });
  on('vozv-sku',  function () { copyText((vozvState().tasks[0] || {}).sku, this); });
  const qtyEl = document.getElementById('vozvFoundQty');
  const step = d => { const max = parseInt(qtyEl.max, 10) || 1; qtyEl.value = Math.min(max, Math.max(1, (parseInt(qtyEl.value, 10) || 1) + d)); };
  on('btnVozvQtyMinus', () => step(-1));
  on('btnVozvQtyPlus',  () => step(1));
  const overlay = document.getElementById('vozvConfirmOverlay');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) hideVozvConfirm(); });
  const cellEl = document.getElementById('vozvFoundCell');
  if (cellEl) cellEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitVozvResult(); } });
}
