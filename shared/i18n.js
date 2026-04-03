/**
 * 界面中文字符串
 */
const VT_I18N = {
  // 通用
  appName: 'Vibe 翻译',
  save: '保存',
  cancel: '取消',
  confirm: '确认',
  reset: '恢复默认',
  copy: '复制',
  copied: '已复制',
  close: '关闭',
  loading: '加载中...',
  error: '错误',
  success: '成功',

  // Popup
  translatePage: '翻译此页面',
  stopTranslation: '停止翻译',
  translating: '翻译中',
  translated: '已完成',
  notTranslated: '未翻译',
  sourceLang: '源语言',
  targetLang: '目标语言',
  autoDetect: '自动检测',
  bilingual: '双语对照',
  targetOnly: '仅译文',
  displayMode: '显示模式',
  selectionTranslate: '划词翻译',
  settings: '设置',
  shortcutHint: '快捷键',

  // Options
  optionsTitle: '设置',
  tabApiConfig: '翻译服务',
  tabDisplay: '显示设置',
  tabPrompts: '提示词管理',
  tabShortcuts: '快捷键',
  tabAdvanced: '高级设置',

  // API 配置
  provider: '翻译服务商',
  baseUrl: '接口地址 (Base URL)',
  apiKey: 'API 密钥',
  model: '模型',
  customModel: '自定义模型名称',
  testConnection: '测试连接',
  testSuccess: '连接成功',
  testFailed: '连接失败',

  // 显示设置
  defaultDisplayMode: '默认显示模式',
  transStyle: '译文样式',
  bold: '加粗',
  underline: '下划线',
  bgColor: '背景色',
  fontSize: '字体大小',
  fontSizeSame: '与原文相同',
  fontSizeSmaller: '稍小',
  fontSizeLarger: '稍大',
  color: '文字颜色',
  separator: '分隔线',
  separatorNone: '无',
  separatorDashed: '虚线',
  separatorSolid: '实线',
  floatingBubble: '悬浮翻译按钮',

  // 提示词
  systemPrompt: '系统提示词 (System Prompt)',
  userPrompt: '用户提示词 (User Prompt)',
  promptVariables: '可用变量',
  promptVariablesDesc: '{source_lang} - 源语言名称，{target_lang} - 目标语言名称，{text} - 待翻译文本，{domain} - 当前网站域名',

  // 快捷键
  shortcutSelection: '划词翻译',
  shortcutPage: '全页翻译',
  shortcutToggleMode: '切换显示模式',

  // 高级
  concurrency: '最大并发数',
  timeout: '请求超时 (秒)',
  cacheSettings: '缓存设置',
  cacheEnabled: '启用翻译缓存',
  cacheTTL: '缓存有效期 (小时)',
  cacheMaxSize: '最大缓存容量 (MB)',
  clearCache: '清除缓存',
  cacheCleared: '缓存已清除',
  currentCacheSize: '当前缓存大小',
  exportConfig: '导出配置',
  importConfig: '导入配置',
  importSuccess: '配置导入成功',
  importFailed: '配置导入失败',
  configBackup: '配置导入/导出',

  // 翻译状态
  cached: '已缓存',
  translationFailed: '翻译失败',
  noApiKey: '请先配置 API 密钥',
  noBaseUrl: '请先配置接口地址',
};

if (typeof window !== 'undefined') {
  window.VT_I18N = VT_I18N;
}
