/**
 * Qoder Translation Agent
 *
 * 翻译编排代理 - 负责高层翻译策略决策
 * 根据文本长度和场景决定最优翻译方式
 */

class TranslationAgent {
  constructor() {
    this.strategies = {
      direct: { maxLength: 500, description: '短文本直接翻译' },
      batch: { maxLength: 10000, description: '中等文本分批翻译' },
      stream: { maxLength: Infinity, description: '长文本流式翻译' },
    };
  }

  /**
   * 决策翻译策略
   * @param {string|Array} input - 待翻译文本或文本数组
   * @returns {{ strategy: string, config: object }}
   */
  decideStrategy(input) {
    const totalLength = Array.isArray(input)
      ? input.reduce((sum, t) => sum + (typeof t === 'string' ? t.length : t.text?.length || 0), 0)
      : input.length;

    if (totalLength <= this.strategies.direct.maxLength) {
      return {
        strategy: 'direct',
        config: { stream: false, batchSize: 1 },
      };
    }

    if (totalLength <= this.strategies.batch.maxLength) {
      return {
        strategy: 'batch',
        config: { stream: false, batchSize: Math.ceil(totalLength / 2000) },
      };
    }

    return {
      strategy: 'stream',
      config: { stream: true, batchSize: Math.ceil(totalLength / 2000) },
    };
  }

  /**
   * 执行翻译
   * @param {object} params
   * @param {string|Array} params.text - 待翻译内容
   * @param {string} params.sourceLang - 源语言
   * @param {string} params.targetLang - 目标语言
   * @param {object} params.providerConfig - 服务商配置
   * @param {object} params.promptConfig - Prompt 配置
   * @param {object} params.cacheManager - 缓存管理器实例
   * @returns {Promise<object>}
   */
  async translate(params) {
    const { text, sourceLang, targetLang, providerConfig, promptConfig, cacheManager } = params;
    const strategy = this.decideStrategy(text);

    const result = {
      strategy: strategy.strategy,
      translations: [],
      cacheHits: 0,
      apiCalls: 0,
      totalTime: 0,
    };

    const startTime = Date.now();

    if (typeof text === 'string') {
      // 单文本翻译
      const cached = cacheManager ? await cacheManager.get(sourceLang, targetLang, text) : null;
      if (cached) {
        result.translations.push({ text: cached, cached: true });
        result.cacheHits = 1;
      } else {
        result.apiCalls = 1;
        // API 调用逻辑委托给 translation-engine
      }
    } else if (Array.isArray(text)) {
      // 批量翻译
      const uncached = [];
      for (const item of text) {
        const t = typeof item === 'string' ? item : item.text;
        const cached = cacheManager ? await cacheManager.get(sourceLang, targetLang, t) : null;
        if (cached) {
          result.translations.push({ text: cached, cached: true });
          result.cacheHits++;
        } else {
          uncached.push(item);
        }
      }
      result.apiCalls = Math.ceil(uncached.length / (strategy.config.batchSize || 10));
    }

    result.totalTime = Date.now() - startTime;
    return result;
  }

  /**
   * 获取服务商状态
   * @param {object} providerConfig
   * @returns {Promise<{available: boolean, latency: number}>}
   */
  async getProviderStatus(providerConfig) {
    if (!providerConfig.base_url || !providerConfig.api_key) {
      return { available: false, latency: -1, reason: '未配置' };
    }

    const startTime = Date.now();
    try {
      const response = await fetch(`${providerConfig.base_url}/models`, {
        headers: { 'Authorization': `Bearer ${providerConfig.api_key}` },
        signal: AbortSignal.timeout(5000),
      });
      const latency = Date.now() - startTime;
      return { available: response.ok, latency, reason: response.ok ? '' : `HTTP ${response.status}` };
    } catch (err) {
      return { available: false, latency: Date.now() - startTime, reason: err.message };
    }
  }

  /**
   * 智能语言检测
   * @param {string} text
   * @returns {string} 检测到的语言代码
   */
  detectLanguage(text) {
    const sample = text.slice(0, 500);
    const patterns = [
      { lang: 'zh-CN', regex: /[\u4e00-\u9fff]/, weight: 1 },
      { lang: 'ja', regex: /[\u3040-\u309f\u30a0-\u30ff]/, weight: 1.5 },
      { lang: 'ko', regex: /[\uac00-\ud7af]/, weight: 1 },
      { lang: 'ru', regex: /[\u0400-\u04ff]/, weight: 1 },
      { lang: 'ar', regex: /[\u0600-\u06ff]/, weight: 1 },
      { lang: 'th', regex: /[\u0e00-\u0e7f]/, weight: 1 },
      { lang: 'hi', regex: /[\u0900-\u097f]/, weight: 1 },
    ];

    let bestLang = 'en';
    let bestScore = 0;

    for (const { lang, regex, weight } of patterns) {
      const matches = sample.match(new RegExp(regex.source, 'g'));
      const score = (matches ? matches.length : 0) * weight;
      if (score > bestScore) {
        bestScore = score;
        bestLang = lang;
      }
    }

    // 如果没有非拉丁字符匹配，默认为英语
    return bestScore > 0 ? bestLang : 'en';
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslationAgent;
}
if (typeof window !== 'undefined') {
  window.TranslationAgent = TranslationAgent;
}
