/**
 * 统一 OpenAI 兼容 API 调用层
 */

/**
 * 调用 LLM API (非流式)
 * @param {object} config - { base_url, api_key, model }
 * @param {Array} messages - [{ role, content }]
 * @param {object} options - { temperature, maxTokens, timeout, signal }
 * @returns {Promise<{success: boolean, content?: string, error?: {code: string, message: string}}>}
 */
export async function callLLM(config, messages, options = {}) {
  const { base_url, api_key, model } = config;
  const {
    temperature = 0.3,
    maxTokens = 4096,
    timeout = 30000,
    signal,
  } = options;

  if (!base_url) {
    return { success: false, error: { code: 'NO_BASE_URL', message: '未配置接口地址' } };
  }
  if (!api_key) {
    return { success: false, error: { code: 'NO_API_KEY', message: '未配置 API 密钥' } };
  }

  const url = `${base_url.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const abortSignal = signal || controller.signal;

  // 超时处理
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: abortSignal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return {
        success: false,
        error: normalizeError(response.status, errorBody),
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return { success: true, content };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: { code: 'TIMEOUT', message: '请求超时' } };
    }
    return { success: false, error: { code: 'NETWORK_ERROR', message: `网络错误: ${err.message}` } };
  }
}

/**
 * 调用 LLM API (流式)
 * @param {object} config - { base_url, api_key, model }
 * @param {Array} messages - [{ role, content }]
 * @param {function} onChunk - 每收到一块内容时的回调 (text)
 * @param {object} options - { temperature, maxTokens, timeout, signal }
 * @returns {Promise<{success: boolean, content?: string, error?: object}>}
 */
export async function callLLMStream(config, messages, onChunk, options = {}) {
  const { base_url, api_key, model } = config;
  const {
    temperature = 0.3,
    maxTokens = 4096,
    timeout = 60000,
    signal,
  } = options;

  if (!base_url || !api_key) {
    return { success: false, error: { code: 'CONFIG_ERROR', message: '未配置接口地址或密钥' } };
  }

  const url = `${base_url.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const abortSignal = signal || controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
      signal: abortSignal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return { success: false, error: normalizeError(response.status, errorBody) };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            onChunk(delta);
          }
        } catch {
          // 忽略解析错误的行
        }
      }
    }

    return { success: true, content: fullContent };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: { code: 'TIMEOUT', message: '请求超时或已取消' } };
    }
    return { success: false, error: { code: 'NETWORK_ERROR', message: `网络错误: ${err.message}` } };
  }
}

/**
 * 带自动重试的 LLM 调用
 */
export async function callLLMWithRetry(config, messages, options = {}) {
  const maxRetries = options.retries || 1;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await callLLM(config, messages, options);
    if (result.success) return result;

    lastError = result.error;
    // 4xx 错误不重试
    if (lastError.code === 'AUTH_ERROR' || lastError.code === 'RATE_LIMITED' ||
        lastError.code === 'BAD_REQUEST' || lastError.code === 'NO_BASE_URL' ||
        lastError.code === 'NO_API_KEY') {
      return result;
    }

    // 等待后重试
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  return { success: false, error: lastError };
}

/**
 * 归一化错误
 */
function normalizeError(status, body) {
  let message = '';
  try {
    const parsed = JSON.parse(body);
    message = parsed.error?.message || parsed.message || body;
  } catch {
    message = body || `HTTP ${status}`;
  }

  switch (true) {
    case status === 401 || status === 403:
      return { code: 'AUTH_ERROR', message: `认证失败: ${message}` };
    case status === 429:
      return { code: 'RATE_LIMITED', message: `请求频率超限: ${message}` };
    case status === 400:
      return { code: 'BAD_REQUEST', message: `请求参数错误: ${message}` };
    case status >= 500:
      return { code: 'SERVER_ERROR', message: `服务端错误 (${status}): ${message}` };
    default:
      return { code: 'UNKNOWN_ERROR', message: `未知错误 (${status}): ${message}` };
  }
}
