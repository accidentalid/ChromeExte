/**
 * 悬浮翻译按钮 (FAB) - Shadow DOM 隔离
 */
const VT_FLOATING_BUBBLE = {
  host: null,
  shadow: null,
  fab: null,
  state: 'idle', // idle | translating | done | error
  isDragging: false,
  dragStart: null,
  position: { right: 24, bottom: 80 },

  // SVG 图标
  ICONS: {
    translate: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`,
    stop: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>`,
    done: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
    error: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
  },

  /**
   * 初始化
   */
  init() {
    // 创建 Shadow DOM 宿主
    this.host = document.createElement('div');
    this.host.setAttribute('data-vt-ext', 'floating-bubble');
    this.host.style.cssText = 'all:initial; position:fixed; z-index:2147483647; pointer-events:none;';
    document.body.appendChild(this.host);

    this.shadow = this.host.attachShadow({ mode: 'closed' });

    // 注入样式
    const style = document.createElement('style');
    style.textContent = this._getStyles();
    this.shadow.appendChild(style);

    // 创建 FAB
    this.fab = document.createElement('div');
    this.fab.className = 'vt-fab';
    this.fab.setAttribute('role', 'button');
    this.fab.setAttribute('aria-label', '翻译此页面');
    this.fab.setAttribute('tabindex', '0');
    this.fab.innerHTML = `
      <div class="vt-fab-icon">${this.ICONS.translate}</div>
      <svg class="vt-fab-progress" viewBox="0 0 60 60">
        <circle class="progress-track" cx="30" cy="30" r="27" />
        <circle class="progress-fill" cx="30" cy="30" r="27" />
      </svg>
      <div class="vt-fab-tooltip">翻译此页面</div>
    `;
    this.shadow.appendChild(this.fab);

    // 加载保存的位置
    this._loadPosition();

    // 绑定事件
    this._bindEvents();

    // 入场动画
    requestAnimationFrame(() => {
      this.fab.classList.add('vt-fab--visible');
    });
  },

  /**
   * 设置状态
   */
  setState(state, progress = 0) {
    this.state = state;
    const iconEl = this.fab.querySelector('.vt-fab-icon');
    const progressFill = this.fab.querySelector('.progress-fill');
    const tooltip = this.fab.querySelector('.vt-fab-tooltip');

    this.fab.className = `vt-fab vt-fab--visible vt-fab--${state}`;

    switch (state) {
      case 'idle':
        iconEl.innerHTML = this.ICONS.translate;
        tooltip.textContent = '翻译此页面';
        break;
      case 'translating':
        iconEl.innerHTML = this.ICONS.stop;
        tooltip.textContent = `翻译中 ${progress}%`;
        // 更新进度环
        const circumference = 2 * Math.PI * 27;
        const offset = circumference - (progress / 100) * circumference;
        progressFill.style.strokeDashoffset = offset;
        break;
      case 'done':
        iconEl.innerHTML = this.ICONS.done;
        tooltip.textContent = '翻译完成';
        break;
      case 'error':
        iconEl.innerHTML = this.ICONS.error;
        tooltip.textContent = '翻译出错';
        break;
    }
  },

  /**
   * 显示/隐藏
   */
  show() {
    this.host.style.display = '';
  },

  hide() {
    this.host.style.display = 'none';
  },

  /**
   * 绑定事件
   */
  _bindEvents() {
    let startX, startY, startRight, startBottom, moved;

    this.fab.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.isDragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      startRight = this.position.right;
      startBottom = this.position.bottom;
      this.fab.setPointerCapture(e.pointerId);
      this.fab.classList.add('vt-fab--dragging');
    });

    this.fab.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
      }

      this.position.right = Math.max(0, Math.min(startRight - dx, window.innerWidth - 60));
      this.position.bottom = Math.max(0, Math.min(startBottom - dy, window.innerHeight - 60));
      this._updatePosition(false);
    });

    this.fab.addEventListener('pointerup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.fab.classList.remove('vt-fab--dragging');

      if (!moved) {
        this._handleClick();
      } else {
        // 吸附到最近的边缘
        this._snapToEdge();
        this._savePosition();
      }
    });

    // 键盘支持
    this.fab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._handleClick();
      }
    });
  },

  /**
   * 处理点击
   */
  _handleClick() {
    if (this.state === 'translating') {
      // 停止翻译
      VT_PAGE_TRANSLATOR.stop();
    } else {
      // 开始翻译
      VT_MESSAGE_BUS.sendToBackground('get_settings', {}).then(settings => {
        VT_PAGE_TRANSLATOR.start(settings.language.source, settings.language.target);
      });
    }
  },

  /**
   * 吸附到边缘
   */
  _snapToEdge() {
    const midX = window.innerWidth / 2;
    const fabCenterX = window.innerWidth - this.position.right - 28;

    if (fabCenterX < midX) {
      // 吸附到左侧
      this.position.right = window.innerWidth - 80;
    } else {
      // 吸附到右侧
      this.position.right = 24;
    }
    this._updatePosition(true);
  },

  /**
   * 更新位置
   */
  _updatePosition(animate) {
    this.fab.style.transition = animate ? 'right 300ms cubic-bezier(0.2, 0, 0, 1), bottom 300ms cubic-bezier(0.2, 0, 0, 1)' : 'none';
    this.fab.style.right = this.position.right + 'px';
    this.fab.style.bottom = this.position.bottom + 'px';
  },

  /**
   * 加载保存的位置
   */
  _loadPosition() {
    chrome.storage.local.get('vibe_bubble_position', (result) => {
      if (result.vibe_bubble_position) {
        this.position = result.vibe_bubble_position;
      }
      this._updatePosition(false);
    });
  },

  /**
   * 保存位置
   */
  _savePosition() {
    chrome.storage.local.set({ vibe_bubble_position: this.position });
  },

  /**
   * 获取组件样式
   */
  _getStyles() {
    return `
      :host { all: initial; }

      .vt-fab {
        position: fixed;
        right: 24px;
        bottom: 80px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #1565C0;
        color: #FFFFFF;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 6px 10px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.14);
        pointer-events: auto;
        user-select: none;
        opacity: 0;
        transform: scale(0);
        transition: opacity 400ms cubic-bezier(0.34, 1.56, 0.64, 1),
                    transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1),
                    background 200ms ease;
        z-index: 2147483647;
        touch-action: none;
      }

      .vt-fab--visible {
        opacity: 1;
        transform: scale(1);
      }

      .vt-fab:hover {
        box-shadow: 0 8px 14px rgba(0,0,0,0.25), 0 3px 6px rgba(0,0,0,0.18);
      }

      .vt-fab--dragging {
        transition: none !important;
        box-shadow: 0 12px 20px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.2);
      }

      .vt-fab--translating {
        background: #E65100;
      }

      .vt-fab--done {
        background: #2E7D32;
      }

      .vt-fab--error {
        background: #B3261E;
      }

      .vt-fab-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
        transition: transform 200ms ease;
      }

      .vt-fab--translating .vt-fab-icon {
        animation: vt-pulse 1.5s ease-in-out infinite;
      }

      @keyframes vt-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(0.85); }
      }

      .vt-fab-progress {
        position: absolute;
        width: 60px;
        height: 60px;
        transform: rotate(-90deg);
        opacity: 0;
        transition: opacity 200ms;
      }

      .vt-fab--translating .vt-fab-progress {
        opacity: 1;
      }

      .progress-track {
        fill: none;
        stroke: rgba(255,255,255,0.2);
        stroke-width: 3;
      }

      .progress-fill {
        fill: none;
        stroke: #FFFFFF;
        stroke-width: 3;
        stroke-dasharray: ${2 * Math.PI * 27};
        stroke-dashoffset: ${2 * Math.PI * 27};
        stroke-linecap: round;
        transition: stroke-dashoffset 300ms ease;
      }

      .vt-fab-tooltip {
        position: absolute;
        right: 64px;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(50, 50, 50, 0.9);
        color: #fff;
        padding: 6px 12px;
        border-radius: 4px;
        font: 500 12px/16px "PingFang SC", "Microsoft YaHei", sans-serif;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 200ms 400ms;
      }

      .vt-fab:hover .vt-fab-tooltip {
        opacity: 1;
      }

      .vt-fab--dragging .vt-fab-tooltip {
        opacity: 0 !important;
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
  window.VT_FLOATING_BUBBLE = VT_FLOATING_BUBBLE;
}
