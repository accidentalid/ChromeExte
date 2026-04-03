/**
 * 翻译引擎 - 分片、并发、缓存编排
 */

import { callLLM, callLLMWithRetry } from './api-adapter.js';
import { buildMessages, buildBatchMessages } from './prompt-builder.js';
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
    // 如果新的 max 更大，释放等待者
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
let writeCount = 0;

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
    writeCount++;
    if (writeCount % 100 === 0) {
      evictOldCache(settings.advanced.cache.maxSizeMB).catch(() => {});
    }
  }

  return { success: result.success, content: result.content, error: result.error, cached: false };
}

/**
 * 翻译页面（批量翻译）
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
    } catch {
      // Tab 可能已关闭
    }
  }

  if (uncachedUnits.length === 0) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'translation_complete', payload: {} });
    } catch {}
    return;
  }

  // 分批
  const chunks = chunkUnits(uncachedUnits, 2000);
  let completedBatches = 0;
  const totalBatches = chunks.length;

  // 并发处理各批次
  const batchPromises = chunks.map(async (chunk) => {
    if (signal?.aborted) return;

    await semaphore.acquire();
    if (signal?.aborted) {
      semaphore.release();
      return;
    }

    try {
      const messages = buildBatchMessages({
        systemPrompt: settings.prompts.system,
        userPrompt: settings.prompts.user,
        segments: chunk,
        sourceLang: sourceLang === 'auto' ? '自动检测' : sourceLang,
        targetLang,
        domain,
      });

      const result = await callLLMWithRetry(providerConfig, messages, {
        timeout: settings.advanced.timeout * 1000,
        signal,
      });

      if (result.success) {
        // 解析带标签的结果
        const translations = parseTaggedResult(result.content, chunk.length);
        const results = chunk.map((seg, i) => ({
          unitId: seg.unitId,
          text: translations[i] || '',
          cached: false,
        }));

        // 写入缓存
        if (settings.advanced.cache.enabled) {
          for (let i = 0; i < chunk.length; i++) {
            if (translations[i]) {
              const cacheKey = makeCacheKey(sourceLang, targetLang, providerConfig.providerKey, providerConfig.model, chunk[i].text);
              await setCache(cacheKey, {
                sourceText: chunk[i].text,
                translatedText: translations[i],
                sourceLang,
                targetLang,
                provider: providerConfig.providerKey,
                model: providerConfig.model,
              });
              writeCount++;
            }
          }
        }

        // 发送结果到 Content Script
        try {
          await chrome.tabs.sendMessage(tabId, {
            type: 'translation_result',
            payload: { results },
          });
        } catch {}
      } else {
        // 发送错误
        const errorResults = chunk.map(seg => ({
          unitId: seg.unitId,
          text: '',
          error: result.error?.message || '翻译失败',
        }));
        try {
          await chrome.tabs.sendMessage(tabId, {
            type: 'translation_error',
            payload: { results: errorResults, error: result.error },
          });
        } catch {}
      }

      completedBatches++;
      // 发送进度
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'translation_progress',
          payload: { completed: completedBatches + cachedResults.length, total: totalBatches + cachedResults.length },
        });
      } catch {}
    } finally {
      semaphore.release();
    }
  });

  await Promise.allSettled(batchPromises);

  // 周期性缓存淘汰
  if (writeCount >= 100) {
    writeCount = 0;
    evictOldCache(settings.advanced.cache.maxSizeMB).catch(() => {});
  }

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

/**
 * 将翻译单元分块
 */
function chunkUnits(units, maxChars = 2000) {
  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;

  for (const unit of units) {
    const textLen = unit.text.length;
    if (currentLength + textLen > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLength = 0;
    }
    currentChunk.push(unit);
    currentLength += textLen;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * 解析带标签的翻译结果
 */
function parseTaggedResult(text, count) {
  const results = [];
  for (let i = 1; i <= count; i++) {
    const regex = new RegExp(`<s${i}>([\\s\\S]*?)</s${i}>`);
    const match = text.match(regex);
    results.push(match ? match[1].trim() : '');
  }

  // 回退策略：如果标签解析完全失败且只有一个段落
  if (results.every(r => r === '')) {
    if (count === 1) {
      return [text.trim()];
    }
    // 尝试按行分割
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length === count) {
      return lines.map(l => l.trim());
    }
  }

  return results;
}
