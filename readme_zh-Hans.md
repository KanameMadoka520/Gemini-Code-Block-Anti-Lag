# Gemini代码块防卡顿

[简体中文](readme_zh-Hans.md) | [繁體中文](readme_zh-Hant.md)| [English](readme.md) 

![Version](https://img.shields.io/badge/version-0.3--Fix-blue) 
![Language](https://img.shields.io/badge/language-JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Manager](https://img.shields.io/badge/Manager-Tampermonkey-29a329?logo=tampermonkey&logoColor=white)
![Target](https://img.shields.io/badge/Target-Google%20Gemini-8E75B2?logo=google&logoColor=white)
![Author](https://img.shields.io/badge/author-KanameMadoka520-purple) ![License](https://img.shields.io/badge/license-MIT-green)

这是一个针对 Google Gemini 网页版的性能优化脚本。旨在解决 Gemini 在输出长代码（通常超过 1000 行）时，因前端语法高亮渲染机制导致的浏览器严重卡顿、页面无响应及鼠标操作延迟问题。

**更新 v0.3-Fix：** 脚本已重构为纯 DOM 操作模式，绕过了严格的内容安全策略（CSP）和可信类型（TrustedTypes），确保完美兼容 **Microsoft Edge** 和 Chrome 浏览器。

即使在使用顶级硬件（如 AMD Ryzen 9 9950X3D + NVIDIA RTX 5090d）的情况下，原生网页在处理大量流式代码生成时仍可能因主线程阻塞而卡死。本脚本通过暂时简化 DOM 结构，显著降低渲染开销。
## 功能演示

我让Gemini全量输出我的index.html（有2000多行代码）来测试我们脚本功能。
![Demo1](assets/Demo1.png)

打开脚本（显示为“防卡顿 ON”）后，
代码块会变为黑底白字，且暂停显示Gemini新生成的内容，但此时实际上仍然在正常生成。
![Demo2](assets/Demo2.png)

等待Gemini工作完毕后，它会自动把刚刚暂停显示的内容全部显示出来，你可以查看生成的全部结果。
![Demo3](assets/Demo3.png)

如果你希望恢复页面的原本渲染方式，可以再点击一次脚本的开关按钮，使之关闭（显示为“防卡顿 OFF")
![Demo4](assets/Demo4.png)

不过如你所见，html代码块在恢复后也没有**颜色高亮**，这不是bug，而是我们脚本方案的取舍。这是因为为了保证不卡顿，我们在一开始就阻止了浏览器对这部分内容的高亮计算。
在关闭脚本后，我们应当希望它恢复。也许会在下个版本尝试解决。

目前你只能依靠刷新页面来恢复**颜色高亮**qwq

但目前对于**Markdown、YAML**等代码块，并不会受到影响，**颜色高亮**仍能在脚本OFF后恢复。

## 功能特性

* **防卡顿模式**：在代码生成过程中，将复杂的代码块临时替换为纯文本节点。这能将浏览器的渲染压力降低 99%，确保在生成数千行代码时页面依然丝般顺滑。
* **Edge & Chrome 双兼容**：v0.3 版本采用了**纯 DOM 构建方式**（不使用 `innerHTML` 构建 UI），完美绕过了此前导致 Microsoft Edge 报错的严格安全策略（TrustedTypes）。
* **强力 UI 挂载**：控制按钮现在直接挂载到 `<html>` 根节点并配合心跳检测机制。这防止了 Gemini（作为单页应用）在刷新 `<body>` 内容时导致按钮消失的问题。
* **无损还原**：脚本内置“内存快照”机制。在简化代码前会自动备份原始数据。当你需要阅读或复制代码时，关闭开关即可完美还原代码的高亮样式，不会破坏原有内容。
* **非侵入式设计**：提供一个简洁的悬浮按钮，支持随意拖拽，状态自动记忆，不干扰正常使用。

## 使用效果对比

| 状态 | 按钮显示 | 视觉效果 | 性能表现 | 适用场景 |
| --- | --- | --- | --- | --- |
| 开启 (ON) | 🟢 防卡顿: ON | 黑底白字 (纯文本)移除颜色高亮，字体统一，无阴影特效。 | 极高浏览器仅需渲染极少量的 DOM 节点，鼠标移动流畅。 | 让 Gemini 写长代码会导致页面乃至系统卡顿无法操作时。 |
| 关闭 (OFF) | 🔴 防卡顿: OFF | 正常高亮 (彩色)恢复 Gemini 原本的主题配色和语法高亮。 | 正常浏览器恢复复杂的渲染逻辑。 | 代码生成完毕后，进行阅读、审查或复制代码时。 |

## 安装方法

1. 在浏览器（Chrome/Edge/Firefox）中安装 **Tampermonkey** 或 **Violentmonkey** 扩展。
2. 点击扩展图标，选择“添加新脚本”。
3. 将本仓库中的 `Gemini Code Block Anti-Lag.js` 代码完整复制并粘贴到编辑器中。
4. 保存脚本（Ctrl+S）。
5. **重要提示：安装完成后，请刷新一次 Gemini 页面以加载配置。**

## 技术实现原理

Gemini 网页版采用流式传输（Streaming）输出内容。每当有新的代码字符到达，前端的高亮引擎（如 Prism.js 或 Highlight.js）都会重新计算整个代码块的 Token 颜色，并创建成千上万个 `<span>` 标签。当代码量巨大时，频繁的 DOM 操作（Reflow/Repaint）会彻底占满 UI 主线程。

本脚本采用了 **“物理简化 + 快照还原”** 的策略来解决此问题：

1. **监听 (Monitor)**：使用 `MutationObserver` 实时监控 DOM 树，专门锁定 `<pre>` 代码块标签。
2. **备份 (Snapshot)**：在对节点进行任何操作前，脚本会将当前的 `innerHTML`（包含高亮结构）备份到元素的 `dataset` 属性中。
3. **简化 (Simplify)**：强制执行 `el.textContent = el.innerText`。这一步会瞬间销毁内部所有复杂的子节点（span），只保留纯文本内容。此时浏览器的渲染复杂度从 $O(n)$ 降为 $O(1)$。
4. **CSP 绕过 (v0.3 新增)**：为了支持 Edge，UI 界面完全使用 `document.createElement` 和 `appendChild` 构建。避免了界面注入时的 `innerHTML` 操作，从而符合严格的可信类型（TrustedTypes）安全策略。
5. **还原 (Restore)**：当用户关闭开关时，脚本从备份中读取原始 HTML 并重新注入，同时清除脚本施加的所有临时样式，将控制权交还给 Gemini 原生 CSS。

## 注意事项

* **流式内容的还原限制**：如果在脚本 **开启状态下** Gemini 生成了新的代码内容，这部分内容在 **关闭脚本后** 会恢复正常的背景色和字体，但可能**不会拥有颜色高亮**。这是因为为了保证不卡顿，我们在一开始就阻止了浏览器对这部分内容的高亮计算。
* **历史内容的还原**：在脚本开启前就已经存在的历史对话代码，可以 100% 完美还原。

## 许可证

本项目采用 [MIT License](https://www.google.com/search?q=LICENSE) 开源。

```text
MIT License

Copyright (c) 2026 KanameMadoka520

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```
