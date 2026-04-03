/**
 * Options 页面逻辑
 */
(function () {
  'use strict';

  const { DEFAULT_SETTINGS, DEFAULT_PROMPTS } = window.VT_CONSTANTS;

  // 服务商注册表（与 background/providers.js 同步）
  const PROVIDERS = {
    openai:    { name: 'OpenAI',          icon: '🟢', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    gemini:    { name: 'Google Gemini',   icon: '🔵', models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-pro'] },
    anthropic: { name: 'Anthropic Claude',icon: '🟠', models: ['claude-sonnet-4-20250514', 'claude-haiku', 'claude-3-5-sonnet-20241022'], hint: '需通过 OpenAI 兼容网关接入' },
    dashscope: { name: '阿里云百炼',      icon: '🟡', models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'] },
    moonshot:  { name: '月之暗面 Kimi',   icon: '🌙', models: ['kimi-k2.5', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] },
    minimax:   { name: 'MiniMax',         icon: '🔷', models: ['MiniMax-M2.7', 'MiniMax-M2.5', 'MiniMax-M2.1'] },
    zhipu:     { name: '智谱AI GLM',      icon: '🟣', models: ['glm-5', 'glm-4.7', 'glm-4-flash', 'glm-4-plus'] },
    hunyuan:   { name: '腾讯混元',        icon: '🔴', models: ['hunyuan-pro', 'hunyuan-turbo', 'hunyuan-standard', 'hunyuan-lite'] },
    custom:    { name: '自定义',          icon: '⚙️', models: [], hint: '输入 OpenAI 兼容接口地址' },
  };

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
    loadCacheStats();

    bindTabEvents();
    bindProviderEvents();
    bindDisplayEvents();
    bindPromptEvents();
    bindShortcutEvents();
    bindAdvancedEvents();
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
    const container = $('#provider-cards');
    container.innerHTML = Object.entries(PROVIDERS).map(([key, p]) => `
      <label class="md-radio-card">
        <input type="radio" name="provider" value="${key}" ${key === activeProviderKey ? 'checked' : ''}>
        <span class="radio-dot"></span>
        <span class="radio-label">${p.icon} ${p.name}</span>
      </label>
    `).join('');
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
    $$('input[name="provider"]').forEach(radio => {
      radio.addEventListener('change', () => {
        activeProviderKey = radio.value;
        settings.activeProvider = activeProviderKey;
        loadProviderConfig(activeProviderKey);
        autoSave();
      });
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

    // 显示模式
    $$('[data-display-mode]').forEach(chip => {
      chip.classList.toggle('md-chip--selected', chip.dataset.displayMode === d.mode);
    });

    // 样式选项
    $('#style-bold').checked = s.bold || false;
    $('#style-underline').checked = s.underline || false;
    $('#style-color').value = s.color || '#666666';
    $('#style-color-value').textContent = s.color || '#666666';

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

  function bindDisplayEvents() {
    // 显示模式
    $$('[data-display-mode]').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('[data-display-mode]').forEach(c => c.classList.remove('md-chip--selected'));
        chip.classList.add('md-chip--selected');
        settings.display.mode = chip.dataset.displayMode;
        autoSave();
      });
    });

    // 样式
    $('#style-bold').addEventListener('change', () => { settings.display.style.bold = $('#style-bold').checked; autoSave(); });
    $('#style-underline').addEventListener('change', () => { settings.display.style.underline = $('#style-underline').checked; autoSave(); });

    $('#style-color').addEventListener('input', () => {
      const val = $('#style-color').value;
      $('#style-color-value').textContent = val;
      settings.display.style.color = val;
      autoSave();
    });

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
    $('#cache-ttl').value = c.ttlHours || 72;
    $('#cache-ttl-value').textContent = (c.ttlHours || 72) + 'h';

    $('#cache-max-size').value = c.maxSizeMB || 50;
    $('#cache-max-value').textContent = (c.maxSizeMB || 50) + 'MB';
  }

  async function loadCacheStats() {
    const stats = await VT_MESSAGE_BUS.sendToBackground('get_cache_stats', {});
    if (stats) {
      $('#cache-stats').textContent = `缓存大小: ${stats.estimatedSizeMB}MB (${stats.count} 条)`;
    }
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
      settings.advanced.cache.enabled = $('#cache-enabled').checked;
      autoSave();
    });

    // 缓存 TTL
    $('#cache-ttl').addEventListener('input', () => {
      const val = parseInt($('#cache-ttl').value);
      $('#cache-ttl-value').textContent = val + 'h';
      settings.advanced.cache.ttlHours = val;
      autoSave();
    });

    // 缓存容量
    $('#cache-max-size').addEventListener('input', () => {
      const val = parseInt($('#cache-max-size').value);
      $('#cache-max-value').textContent = val + 'MB';
      settings.advanced.cache.maxSizeMB = val;
      autoSave();
    });

    // 清除缓存
    $('#btn-clear-cache').addEventListener('click', async () => {
      await VT_MESSAGE_BUS.sendToBackground('clear_cache', {});
      showSnackbar('缓存已清除', 'success');
      loadCacheStats();
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
