/**
 * TTS 管理器 - Web Speech API 封装
 * 提供原文语音朗读功能，方便学习英语
 */
const VT_TTS_MANAGER = {
  speaking: false,
  currentUtterance: null,
  voices: [],
  settings: {
    enabled: true,
    rate: 1.0,
    pitch: 1.0,
    voiceURI: '',
  },

  /**
   * 初始化 TTS
   */
  init() {
    if (!('speechSynthesis' in window)) {
      console.warn('[Vibe TTS] Web Speech API not supported');
      return;
    }

    // 加载可用语音
    this._loadVoices();
    speechSynthesis.addEventListener('voiceschanged', () => this._loadVoices());

    // 从设置中加载 TTS 配置
    this._loadSettings();
  },

  /**
   * 加载设置
   */
  async _loadSettings() {
    try {
      const settings = await VT_MESSAGE_BUS.sendToBackground('get_settings', {});
      if (settings?.tts) {
        this.settings = { ...this.settings, ...settings.tts };
      }
    } catch {}
  },

  /**
   * 更新设置
   */
  updateSettings(ttsSettings) {
    if (ttsSettings) {
      this.settings = { ...this.settings, ...ttsSettings };
    }
  },

  /**
   * 加载可用语音列表
   */
  _loadVoices() {
    this.voices = speechSynthesis.getVoices();
  },

  /**
   * 获取所有可用语音
   */
  getVoices() {
    return this.voices;
  },

  /**
   * 朗读文本
   * @param {string} text - 要朗读的文本
   * @param {string} lang - 语言代码 (如 'en', 'zh-CN')
   */
  speak(text, lang) {
    if (!('speechSynthesis' in window)) return;
    if (!this.settings.enabled) return;
    if (!text || !text.trim()) return;

    // 停止当前朗读
    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.settings.rate;
    utterance.pitch = this.settings.pitch;

    // 设置语言
    if (lang) {
      utterance.lang = lang;
    }

    // 设置指定的语音
    if (this.settings.voiceURI) {
      const voice = this.voices.find(v => v.voiceURI === this.settings.voiceURI);
      if (voice) {
        utterance.voice = voice;
      }
    }

    utterance.onstart = () => {
      this.speaking = true;
    };
    utterance.onend = () => {
      this.speaking = false;
      this.currentUtterance = null;
    };
    utterance.onerror = () => {
      this.speaking = false;
      this.currentUtterance = null;
    };

    this.currentUtterance = utterance;
    speechSynthesis.speak(utterance);
  },

  /**
   * 停止朗读
   */
  stop() {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    this.speaking = false;
    this.currentUtterance = null;
  },

  /**
   * 是否支持 TTS
   */
  isSupported() {
    return 'speechSynthesis' in window;
  },

  /**
   * SVG 图标 - 喇叭
   */
  ICON_SPEAKER: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,

  /**
   * SVG 图标 - 停止
   */
  ICON_STOP: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>`,
};

if (typeof window !== 'undefined') {
  window.VT_TTS_MANAGER = VT_TTS_MANAGER;
}
