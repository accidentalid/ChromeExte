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

    // 创建译文文本 span
    const textSpan = document.createElement('span');
    textSpan.className = 'vt-trans-text';
    textSpan.textContent = translatedText;
    transEl.appendChild(textSpan);

    // 添加朗读按钮（朗读原文）
    const ttsSupported = typeof VT_TTS_MANAGER !== 'undefined' && VT_TTS_MANAGER.isSupported() && VT_TTS_MANAGER.settings.enabled;
    if (ttsSupported) {
      const speakBtn = document.createElement('button');
      speakBtn.className = 'vt-tts-btn';
      speakBtn.setAttribute('aria-label', '朗读原文');
      speakBtn.setAttribute('title', '朗读原文');
      speakBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
      speakBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const origEl = document.querySelector(`[data-vt-id="${unitId}"]`);
        const origText = origEl ? origEl.textContent : '';
        if (VT_TTS_MANAGER.speaking) {
          VT_TTS_MANAGER.stop();
          speakBtn.classList.remove('vt-tts-btn--active');
        } else {
          VT_TTS_MANAGER.speak(origText);
          speakBtn.classList.add('vt-tts-btn--active');
          const checkEnd = setInterval(() => {
            if (!VT_TTS_MANAGER.speaking) {
              speakBtn.classList.remove('vt-tts-btn--active');
              clearInterval(checkEnd);
            }
          }, 200);
        }
      });
      transEl.appendChild(speakBtn);
    }

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
