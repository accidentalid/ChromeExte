/**
 * 设置管理器 - chrome.storage.local 读写
 */

// 内联默认 Prompt 以避免跨模块依赖
const DEFAULT_PROMPTS = {
  system: `你是一位专业的翻译引擎。请将用户提供的文本从{source_lang}精确翻译为{target_lang}。

要求：
1. 保持原文的格式、语气和风格
2. 专业术语需准确翻译
3. 如果文本包含 <sN>...</sN> 标签，请保留这些标签并翻译标签内的内容
4. 只输出翻译结果，不要添加任何解释或注释`,
  user: `{text}`,
};

const DEFAULT_SETTINGS = {
  activeProvider: 'openai',
  providers: {
    openai: { base_url: 'https://api.openai.com/v1', api_key: '', model: 'gpt-4o-mini', customModel: '' },
    gemini: { base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', api_key: '', model: 'gemini-2.0-flash', customModel: '' },
    anthropic: { base_url: '', api_key: '', model: 'claude-sonnet-4-20250514', customModel: '' },
    dashscope: { base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', api_key: '', model: 'qwen-plus', customModel: '' },
    moonshot: { base_url: 'https://api.moonshot.cn/v1', api_key: '', model: 'moonshot-v1-8k', customModel: '' },
    minimax: { base_url: 'https://api.minimaxi.com/v1', api_key: '', model: 'MiniMax-M2.5', customModel: '' },
    zhipu: { base_url: 'https://open.bigmodel.cn/api/paas/v4', api_key: '', model: 'glm-4-flash', customModel: '' },
    hunyuan: { base_url: 'https://api.hunyuan.cloud.tencent.com/v1', api_key: '', model: 'hunyuan-turbo', customModel: '' },
    custom: { base_url: '', api_key: '', model: '', customModel: '' },
  },
  language: { source: 'auto', target: 'zh-CN' },
  display: {
    mode: 'bilingual',
    style: {
      bold: false,
      underline: false,
      backgroundColor: '',
      fontSize: 'same',
      color: '#666666',
      separator: 'dashed',
    },
  },
  prompts: { system: DEFAULT_PROMPTS.system, user: DEFAULT_PROMPTS.user },
  shortcuts: { translateSelection: 'Alt+T', translatePage: 'Alt+P' },
  advanced: {
    concurrency: 3,
    timeout: 30,
    cache: { enabled: true, ttlHours: 72, maxSizeMB: 50 },
  },
  tts: {
    enabled: true,
    rate: 1.0,
    pitch: 1.0,
    voiceURI: '',
  },
  floatingBubble: { enabled: true, position: { right: 24, bottom: 80 } },
  selectionTranslateEnabled: true,
  version: 1,
};

// 内存中的设置缓存
let settingsCache = null;

/**
 * 深度合并（target 的值优先）
 */
function deepMerge(defaults, target) {
  const result = { ...defaults };
  for (const key in target) {
    if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      result[key] = deepMerge(defaults[key] || {}, target[key]);
    } else if (target[key] !== undefined) {
      result[key] = target[key];
    }
  }
  return result;
}

/**
 * 获取完整设置
 */
export async function getSettings() {
  if (settingsCache) return settingsCache;

  return new Promise((resolve) => {
    chrome.storage.local.get('vibe_settings', (result) => {
      const stored = result.vibe_settings || {};
      settingsCache = deepMerge(DEFAULT_SETTINGS, stored);
      resolve(settingsCache);
    });
  });
}

/**
 * 保存设置（局部更新）
 */
export async function saveSettings(partial) {
  const current = await getSettings();
  const updated = deepMerge(current, partial);
  settingsCache = updated;

  return new Promise((resolve) => {
    chrome.storage.local.set({ vibe_settings: updated }, resolve);
  });
}

/**
 * 保存完整设置（覆盖）
 */
export async function setAllSettings(settings) {
  const merged = deepMerge(DEFAULT_SETTINGS, settings);
  settingsCache = merged;

  return new Promise((resolve) => {
    chrome.storage.local.set({ vibe_settings: merged }, resolve);
  });
}

/**
 * 获取当前活跃的服务商配置
 */
export async function getActiveProviderConfig() {
  const settings = await getSettings();
  const providerKey = settings.activeProvider;
  const providerSettings = settings.providers[providerKey] || {};

  return {
    providerKey,
    base_url: providerSettings.base_url,
    api_key: providerSettings.api_key,
    model: providerSettings.customModel || providerSettings.model,
  };
}

/**
 * 重置为默认设置
 */
export async function resetSettings() {
  settingsCache = { ...DEFAULT_SETTINGS };
  return new Promise((resolve) => {
    chrome.storage.local.set({ vibe_settings: DEFAULT_SETTINGS }, resolve);
  });
}

/**
 * 导出设置为 JSON 字符串
 */
export async function exportSettings() {
  const settings = await getSettings();
  return JSON.stringify(settings, null, 2);
}

/**
 * 导入设置
 */
export async function importSettings(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('无效的配置格式');
    }
    await setAllSettings(parsed);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 监听设置变化
 */
export function onSettingsChanged(callback) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.vibe_settings) {
      settingsCache = changes.vibe_settings.newValue;
      callback(settingsCache);
    }
  });
}

// 导出默认设置供其他模块使用
export { DEFAULT_SETTINGS, DEFAULT_PROMPTS };
