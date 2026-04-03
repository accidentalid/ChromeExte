/**
 * 全页翻译协调器
 */
const VT_PAGE_TRANSLATOR = {
  translating: false,
  totalUnits: 0,
  completedUnits: 0,
  observer: null,
  keepAlivePort: null,

  /**
   * 开始全页翻译
   */
  async start(sourceLang, targetLang) {
    if (this.translating) return;
    this.translating = true;
    this.completedUnits = 0;

    // 建立 keep-alive 长连接
    try {
      this.keepAlivePort = chrome.runtime.connect({ name: 'vibe-keepalive' });
      this._keepAliveInterval = setInterval(() => {
        try { this.keepAlivePort.postMessage({ ping: true }); } catch {}
      }, 20000);
    } catch {}

    // 提取文本
    const units = VT_TEXT_EXTRACTOR.extract();
    this.totalUnits = units.length;

    if (units.length === 0) {
      this.translating = false;
      this._cleanup();
      return;
    }

    // 通知 FAB 更新状态
    if (window.VT_FLOATING_BUBBLE) {
      window.VT_FLOATING_BUBBLE.setState('translating', 0);
    }

    // 发送翻译请求到 background
    const domain = window.location.hostname;
    const unitData = units.map(u => ({ unitId: u.unitId, text: u.text }));

    try {
      await VT_MESSAGE_BUS.sendToBackground('translate_page', {
        units: unitData,
        sourceLang,
        targetLang,
        domain,
      });
    } catch (err) {
      console.error('[Vibe] Page translate error:', err);
      this.translating = false;
      if (window.VT_FLOATING_BUBBLE) {
        window.VT_FLOATING_BUBBLE.setState('error');
      }
    }

    // 启动 MutationObserver 监听动态内容
    this._startObserver(sourceLang, targetLang);
  },

  /**
   * 停止翻译
   */
  stop() {
    this.translating = false;
    this._cleanup();

    // 发送取消请求
    try {
      VT_MESSAGE_BUS.sendToBackground('cancel_translation', {});
    } catch {}

    // 移除所有翻译
    VT_DOM_INJECTOR.removeAll();

    if (window.VT_FLOATING_BUBBLE) {
      window.VT_FLOATING_BUBBLE.setState('idle');
    }
  },

  /**
   * 处理来自 background 的翻译结果
   */
  handleResult(results, targetLang) {
    VT_DOM_INJECTOR.batchInject(results, targetLang);
    this.completedUnits += results.length;

    if (window.VT_FLOATING_BUBBLE && this.totalUnits > 0) {
      const progress = Math.round((this.completedUnits / this.totalUnits) * 100);
      window.VT_FLOATING_BUBBLE.setState('translating', progress);
    }
  },

  /**
   * 处理翻译完成
   */
  handleComplete() {
    this.translating = false;
    this._cleanup();

    if (window.VT_FLOATING_BUBBLE) {
      window.VT_FLOATING_BUBBLE.setState('done');
      setTimeout(() => {
        if (!this.translating && window.VT_FLOATING_BUBBLE) {
          window.VT_FLOATING_BUBBLE.setState('idle');
        }
      }, 2000);
    }
  },

  /**
   * 处理翻译错误
   */
  handleError(error) {
    console.error('[Vibe] Translation error:', error);
    if (window.VT_FLOATING_BUBBLE) {
      window.VT_FLOATING_BUBBLE.setState('error');
    }
  },

  /**
   * 启动动态内容监听
   */
  _startObserver(sourceLang, targetLang) {
    if (this.observer) this.observer.disconnect();

    const handleMutations = VT_UTILS.debounce(() => {
      if (!this.translating || !VT_DOM_INJECTOR.hasTranslations()) return;

      // 检查是否有新的未翻译文本
      const newUnits = VT_TEXT_EXTRACTOR.extract().filter(u => {
        return !document.querySelector(`[data-vt-for="${u.unitId}"]`);
      });

      if (newUnits.length > 0) {
        const domain = window.location.hostname;
        const unitData = newUnits.map(u => ({ unitId: u.unitId, text: u.text }));
        this.totalUnits += newUnits.length;

        VT_MESSAGE_BUS.sendToBackground('translate_page', {
          units: unitData,
          sourceLang,
          targetLang,
          domain,
        }).catch(() => {});
      }
    }, 1000);

    this.observer = new MutationObserver(handleMutations);
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },

  /**
   * 清理资源
   */
  _cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this._keepAliveInterval) {
      clearInterval(this._keepAliveInterval);
      this._keepAliveInterval = null;
    }
    if (this.keepAlivePort) {
      try { this.keepAlivePort.disconnect(); } catch {}
      this.keepAlivePort = null;
    }
  },
};

if (typeof window !== 'undefined') {
  window.VT_PAGE_TRANSLATOR = VT_PAGE_TRANSLATOR;
}
