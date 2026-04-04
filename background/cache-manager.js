/**
 * IndexedDB 翻译缓存管理器
 */

const DB_NAME = 'vibe_translate_cache';
const DB_VERSION = 1;
const STORE_NAME = 'translations';

let dbPromise = null;

/**
 * 获取/初始化数据库
 */
function getDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('accessedAt', 'accessedAt', { unique: false });
        store.createIndex('provider', 'provider', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * FNV-1a 哈希
 */
function fnv1aHash(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * 生成缓存键
 */
export function makeCacheKey(sourceLang, targetLang, provider, model, text) {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return fnv1aHash(`${sourceLang}|${targetLang}|${provider}|${model}|${normalized}`);
}

/**
 * 查询缓存
 */
export async function getCache(key, ttlHours = 72) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const record = request.result;
        if (!record) {
          resolve(null);
          return;
        }

        // TTL 检查
        const ttlMs = ttlHours * 60 * 60 * 1000;
        if (Date.now() - record.createdAt > ttlMs) {
          store.delete(key);
          resolve(null);
          return;
        }

        // 更新访问时间和次数
        record.accessedAt = Date.now();
        record.accessCount = (record.accessCount || 0) + 1;
        store.put(record);

        resolve(record);
      };

      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

/**
 * 写入缓存
 */
export async function setCache(key, data) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record = {
        key,
        sourceText: data.sourceText,
        translatedText: data.translatedText,
        sourceLang: data.sourceLang,
        targetLang: data.targetLang,
        provider: data.provider,
        model: data.model,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        accessCount: 0,
      };

      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // 静默失败
  }
}

/**
 * 批量查询缓存
 */
export async function batchGetCache(keys, ttlHours = 72) {
  const results = {};
  for (const key of keys) {
    results[key] = await getCache(key, ttlHours);
  }
  return results;
}

/**
 * 清除所有缓存
 */
export async function clearAllCache() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // 尝试删除整个数据库
    dbPromise = null;
    indexedDB.deleteDatabase(DB_NAME);
  }
}

/**
 * 按服务商清除缓存
 */
export async function clearCacheByProvider(providerKey) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('provider');
      const request = index.openCursor(IDBKeyRange.only(providerKey));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch {
    // 静默失败
  }
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        const count = countRequest.result;

        // 估算大小
        let estimatedSize = 0;
        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor) {
            const record = cursor.value;
            estimatedSize += (record.sourceText || '').length * 2 + (record.translatedText || '').length * 2;
            cursor.continue();
          } else {
            resolve({
              count,
              estimatedSizeBytes: estimatedSize,
              estimatedSizeMB: (estimatedSize / 1024 / 1024).toFixed(2),
            });
          }
        };
        cursorRequest.onerror = () => resolve({ count, estimatedSizeBytes: 0, estimatedSizeMB: '0.00' });
      };

      countRequest.onerror = () => reject(countRequest.error);
    });
  } catch {
    return { count: 0, estimatedSizeBytes: 0, estimatedSizeMB: '0.00' };
  }
}

/**
 * 淘汰旧缓存（按访问时间排序，超过 maxCount 条时删除最旧的）
 */
export async function evictOldCache(maxCount = 50) {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();

      countReq.onsuccess = () => {
        const total = countReq.result;
        if (total <= maxCount) { resolve(); return; }

        const deleteCount = total - maxCount;
        const index = store.index('accessedAt');
        const cursorReq = index.openCursor();
        let deleted = 0;

        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor && deleted < deleteCount) {
            cursor.delete();
            deleted++;
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorReq.onerror = () => resolve();
      };
      countReq.onerror = () => resolve();
    });
  } catch {
    // 静默失败
  }
}
