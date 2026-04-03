/**
 * Qoder Skill: Prompt Template Manager
 *
 * 管理翻译提示词模板的 CRUD 操作
 */

class PromptTemplateManager {
  constructor() {
    // 默认模板
    this.defaults = {
      system: `你是一位专业的翻译引擎。请将用户提供的文本从{source_lang}精确翻译为{target_lang}。

要求：
1. 保持原文的格式、语气和风格
2. 专业术语需准确翻译
3. 如果文本包含 <sN>...</sN> 标签，请保留这些标签并翻译标签内的内容
4. 只输出翻译结果，不要添加任何解释或注释`,
      user: '{text}',
    };

    // 可用变量
    this.variables = [
      { name: 'source_lang', description: '源语言名称', example: 'English' },
      { name: 'target_lang', description: '目标语言名称', example: '简体中文' },
      { name: 'text', description: '待翻译文本', example: 'Hello world' },
      { name: 'domain', description: '当前网站域名', example: 'example.com' },
    ];
  }

  /**
   * 获取默认模板
   * @param {string} type - 'system' | 'user'
   * @returns {string}
   */
  getDefault(type) {
    return this.defaults[type] || '';
  }

  /**
   * 验证模板
   * @param {string} template - 模板内容
   * @param {string} type - 'system' | 'user'
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate(template, type) {
    const errors = [];

    if (!template || !template.trim()) {
      errors.push('模板内容不能为空');
      return { valid: false, errors };
    }

    if (type === 'user') {
      if (!template.includes('{text}')) {
        errors.push('用户提示词必须包含 {text} 变量');
      }
    }

    // 检查未知变量
    const varPattern = /\{(\w+)\}/g;
    let match;
    const knownVars = new Set(this.variables.map(v => v.name));
    while ((match = varPattern.exec(template)) !== null) {
      if (!knownVars.has(match[1])) {
        errors.push(`未知变量: {${match[1]}}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 预览模板（替换变量为示例值）
   * @param {string} template
   * @param {object} [customValues]
   * @returns {string}
   */
  preview(template, customValues = {}) {
    const sampleValues = {
      source_lang: 'English',
      target_lang: '简体中文',
      text: 'Hello, how are you?',
      domain: 'example.com',
      ...customValues,
    };

    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return sampleValues[key] !== undefined ? sampleValues[key] : match;
    });
  }

  /**
   * 列出所有可用变量
   * @returns {Array<{name: string, description: string, example: string}>}
   */
  listVariables() {
    return [...this.variables];
  }

  /**
   * 创建自定义模板
   * @param {string} name - 模板名称
   * @param {object} template - { system: string, user: string }
   * @returns {{ success: boolean, error?: string }}
   */
  create(name, template) {
    const systemValidation = this.validate(template.system, 'system');
    if (!systemValidation.valid) {
      return { success: false, error: `系统提示词: ${systemValidation.errors.join(', ')}` };
    }

    const userValidation = this.validate(template.user, 'user');
    if (!userValidation.valid) {
      return { success: false, error: `用户提示词: ${userValidation.errors.join(', ')}` };
    }

    return { success: true, template: { name, ...template } };
  }

  /**
   * 重置为默认模板
   * @returns {object}
   */
  reset() {
    return { ...this.defaults };
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PromptTemplateManager;
}
if (typeof window !== 'undefined') {
  window.PromptTemplateManager = PromptTemplateManager;
}
