// ==UserScript==
// @name         Gemini 代码块防卡顿 (Edge/Chrome 纯DOM版)
// @namespace    http://tampermonkey.net/
// @version      0.3-Fix
// @description  解决 Gemini 生成大量代码时网页严重卡顿的问题。不使用 innerHTML，绕过 Edge 安全策略。
// @author       KanameMadoka520
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('Gemini Anti-Lag: 脚本已注入');

    // === 1. 配置 ===
    const CONFIG_KEY = 'gemini_antilag_config_kaname_v3';
    let config = { isEnabled: false, posX: window.innerWidth - 150, posY: 80 };
    try {
        const saved = localStorage.getItem(CONFIG_KEY);
        if (saved) config = { ...config, ...JSON.parse(saved) };
    } catch(e) {}

    // === 2. 样式定义 (不依赖 external resources) ===
    const CSS_RULES = `
        /* 核心优化样式 */
        body.gemini-optimized pre,
        body.gemini-optimized pre code,
        body.gemini-optimized pre .code-block {
            background-color: #1e1e1e !important;
            color: #d4d4d4 !important;
            font-family: 'Consolas', monospace !important;
            white-space: pre-wrap !important;
            transition: none !important;
            box-shadow: none !important;
            border: 1px solid #333 !important;
        }
        body.gemini-optimized pre * {
            color: inherit !important;
            background: transparent !important;
            font-weight: normal !important;
        }

        /* 按钮样式 */
        #gemini-lag-controller {
            position: fixed !important;
            top: 0; left: 0; /* 初始定位，由JS覆盖 */
            z-index: 2147483647 !important;
            background: #2d2d2d;
            color: #e0e0e0;
            padding: 8px 16px;
            border-radius: 24px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            font-family: system-ui, sans-serif;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            user-select: none;
            border: 1px solid #555;
            width: fit-content;
            height: fit-content;
        }
        #gemini-lag-status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: #f44336;
            transition: background-color 0.3s;
        }
        #gemini-lag-controller.active {
            background: #1b3a25;
            border-color: #00e676;
        }
        #gemini-lag-controller.active #gemini-lag-status-dot {
            background-color: #00e676;
            box-shadow: 0 0 5px #00e676;
        }
    `;

    // 安全注入样式
    function injectStyle() {
        if (typeof GM_addStyle !== 'undefined') {
            GM_addStyle(CSS_RULES);
        } else {
            const style = document.createElement('style');
            style.textContent = CSS_RULES;
            (document.head || document.documentElement).appendChild(style);
        }
    }
    injectStyle();

    // === 3. 逻辑处理 ===
    function simplifyElement(el) {
        if (el.dataset.optimized === 'true') return;
        // 备份
        if (!el.dataset.backup && el.textContent.length > 0) {
            el.dataset.backup = el.innerHTML;
        }
        // 简化：纯文本替换
        if (el.children.length > 0) {
            el.textContent = el.innerText;
            el.dataset.optimized = 'true';
        }
    }

    function restoreElement(el) {
        if (el.dataset.backup && Math.abs(el.textContent.length - el.dataset.backup.length) < 5000) {
            el.innerHTML = el.dataset.backup;
        }
        delete el.dataset.optimized;
        delete el.dataset.backup;
    }

    // 观察者
    const observer = new MutationObserver((mutations) => {
        if (!config.isEnabled) return;
        mutations.forEach(m => {
            if (m.type === 'childList') {
                m.addedNodes.forEach(n => {
                    if (n.nodeType === 1 && (n.tagName === 'PRE' || n.querySelector?.('pre'))) {
                        n.tagName === 'PRE' ? simplifyElement(n) : n.querySelectorAll('pre').forEach(simplifyElement);
                    }
                });
            } else if (m.type === 'characterData' || m.type === 'subtree') {
                let t = m.target;
                while (t && t.tagName !== 'PRE') t = t.parentElement;
                if (t) simplifyElement(t);
            }
        });
    });

    // === 4. UI 创建 (纯 DOM 操作，不含 innerHTML) ===
    function createController() {
        if (document.getElementById('gemini-lag-controller')) return;

        console.log('Gemini Anti-Lag: 创建UI中...');

        // 1. 创建容器
        const container = document.createElement('div');
        container.id = 'gemini-lag-controller';

        // 2. 创建红绿灯
        const dot = document.createElement('div');
        dot.id = 'gemini-lag-status-dot';

        // 3. 创建文字
        const text = document.createElement('span');
        text.id = 'gemini-lag-text';
        text.textContent = config.isEnabled ? '防卡顿: ON' : '防卡顿: OFF';

        // 4. 组装
        container.appendChild(dot);
        container.appendChild(text);

        // 5. 设置初始状态
        if (config.isEnabled) container.classList.add('active');

        // 6. 设置坐标
        container.style.left = Math.min(Math.max(0, config.posX), window.innerWidth - 120) + 'px';
        container.style.top = Math.min(Math.max(0, config.posY), window.innerHeight - 50) + 'px';

        // 7. 绑定事件
        // 点击切换
        let isDrag = false;
        container.addEventListener('click', () => {
            if (!isDrag) toggleMode(container, text);
        });

        // 拖拽逻辑
        container.addEventListener('mousedown', (e) => {
            isDrag = false;
            const startX = e.clientX;
            const startY = e.clientY;
            const rect = container.getBoundingClientRect();
            const offX = startX - rect.left;
            const offY = startY - rect.top;

            const onMove = (ev) => {
                if (Math.abs(ev.clientX - startX) > 3) isDrag = true;
                container.style.left = (ev.clientX - offX) + 'px';
                container.style.top = (ev.clientY - offY) + 'px';
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (isDrag) {
                    config.posX = parseFloat(container.style.left);
                    config.posY = parseFloat(container.style.top);
                    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
                }
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        // 8. 强力挂载：直接挂载到 HTML 根元素，防止 Body 被清空
        document.documentElement.appendChild(container);
    }

    function toggleMode(btn, txt) {
        config.isEnabled = !config.isEnabled;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

        if (config.isEnabled) {
            btn.classList.add('active');
            document.body.classList.add('gemini-optimized');
            txt.textContent = '防卡顿: ON';
            document.querySelectorAll('pre').forEach(simplifyElement);
        } else {
            btn.classList.remove('active');
            document.body.classList.remove('gemini-optimized');
            txt.textContent = '防卡顿: OFF';
            document.querySelectorAll('pre').forEach(restoreElement);
        }
    }

    // === 5. 启动 ===
    function main() {
        createController();
        // 无论 body 是否存在，先挂载 UI 到 html，然后等 body 出来挂载观察者
        if (document.body) {
             observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        } else {
            // 如果 body 还没出来，监听 html 的变化直到 body 出现
            const tempOb = new MutationObserver(() => {
                if (document.body) {
                    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
                    tempOb.disconnect();
                }
            });
            tempOb.observe(document.documentElement, { childList: true });
        }
    }

    // 只要 DOM 解析完成就开始，不必等图片加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

    // 心跳检测：防止 Edge 杀掉节点
    setInterval(() => {
        if (!document.getElementById('gemini-lag-controller')) {
            console.log('Gemini Anti-Lag: 重新挂载UI');
            createController();
        }
    }, 2000);

})();