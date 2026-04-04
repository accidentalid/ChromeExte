# Vibe 翻译

智能网页翻译插件 - 支持划词翻译与全页双语对照，接入多家主流 AI 大模型。

## 功能特性

- 🤖 支持多家主流 AI 大模型（OpenAI、Gemini、Claude、通义千问等）
- 🎯 智能划词翻译，选中即翻译
- 📄 全页双语对照翻译，沉浸式阅读体验
- 💫 优雅的 UI 设计，悬浮气泡便捷操作
- ⚡ 轻量快速，智能缓存减少重复请求
- 🔧 高度可定制，支持自定义 Prompt 和样式
- 🔒 隐私优先，API Key 本地存储
- 🔊 原文语音朗读，方便学习英语发音（Web Speech API）

## 安装

### 手动安装

1. 下载或克隆本仓库
2. 打开 Chrome 扩展管理页面 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择项目文件夹

## 使用方法

1. **划词翻译**：选中页面文字，点击悬浮翻译按钮或按快捷键 `Alt+T`
2. **整页翻译**：点击扩展图标打开面板，或按快捷键 `Alt+P`
3. **设置**：右键扩展图标 → 选项，配置翻译服务、目标语言、显示样式等

## 配置说明

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| 翻译服务 | 选择使用的 AI 服务商 | OpenAI |
| 目标语言 | 翻译后的语言 | 简体中文 |
| 显示模式 | 双语对照 / 仅译文 | 双语对照 |
| 快捷键 | 划词翻译 / 整页翻译 | Alt+T / Alt+P |
| 悬浮气泡 | 是否显示悬浮操作按钮 | 开启 |
| 缓存 | 启用翻译缓存 | 开启（72小时过期） |
| 语音朗读 | 启用原文 TTS 语音 | 开启 |
| 语速 | TTS 语音速度 | 1.0x |
| 音调 | TTS 语音音调 | 1.0 |
| 声音选择 | 选择 TTS 语音引擎 | 系统默认 |

## 支持的 AI 服务商

| 服务商 | 说明 |
|--------|------|
| 🟢 OpenAI | GPT-4o / GPT-4o-mini / GPT-4-turbo / GPT-3.5-turbo |
| 🔵 Google Gemini | Gemini 2.0 Flash / Gemini 2.5 Flash / Gemini 1.5 Pro |
| 🟠 Anthropic Claude | Claude Sonnet 4 / Claude Haiku（需兼容网关） |
| 🟡 阿里云百炼 | 通义千问 Plus / Turbo / Max / Long |
| 🌙 月之暗面 Kimi | Kimi K2.5 / Moonshot 系列 |
| 🔷 MiniMax | MiniMax M2.7 / M2.5 / M2.1 |
| 🟣 智谱AI | GLM-5 / GLM-4 系列 |
| 🔴 腾讯混元 | Hunyuan Pro / Turbo / Standard / Lite |
| ⚙️ 自定义 | 支持任意 OpenAI 兼容接口 |

## 项目结构

```
vibe-translation-extension/
├── background/          # Service Worker 后台脚本
│   ├── service-worker.js
│   ├── translation-engine.js
│   ├── providers.js
│   └── ...
├── content/             # 内容脚本（注入页面）
│   ├── content-main.js
│   ├── page-translator.js
│   ├── selection-handler.js
│   └── ...
├── popup/               # 弹出面板
├── options/             # 设置页面
├── shared/              # 共享模块
│   ├── constants.js
│   ├── language-list.js
│   └── ...
├── icons/               # 扩展图标
└── manifest.json        # 扩展清单 (Manifest V3)
```

## 开发

本项目为纯静态 Chrome 扩展，无需构建步骤。

```bash
# 克隆项目
git clone https://github.com/accidentalid/ChromeExte.git
# 在 Chrome 中加载扩展进行开发调试
# chrome://extensions/ → 开发者模式 → 加载已解压的扩展程序
```

## 技术栈

- JavaScript (ES6+)
- Chrome Extension API (Manifest V3)
- Service Worker
- CSS3
- Web Speech API

## 版本历史

### v1.0.2
- ⚡ 优化分块翻译策略，超长单元独立成块，提升大页面翻译稳定性
- 🔧 翻译时自动跳过代码块，Prompt 增加代码保留指令
- 🐛 修复划词翻译气泡不跟随显示模式/TTS 设置同步变更

### v1.0.1
- 🔊 新增原文语音朗读功能（Web Speech API）
  - 翻译结果旁添加语音朗读按钮，支持朗读原文
  - 划词翻译气泡卡片中集成朗读按钮
  - 全页翻译的每个翻译块均支持朗读
- ⚙️ 新增语音设置选项
  - 启用/禁用语音朗读
  - 语速调节（0.5x - 2.0x）
  - 音调调节（0.5 - 2.0）
  - 声音引擎选择（取决于浏览器支持）
  - 测试语音试听功能
- 🖱️ 划词翻译气泡卡片支持拖拽移动，按住标题栏即可拖动

### v1.0.0
- ✨ 初始版本发布
- 支持 8 家主流 AI 服务商 + 自定义接口
- 划词翻译和整页双语对照翻译
- 可自定义翻译样式和 Prompt
- 智能缓存管理

## 许可证

[MIT](LICENSE)

## 贡献

欢迎提交 Issue 和 Pull Request！

## TODO 路线图

### ✅ 已完成

- [x] **颜色预设选择器** - 10 种预设颜色 + 自定义取色器
- [x] **分 Chunk 翻译优化** - 智能分块、跳过代码块
- [x] **代码清理重构** - 消除重复定义，统一常量管理
- [x] **TTS 语音朗读** - 基于 Web Speech API 实现翻译结果语音输出
- [x] **设置同步修复** - 划词气泡跟随显示模式/TTS 设置同步变更
- [x] 划词翻译和整页双语对照
- [x] 支持 8 家主流 AI 服务商 + 自定义接口
- [x] 智能缓存管理
- [x] 可自定义翻译样式和 Prompt

### 🚧 开发中 / 计划中

- [ ] **代码重构** - 优化架构，提升可维护性和扩展性
- [ ] **动态取色** - 根据页面主题色自动调整翻译结果样式
- [ ] **支持机器翻译 API** - DeepL、有道、微软翻译等传统翻译服务
- [ ] 翻译历史记录
- [ ] 批量翻译导出
- [ ] 翻译质量评分反馈

## AI 声明

本项目在开发过程中使用了生成式人工智能（Generative AI）辅助编写代码和文档。所有 AI 生成的内容均经过人工审核和调整。
