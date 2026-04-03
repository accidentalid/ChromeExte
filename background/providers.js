/**
 * LLM 服务商静态注册表
 */
export const PROVIDERS = {
  openai: {
    key: 'openai',
    name: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    icon: '🟢',
  },
  gemini: {
    key: 'gemini',
    name: 'Google Gemini',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-pro'],
    icon: '🔵',
  },
  anthropic: {
    key: 'anthropic',
    name: 'Anthropic Claude',
    base_url: '',
    models: ['claude-sonnet-4-20250514', 'claude-haiku', 'claude-3-5-sonnet-20241022'],
    icon: '🟠',
    hint: '需要通过 OpenAI 兼容网关 (如 OneAPI) 接入',
  },
  dashscope: {
    key: 'dashscope',
    name: '阿里云百炼',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'],
    icon: '🟡',
  },
  moonshot: {
    key: 'moonshot',
    name: '月之暗面 Kimi',
    base_url: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2.5', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    icon: '🌙',
  },
  minimax: {
    key: 'minimax',
    name: 'MiniMax',
    base_url: 'https://api.minimaxi.com/v1',
    models: ['MiniMax-M2.7', 'MiniMax-M2.5', 'MiniMax-M2.1'],
    icon: '🔷',
  },
  zhipu: {
    key: 'zhipu',
    name: '智谱AI GLM',
    base_url: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5', 'glm-4.7', 'glm-4-flash', 'glm-4-plus'],
    icon: '🟣',
  },
  hunyuan: {
    key: 'hunyuan',
    name: '腾讯混元',
    base_url: 'https://api.hunyuan.cloud.tencent.com/v1',
    models: ['hunyuan-pro', 'hunyuan-turbo', 'hunyuan-standard', 'hunyuan-lite'],
    icon: '🔴',
  },
  custom: {
    key: 'custom',
    name: '自定义',
    base_url: '',
    models: [],
    icon: '⚙️',
    hint: '输入自定义 OpenAI 兼容接口地址',
  },
};

export const PROVIDER_KEYS = Object.keys(PROVIDERS);
