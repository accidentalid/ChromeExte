/**
 * Qoder Skill: Cache Manager
 *
 * 翻译缓存管理技能 - 统计、分析、清理
 */

class CacheManagerSkill {
  constructor() {
    this.dbName = 'vibe_translate_cache';
    this.storeName = 'translations';
  }

  /**
   * 获取缓存统计信息
   * @returns {Promise<object>}
   */
  async getStats() {
    const db = await this._openDB();
    if (!db) return this._emptyStats();

    return new Promise((resolve) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);

      let count = 0;
      let totalSize = 0;
      let oldestEntry = Infinity;
      let newestEntry = 0;
      const providerCounts = {};
      const langPairCounts = {};

      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (c) {
          const record = c.value;
          count++;
          totalSize += (record.sourceText || '').length * 2 + (record.translatedText || '').length * 2;

          if (record.createdAt < oldestEntry) oldestEntry = record.createdAt;
          if (record.createdAt > newestEntry) newestEntry = record.createdAt;

          const provider = record.provider || 'unknown';
          providerCounts[provider] = (providerCounts[provider] || 0) + 1;

          const langPair = `${record.sourceLang || '?'} → ${record.targetLang || '?'}`;
          langPairCounts[langPair] = (langPairCounts[langPair] || 0) + 1;

          c.continue();
        } else {
          resolve({
            count,
            totalSizeBytes: totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            oldestEntry: count > 0 ? new Date(oldestEntry).toISOString() : null,
            newestEntry: count > 0 ? new Date(newestEntry).toISOString() : null,
            providerBreakdown: providerCounts,
            langPairBreakdown: langPairCounts,
          });
          db.close();
        }
      };

      cursor.onerror = () => {
        resolve(this._emptyStats());
        db.close();
      };
    });
  }

  /**
   * 清除所有缓存
   */
  async clear() {
    const db = await this._openDB();
    if (!db) return { success: false, error: '无法打开数据库' };

    return new Promise((resolve) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const req = tx.objectStore(this.storeName).clear();
      req.onsuccess = () => { resolve({ success: true }); db.close(); };
      req.onerror = () => { resolve({ success: false, error: req.error?.message }); db.close(); };
    });
  }

  /**
   * 按服务商清除
   * @param {string} provider
   */
  async clearByProvider(provider) {
    const db = await this._openDB();
    if (!db) return { success: false, error: '无法打开数据库' };

    return new Promise((resolve) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const index = store.index('provider');
      const req = index.openCursor(IDBKeyRange.only(provider));
      let deleted = 0;

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve({ success: true, deleted });
          db.close();
        }
      };

      req.onerror = () => { resolve({ success: false, error: req.error?.message }); db.close(); };
    });
  }

  /**
   * 按时间清除（删除指定天数之前的记录）
   * @param {number} daysOld
   */
  async clearByAge(daysOld) {
    const db = await this._openDB();
    if (!db) return { success: false, error: '无法打开数据库' };

    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;

    return new Promise((resolve) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const index = store.index('createdAt');
      const range = IDBKeyRange.upperBound(cutoff);
      const req = index.openCursor(range);
      let deleted = 0;

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve({ success: true, deleted });
          db.close();
        }
      };

      req.onerror = () => { resolve({ success: false, error: req.error?.message }); db.close(); };
    });
  }

  /**
   * 缓存健康检查
   * @param {object} limits - { maxSizeMB, ttlHours }
   * @returns {Promise<object>}
   */
  async healthCheck(limits = { maxSizeMB: 50, ttlHours: 72 }) {
    const stats = await this.getStats();
    const issues = [];

    if (parseFloat(stats.totalSizeMB) > limits.maxSizeMB) {
      issues.push(`缓存大小 (${stats.totalSizeMB}MB) 超过限制 (${limits.maxSizeMB}MB)`);
    }

    if (stats.oldestEntry) {
      const ageHours = (Date.now() - new Date(stats.oldestEntry).getTime()) / (1000 * 60 * 60);
      if (ageHours > limits.ttlHours * 2) {
        issues.push(`存在超过 TTL 两倍时间的陈旧缓存条目`);
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats,
      recommendations: issues.length > 0
        ? ['建议运行缓存清理以释放空间和删除过期条目']
        : [],
    };
  }

  /**
   * 打开 IndexedDB
   */
  _openDB() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
            store.createIndex('createdAt', 'createdAt', { unique: false });
            store.createIndex('accessedAt', 'accessedAt', { unique: false });
            store.createIndex('provider', 'provider', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  _emptyStats() {
    return {
      count: 0,
      totalSizeBytes: 0,
      totalSizeMB: '0.00',
      oldestEntry: null,
      newestEntry: null,
      providerBreakdown: {},
      langPairBreakdown: {},
    };
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CacheManagerSkill;
}
if (typeof window !== 'undefined') {
  window.CacheManagerSkill = CacheManagerSkill;
}
