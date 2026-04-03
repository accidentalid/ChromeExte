/**
 * 划词选中事件处理
 */
const VT_SELECTION_HANDLER = {
  enabled: true,
  bubble: null, // 将在 content-main.js 中注入

  init(selectionBubble) {
    this.bubble = selectionBubble;
    this._onMouseUp = VT_UTILS.debounce(this._handleMouseUp.bind(this), 200);
    document.addEventListener('mouseup', this._onMouseUp);
  },

  _handleMouseUp(e) {
    if (!this.enabled) return;

    // 忽略在插件 UI 上的点击
    if (e.target.closest?.('[data-vt-ext]')) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (!text || text.length < 1) {
      // 无选中文本，隐藏气泡
      if (this.bubble) this.bubble.hide();
      return;
    }

    // 获取选区位置
    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0 && rect.height === 0) return;

      // 获取最后一行的 rect，用于精确定位触发图标
      const clientRects = range.getClientRects();
      const lastRect = clientRects.length > 0
        ? clientRects[clientRects.length - 1]
        : rect;

      if (this.bubble) {
        this.bubble.show(text, rect, lastRect);
      }
    } catch {
      // 忽略选区异常
    }
  },

  setEnabled(enabled) {
    this.enabled = enabled;
  },

  destroy() {
    document.removeEventListener('mouseup', this._onMouseUp);
  },
};

if (typeof window !== 'undefined') {
  window.VT_SELECTION_HANDLER = VT_SELECTION_HANDLER;
}
