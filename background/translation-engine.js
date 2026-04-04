/**
 * 翻译引擎 - 逐段落并发翻译 + 缓存编排
 */

import { callLLM, callLLMWithRetry } from './api-adapter.js';
import { buildMessages } from './prompt-builder.js';
import { getCache, setCache, makeCacheKey, evictOldCache } from './cache-manager.js';
import { getSettings, getActiveProviderConfig } from './settings-manager.js';

// 并发控制信号量
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise(resolve => this.queue.push(resolve));
  }

  release() {
    this.current--;
    if (this.queue.length > 0) {
      this.current++;
      const next = this.queue.shift();
      next();
    }
  }

  updateMax(newMax) {
    this.max = newMax;
    while (this.current < this.max && this.queue.length > 0) {
      this.current++;
      const next = this.queue.shift();
      next();
    }
  }

  cancelAll() {
    const waiters = this.queue.splice(0);
    waiters.forEach(resolve => resolve('cancelled'));
  }
}

let semaphore = new Semaphore(3);
const MAX_CACHE_ENTRIES = 50;

/**
 * 翻译单条文本（用于划词翻译）
 */
export async function translateSelection(text, sourceLang, targetLang, domain = '') {
  const settings = await getSettings();
  const providerConfig = await getActiveProviderConfig();

  // 缓存检查
  if (settings.advanced.cache.enabled) {
    const cacheKey = makeCacheKey(sourceLang, targetLang, providerConfig.providerKey, providerConfig.model, text);
    const cached = await getCache(cacheKey, settings.advanced.cache.ttlHours);
    if (cached) {
      return { success: true, content: cached.translatedText, cached: true };
    }
  }

  // 构建 Prompt
  const messages = buildMessages({
    systemPrompt: settings.prompts.system,
    userPrompt: settings.prompts.user,
    text,
    sourceLang: sourceLang === 'auto' ? '自动检测' : sourceLang,
    targetLang,
    domain,
  });

  // 调用 API
  const result = await callLLMWithRetry(providerConfig, messages, {
    timeout: settings.advanced.timeout * 1000,
  });

  // 写入缓存
  if (result.success && settings.advanced.cache.enabled) {
    const cacheKey = makeCacheKey(sourceLang, targetLang, providerConfig.providerKey, providerConfig.model, text);
    await setCache(cacheKey, {
      sourceText: text,
      translatedText: result.content,
      sourceLang,
      targetLang,
      provider: providerConfig.providerKey,
      model: providerConfig.model,
    });
    evictOldCache(MAX_CACHE_ENTRIES).catch(() => {});
  }

  return { success: result.success, content: result.content, error: result.error, cached: false };
}

/**
 * 翻译页面（逐段落独立翻译，并发控制）
 * 每个段落（翻译单元）独立发送一次翻译请求，由信号量控制并发数。
 * @param {Array<{unitId: string, text: string}>} units - 翻译单元列表
 * @param {string} sourceLang
 * @param {string} targetLang
 * @param {string} domain
 * @param {number} tabId - 目标 Tab ID
 * @param {AbortSignal} signal - 取消信号
 */
export async function translatePage(units, sourceLang, targetLang, domain, tabId, signal) {
  const settings = await getSettings();
  const providerConfig = await getActiveProviderConfig();

  // 更新并发信号量
  semaphore.updateMax(settings.advanced.concurrency);

  // 缓存分流
  const cachedResults = [];
  const uncachedUnits = [];

  if (settings.advanced.cache.enabled) {
    for (const unit of units) {
      const cacheKey = makeCacheKey(sourceLang, targetLang, providerConfig.providerKey, providerConfig.model, unit.text);
      const cached = await getCache(cacheKey, settings.advanced.cache.ttlHours);
      if (cached) {
        cachedResults.push({ unitId: unit.unitId, text: cached.translatedText, cached: true });
      } else {
        uncachedUnits.push(unit);
      }
    }
  } else {
    uncachedUnits.push(...units);
  }

  // 立即发送缓存命中的结果
  if (cachedResults.length > 0) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'translation_result',
        payload: { results: cachedResults },
      });
    } catch {}
  }

  if (uncachedUnits.length === 0) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'translation_complete', payload: {} });
    } catch {}
    return;
  }

  const totalCount = uncachedUnits.length + cachedResults.length;
  let completedCount = cachedResults.length;

  // 逐段落并发翻译
  const unitPromises = uncachedUnits.map(async (unit) => {
    if (signal?.aborted) return;

    await semaphore.acquire();
    if (signal?.aborted) {
      semaphore.release();
      return;
    }

    try {
      const messages = buildMessages({
        systemPrompt: settings.prompts.system,
        userPrompt: settings.prompts.user,
        text: unit.text,
        sourceLang: sourceLang === 'auto' ? '自动检测' : sourceLang,
        targetLang,
        domain,
      });

      const result = await callLLMWithRetry(providerConfig, messages, {
        timeout: settings.advanced.timeout * 1000,
        signal,
      });

      if (result.success) {
        const translatedText = result.content;

        // 写入缓存
        if (settings.advanced.cache.enabled) {
          const cacheKey = makeCacheKey(sourceLang, targetLang, providerConfig.providerKey, providerConfig.model, unit.text);
          await setCache(cacheKey, {
            sourceText: unit.text,
            translatedText,
            sourceLang,
            targetLang,
            provider: providerConfig.providerKey,
            model: providerConfig.model,
          });
        }

        // 发送结果
        try {
          await chrome.tabs.sendMessage(tabId, {
            type: 'translation_result',
            payload: { results: [{ unitId: unit.unitId, text: translatedText, cached: false }] },
          });
        } catch {}
      } else {
        try {
          await chrome.tabs.sendMessage(tabId, {
            type: 'translation_error',
            payload: {
              results: [{ unitId: unit.unitId, text: '', error: result.error?.message || '翻译失败' }],
              error: result.error,
            },
          });
        } catch {}
      }

      completedCount++;
      // 发送进度
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'translation_progress',
          payload: { completed: completedCount, total: totalCount },
        });
      } catch {}
    } finally {
      semaphore.release();
    }
  });

  await Promise.allSettled(unitPromises);

  // 批量翻译完成后淘汰超限缓存
  evictOldCache(MAX_CACHE_ENTRIES).catch(() => {});

  // 发送翻译完成
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'translation_complete', payload: {} });
  } catch {}
}

/**
 * 测试服务商连接
 */
export async function testProvider(providerKey) {
  const settings = await getSettings();
  const providerSettings = settings.providers[providerKey];
  if (!providerSettings) {
    return { success: false, error: { message: '服务商不存在' } };
  }

  const config = {
    base_url: providerSettings.base_url,
    api_key: providerSettings.api_key,
    model: providerSettings.customModel || providerSettings.model,
  };

  const messages = [
    { role: 'system', content: 'You are a helpful translator.' },
    { role: 'user', content: 'Translate "hello" to Chinese. Reply with only the translation.' },
  ];

  return callLLM(config, messages, { timeout: 15000 });
}
