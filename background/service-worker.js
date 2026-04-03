/**
 * Background Service Worker - MV3 入口
 * 消息路由、右键菜单、快捷键处理
 */

import { translateSelection, translatePage, testProvider } from './translation-engine.js';
import { getSettings, saveSettings, exportSettings, importSettings, onSettingsChanged } from './settings-manager.js';
import { getCacheStats, clearAllCache } from './cache-manager.js';

// 当前翻译状态 (tabId → state)
const translationStates = new Map();
// 取消控制器
const abortControllers = new Map();

/**
 * 安装时初始化
 */
chrome.runtime.onInstalled.addListener(() => {
  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'vibe-translate-selection',
    title: '翻译选中文本',
    contexts: ['selection'],
  });

  // 初始化默认设置
  getSettings().then(() => {
    console.log('[Vibe] Extension installed, settings initialized.');
  });
});

/**
 * 右键菜单点击处理
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'vibe-translate-selection' && info.selectionText) {
    try {
      const settings = await getSettings();
      const result = await translateSelection(
        info.selectionText,
        settings.language.source,
        settings.language.target,
        new URL(tab.url).hostname
      );

      await chrome.tabs.sendMessage(tab.id, {
        type: 'translation_result',
        payload: {
          selectionResult: true,
          text: result.content || '',
          error: result.error?.message || '',
          cached: result.cached || false,
        },
      });
    } catch (err) {
      console.error('[Vibe] Context menu translate error:', err);
    }
  }
});

/**
 * 快捷键处理
 */
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  if (command === 'translate-selection') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'translate_selection',
      payload: { trigger: 'shortcut' },
    });
  } else if (command === 'translate-page') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'translate_page',
      payload: { trigger: 'shortcut' },
    });
  }
});

/**
 * 统一消息路由
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case 'translate_selection':
      handleTranslateSelection(payload, sender).then(sendResponse);
      return true;

    case 'translate_page':
      handleTranslatePage(payload, sender).then(sendResponse);
      return true;

    case 'cancel_translation':
      handleCancelTranslation(sender);
      sendResponse({ success: true });
      return false;

    case 'translate_text':
      handleTranslateText(payload).then(sendResponse);
      return true;

    case 'get_settings':
      getSettings().then(sendResponse);
      return true;

    case 'save_settings':
      saveSettings(payload).then(() => sendResponse({ success: true }));
      return true;

    case 'get_status':
      handleGetStatus(sender).then(sendResponse);
      return true;

    case 'test_provider':
      testProvider(payload.providerKey).then(sendResponse);
      return true;

    case 'get_cache_stats':
      getCacheStats().then(sendResponse);
      return true;

    case 'clear_cache':
      clearAllCache().then(() => sendResponse({ success: true }));
      return true;

    case 'export_settings':
      exportSettings().then(json => sendResponse({ json }));
      return true;

    case 'import_settings':
      importSettings(payload.json).then(sendResponse);
      return true;

    default:
      return false;
  }
});

/**
 * 处理划词翻译请求
 */
async function handleTranslateSelection(payload, sender) {
  const { text, sourceLang, targetLang, domain } = payload;
  const settings = await getSettings();

  return translateSelection(
    text,
    sourceLang || settings.language.source,
    targetLang || settings.language.target,
    domain || ''
  );
}

/**
 * 处理全页翻译请求
 */
async function handleTranslatePage(payload, sender) {
  const tabId = sender.tab?.id;
  if (!tabId) return { success: false, error: 'No tab ID' };

  const { units, sourceLang, targetLang, domain } = payload;
  const settings = await getSettings();

  // 取消之前的翻译
  if (abortControllers.has(tabId)) {
    abortControllers.get(tabId).abort();
  }

  const controller = new AbortController();
  abortControllers.set(tabId, controller);
  translationStates.set(tabId, { translating: true, progress: 0 });

  try {
    await translatePage(
      units,
      sourceLang || settings.language.source,
      targetLang || settings.language.target,
      domain || '',
      tabId,
      controller.signal
    );
  } finally {
    translationStates.set(tabId, { translating: false, progress: 100 });
    abortControllers.delete(tabId);
  }

  return { success: true };
}

/**
 * 处理取消翻译
 */
function handleCancelTranslation(sender) {
  const tabId = sender.tab?.id;
  if (tabId && abortControllers.has(tabId)) {
    abortControllers.get(tabId).abort();
    abortControllers.delete(tabId);
    translationStates.set(tabId, { translating: false, progress: 0 });
  }
}

/**
 * 处理 Popup 文本翻译
 */
async function handleTranslateText(payload) {
  const { text, sourceLang, targetLang } = payload;
  const settings = await getSettings();

  return translateSelection(
    text,
    sourceLang || settings.language.source,
    targetLang || settings.language.target
  );
}

/**
 * 获取翻译状态
 */
async function handleGetStatus(sender) {
  const tabId = sender.tab?.id;
  const state = tabId ? translationStates.get(tabId) : null;
  const settings = await getSettings();

  return {
    translating: state?.translating || false,
    progress: state?.progress || 0,
    settings,
  };
}

/**
 * 长连接保活（页面翻译期间）
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'vibe-keepalive') {
    port.onMessage.addListener(() => {
      // Keep-alive ping, 不需要处理
    });
    port.onDisconnect.addListener(() => {
      // 端口断开，清理状态
    });
  }
});

/**
 * Tab 关闭时清理
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (abortControllers.has(tabId)) {
    abortControllers.get(tabId).abort();
    abortControllers.delete(tabId);
  }
  translationStates.delete(tabId);
});
