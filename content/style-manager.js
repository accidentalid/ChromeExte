/**
 * 译文样式管理器
 */
const VT_STYLE_MANAGER = {
  styleElement: null,

  /**
   * 应用译文样式
   * @param {object} style - { bold, underline, backgroundColor, fontSize, color, separator }
   */
  applyStyle(style) {
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.setAttribute('data-vt-ext', 'style-manager');
      document.head.appendChild(this.styleElement);
    }

    const fontSizeMap = {
      'same': '1em',
      'smaller': '0.9em',
      'larger': '1.1em',
    };

    const separatorMap = {
      'none': 'none',
      'dashed': '1px dashed #E0E0E0',
      'solid': '1px solid #E0E0E0',
    };

    const fontSize = fontSizeMap[style.fontSize] || '1em';
    const borderTop = separatorMap[style.separator] || 'none';
    const bgColor = style.backgroundColor || 'transparent';
    const textColor = style.color || '#666666';

    this.styleElement.textContent = `
      .vt-trans {
        font-size: ${fontSize} !important;
        color: ${textColor} !important;
        ${style.bold ? 'font-weight: bold !important;' : ''}
        ${style.underline ? 'text-decoration: underline !important;' : ''}
        ${bgColor !== 'transparent' ? `background-color: ${bgColor} !important;` : ''}
        border-top: ${borderTop} !important;
        margin-top: 4px !important;
        padding-top: 4px !important;
        line-height: 1.6 !important;
        font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif !important;
      }

      /* 仅译文模式 */
      .vt-mode-target-only [data-vt-id] {
        display: none !important;
      }
      .vt-mode-target-only .vt-trans {
        border-top: none !important;
        margin-top: 0 !important;
        padding-top: 0 !important;
        color: inherit !important;
        font-size: inherit !important;
        font-weight: inherit !important;
        text-decoration: inherit !important;
        background-color: transparent !important;
      }
    `;
  },

  /**
   * 清理
   */
  cleanup() {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  },
};

if (typeof window !== 'undefined') {
  window.VT_STYLE_MANAGER = VT_STYLE_MANAGER;
}
