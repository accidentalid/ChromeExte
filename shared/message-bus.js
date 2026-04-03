/**
 * Chrome Runtime 消息通信封装
 */
const VT_MESSAGE_BUS = {
  /**
   * 检查扩展上下文是否仍然有效
   */
  isContextValid() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  },

  /**
   * 发送消息到 Background Service Worker
   */
  sendToBackground(type, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!VT_MESSAGE_BUS.isContextValid()) {
        reject(new Error('扩展已更新，请刷新页面后重试'));
        return;
      }
      try {
        chrome.runtime.sendMessage({ type, payload }, response => {
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || '';
            if (msg.includes('Extension context invalidated')) {
              reject(new Error('扩展已更新，请刷新页面后重试'));
            } else {
              reject(new Error(msg));
            }
          } else {
            resolve(response);
          }
        });
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes('Extension context invalidated') || msg.includes('Extension context')) {
          reject(new Error('扩展已更新，请刷新页面后重试'));
        } else {
          reject(err);
        }
      }
    });
  },

  /**
   * 发送消息到指定 Tab 的 Content Script
   */
  sendToTab(tabId, type, payload = {}) {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.sendMessage(tabId, { type, payload }, response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  },

  /**
   * 发送消息到当前活动 Tab
   */
  async sendToActiveTab(type, payload = {}) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');
    return VT_MESSAGE_BUS.sendToTab(tab.id, type, payload);
  },

  /**
   * 注册消息监听器（可过滤类型）
   */
  onMessage(handler) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const result = handler(message, sender);
      if (result instanceof Promise) {
        result.then(sendResponse).catch(err => sendResponse({ error: err.message }));
        return true; // 保持消息通道打开
      }
      if (result !== undefined) {
        sendResponse(result);
      }
      return false;
    });
  },

  /**
   * 注册特定类型的消息监听器
   */
  on(type, handler) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type !== type) return false;
      const result = handler(message.payload, sender);
      if (result instanceof Promise) {
        result.then(sendResponse).catch(err => sendResponse({ error: err.message }));
        return true;
      }
      if (result !== undefined) {
        sendResponse(result);
      }
      return false;
    });
  },
};

if (typeof window !== 'undefined') {
  window.VT_MESSAGE_BUS = VT_MESSAGE_BUS;
}
