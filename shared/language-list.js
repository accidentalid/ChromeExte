/**
 * 支持的语言列表
 */
const LANGUAGE_LIST = [
  { code: 'auto', name: '自动检测', nativeName: 'Auto Detect' },
  { code: 'zh-CN', name: '简体中文', nativeName: '简体中文' },
  { code: 'zh-TW', name: '繁体中文', nativeName: '繁體中文' },
  { code: 'en', name: '英语', nativeName: 'English' },
  { code: 'ja', name: '日语', nativeName: '日本語' },
  { code: 'ko', name: '韩语', nativeName: '한국어' },
  { code: 'fr', name: '法语', nativeName: 'Français' },
  { code: 'de', name: '德语', nativeName: 'Deutsch' },
  { code: 'es', name: '西班牙语', nativeName: 'Español' },
  { code: 'pt', name: '葡萄牙语', nativeName: 'Português' },
  { code: 'ru', name: '俄语', nativeName: 'Русский' },
  { code: 'ar', name: '阿拉伯语', nativeName: 'العربية' },
  { code: 'it', name: '意大利语', nativeName: 'Italiano' },
  { code: 'nl', name: '荷兰语', nativeName: 'Nederlands' },
  { code: 'pl', name: '波兰语', nativeName: 'Polski' },
  { code: 'th', name: '泰语', nativeName: 'ไทย' },
  { code: 'vi', name: '越南语', nativeName: 'Tiếng Việt' },
  { code: 'id', name: '印尼语', nativeName: 'Bahasa Indonesia' },
  { code: 'tr', name: '土耳其语', nativeName: 'Türkçe' },
  { code: 'hi', name: '印地语', nativeName: 'हिन्दी' },
];

// 语言代码 → 全称映射
const LANGUAGE_NAME_MAP = {};
LANGUAGE_LIST.forEach(lang => {
  LANGUAGE_NAME_MAP[lang.code] = lang.name;
});

/**
 * 获取语言全称
 */
function getLanguageName(code) {
  return LANGUAGE_NAME_MAP[code] || code;
}

/**
 * 获取目标语言列表（排除"自动检测"）
 */
function getTargetLanguages() {
  return LANGUAGE_LIST.filter(l => l.code !== 'auto');
}

if (typeof window !== 'undefined') {
  window.VT_LANGUAGES = { LANGUAGE_LIST, LANGUAGE_NAME_MAP, getLanguageName, getTargetLanguages };
}
