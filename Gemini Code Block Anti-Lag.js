// ==UserScript==
// @name         Gemini 代码块防卡顿 (Edge/Chrome 纯DOM版)
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  解决 Gemini 生成大量代码时网页严重卡顿的问题。修复拖拽后按钮失效的Bug。
// @author       KanameMadoka520
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('Gemini Anti-Lag: 脚本已注入 (v0.5 修复拖拽锁死 Bug)');

    // === 1. 配置 ===
    const CONFIG_KEY = 'gemini_antilag_config_kaname_v4';
    let config = { isEnabled: false, posX: window.innerWidth - 220, posY: 80 };
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
            top: 0; left: 0;
            z-index: 2147483647 !important;
            background: #2d2d2d;
            color: #e0e0e0;
            padding: 6px 12px;
            border-radius: 24px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            font-family: system-ui, sans-serif;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 10px;
            user-select: none;
            border: 1px solid #555;
            width: fit-content;
            height: fit-content;
        }

        .lag-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 16px;
            transition: background 0.2s;
        }
        .lag-btn:hover { background: rgba(255, 255, 255, 0.1); }

        #gemini-lag-status-dot {
            width: 10px; height: 10px;
            border-radius: 50%;
            background-color: #f44336;
            transition: background-color 0.3s;
        }

        .lag-btn.active #gemini-lag-status-dot {
            background-color: #00e676;
            box-shadow: 0 0 5px #00e676;
        }

        .lag-btn-restore {
            color: #ff9800;
            font-weight: bold;
        }
        .lag-btn-restore:active { transform: scale(0.95); }

        .lag-divider {
            width: 1px; height: 16px; background: #555; cursor: move; padding: 0 4px;
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
        // 备份初始状态
        if (!el.dataset.backup && el.textContent.length > 0) {
            el.dataset.backup = el.innerHTML;
        }
        // 简化：纯文本替换，强行干掉引发卡顿的高亮节点
        if (el.children.length > 0) {
            el.textContent = el.innerText;
            el.dataset.optimized = 'true';
        }
    }

    function restoreElement(el) {
        // 修复原版 Bug：如果当前文本长度远大于备份长度，说明代码是在开启防卡顿期间生成的。
        // 此时绝对不能用旧备份覆盖，否则会吞掉几千行代码，直接保留纯文本即可。
        if (el.dataset.backup && (el.textContent.length - el.dataset.backup.length) < 50) {
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

    // === 4. UI 创建 ===
    function createController() {
        if (document.getElementById('gemini-lag-controller')) return;

        const container = document.createElement('div');
        container.id = 'gemini-lag-controller';

        // --- 防卡顿开关按钮 ---
        const btnToggle = document.createElement('div');
        btnToggle.className = 'lag-btn';
        if (config.isEnabled) btnToggle.classList.add('active');

        const dot = document.createElement('div');
        dot.id = 'gemini-lag-status-dot';

        const text = document.createElement('span');
        text.id = 'gemini-lag-text';
        text.textContent = config.isEnabled ? '防卡顿: ON' : '防卡顿: OFF';

        btnToggle.appendChild(dot);
        btnToggle.appendChild(text);

        // --- 拖拽把手/分割线 ---
        const divider = document.createElement('div');
        divider.className = 'lag-divider';
        divider.title = "按住拖拽";

        // --- 手动恢复按钮 ---
        const btnRestore = document.createElement('div');
        btnRestore.className = 'lag-btn lag-btn-restore';
        btnRestore.textContent = '↺ 恢复排版';

        // 组装
        container.appendChild(btnToggle);
        container.appendChild(divider);
        container.appendChild(btnRestore);

        // 设置坐标
        container.style.left = Math.min(Math.max(0, config.posX), window.innerWidth - 200) + 'px';
        container.style.top = Math.min(Math.max(0, config.posY), window.innerHeight - 50) + 'px';

        // 绑定事件
        let isDrag = false;

        // 切换防卡顿模式
        btnToggle.addEventListener('click', () => {
            if (isDrag) return;
            config.isEnabled = !config.isEnabled;
            localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

            if (config.isEnabled) {
                btnToggle.classList.add('active');
                document.body.classList.add('gemini-optimized');
                text.textContent = '防卡顿: ON';
                document.querySelectorAll('pre').forEach(simplifyElement);
            } else {
                btnToggle.classList.remove('active');
                // 仅关闭全局强行覆盖的 CSS，不还原具体 DOM 节点，除非点击恢复按钮
                document.body.classList.remove('gemini-optimized');
                text.textContent = '防卡顿: OFF';
            }
        });

        // 手动恢复按钮事件
        btnRestore.addEventListener('click', () => {
            if (isDrag) return;
            // 确保防卡顿状态关闭，避免刚恢复又被拍平
            if (config.isEnabled) {
                config.isEnabled = false;
                localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
                btnToggle.classList.remove('active');
                text.textContent = '防卡顿: OFF';
                document.body.classList.remove('gemini-optimized');
            }

            // 执行所有节点的恢复逻辑
            document.querySelectorAll('pre').forEach(restoreElement);

            // 简单的点击反馈
            const originalText = btnRestore.textContent;
            btnRestore.textContent = '✓ 已恢复';
            setTimeout(() => { btnRestore.textContent = originalText; }, 1500);
        });

        // 拖拽逻辑 (绑定在分割线上，避免误触按钮)
        divider.addEventListener('mousedown', (e) => {
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
                // 【已修复】重置拖拽状态，释放按钮的点击拦截
                setTimeout(() => { isDrag = false; }, 0);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        document.documentElement.appendChild(container);
    }

    // === 5. 启动 ===
    function main() {
        createController();
        if (document.body) {
             observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        } else {
            const tempOb = new MutationObserver(() => {
                if (document.body) {
                    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
                    tempOb.disconnect();
                }
            });
            tempOb.observe(document.documentElement, { childList: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

    setInterval(() => {
        if (!document.getElementById('gemini-lag-controller')) {
            createController();
        }
    }, 2000);

})();