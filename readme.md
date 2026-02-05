
# Gemini Anti-Lag & Performance Booster

针对 Google Gemini 网页版 (gemini.google.com) 的性能优化脚本。主要用于解决在生成大量代码或长文本时，浏览器主线程因高频 DOM 操作和语法高亮渲染导致的严重卡顿、掉帧以及系统级无响应问题。

![Version](https://img.shields.io/badge/version-1.2-blue) ![Author](https://img.shields.io/badge/author-KanameMadoka520-purple) ![License](https://img.shields.io/badge/license-MIT-green)


即便在使用顶级硬件（如 Ryzen 9 9950X3D+5090D）的情况下，原生网页的渲染机制仍可导致页面乃至整个系统卡死，直到回答输出完毕。即使页面只使用单核处理也是如此。
本脚本通过 CSS 渲染隔离和 DOM 简化策略，显著降低资源占用。

## 功能特性

* **一键防卡顿模式**：提供一个悬浮开关，开启后强制简化代码块渲染，极大降低 CPU/GPU 负载。
* **渲染隔离**：利用 CSS `contain` 和 `content-visibility` 属性，将代码块的布局计算与主页面隔离。
* **DOM 降维**：在生成过程中暂时隐藏复杂的语法高亮节点，仅显示纯文本，消除重排 (Reflow) 和重绘 (Repaint) 压力。
* **原生 DOM 构建**：完全摒弃 `innerHTML` 写法，符合 Google 严格的 CSP 安全策略，完美修复 Edge 浏览器不显示的问题。
* **可拖动悬浮窗**：控制按钮可以随意拖拽到页面任何位置，避免遮挡内容。
* **位置记忆**：脚本会自动保存按钮的屏幕坐标，刷新页面后位置不重置。
* **智能交互**：自动区分“点击”与“拖拽”操作，防止误触。

## 安装方法

1. 在浏览器（Chrome/Edge/Firefox）中安装 **Tampermonkey** 或 **Violentmonkey** 扩展。
2. 点击扩展图标，选择“添加新脚本”。
3. 将仓库中的 `gemini-anti-lag.js` 代码完整复制并粘贴到编辑器中。
4. 保存脚本（Ctrl+S）。
5. 刷新 Gemini 网页即可生效。

## 使用指南

1. **启动**：脚本加载后，页面左下角（默认位置）会出现一个深色胶囊状按钮，显示状态为 `防卡顿: OFF`。
2. **开启优化**：在向 Gemini 提问需要生成大量代码的问题之前，点击该按钮。状态变为绿色 `防卡顿: ON`。
3. **效果**：此时生成的代码块将失去语法高亮，背景变为深色纯文本模式。浏览器的响应速度将保持流畅，不会出现卡顿。
4. **恢复视图**：当生成结束后，再次点击按钮切换回 `OFF` 状态，即可恢复原生的语法高亮样式以便阅读。
5. **移动按钮**：按住按钮即可将其拖拽到屏幕任意位置。松开鼠标后位置自动保存。

## 技术实现原理

Gemini 网页版在流式输出长代码时，会频繁触发 DOM 更新。原生的高亮渲染需要为每个代码 token 生成嵌套的 `<span>` 标签并计算样式，这在单线程的 JavaScript 环境下会迅速占满主线程。

本脚本通过以下技术手段解决该问题：

### 1. CSS 渲染隔离 (CSS Containment)

通过给代码容器应用 `contain: strict` 属性，告知浏览器该元素的布局、样式和绘制与外部完全独立。这意味着代码块内部的 DOM 变化不会触发整个页面的回流 (Reflow)，仅限制在容器内部。

```css
contain: strict !important;

```

### 2. 视口渲染优化 (Content Visibility)

应用 `content-visibility: auto` 属性。这允许浏览器跳过屏幕外内容的渲染计算，仅当用户滚动到该区域时才进行渲染，显著降低长对话历史的内存和计算开销。

```css
content-visibility: auto !important;

```

### 3. DOM 复杂度降维

在开启模式下，通过 CSS 强制覆盖：

* 将所有代码文字颜色统一，背景透明。
* 强制 `display: inline`。
* 移除阴影 (`box-shadow`) 和圆角 (`border-radius`) 等昂贵的绘制属性。

这使得浏览器不需要处理复杂的层叠上下文 (Stacking Contexts) 和细粒度的文字绘制，将渲染复杂度从  降低到接近 。

### 4. 交互逻辑

使用欧几里得距离判断鼠标行为：

* 监听 `mousedown` 记录初始坐标。
* 监听 `mousemove` 计算位移量 `dx` 和 `dy`。
* 若位移绝对值大于 3 像素，标记为 **拖拽** 行为，鼠标松开时仅保存位置。
* 若位移小于等于 3 像素，标记为 **点击** 行为，触发开关逻辑。

### 5. 安全策略适配 (Trusted Types & CSP)

针对 Edge 和新版 Chrome 对 `innerHTML` 的严格安全限制（Trusted Types），重构了 UI 生成逻辑：

* **纯 DOM API 构建**：完全使用 `document.createElement` 和 `appendChild` 组装界面，不再通过字符串注入 HTML。
* **合规性**：这种方式绕过了浏览器的 HTML 字符串解析拦截，消除了潜在的 XSS 风险，符合 Gemini 站点的 CSP 策略，确保脚本在任何严格安全配置的浏览器（特别是 Edge）中均能正常加载。

## 兼容性

+ * **浏览器**：Chrome, Edge (已解决 CSP 拦截问题), Firefox, Safari (需支持 Tampermonkey)。
  * **系统**：Windows, macOS, Linux。
* **限制**：依赖浏览器对 `contain` 和 `content-visibility` CSS 属性的支持（现代浏览器均已支持）。

## 许可证

MIT License