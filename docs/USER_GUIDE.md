# Vibe 翻译 - 使用指南

智能网页翻译插件，支持划词翻译与全页双语对照，接入多家主流 AI 大模型。

---

## 安装

1. 下载或克隆本项目到本地
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `vibe-translation-extension` 文件夹
6. 安装完成后，工具栏会出现 Vibe 翻译图标

---

## 快速开始

### 1. 配置 API

首次使用前需要配置至少一个 AI 翻译服务商：

1. 点击工具栏图标 → 点击右上角齿轮图标进入设置
2. 在"翻译服务"标签页选择服务商
3. 填入该服务商的 **接口地址 (Base URL)** 和 **API 密钥**
4. 选择或输入模型名称
5. 点击"测试连接"验证配置

### 2. 开始翻译

配置完成后，有三种方式使用翻译功能：

- **划词翻译**：在网页上选中文本，点击出现的翻译图标
- **全页翻译**：点击页面右下角的悬浮翻译按钮
- **Popup 面板**：点击工具栏图标，使用"翻译此页面"按钮

---

## 支持的服务商

所有服务商均通过 OpenAI 兼容接口 (`/v1/chat/completions`) 调用。

| 服务商 | 默认 Base URL | 推荐模型 |
|--------|---------------|----------|
| OpenAI | `https://api.openai.com/v1` | gpt-4o-mini |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | gemini-2.0-flash |
| Anthropic Claude | 需自行填写兼容网关地址 | claude-sonnet-4-20250514 |
| 阿里云百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | qwen-plus |
| 月之暗面 Kimi | `https://api.moonshot.cn/v1` | moonshot-v1-8k |
| MiniMax | `https://api.minimaxi.com/v1` | MiniMax-M2.5 |
| 智谱AI GLM | `https://open.bigmodel.cn/api/paas/v4` | glm-4-flash |
| 腾讯混元 | `https://api.hunyuan.cloud.tencent.com/v1` | hunyuan-turbo |
| 自定义 | 自行填写 | 自行填写 |

> **关于 Anthropic Claude**：Claude 原生 API 格式与 OpenAI 不兼容。请通过 OneAPI、New API 等兼容网关接入，或使用支持 Claude 的第三方中转服务。

---

## 功能详解

### 划词翻译

1. 在任意网页上选中一段文本
2. 选区旁会出现一个蓝色翻译图标
3. 点击图标开始翻译
4. 翻译结果显示在弹出卡片中
5. 可点击"复制"按钮复制翻译结果

快捷键：`Alt+T`

### 全页翻译

1. 点击页面右下角的蓝色悬浮按钮
2. 插件会自动提取页面中的可翻译文本
3. 翻译结果以双语对照形式逐步显示
4. 翻译过程中按钮显示进度环
5. 再次点击可停止翻译并恢复原文

快捷键：`Alt+P`

### 显示模式

- **双语对照**（默认）：原文下方显示译文，方便对照阅读
- **仅译文**：隐藏原文，只显示翻译结果

在 Popup 面板的"显示模式"区域切换，切换即时生效，无需重新翻译。

### 译文样式

在设置 → 显示设置中可自定义：

- 加粗 / 下划线
- 文字颜色
- 背景色
- 字体大小（与原文相同 / 稍小 / 稍大）
- 分隔线样式（无 / 虚线 / 实线）

---

## 高级功能

### 提示词管理

设置 → 提示词管理 中可自定义翻译指令：

**系统提示词 (System Prompt)**：定义 AI 翻译引擎的行为规则。

**用户提示词 (User Prompt)**：定义发送给 AI 的消息模板。

支持的变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| `{source_lang}` | 源语言名称 | English |
| `{target_lang}` | 目标语言名称 | 简体中文 |
| `{text}` | 待翻译文本 | Hello world |
| `{domain}` | 当前网站域名 | github.com |

### 并发控制

设置 → 高级设置 → 最大并发数

控制同时进行的 API 请求数量。增大可提高翻译速度，但可能触发服务商限流。建议值：3-5。

### 翻译缓存

已翻译的内容会自动缓存，重复翻译相同文本时直接读取缓存，节省 API 调用。

- **缓存有效期**：默认 72 小时
- **最大容量**：默认 50MB
- **清除缓存**：设置 → 高级设置 → 清除缓存

缓存按服务商和模型隔离，切换服务商后不会使用旧缓存。

### 配置导入/导出

设置 → 高级设置 → 配置导入/导出

- **导出**：将所有设置保存为 JSON 文件
- **导入**：从 JSON 文件恢复设置

可用于备份配置或在多台设备间同步设置。

---

## 快捷键

| 功能 | 默认快捷键 |
|------|-----------|
| 划词翻译 | `Alt+T` |
| 全页翻译 | `Alt+P` |

修改快捷键：Chrome 设置 → 扩展程序 → 键盘快捷键，或访问 `chrome://extensions/shortcuts`。

---

## 常见问题

**Q: 翻译没有反应？**
A: 请检查是否已配置 API 密钥。进入设置 → 翻译服务，确认已填写 API Key 并通过连接测试。

**Q: 提示"认证失败"？**
A: API 密钥可能无效或已过期，请到服务商控制台重新生成。

**Q: 翻译速度很慢？**
A: 可以尝试：1) 切换到更快的模型（如 gpt-4o-mini）2) 增大并发数 3) 使用国内服务商。

**Q: 某些网页内容没有被翻译？**
A: 插件会自动跳过代码块、输入框、按钮等非正文内容。对于动态加载的内容（如无限滚动），滚动到新内容后会自动翻译。

**Q: 如何接入 Claude？**
A: Claude 原生 API 格式与本插件不兼容。请通过 OneAPI 等兼容网关转换为 OpenAI 格式后接入。在设置中选择"Anthropic Claude"，填写网关地址和密钥即可。

---

## 项目结构

```
vibe-translation-extension/
├── manifest.json          # Chrome 扩展清单
├── background/            # Service Worker (API 调用、缓存、翻译引擎)
├── content/               # 内容脚本 (DOM 操作、UI 组件)
├── popup/                 # 弹出面板
├── options/               # 设置页面
├── shared/                # 共享模块 (常量、工具函数、消息通信)
├── styles/                # Material Design 主题样式
├── icons/                 # 扩展图标
├── .qoder/agents/         # Qoder 翻译代理
├── .qoder/skills/         # Qoder 技能模块
└── docs/                  # 文档
```
