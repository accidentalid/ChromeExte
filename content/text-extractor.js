/**
 * DOM 遍历 - 提取可翻译文本节点
 */
const VT_TEXT_EXTRACTOR = {
  // 跳过的标签
  SKIP_TAGS: new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
    'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'INPUT', 'TEXTAREA',
    'SELECT', 'BUTTON', 'CODE', 'PRE', 'KBD', 'SAMP', 'VAR',
    'IMG', 'BR', 'HR', 'MATH',
  ]),

  // Markdown 渲染后常见的代码块容器 class 关键词
  CODE_BLOCK_CLASSES: ['highlight', 'codehilite', 'code-block', 'source-code', 'gist', 'CodeMirror'],

  // 块级标签
  BLOCK_TAGS: new Set([
    'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'LI', 'TD', 'TH', 'DT', 'DD',
    'DIV', 'SECTION', 'ARTICLE', 'ASIDE', 'MAIN', 'NAV', 'HEADER', 'FOOTER',
    'BLOCKQUOTE', 'FIGCAPTION', 'FIGURE', 'DETAILS', 'SUMMARY',
  ]),

  /**
   * 提取页面中所有可翻译的文本单元
   * @returns {Array<{unitId: string, text: string, element: Element}>}
   */
  extract() {
    const units = new Map(); // element → { unitId, text, element }
    let unitCounter = 0;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // 跳过空文本
          const text = node.textContent.trim();
          if (!text || text.length < 2) return NodeFilter.FILTER_REJECT;

          // 检查父元素
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          // 跳过特定标签
          if (this.shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;

          // 跳过隐藏元素
          if (this.isHidden(parent)) return NodeFilter.FILTER_REJECT;

          // 跳过已翻译的元素
          if (parent.hasAttribute('data-vt-for') || parent.hasAttribute('data-vt-ext')) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    // 收集所有文本节点并按块级元素分组
    let currentNode;
    while ((currentNode = walker.nextNode())) {
      const blockParent = this.findBlockParent(currentNode);
      if (!blockParent) continue;

      // 跳过已标记的元素
      if (blockParent.hasAttribute('data-vt-id')) {
        const existingId = blockParent.getAttribute('data-vt-id');
        if (units.has(existingId)) continue;
      }

      if (!units.has(blockParent)) {
        unitCounter++;
        const unitId = 'vt-u-' + unitCounter;
        units.set(blockParent, {
          unitId,
          text: '',
          element: blockParent,
        });
      }

      const unit = units.get(blockParent);
      const nodeText = currentNode.textContent.trim();
      if (nodeText) {
        unit.text += (unit.text ? ' ' : '') + nodeText;
      }
    }

    // 过滤太短的单元，标记元素
    const result = [];
    for (const unit of units.values()) {
      if (unit.text.length >= 2) {
        unit.element.setAttribute('data-vt-id', unit.unitId);
        result.push({
          unitId: unit.unitId,
          text: unit.text,
          element: unit.element,
        });
      }
    }

    return result;
  },

  /**
   * 查找最近的块级祖先元素
   */
  findBlockParent(node) {
    let el = node.parentElement;
    while (el && el !== document.body) {
      if (this.isBlockElement(el)) return el;
      el = el.parentElement;
    }
    return null;
  },

  /**
   * 判断是否为块级元素
   */
  isBlockElement(el) {
    if (this.BLOCK_TAGS.has(el.tagName)) return true;
    try {
      const display = getComputedStyle(el).display;
      return display === 'block' || display === 'flex' || display === 'grid' ||
             display === 'list-item' || display === 'table-cell';
    } catch {
      return false;
    }
  },

  /**
   * 判断元素是否应该跳过
   */
  shouldSkipElement(el) {
    let current = el;
    while (current && current !== document.body) {
      if (this.SKIP_TAGS.has(current.tagName)) return true;
      if (current.isContentEditable) return true;
      if (current.hasAttribute('data-vt-for')) return true;
      if (current.hasAttribute('data-vt-ext')) return true;
      // 跳过 Markdown 渲染的代码块容器
      if (this.isCodeBlockContainer(current)) return true;
      current = current.parentElement;
    }
    return false;
  },

  /**
   * 判断元素是否为 Markdown 渲染的代码块容器
   */
  isCodeBlockContainer(el) {
    if (!el.className || typeof el.className !== 'string') return false;
    const cls = el.className.toLowerCase();
    return this.CODE_BLOCK_CLASSES.some(kw => cls.includes(kw.toLowerCase()));
  },

  /**
   * 判断元素是否隐藏
   */
  isHidden(el) {
    try {
      if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') {
        return true;
      }
      const style = getComputedStyle(el);
      return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
    } catch {
      return false;
    }
  },

  /**
   * 清除所有提取标记
   */
  clearMarks() {
    document.querySelectorAll('[data-vt-id]').forEach(el => {
      el.removeAttribute('data-vt-id');
    });
  },
};

if (typeof window !== 'undefined') {
  window.VT_TEXT_EXTRACTOR = VT_TEXT_EXTRACTOR;
}
