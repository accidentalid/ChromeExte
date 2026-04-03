/**
 * Vibe Translation Extension - 常量与默认配置
 */

// 消息类型
const MESSAGE_TYPES = {
  // Content → Background
  TRANSLATE_SELECTION: 'translate_selection',
  TRANSLATE_PAGE: 'translate_page',
  CANCEL_TRANSLATION: 'cancel_translation',
  GET_SETTINGS: 'get_settings',
  SAVE_SETTINGS: 'save_settings',
  GET_STATUS: 'get_status',

  // Background → Content
  TRANSLATION_RESULT: 'translation_result',
  TRANSLATION_PROGRESS: 'translation_progress',
  TRANSLATION_COMPLETE: 'translation_complete',
  TRANSLATION_ERROR: 'translation_error',
  SETTINGS_CHANGED: 'settings_changed',

  // Popup → Background
  TRANSLATE_TEXT: 'translate_text',
  TEST_PROVIDER: 'test_provider',
  GET_CACHE_STATS: 'get_cache_stats',
  CLEAR_CACHE: 'clear_cache',
  SET_MODE: 'set_mode',
  TOGGLE_SELECTION: 'toggle_selection',

  // 快捷键
  COMMAND_TRANSLATE_SELECTION: 'translate-selection',
  COMMAND_TRANSLATE_PAGE: 'translate-page',
};

// 存储键
const STORAGE_KEYS = {
  SETTINGS: 'vibe_settings',
  BUBBLE_POSITION: 'vibe_bubble_position',
};

// 翻译显示模式
const DISPLAY_MODES = {
  BILINGUAL: 'bilingual',
  TARGET_ONLY: 'target-only',
};

// 默认 Prompt 模板
const DEFAULT_PROMPTS = {
  system: `你是一位专业的翻译引擎。请将用户提供的文本从{source_lang}精确翻译为{target_lang}。

要求：
1. 保持原文的格式、语气和风格
2. 专业术语需准确翻译
3. 如果文本包含 <sN>...</sN> 标签，请保留这些标签并翻译标签内的内容
4. 只输出翻译结果，不要添加任何解释或注释`,

  user: `{text}`,
};

// 默认设置
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
  language: {
    source: 'auto',
    target: 'zh-CN',
  },
  display: {
    mode: DISPLAY_MODES.BILINGUAL,
    style: {
      bold: false,
      underline: false,
      backgroundColor: '',
      fontSize: 'same',
      color: '#666666',
      separator: 'dashed',
    },
  },
  prompts: {
    system: DEFAULT_PROMPTS.system,
    user: DEFAULT_PROMPTS.user,
  },
  shortcuts: {
    translateSelection: 'Alt+T',
    translatePage: 'Alt+P',
  },
  advanced: {
    concurrency: 3,
    timeout: 30,
    cache: {
      enabled: true,
      ttlHours: 72,
      maxSizeMB: 50,
    },
  },
  tts: {
    enabled: true,
    rate: 1.0,
    pitch: 1.0,
    voiceURI: '',
  },
  floatingBubble: {
    enabled: true,
    position: { right: 24, bottom: 80 },
  },
  selectionTranslateEnabled: true,
  version: 1,
};

// CSS 类名前缀
const CSS_PREFIX = 'vt';

// 翻译单元属性名
const ATTR_NAMES = {
  UNIT_ID: 'data-vt-id',
  TRANS_FOR: 'data-vt-for',
  EXT_ROOT: 'data-vt-ext',
  WRAPPER: 'data-vt-wrapper',
};

// 扩展版本
const EXTENSION_VERSION = '1.0.1';

// 如果在非模块环境中，通过 window 暴露
if (typeof window !== 'undefined') {
  window.VT_CONSTANTS = {
    MESSAGE_TYPES,
    STORAGE_KEYS,
    DISPLAY_MODES,
    DEFAULT_PROMPTS,
    DEFAULT_SETTINGS,
    CSS_PREFIX,
    ATTR_NAMES,
    EXTENSION_VERSION,
  };
}

// 如果在 ES module 环境中
if (typeof exports !== 'undefined') {
  Object.assign(exports, {
    MESSAGE_TYPES,
    STORAGE_KEYS,
    DISPLAY_MODES,
    DEFAULT_PROMPTS,
    DEFAULT_SETTINGS,
    CSS_PREFIX,
    ATTR_NAMES,
    EXTENSION_VERSION,
  });
}
