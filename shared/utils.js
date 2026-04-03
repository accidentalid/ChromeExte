/**
 * 工具函数集
 */
const VT_UTILS = {
  /**
   * 防抖
   */
  debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * 节流
   */
  throttle(fn, limit) {
    let inThrottle = false;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => { inThrottle = false; }, limit);
      }
    };
  },

  /**
   * FNV-1a 哈希（轻量字符串哈希）
   */
  fnv1aHash(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  },

  /**
   * 生成缓存键
   */
  cacheKey(sourceLang, targetLang, provider, model, text) {
    const normalized = text.trim().replace(/\s+/g, ' ');
    return VT_UTILS.fnv1aHash(`${sourceLang}|${targetLang}|${provider}|${model}|${normalized}`);
  },

  /**
   * 将文本分块，每块不超过 maxChars 字符
   */
  chunkText(segments, maxChars = 2000) {
    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;

    for (const segment of segments) {
      const textLen = segment.text.length;
      if (currentLength + textLen > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentLength = 0;
      }
      currentChunk.push(segment);
      currentLength += textLen;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  },

  /**
   * 构建带标签的翻译文本
   */
  buildTaggedText(segments) {
    return segments.map((seg, i) => `<s${i + 1}>${seg.text}</s${i + 1}>`).join('\n');
  },

  /**
   * 解析带标签的翻译结果
   */
  parseTaggedResult(text, count) {
    const results = [];
    for (let i = 1; i <= count; i++) {
      const regex = new RegExp(`<s${i}>(.*?)</s${i}>`, 's');
      const match = text.match(regex);
      results.push(match ? match[1].trim() : '');
    }
    // 如果标签解析完全失败（一个也没匹配到），回退到按行分割
    if (results.every(r => r === '') && count === 1) {
      return [text.trim()];
    }
    return results;
  },

  /**
   * 简单的 Unicode 语言检测
   */
  detectLanguageHint(text) {
    const sample = text.slice(0, 200);
    const cjkCount = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
    const hangulCount = (sample.match(/[\uac00-\ud7af]/g) || []).length;
    const hiraganaKatakana = (sample.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
    const latinCount = (sample.match(/[a-zA-Z]/g) || []).length;
    const cyrillicCount = (sample.match(/[\u0400-\u04ff]/g) || []).length;
    const arabicCount = (sample.match(/[\u0600-\u06ff]/g) || []).length;

    const counts = [
      { lang: 'zh-CN', count: cjkCount },
      { lang: 'ko', count: hangulCount },
      { lang: 'ja', count: hiraganaKatakana },
      { lang: 'en', count: latinCount },
      { lang: 'ru', count: cyrillicCount },
      { lang: 'ar', count: arabicCount },
    ];

    counts.sort((a, b) => b.count - a.count);
    return counts[0].count > 0 ? counts[0].lang : 'en';
  },

  /**
   * 生成唯一 ID
   */
  generateId() {
    return 'vt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  },

  /**
   * 安全的 HTML 转义
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * 估算字节大小
   */
  estimateBytes(str) {
    return new Blob([str]).size;
  },
};

if (typeof window !== 'undefined') {
  window.VT_UTILS = VT_UTILS;
}
