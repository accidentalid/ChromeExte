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

## 版本历史

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

---

Made with ❤️ by Vibe Team

## AI 声明

本项目在开发过程中使用了生成式人工智能（Generative AI）辅助编写代码和文档。所有 AI 生成的内容均经过人工审核和调整。
