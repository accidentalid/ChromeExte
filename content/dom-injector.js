/**
 * DOM 注入器 - 双语显示与仅译文模式
 */
const VT_DOM_INJECTOR = {
  /**
   * 注入翻译结果
   * @param {string} unitId - 翻译单元 ID
   * @param {string} translatedText - 翻译文本
   * @param {string} targetLang - 目标语言代码
   */
  inject(unitId, translatedText, targetLang) {
    const original = document.querySelector(`[data-vt-id="${unitId}"]`);
    if (!original) return;

    // 如果已有翻译，先移除
    this.removeTranslation(unitId);

    // 创建翻译元素
    const transEl = document.createElement(original.tagName === 'LI' ? 'li' : 'div');
    transEl.className = 'vt-trans';
    transEl.setAttribute('data-vt-for', unitId);
    transEl.setAttribute('lang', targetLang);
    transEl.textContent = translatedText;

    // 处理 Flex/Grid 父容器
    const parent = original.parentElement;
    if (parent && this.isFlexOrGrid(parent)) {
      // 使用 display:contents 包装器
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-vt-wrapper', unitId);
      wrapper.style.display = 'contents';

      original.parentNode.insertBefore(wrapper, original);
      wrapper.appendChild(original);
      wrapper.appendChild(transEl);
    } else {
      // 正常情况：在原文后插入同级元素
      original.parentNode.insertBefore(transEl, original.nextSibling);
    }
  },

  /**
   * 批量注入翻译结果
   */
  batchInject(results, targetLang) {
    for (const item of results) {
      if (item.text) {
        this.inject(item.unitId, item.text, targetLang);
      }
    }
  },

  /**
   * 移除指定翻译
   */
  removeTranslation(unitId) {
    const existing = document.querySelector(`[data-vt-for="${unitId}"]`);
    if (existing) {
      // 检查是否在 wrapper 中
      const wrapper = existing.parentElement;
      if (wrapper && wrapper.hasAttribute('data-vt-wrapper')) {
        const original = wrapper.querySelector(`[data-vt-id="${unitId}"]`);
        if (original) {
          wrapper.parentNode.insertBefore(original, wrapper);
        }
        wrapper.remove();
      } else {
        existing.remove();
      }
    }
  },

  /**
   * 移除所有翻译
   */
  removeAll() {
    // 移除所有 wrapper
    document.querySelectorAll('[data-vt-wrapper]').forEach(wrapper => {
      const children = Array.from(wrapper.children);
      children.forEach(child => {
        if (!child.hasAttribute('data-vt-for')) {
          wrapper.parentNode.insertBefore(child, wrapper);
        }
      });
      wrapper.remove();
    });

    // 移除所有翻译元素
    document.querySelectorAll('[data-vt-for]').forEach(el => el.remove());

    // 清除所有标记
    document.querySelectorAll('[data-vt-id]').forEach(el => {
      el.removeAttribute('data-vt-id');
    });

    // 移除模式 class
    document.documentElement.classList.remove('vt-mode-target-only');
  },

  /**
   * 切换显示模式
   */
  setDisplayMode(mode) {
    if (mode === 'target-only') {
      document.documentElement.classList.add('vt-mode-target-only');
    } else {
      document.documentElement.classList.remove('vt-mode-target-only');
    }
  },

  /**
   * 检查父元素是否为 Flex/Grid 布局
   */
  isFlexOrGrid(el) {
    try {
      const display = getComputedStyle(el).display;
      return display === 'flex' || display === 'inline-flex' ||
             display === 'grid' || display === 'inline-grid';
    } catch {
      return false;
    }
  },

  /**
   * 检查页面是否已有翻译
   */
  hasTranslations() {
    return document.querySelector('[data-vt-for]') !== null;
  },

  /**
   * 获取已翻译的单元数量
   */
  getTranslatedCount() {
    return document.querySelectorAll('[data-vt-for]').length;
  },
};

if (typeof window !== 'undefined') {
  window.VT_DOM_INJECTOR = VT_DOM_INJECTOR;
}
