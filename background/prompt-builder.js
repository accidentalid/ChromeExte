/**
 * Prompt 模板构建器
 */

import { PROVIDERS } from './providers.js';

// 语言代码 → 全称（用于 Prompt）
const LANG_NAMES = {
  'auto': '自动检测',
  'zh-CN': '简体中文', 'zh-TW': '繁体中文',
  'en': 'English', 'ja': '日本語', 'ko': '한국어',
  'fr': 'Français', 'de': 'Deutsch', 'es': 'Español',
  'pt': 'Português', 'ru': 'Русский', 'ar': 'العربية',
  'it': 'Italiano', 'nl': 'Nederlands', 'pl': 'Polski',
  'th': 'ไทย', 'vi': 'Tiếng Việt', 'id': 'Bahasa Indonesia',
  'tr': 'Türkçe', 'hi': 'हिन्दी',
};

/**
 * 构建翻译请求的 messages 数组
 * @param {object} params
 * @param {string} params.systemPrompt - 系统 Prompt 模板
 * @param {string} params.userPrompt - 用户 Prompt 模板
 * @param {string} params.text - 待翻译文本
 * @param {string} params.sourceLang - 源语言代码
 * @param {string} params.targetLang - 目标语言代码
 * @param {string} [params.domain] - 当前网站域名
 * @returns {Array<{role: string, content: string}>}
 */
export function buildMessages({ systemPrompt, userPrompt, text, sourceLang, targetLang, domain = '' }) {
  const sourceLangName = LANG_NAMES[sourceLang] || sourceLang;
  const targetLangName = LANG_NAMES[targetLang] || targetLang;

  const resolvedSystem = replaceVars(systemPrompt, {
    source_lang: sourceLangName,
    target_lang: targetLangName,
    domain,
  });

  const resolvedUser = replaceVars(userPrompt, {
    text,
    source_lang: sourceLangName,
    target_lang: targetLangName,
    domain,
  });

  return [
    { role: 'system', content: resolvedSystem },
    { role: 'user', content: resolvedUser },
  ];
}

/**
 * 构建批量翻译的 messages（带标签格式）
 */
export function buildBatchMessages({ systemPrompt, userPrompt, segments, sourceLang, targetLang, domain = '' }) {
  // 构建带标签文本
  const taggedText = segments.map((seg, i) => `<s${i + 1}>${seg.text}</s${i + 1}>`).join('\n');

  // 为批量翻译增强系统 Prompt
  const batchSystemAddendum = `\n\n重要：输入文本包含编号标签 <sN>...</sN>，请保留这些标签并翻译标签内的文本内容。输出格式必须与输入保持一致。`;

  return buildMessages({
    systemPrompt: systemPrompt + batchSystemAddendum,
    userPrompt,
    text: taggedText,
    sourceLang,
    targetLang,
    domain,
  });
}

/**
 * 替换模板变量
 */
function replaceVars(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}
