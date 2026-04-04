/**
 * Content Script 入口 - 引导初始化
 */
(function () {
  'use strict';

  // 防止重复初始化
  if (window.__VT_INITIALIZED__) return;
  window.__VT_INITIALIZED__ = true;

  let currentSettings = null;

  /**
   * 初始化
   */
  async function init() {
    try {
      // 获取设置
      currentSettings = await VT_MESSAGE_BUS.sendToBackground('get_settings', {});

      // 应用译文样式
      if (currentSettings?.display?.style) {
        VT_STYLE_MANAGER.applyStyle(currentSettings.display.style);
      }

      // 初始化 TTS 管理器
      if (typeof VT_TTS_MANAGER !== 'undefined') {
        VT_TTS_MANAGER.init();
        if (currentSettings?.tts) {
          VT_TTS_MANAGER.updateSettings(currentSettings.tts);
        }
      }

      // 初始化悬浮翻译按钮
      if (currentSettings?.floatingBubble?.enabled !== false) {
        VT_FLOATING_BUBBLE.init();
      }

      // 初始化划词翻译气泡
      VT_SELECTION_BUBBLE.init();
      VT_SELECTION_BUBBLE.updateSettings(currentSettings);

      // 初始化划词选中处理
      VT_SELECTION_HANDLER.init(VT_SELECTION_BUBBLE);
      VT_SELECTION_HANDLER.setEnabled(currentSettings?.selectionTranslateEnabled !== false);

      // 注册消息监听
      registerMessageListeners();

      console.log('[Vibe] Translation extension initialized.');
    } catch (err) {
      console.error('[Vibe] Initialization error:', err);
    }
  }

  /**
   * 注册消息监听器
   */
  function registerMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const { type, payload } = message;

      switch (type) {
        case 'translation_result':
          handleTranslationResult(payload);
          sendResponse({ received: true });
          break;

        case 'translation_progress':
          handleTranslationProgress(payload);
          sendResponse({ received: true });
          break;

        case 'translation_complete':
          VT_PAGE_TRANSLATOR.handleComplete();
          sendResponse({ received: true });
          break;

        case 'translation_error':
          handleTranslationError(payload);
          sendResponse({ received: true });
          break;

        case 'translate_selection':
          // 快捷键触发的划词翻译
          triggerSelectionTranslate();
          sendResponse({ received: true });
          break;

        case 'translate_page':
          // 快捷键触发的全页翻译
          togglePageTranslation();
          sendResponse({ received: true });
          break;

        case 'set_mode':
          VT_DOM_INJECTOR.setDisplayMode(payload.mode);
          sendResponse({ received: true });
          break;

        case 'toggle_selection':
          VT_SELECTION_HANDLER.setEnabled(payload.enabled);
          sendResponse({ received: true });
          break;

        case 'get_status':
          sendResponse({
            translating: VT_PAGE_TRANSLATOR.translating,
            hasTranslations: VT_DOM_INJECTOR.hasTranslations(),
            translatedCount: VT_DOM_INJECTOR.getTranslatedCount(),
          });
          break;

        case 'settings_changed':
          handleSettingsChanged(payload);
          sendResponse({ received: true });
          break;

        default:
          return false;
      }
      return false;
    });
  }

  /**
   * 处理翻译结果
   */
  function handleTranslationResult(payload) {
    if (payload.selectionResult) {
      // 划词翻译结果（由右键菜单触发）
      if (payload.text) {
        VT_SELECTION_BUBBLE.show(payload.text, getSelectionRect());
        VT_SELECTION_BUBBLE._showResult(payload.text, payload.cached);
      } else if (payload.error) {
        VT_SELECTION_BUBBLE._showError(payload.error);
      }
    } else if (payload.results) {
      // 页面翻译结果
      const targetLang = currentSettings?.language?.target || 'zh-CN';
      VT_PAGE_TRANSLATOR.handleResult(payload.results, targetLang);
    }
  }

  /**
   * 处理翻译进度
   */
  function handleTranslationProgress(payload) {
    if (VT_FLOATING_BUBBLE && payload.total > 0) {
      const progress = Math.round((payload.completed / payload.total) * 100);
      VT_FLOATING_BUBBLE.setState('translating', progress);
    }
  }

  /**
   * 处理翻译错误
   */
  function handleTranslationError(payload) {
    VT_PAGE_TRANSLATOR.handleError(payload.error);
  }

  /**
   * 快捷键触发划词翻译
   */
  function triggerSelectionTranslate() {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      VT_SELECTION_BUBBLE.show(text, rect);
      VT_SELECTION_BUBBLE._translate();
    }
  }

  /**
   * 切换页面翻译
   */
  function togglePageTranslation() {
    if (VT_PAGE_TRANSLATOR.translating) {
      VT_PAGE_TRANSLATOR.stop();
    } else if (VT_DOM_INJECTOR.hasTranslations()) {
      VT_DOM_INJECTOR.removeAll();
      VT_FLOATING_BUBBLE?.setState('idle');
    } else {
      VT_MESSAGE_BUS.sendToBackground('get_settings', {}).then(settings => {
        currentSettings = settings;
        VT_PAGE_TRANSLATOR.start(settings.language.source, settings.language.target);
      });
    }
  }

  /**
   * 获取当前选区的位置
   */
  function getSelectionRect() {
    try {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        return selection.getRangeAt(0).getBoundingClientRect();
      }
    } catch {}
    return { top: 100, right: 100, bottom: 120, left: 80, width: 20, height: 20 };
  }

  /**
   * 处理设置变更
   */
  function handleSettingsChanged(newSettings) {
    currentSettings = newSettings;

    if (newSettings.display?.style) {
      VT_STYLE_MANAGER.applyStyle(newSettings.display.style);
    }

    if (newSettings.display?.mode) {
      VT_DOM_INJECTOR.setDisplayMode(newSettings.display.mode);
    }

    // 更新 TTS 设置
    if (typeof VT_TTS_MANAGER !== 'undefined' && newSettings.tts) {
      VT_TTS_MANAGER.updateSettings(newSettings.tts);
    }

    // 同步设置到划词气泡
    VT_SELECTION_BUBBLE.updateSettings(newSettings);

    VT_SELECTION_HANDLER.setEnabled(newSettings.selectionTranslateEnabled !== false);

    if (newSettings.floatingBubble?.enabled === false) {
      VT_FLOATING_BUBBLE.hide();
    } else {
      // 如果气泡未初始化（启动时被禁用），先初始化
      if (!VT_FLOATING_BUBBLE.host) {
        VT_FLOATING_BUBBLE.init();
      } else {
        VT_FLOATING_BUBBLE.show();
      }
    }
  }

  // 监听设置变更（通过 storage）
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.vibe_settings) {
      handleSettingsChanged(changes.vibe_settings.newValue);
    }
  });

  // 启动
  init();
})();
