/**
 * Options 页面逻辑
 */
(function () {
  'use strict';

  const { DEFAULT_SETTINGS, DEFAULT_PROMPTS, PROVIDER_UI } = window.VT_CONSTANTS;

  const PROVIDERS = PROVIDER_UI;

  // 颜色预设
  const COLOR_PRESETS = [
    { color: '#424242', name: '深灰' },
    { color: '#1565C0', name: '蓝色' },
    { color: '#2E7D32', name: '绿色' },
    { color: '#C62828', name: '红色' },
    { color: '#E65100', name: '橙色' },
    { color: '#6A1B9A', name: '紫色' },
    { color: '#00695C', name: '青色' },
    { color: '#AD1457', name: '粉色' },
    { color: '#37474F', name: '墨色' },
    { color: '#F57F17', name: '金色' },
  ];

  let settings = null;
  let activeProviderKey = 'openai';
  const autoSave = VT_UTILS.debounce(saveAllSettings, 500);

  // DOM 引用
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /**
   * 初始化
   */
  async function init() {
    settings = await VT_MESSAGE_BUS.sendToBackground('get_settings', {});
    if (!settings) {
      settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }

    activeProviderKey = settings.activeProvider || 'openai';

    renderProviderCards();
    loadProviderConfig(activeProviderKey);
    loadDisplaySettings();
    loadPromptSettings();
    loadShortcuts();
    loadAdvancedSettings();
    loadTtsSettings();

    bindTabEvents();
    bindProviderEvents();
    bindDisplayEvents();
    bindPromptEvents();
    bindShortcutEvents();
    bindAdvancedEvents();
    bindTtsEvents();
  }

  // ============================================
  // Tab 切换
  // ============================================
  function bindTabEvents() {
    $$('.md-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.md-tab').forEach(t => t.setAttribute('aria-selected', 'false'));
        tab.setAttribute('aria-selected', 'true');

        $$('.md-tab-panel').forEach(p => p.hidden = true);
        $(`#panel-${tab.dataset.tab}`).hidden = false;
      });
    });
  }

  // ============================================
  // 翻译服务配置
  // ============================================
  function renderProviderCards() {
    const select = $('#provider-select');
    select.innerHTML = Object.entries(PROVIDERS).map(([key, p]) =>
      `<option value="${key}" ${key === activeProviderKey ? 'selected' : ''}>${p.icon} ${p.name}</option>`
    ).join('');
  }

  function loadProviderConfig(key) {
    const provider = PROVIDERS[key];
    const cfg = settings.providers[key] || {};

    $('#provider-config-title').textContent = `${provider.name} 配置`;
    $('#provider-hint').textContent = provider.hint || '';
    $('#cfg-base-url').value = cfg.base_url || '';
    $('#cfg-api-key').value = cfg.api_key || '';
    $('#cfg-custom-model').value = cfg.customModel || '';

    // 填充模型下拉
    const modelSelect = $('#cfg-model');
    modelSelect.innerHTML = '<option value="">请选择模型</option>' +
      provider.models.map(m => `<option value="${m}" ${m === cfg.model ? 'selected' : ''}>${m}</option>`).join('');
  }

  function bindProviderEvents() {
    // 切换服务商
    $('#provider-select').addEventListener('change', (e) => {
      activeProviderKey = e.target.value;
      settings.activeProvider = activeProviderKey;
      loadProviderConfig(activeProviderKey);
      autoSave();
    });

    // 配置项变更
    ['cfg-base-url', 'cfg-api-key', 'cfg-model', 'cfg-custom-model'].forEach(id => {
      $(`#${id}`).addEventListener('input', () => {
        const cfg = settings.providers[activeProviderKey] || {};
        cfg.base_url = $('#cfg-base-url').value;
        cfg.api_key = $('#cfg-api-key').value;
        cfg.model = $('#cfg-model').value;
        cfg.customModel = $('#cfg-custom-model').value;
        settings.providers[activeProviderKey] = cfg;
        autoSave();
      });
    });

    // 密码显示切换
    $('#btn-toggle-key').addEventListener('click', () => {
      const input = $('#cfg-api-key');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // 测试连接
    $('#btn-test').addEventListener('click', async () => {
      const btn = $('#btn-test');
      btn.disabled = true;
      btn.textContent = '测试中...';

      // 先保存
      await saveAllSettings();

      const result = await VT_MESSAGE_BUS.sendToBackground('test_provider', {
        providerKey: activeProviderKey,
      });

      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> 测试连接`;

      if (result && result.success) {
        showSnackbar('连接成功! 翻译结果: ' + (result.content || '').slice(0, 50), 'success');
      } else {
        showSnackbar('连接失败: ' + (result?.error?.message || '未知错误'), 'error');
      }
    });
  }

  // ============================================
  // 显示设置
  // ============================================
  function loadDisplaySettings() {
    const d = settings.display || {};
    const s = d.style || {};

    // 样式选项
    $('#style-bold').checked = s.bold || false;
    $('#style-underline').checked = s.underline || false;
    $('#style-color').value = s.color || '#666666';
    $('#style-color-value').textContent = s.color || '#666666';

    // 渲染颜色预设
    renderColorPresets(s.color || '#666666');

    if (s.backgroundColor) {
      $('#style-bg-color').value = s.backgroundColor;
      $('#style-bg-color-value').textContent = s.backgroundColor;
    } else {
      $('#style-bg-color-value').textContent = '无';
    }

    $$('[data-font-size]').forEach(chip => {
      chip.classList.toggle('md-chip--selected', chip.dataset.fontSize === (s.fontSize || 'same'));
    });

    $$('[data-separator]').forEach(chip => {
      chip.classList.toggle('md-chip--selected', chip.dataset.separator === (s.separator || 'dashed'));
    });

    $('#bubble-enabled').checked = settings.floatingBubble?.enabled !== false;
  }

  /**
   * 渲染颜色预设色块
   */
  function renderColorPresets(activeColor) {
    const container = $('#color-presets');
    if (!container) return;

    container.innerHTML = COLOR_PRESETS.map(p => `
      <button class="md-color-swatch${p.color.toLowerCase() === activeColor.toLowerCase() ? ' md-color-swatch--active' : ''}"
              data-preset-color="${p.color}"
              title="${p.name}"
              style="background:${p.color};"
              aria-label="${p.name}"></button>
    `).join('');
  }

  function bindDisplayEvents() {
    // 样式
    $('#style-bold').addEventListener('change', () => { settings.display.style.bold = $('#style-bold').checked; autoSave(); });
    $('#style-underline').addEventListener('change', () => { settings.display.style.underline = $('#style-underline').checked; autoSave(); });

    $('#style-color').addEventListener('input', () => {
      const val = $('#style-color').value;
      $('#style-color-value').textContent = val;
      settings.display.style.color = val;
      renderColorPresets(val);
      autoSave();
    });

    // 颜色预设点击
    const presetsContainer = $('#color-presets');
    if (presetsContainer) {
      presetsContainer.addEventListener('click', (e) => {
        const swatch = e.target.closest('.md-color-swatch');
        if (!swatch) return;
        const color = swatch.dataset.presetColor;
        settings.display.style.color = color;
        $('#style-color').value = color;
        $('#style-color-value').textContent = color;
        renderColorPresets(color);
        autoSave();
      });
    }

    $('#style-bg-color').addEventListener('input', () => {
      const val = $('#style-bg-color').value;
      $('#style-bg-color-value').textContent = val;
      settings.display.style.backgroundColor = val;
      autoSave();
    });

    $('#btn-clear-bg').addEventListener('click', () => {
      settings.display.style.backgroundColor = '';
      $('#style-bg-color-value').textContent = '无';
      autoSave();
    });

    $$('[data-font-size]').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('[data-font-size]').forEach(c => c.classList.remove('md-chip--selected'));
        chip.classList.add('md-chip--selected');
        settings.display.style.fontSize = chip.dataset.fontSize;
        autoSave();
      });
    });

    $$('[data-separator]').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('[data-separator]').forEach(c => c.classList.remove('md-chip--selected'));
        chip.classList.add('md-chip--selected');
        settings.display.style.separator = chip.dataset.separator;
        autoSave();
      });
    });

    $('#bubble-enabled').addEventListener('change', () => {
      settings.floatingBubble.enabled = $('#bubble-enabled').checked;
      autoSave();
    });
  }

  // ============================================
  // 提示词管理
  // ============================================
  function loadPromptSettings() {
    $('#prompt-system').value = settings.prompts?.system || DEFAULT_PROMPTS.system;
    $('#prompt-user').value = settings.prompts?.user || DEFAULT_PROMPTS.user;
  }

  function bindPromptEvents() {
    $('#prompt-system').addEventListener('input', () => {
      settings.prompts.system = $('#prompt-system').value;
      autoSave();
    });

    $('#prompt-user').addEventListener('input', () => {
      settings.prompts.user = $('#prompt-user').value;
      autoSave();
    });

    $('#btn-reset-system').addEventListener('click', () => {
      $('#prompt-system').value = DEFAULT_PROMPTS.system;
      settings.prompts.system = DEFAULT_PROMPTS.system;
      autoSave();
      showSnackbar('系统提示词已恢复默认');
    });

    $('#btn-reset-user').addEventListener('click', () => {
      $('#prompt-user').value = DEFAULT_PROMPTS.user;
      settings.prompts.user = DEFAULT_PROMPTS.user;
      autoSave();
      showSnackbar('用户提示词已恢复默认');
    });
  }

  // ============================================
  // 快捷键
  // ============================================
  function loadShortcuts() {
    chrome.commands.getAll((commands) => {
      commands.forEach(cmd => {
        if (cmd.name === 'translate-selection' && cmd.shortcut) {
          $('#key-selection').textContent = cmd.shortcut;
        } else if (cmd.name === 'translate-page' && cmd.shortcut) {
          $('#key-page').textContent = cmd.shortcut;
        }
      });
    });
  }

  function bindShortcutEvents() {
    $('#link-shortcuts').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }

  // ============================================
  // 高级设置
  // ============================================
  function loadAdvancedSettings() {
    const a = settings.advanced || {};
    const c = a.cache || {};

    $('#cfg-concurrency').value = a.concurrency || 3;
    $('#concurrency-value').textContent = a.concurrency || 3;

    $('#cfg-timeout').value = a.timeout || 30;
    $('#timeout-value').textContent = (a.timeout || 30) + 's';

    $('#cache-enabled').checked = c.enabled !== false;
  }

  function bindAdvancedEvents() {
    // 并发
    $('#cfg-concurrency').addEventListener('input', () => {
      const val = parseInt($('#cfg-concurrency').value);
      $('#concurrency-value').textContent = val;
      settings.advanced.concurrency = val;
      autoSave();
    });

    // 超时
    $('#cfg-timeout').addEventListener('input', () => {
      const val = parseInt($('#cfg-timeout').value);
      $('#timeout-value').textContent = val + 's';
      settings.advanced.timeout = val;
      autoSave();
    });

    // 缓存开关
    $('#cache-enabled').addEventListener('change', () => {
      if (!settings.advanced.cache) settings.advanced.cache = {};
      settings.advanced.cache.enabled = $('#cache-enabled').checked;
      autoSave();
    });

    // 导出配置
    $('#btn-export').addEventListener('click', async () => {
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

    // 导入配置
    $('#btn-import').addEventListener('click', () => {
      $('#import-file').click();
    });

    $('#import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = await VT_MESSAGE_BUS.sendToBackground('import_settings', { json: text });
        if (result?.success) {
          showSnackbar('配置导入成功，页面将刷新', 'success');
          setTimeout(() => location.reload(), 1000);
        } else {
          showSnackbar('导入失败: ' + (result?.error || '格式错误'), 'error');
        }
      } catch (err) {
        showSnackbar('导入失败: ' + err.message, 'error');
      }

      e.target.value = '';
    });
  }

  // ============================================
  // 语音朗读 (TTS) 设置
  // ============================================
  function loadTtsSettings() {
    const tts = settings.tts || {};
    $('#tts-enabled').checked = tts.enabled !== false;
    $('#tts-rate').value = tts.rate || 1.0;
    $('#tts-rate-value').textContent = (tts.rate || 1.0).toFixed(1) + 'x';
    $('#tts-pitch').value = tts.pitch || 1.0;
    $('#tts-pitch-value').textContent = (tts.pitch || 1.0).toFixed(1);

    // 加载语音列表
    loadVoiceList(tts.voiceURI || '');
  }

  function loadVoiceList(selectedURI) {
    const voiceSelect = $('#tts-voice');
    const populateVoices = () => {
      const voices = speechSynthesis.getVoices();
      voiceSelect.innerHTML = '<option value="">默认语音</option>';
      voices.forEach(voice => {
        const opt = document.createElement('option');
        opt.value = voice.voiceURI;
        opt.textContent = `${voice.name} (${voice.lang})`;
        if (voice.voiceURI === selectedURI) opt.selected = true;
        voiceSelect.appendChild(opt);
      });
    };

    if ('speechSynthesis' in window) {
      populateVoices();
      speechSynthesis.addEventListener('voiceschanged', populateVoices);
    }
  }

  function bindTtsEvents() {
    $('#tts-enabled').addEventListener('change', () => {
      if (!settings.tts) settings.tts = {};
      settings.tts.enabled = $('#tts-enabled').checked;
      autoSave();
    });

    $('#tts-rate').addEventListener('input', () => {
      const val = parseFloat($('#tts-rate').value);
      $('#tts-rate-value').textContent = val.toFixed(1) + 'x';
      if (!settings.tts) settings.tts = {};
      settings.tts.rate = val;
      autoSave();
    });

    $('#tts-pitch').addEventListener('input', () => {
      const val = parseFloat($('#tts-pitch').value);
      $('#tts-pitch-value').textContent = val.toFixed(1);
      if (!settings.tts) settings.tts = {};
      settings.tts.pitch = val;
      autoSave();
    });

    $('#tts-voice').addEventListener('change', () => {
      if (!settings.tts) settings.tts = {};
      settings.tts.voiceURI = $('#tts-voice').value;
      autoSave();
    });

    $('#btn-tts-test').addEventListener('click', () => {
      if (!('speechSynthesis' in window)) {
        showSnackbar('当前浏览器不支持 Web Speech API', 'error');
        return;
      }

      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('Hello, this is a test of the text to speech feature.');
      utterance.rate = parseFloat($('#tts-rate').value) || 1.0;
      utterance.pitch = parseFloat($('#tts-pitch').value) || 1.0;
      utterance.lang = 'en-US';

      const selectedVoiceURI = $('#tts-voice').value;
      if (selectedVoiceURI) {
        const voice = speechSynthesis.getVoices().find(v => v.voiceURI === selectedVoiceURI);
        if (voice) utterance.voice = voice;
      }

      speechSynthesis.speak(utterance);
      showSnackbar('正在播放测试语音...');
    });
  }

  // ============================================
  // 保存设置
  // ============================================
  async function saveAllSettings() {
    await VT_MESSAGE_BUS.sendToBackground('save_settings', settings);
    showSnackbar('设置已保存');
  }

  // ============================================
  // Snackbar
  // ============================================
  let snackbarTimer = null;
  function showSnackbar(message, type = '') {
    const snackbar = $('#snackbar');
    const textEl = $('#snackbar-text');

    clearTimeout(snackbarTimer);
    snackbar.className = 'md-snackbar md-snackbar--visible' + (type ? ` md-snackbar--${type}` : '');
    textEl.textContent = message;

    snackbarTimer = setTimeout(() => {
      snackbar.classList.remove('md-snackbar--visible');
    }, 3000);
  }

  // 启动
  init();
})();
