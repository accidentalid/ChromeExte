/**
 * 划词翻译气泡 - Shadow DOM 隔离
 */
const VT_SELECTION_BUBBLE = {
  host: null,
  shadow: null,
  container: null,
  state: 'hidden', // hidden | trigger | loading | result
  currentText: '',
  boundingRect: null, // 选区整体 bounding rect
  settings: null,

  /**
   * 初始化
   */
  init() {
    this.host = document.createElement('div');
    this.host.setAttribute('data-vt-ext', 'selection-bubble');
    this.host.style.cssText = 'all:initial; position:fixed; z-index:2147483647; pointer-events:none;';
    document.body.appendChild(this.host);

    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = this._getStyles();
    this.shadow.appendChild(style);

    this.container = document.createElement('div');
    this.container.className = 'vt-bubble';
    this.shadow.appendChild(this.container);

    // 点击外部隐藏
    document.addEventListener('mousedown', (e) => {
      if (this.state !== 'hidden' && !e.target.closest?.('[data-vt-ext="selection-bubble"]')) {
        this.hide();
      }
    });
  },

  /**
   * 显示气泡（触发图标状态）
   * @param {string} text - 选中的文本
   * @param {DOMRect} boundingRect - 选区的整体 bounding rect
   * @param {DOMRect} lastRect - 选区最后一行的 rect（用于触发图标定位）
   */
  show(text, boundingRect, lastRect) {
    this.currentText = text;
    this.boundingRect = boundingRect;
    this.state = 'trigger';

    // 用最后一行的 rect 定位触发图标（避免多行时跑到最右边）
    const triggerSize = 32;
    const gap = 6;
    const lr = lastRect || boundingRect;

    // 优先放在最后一行末尾右侧
    let top = lr.top + (lr.height - triggerSize) / 2;
    let left = lr.right + gap;

    // 如果右侧空间不够，放到最后一行下方左侧对齐
    if (left + triggerSize + 8 > window.innerWidth) {
      top = lr.bottom + gap;
      left = Math.max(8, lr.left);
    }

    // 如果下方也不够，放到选区上方
    if (top + triggerSize + 8 > window.innerHeight) {
      top = boundingRect.top - triggerSize - gap;
    }

    // 视口边界限制
    top = Math.max(4, Math.min(top, window.innerHeight - triggerSize - 4));
    left = Math.max(4, Math.min(left, window.innerWidth - triggerSize - 4));

    this.container.style.top = top + 'px';
    this.container.style.left = left + 'px';
    this.container.style.right = 'auto';

    this.container.innerHTML = `
      <div class="vt-trigger" role="button" tabindex="0" aria-label="翻译">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
        </svg>
      </div>
    `;

    this.container.classList.add('vt-bubble--visible');

    // 绑定点击
    const trigger = this.container.querySelector('.vt-trigger');
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this._translate();
    });
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._translate();
      }
    });
    trigger.style.pointerEvents = 'auto';
  },

  /**
   * 隐藏气泡
   */
  hide() {
    this.state = 'hidden';
    this.container.classList.remove('vt-bubble--visible');
    setTimeout(() => {
      if (this.state === 'hidden') {
        this.container.innerHTML = '';
      }
    }, 200);
  },

  /**
   * 将卡片重新定位到选区下方（展开卡片时使用）
   */
  _repositionCard() {
    const br = this.boundingRect;
    if (!br) return;

    const cardWidth = 340;
    const gap = 8;

    // 优先在选区下方
    let top = br.bottom + gap;
    let left = br.left;

    // 如果下方空间不足（卡片约需要 250px 高度），放到上方
    if (top + 200 > window.innerHeight) {
      top = Math.max(8, br.top - 280);
    }

    // 水平方向：保证卡片不超出右边界
    if (left + cardWidth > window.innerWidth - 8) {
      left = window.innerWidth - cardWidth - 8;
    }
    left = Math.max(8, left);
    top = Math.max(8, top);

    this.container.style.top = top + 'px';
    this.container.style.left = left + 'px';
    this.container.style.right = 'auto';
  },

  /**
   * 执行翻译
   */
  async _translate() {
    this.state = 'loading';

    // 重新定位到选区下方，展示卡片
    this._repositionCard();

    // 展开为加载状态
    this.container.innerHTML = `
      <div class="vt-card" style="pointer-events:auto;">
        <div class="vt-card-body">
          <div class="vt-loading">
            <div class="vt-loading-dot"></div>
            <div class="vt-loading-dot"></div>
            <div class="vt-loading-dot"></div>
          </div>
          <span class="vt-loading-text">翻译中...</span>
        </div>
      </div>
    `;

    try {
      const result = await VT_MESSAGE_BUS.sendToBackground('translate_selection', {
        text: this.currentText,
        domain: window.location.hostname,
      });

      if (this.state !== 'loading') return; // 用户已关闭

      if (result && result.success) {
        this._showResult(result.content, result.cached);
      } else {
        this._showError(result?.error?.message || '翻译失败');
      }
    } catch (err) {
      if (this.state === 'loading') {
        this._showError(err.message || '翻译失败');
      }
    }
  },

  /**
   * 显示翻译结果（原文在上，译文在下）
   */
  _showResult(text, cached) {
    this.state = 'result';
    const cachedBadge = cached ? '<span class="vt-badge">已缓存</span>' : '';

    this.container.innerHTML = `
      <div class="vt-card" style="pointer-events:auto;">
        <div class="vt-card-header">
          <span class="vt-card-title">翻译结果 ${cachedBadge}</span>
          <button class="vt-close-btn" aria-label="关闭">&times;</button>
        </div>
        <div class="vt-card-body">
          <div class="vt-source-section">
            <div class="vt-section-label">原文</div>
            <div class="vt-source-text">${this._escapeHtml(this.currentText)}</div>
          </div>
          <div class="vt-divider"></div>
          <div class="vt-result-section">
            <div class="vt-section-label">译文</div>
            <div class="vt-result-text">${this._escapeHtml(text)}</div>
          </div>
        </div>
        <div class="vt-card-footer">
          <button class="vt-copy-btn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            复制译文
          </button>
        </div>
      </div>
    `;

    // 绑定复制按钮
    const copyBtn = this.container.querySelector('.vt-copy-btn');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          已复制
        `;
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            复制译文
          `;
        }, 2000);
      } catch {}
    });

    // 关闭按钮
    this.container.querySelector('.vt-close-btn').addEventListener('click', () => this.hide());
  },

  /**
   * 显示错误
   */
  _showError(message) {
    this.state = 'result';
    const needsReload = message.includes('刷新页面') || message.includes('Extension context');
    const reloadBtn = needsReload
      ? '<button class="vt-reload-btn">刷新页面</button>'
      : '';

    this.container.innerHTML = `
      <div class="vt-card vt-card--error" style="pointer-events:auto;">
        <div class="vt-card-header">
          <span class="vt-card-title">${needsReload ? '扩展已更新' : '翻译失败'}</span>
          <button class="vt-close-btn" aria-label="关闭">&times;</button>
        </div>
        <div class="vt-card-body">
          <div class="vt-error-text">${this._escapeHtml(message)}</div>
          ${reloadBtn}
        </div>
      </div>
    `;

    this.container.querySelector('.vt-close-btn').addEventListener('click', () => this.hide());
    const rb = this.container.querySelector('.vt-reload-btn');
    if (rb) {
      rb.addEventListener('click', () => location.reload());
    }
  },

  /**
   * HTML 转义
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * 获取样式
   */
  _getStyles() {
    return `
      :host { all: initial; }

      .vt-bubble {
        position: fixed;
        z-index: 2147483647;
        opacity: 0;
        transform: scale(0.8);
        transition: opacity 150ms cubic-bezier(0.2, 0, 0, 1),
                    transform 150ms cubic-bezier(0.2, 0, 0, 1);
        pointer-events: none;
      }

      .vt-bubble--visible {
        opacity: 1;
        transform: scale(1);
      }

      .vt-trigger {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #1565C0;
        color: #FFFFFF;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: background 150ms, transform 150ms;
        pointer-events: auto;
      }

      .vt-trigger:hover {
        background: #1E88E5;
        transform: scale(1.1);
      }

      .vt-card {
        width: 340px;
        max-width: 90vw;
        background: #FFFFFF;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1);
        overflow: hidden;
        font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
      }

      .vt-card--error {
        border-top: 3px solid #B3261E;
      }

      .vt-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid #F0F0F0;
      }

      .vt-card-title {
        font-size: 13px;
        font-weight: 500;
        color: #1C1B1F;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .vt-badge {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        background: #E8F5E9;
        color: #2E7D32;
        font-weight: 400;
      }

      .vt-close-btn {
        width: 24px;
        height: 24px;
        border: none;
        background: none;
        font-size: 18px;
        color: #666;
        cursor: pointer;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 150ms;
      }

      .vt-close-btn:hover {
        background: #F0F0F0;
      }

      .vt-card-body {
        padding: 12px 16px;
        max-height: 300px;
        overflow-y: auto;
      }

      .vt-section-label {
        font-size: 11px;
        font-weight: 500;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
      }

      .vt-source-text {
        font-size: 13px;
        line-height: 1.6;
        color: #666;
        word-break: break-word;
        max-height: 80px;
        overflow-y: auto;
      }

      .vt-divider {
        height: 1px;
        background: #E8E8E8;
        margin: 10px 0;
      }

      .vt-result-text {
        font-size: 14px;
        line-height: 1.6;
        color: #333;
        word-break: break-word;
      }

      .vt-error-text {
        font-size: 13px;
        color: #B3261E;
      }

      .vt-reload-btn {
        display: inline-block;
        margin-top: 10px;
        padding: 6px 16px;
        border: none;
        border-radius: 6px;
        background: #1565C0;
        color: #FFF;
        font-size: 13px;
        cursor: pointer;
        font-family: inherit;
        transition: background 150ms;
      }

      .vt-reload-btn:hover {
        background: #1E88E5;
      }

      .vt-card-footer {
        padding: 8px 16px;
        border-top: 1px solid #F0F0F0;
        display: flex;
        justify-content: flex-end;
      }

      .vt-copy-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        border: none;
        background: none;
        font-size: 12px;
        color: #1565C0;
        cursor: pointer;
        border-radius: 4px;
        transition: background 150ms;
        font-family: inherit;
      }

      .vt-copy-btn:hover {
        background: rgba(21, 101, 192, 0.08);
      }

      /* Loading animation */
      .vt-loading {
        display: inline-flex;
        gap: 4px;
        align-items: center;
      }

      .vt-loading-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #1565C0;
        animation: vt-bounce 1.2s ease-in-out infinite;
      }

      .vt-loading-dot:nth-child(2) { animation-delay: 0.2s; }
      .vt-loading-dot:nth-child(3) { animation-delay: 0.4s; }

      @keyframes vt-bounce {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40% { transform: scale(1); opacity: 1; }
      }

      .vt-loading-text {
        font-size: 13px;
        color: #666;
        margin-left: 8px;
      }

      /* Scrollbar */
      .vt-card-body::-webkit-scrollbar,
      .vt-source-text::-webkit-scrollbar {
        width: 4px;
      }
      .vt-card-body::-webkit-scrollbar-track,
      .vt-source-text::-webkit-scrollbar-track {
        background: transparent;
      }
      .vt-card-body::-webkit-scrollbar-thumb,
      .vt-source-text::-webkit-scrollbar-thumb {
        background: #CCC;
        border-radius: 2px;
      }
    `;
  },

  /**
   * 销毁
   */
  destroy() {
    if (this.host) {
      this.host.remove();
      this.host = null;
    }
  },
};

if (typeof window !== 'undefined') {
  window.VT_SELECTION_BUBBLE = VT_SELECTION_BUBBLE;
}
