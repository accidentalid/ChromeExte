/**
 * Popup 页面逻辑 - 含内嵌设置面板
 */
(function () {
  'use strict';

  const { MESSAGE_TYPES, DISPLAY_MODES, DEFAULT_SETTINGS, DEFAULT_PROMPTS, PROVIDER_UI } = window.VT_CONSTANTS;
  const { LANGUAGE_LIST, getTargetLanguages } = window.VT_LANGUAGES;

  const PROVIDERS = PROVIDER_UI;

  // UI 主题预设
  const UI_THEMES = [
    { key: 'blue',   label: '蓝色', primary: '#1565C0', light: '#1E88E5', dark: '#0D47A1', container: '#D1E4FF', onContainer: '#001D36' },
    { key: 'purple', label: '紫色', primary: '#6A1B9A', light: '#8E24AA', dark: '#4A148C', container: '#F3E5F5', onContainer: '#38006b' },
    { key: 'teal',   label: '青色', primary: '#00695C', light: '#00897B', dark: '#004D40', container: '#E0F2F1', onContainer: '#00251a' },
    { key: 'rose',   label: '玫红', primary: '#AD1457', light: '#C2185B', dark: '#880E4F', container: '#FCE4EC', onContainer: '#5e0028' },
  ];

  // DOM
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const elements = {
    statusDot: $('#status-dot'),
    statusText: $('#status-text'),
    progressBar: $('#progress-bar'),
    sourceLang: $('#source-lang'),
    targetLang: $('#target-lang'),
    btnSwap: $('#btn-swap'),
    btnTranslate: $('#btn-translate'),
    btnTranslateText: $('#btn-translate-text'),
    btnSettings: $('#btn-settings'),
    btnBack: $('#btn-back'),
    selectionToggle: $('#selection-toggle'),
    modeChips: $$('.md-chip[data-mode]'),
    viewMain: $('#view-main'),
    viewSettings: $('#view-settings'),
  };

  let currentSettings = null;
  let isTranslating = false;
  let activeProviderKey = 'openai';
  const autoSave = VT_UTILS.debounce(saveAllSettings, 500);

  // ============================================
  // 初始化
  // ============================================
  async function init() {
    currentSettings = await VT_MESSAGE_BUS.sendToBackground('get_settings', {});
    if (!currentSettings) {
      currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }

    activeProviderKey = currentSettings.activeProvider || 'openai';

    // 主视图
    populateLanguages();
    elements.sourceLang.value = currentSettings.language.source;
    elements.targetLang.value = currentSettings.language.target;
    elements.selectionToggle.checked = currentSettings.selectionTranslateEnabled !== false;
    updateModeChips(currentSettings.display.mode);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        const status = await chrome.tabs.sendMessage(tab.id, { type: 'get_status', payload: {} });
        updateStatus(status);
      }
    } catch {}

    // 设置视图
    initSettingsView();

    // 事件
    bindMainEvents();
    bindSettingsEvents();
  }

  // ============================================
  // 视图切换
  // ============================================
  function showView(viewId) {
    elements.viewMain.classList.remove('popup-view--active');
    elements.viewSettings.classList.remove('popup-view--active');
    $(viewId).classList.add('popup-view--active');
  }

  // ============================================
  // 主视图逻辑
  // ============================================
  function populateLanguages() {
    elements.sourceLang.innerHTML = LANGUAGE_LIST.map(l =>
      `<option value="${l.code}">${l.name}</option>`
    ).join('');

    const targets = getTargetLanguages();
    elements.targetLang.innerHTML = targets.map(l =>
      `<option value="${l.code}">${l.name}</option>`
    ).join('');
  }

  function bindMainEvents() {
    // 翻译按钮
    elements.btnTranslate.addEventListener('click', async () => {
      if (isTranslating) {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
            await chrome.tabs.sendMessage(tab.id, { type: 'translate_page', payload: { trigger: 'popup-stop' } });
          }
        } catch {}
        setTranslatingState(false);
      } else {
        await saveLanguageSettings();
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
            await chrome.tabs.sendMessage(tab.id, { type: 'translate_page', payload: { trigger: 'popup' } });
          }
        } catch {}
        setTranslatingState(true);
      }
    });

    // 交换语言
    elements.btnSwap.addEventListener('click', () => {
      const src = elements.sourceLang.value;
      const tgt = elements.targetLang.value;
      if (src !== 'auto') {
        const targetOptions = Array.from(elements.targetLang.options).map(o => o.value);
        if (targetOptions.includes(src)) {
          elements.targetLang.value = src;
        }
        elements.sourceLang.value = tgt;
      }
      saveLanguageSettings();
    });

    elements.sourceLang.addEventListener('change', saveLanguageSettings);
    elements.targetLang.addEventListener('change', saveLanguageSettings);

    // 显示模式
    elements.modeChips.forEach(chip => {
      chip.addEventListener('click', async () => {
        const mode = chip.dataset.mode;
        updateModeChips(mode);
        await VT_MESSAGE_BUS.sendToBackground('save_settings', { display: { mode } });
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) chrome.tabs.sendMessage(tab.id, { type: 'set_mode', payload: { mode } });
        } catch {}
      });
    });

    // 划词翻译开关
    elements.selectionToggle.addEventListener('change', async () => {
      const enabled = elements.selectionToggle.checked;
      await VT_MESSAGE_BUS.sendToBackground('save_settings', { selectionTranslateEnabled: enabled });
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) chrome.tabs.sendMessage(tab.id, { type: 'toggle_selection', payload: { enabled } });
      } catch {}
    });

    // 设置按钮 -> 切换到设置视图
    elements.btnSettings.addEventListener('click', () => showView('#view-settings'));
  }

  async function saveLanguageSettings() {
    await VT_MESSAGE_BUS.sendToBackground('save_settings', {
      language: { source: elements.sourceLang.value, target: elements.targetLang.value },
    });
  }

  function updateStatus(status) {
    if (!status) return;
    if (status.translating) {
      setTranslatingState(true);
    } else if (status.hasTranslations) {
      elements.statusDot.className = 'status-dot status-dot--done';
      elements.statusText.textContent = `已完成 (${status.translatedCount} 段)`;
    }
  }

  function setTranslatingState(translating) {
    isTranslating = translating;
    if (translating) {
      elements.statusDot.className = 'status-dot status-dot--translating';
      elements.statusText.textContent = '翻译中...';
      elements.progressBar.classList.remove('md-progress--hidden');
      elements.btnTranslate.classList.add('translate-btn--stop');
      elements.btnTranslateText.textContent = '停止翻译';
    } else {
      elements.statusDot.className = 'status-dot status-dot--done';
      elements.statusText.textContent = '已完成';
      elements.progressBar.classList.add('md-progress--hidden');
      elements.btnTranslate.classList.remove('translate-btn--stop');
      elements.btnTranslateText.textContent = '翻译此页面';
    }
  }

  function updateModeChips(activeMode) {
    elements.modeChips.forEach(chip => {
      chip.classList.toggle('md-chip--selected', chip.dataset.mode === activeMode);
    });
  }

  // ============================================
  // 设置视图逻辑
  // ============================================
  function initSettingsView() {
    renderProviderCards();
    loadProviderConfig(activeProviderKey);
    loadDisplaySettings();
    loadPromptSettings();
    loadAdvancedSettings();
    loadTtsSettings();
  }

  function bindSettingsEvents() {
    // 返回按钮
    elements.btnBack.addEventListener('click', () => showView('#view-main'));

    // 设置 Tabs
    $$('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.settings-tab').forEach(t => t.classList.remove('settings-tab--active'));
        tab.classList.add('settings-tab--active');
        $$('.settings-panel').forEach(p => p.hidden = true);
        $(`#${tab.dataset.stab}`).hidden = false;
      });
    });

    bindProviderEvents();
    bindDisplayEvents();
    bindPromptEvents();
    bindAdvancedEvents();
    bindTtsEvents();
  }

  // --- Provider ---
  function renderProviderCards() {
    const select = $('#sp-provider-select');
    select.innerHTML = Object.entries(PROVIDERS).map(([key, p]) =>
      `<option value="${key}" ${key === activeProviderKey ? 'selected' : ''}>${p.icon} ${p.name}</option>`
    ).join('');
  }

  function loadProviderConfig(key) {
    const provider = PROVIDERS[key];
    const cfg = currentSettings.providers?.[key] || {};
    $('#sp-provider-config-title').textContent = `${provider.name} 配置`;
    $('#sp-provider-hint').textContent = provider.hint || '';
    $('#sp-base-url').value = cfg.base_url || '';
    $('#sp-api-key').value = cfg.api_key || '';
    $('#sp-custom-model').value = cfg.customModel || '';
    const modelSelect = $('#sp-model');
    modelSelect.innerHTML = '<option value="">请选择模型</option>' +
      provider.models.map(m => `<option value="${m}" ${m === cfg.model ? 'selected' : ''}>${m}</option>`).join('');
  }

  function bindProviderEvents() {
    $('#sp-provider-select').addEventListener('change', (e) => {
      activeProviderKey = e.target.value;
      currentSettings.activeProvider = activeProviderKey;
      loadProviderConfig(activeProviderKey);
      autoSave();
    });

    ['sp-base-url', 'sp-api-key', 'sp-model', 'sp-custom-model'].forEach(id => {
      $(`#${id}`).addEventListener('input', () => {
        if (!currentSettings.providers) currentSettings.providers = {};
        const cfg = currentSettings.providers[activeProviderKey] || {};
        cfg.base_url = $('#sp-base-url').value;
        cfg.api_key = $('#sp-api-key').value;
        cfg.model = $('#sp-model').value;
        cfg.customModel = $('#sp-custom-model').value;
        currentSettings.providers[activeProviderKey] = cfg;
        autoSave();
      });
    });

    $('#sp-toggle-key').addEventListener('click', () => {
      const input = $('#sp-api-key');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    $('#sp-btn-test').addEventListener('click', async () => {
      const btn = $('#sp-btn-test');
      btn.disabled = true;
      btn.textContent = '测试中...';
      await saveAllSettings();
      const result = await VT_MESSAGE_BUS.sendToBackground('test_provider', { providerKey: activeProviderKey });
      btn.disabled = false;
      btn.textContent = '测试连接';
      if (result && result.success) {
        showSnackbar('连接成功!');
      } else {
        showSnackbar('连接失败: ' + (result?.error?.message || '未知错误'));
      }
    });
  }

  // --- Display ---
  function loadDisplaySettings() {
    const d = currentSettings.display || {};
    const s = d.style || {};

    // 主题色
    renderThemeSwatches(currentSettings.theme?.key || 'blue');
    applyTheme(currentSettings.theme?.key || 'blue');

    $$('[data-sp-display-mode]').forEach(chip => {
      chip.classList.toggle('md-chip--selected', chip.dataset.spDisplayMode === d.mode);
    });
    $('#sp-style-bold').checked = s.bold || false;
    $('#sp-style-underline').checked = s.underline || false;

    $$('[data-sp-font-size]').forEach(chip => {
      chip.classList.toggle('md-chip--selected', chip.dataset.spFontSize === (s.fontSize || 'same'));
    });
  }

  function renderThemeSwatches(activeKey) {
    const container = $('#sp-theme-swatches');
    container.innerHTML = UI_THEMES.map(t =>
      `<button class="theme-swatch${t.key === activeKey ? ' theme-swatch--active' : ''}"
               data-theme="${t.key}"
               style="background:${t.primary};"
               title="${t.label}">${t.label}</button>`
    ).join('');
  }

  function applyTheme(key) {
    const theme = UI_THEMES.find(t => t.key === key) || UI_THEMES[0];
    const root = document.documentElement;
    root.style.setProperty('--md-primary', theme.primary);
    root.style.setProperty('--md-primary-light', theme.light);
    root.style.setProperty('--md-primary-dark', theme.dark);
    root.style.setProperty('--md-primary-container', theme.container);
    root.style.setProperty('--md-on-primary-container', theme.onContainer);
  }

  function bindDisplayEvents() {
    // 主题切换
    $('#sp-theme-swatches').addEventListener('click', (e) => {
      const swatch = e.target.closest('.theme-swatch');
      if (!swatch) return;
      const key = swatch.dataset.theme;
      if (!currentSettings.theme) currentSettings.theme = {};
      currentSettings.theme.key = key;
      renderThemeSwatches(key);
      applyTheme(key);
      autoSave();
    });

    $$('[data-sp-display-mode]').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('[data-sp-display-mode]').forEach(c => c.classList.remove('md-chip--selected'));
        chip.classList.add('md-chip--selected');
        currentSettings.display.mode = chip.dataset.spDisplayMode;
        autoSave();
      });
    });

    $('#sp-style-bold').addEventListener('change', () => {
      currentSettings.display.style.bold = $('#sp-style-bold').checked;
      autoSave();
    });
    $('#sp-style-underline').addEventListener('change', () => {
      currentSettings.display.style.underline = $('#sp-style-underline').checked;
      autoSave();
    });

    $$('[data-sp-font-size]').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('[data-sp-font-size]').forEach(c => c.classList.remove('md-chip--selected'));
        chip.classList.add('md-chip--selected');
        currentSettings.display.style.fontSize = chip.dataset.spFontSize;
        autoSave();
      });
    });
  }

  // --- Prompts ---
  function loadPromptSettings() {
    $('#sp-prompt-system').value = currentSettings.prompts?.system || DEFAULT_PROMPTS.system;
    $('#sp-prompt-user').value = currentSettings.prompts?.user || DEFAULT_PROMPTS.user;
  }

  function bindPromptEvents() {
    $('#sp-prompt-system').addEventListener('input', () => {
      currentSettings.prompts.system = $('#sp-prompt-system').value;
      autoSave();
    });
    $('#sp-prompt-user').addEventListener('input', () => {
      currentSettings.prompts.user = $('#sp-prompt-user').value;
      autoSave();
    });
    $('#sp-reset-system').addEventListener('click', () => {
      $('#sp-prompt-system').value = DEFAULT_PROMPTS.system;
      currentSettings.prompts.system = DEFAULT_PROMPTS.system;
      autoSave();
      showSnackbar('系统提示词已恢复默认');
    });
    $('#sp-reset-user').addEventListener('click', () => {
      $('#sp-prompt-user').value = DEFAULT_PROMPTS.user;
      currentSettings.prompts.user = DEFAULT_PROMPTS.user;
      autoSave();
      showSnackbar('用户提示词已恢复默认');
    });
  }

  // --- Advanced ---
  function loadAdvancedSettings() {
    const a = currentSettings.advanced || {};
    const c = a.cache || {};
    $('#sp-concurrency').value = a.concurrency || 3;
    $('#sp-concurrency-value').textContent = a.concurrency || 3;
    $('#sp-timeout').value = a.timeout || 30;
    $('#sp-timeout-value').textContent = (a.timeout || 30) + 's';
    $('#sp-cache-enabled').checked = c.enabled !== false;
  }

  function bindAdvancedEvents() {
    $('#sp-concurrency').addEventListener('input', () => {
      const val = parseInt($('#sp-concurrency').value);
      $('#sp-concurrency-value').textContent = val;
      currentSettings.advanced.concurrency = val;
      autoSave();
    });
    $('#sp-timeout').addEventListener('input', () => {
      const val = parseInt($('#sp-timeout').value);
      $('#sp-timeout-value').textContent = val + 's';
      currentSettings.advanced.timeout = val;
      autoSave();
    });

    // 缓存开关
    $('#sp-cache-enabled').addEventListener('change', () => {
      if (!currentSettings.advanced.cache) currentSettings.advanced.cache = {};
      currentSettings.advanced.cache.enabled = $('#sp-cache-enabled').checked;
      autoSave();
    });

    // 导出
    $('#sp-export').addEventListener('click', async () => {
      const result = await VT_MESSAGE_BUS.sendToBackground('export_settings', {});
      if (result?.json) {
        const blob = new Blob([result.json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vibe-translate-config-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showSnackbar('配置已导出');
      }
    });

    // 导入
    $('#sp-import').addEventListener('click', () => $('#sp-import-file').click());
    $('#sp-import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const result = await VT_MESSAGE_BUS.sendToBackground('import_settings', { json: text });
        if (result?.success) {
          showSnackbar('配置导入成功');
          currentSettings = await VT_MESSAGE_BUS.sendToBackground('get_settings', {});
          activeProviderKey = currentSettings.activeProvider || 'openai';
          initSettingsView();
        } else {
          showSnackbar('导入失败: ' + (result?.error || '格式错误'));
        }
      } catch (err) {
        showSnackbar('导入失败: ' + err.message);
      }
      e.target.value = '';
    });
  }

  // --- TTS ---
  function loadTtsSettings() {
    const tts = currentSettings.tts || {};
    $('#sp-tts-enabled').checked = tts.enabled !== false;
    $('#sp-tts-rate').value = tts.rate || 1.0;
    $('#sp-tts-rate-value').textContent = (tts.rate || 1.0).toFixed(1) + 'x';
    $('#sp-tts-pitch').value = tts.pitch || 1.0;
    $('#sp-tts-pitch-value').textContent = (tts.pitch || 1.0).toFixed(1);

    if ('speechSynthesis' in window) {
      const populateVoices = () => {
        const voiceSelect = $('#sp-tts-voice');
        const voices = speechSynthesis.getVoices();
        voiceSelect.innerHTML = '<option value="">默认语音</option>';
        voices.forEach(v => {
          const opt = document.createElement('option');
          opt.value = v.voiceURI;
          opt.textContent = `${v.name} (${v.lang})`;
          if (v.voiceURI === (tts.voiceURI || '')) opt.selected = true;
          voiceSelect.appendChild(opt);
        });
      };
      populateVoices();
      speechSynthesis.addEventListener('voiceschanged', populateVoices);
    }
  }

  function bindTtsEvents() {
    $('#sp-tts-enabled').addEventListener('change', () => {
      if (!currentSettings.tts) currentSettings.tts = {};
      currentSettings.tts.enabled = $('#sp-tts-enabled').checked;
      autoSave();
    });

    $('#sp-tts-rate').addEventListener('input', () => {
      const val = parseFloat($('#sp-tts-rate').value);
      $('#sp-tts-rate-value').textContent = val.toFixed(1) + 'x';
      if (!currentSettings.tts) currentSettings.tts = {};
      currentSettings.tts.rate = val;
      autoSave();
    });

    $('#sp-tts-pitch').addEventListener('input', () => {
      const val = parseFloat($('#sp-tts-pitch').value);
      $('#sp-tts-pitch-value').textContent = val.toFixed(1);
      if (!currentSettings.tts) currentSettings.tts = {};
      currentSettings.tts.pitch = val;
      autoSave();
    });

    $('#sp-tts-voice').addEventListener('change', () => {
      if (!currentSettings.tts) currentSettings.tts = {};
      currentSettings.tts.voiceURI = $('#sp-tts-voice').value;
      autoSave();
    });

    $('#sp-tts-test').addEventListener('click', () => {
      if (!('speechSynthesis' in window)) {
        showSnackbar('浏览器不支持语音');
        return;
      }
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('Hello, this is a test of the text to speech feature.');
      utterance.rate = parseFloat($('#sp-tts-rate').value) || 1.0;
      utterance.pitch = parseFloat($('#sp-tts-pitch').value) || 1.0;
      utterance.lang = 'en-US';
      const uri = $('#sp-tts-voice').value;
      if (uri) {
        const voice = speechSynthesis.getVoices().find(v => v.voiceURI === uri);
        if (voice) utterance.voice = voice;
      }
      speechSynthesis.speak(utterance);
      showSnackbar('正在播放测试语音...');
    });
  }

  // ============================================
  // 保存 & Snackbar
  // ============================================
  async function saveAllSettings() {
    await VT_MESSAGE_BUS.sendToBackground('save_settings', currentSettings);
  }

  let snackbarTimer = null;
  function showSnackbar(message) {
    const snackbar = $('#sp-snackbar');
    const textEl = $('#sp-snackbar-text');
    clearTimeout(snackbarTimer);
    snackbar.classList.add('sp-snackbar--visible');
    textEl.textContent = message;
    snackbarTimer = setTimeout(() => {
      snackbar.classList.remove('sp-snackbar--visible');
    }, 2500);
  }

  // 启动
  init();
})();
