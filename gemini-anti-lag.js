// ==UserScript==
// @name         Gemini Anti-Lag & Performance Booster (Fixed)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  为 Gemini 网页版增加一个悬浮开关，解决长代码卡顿。修复Edge兼容性与拖拽逻辑。
// @author       Gemini_Helper
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG_KEY = 'gemini_antilag_config_v2';
    let config = {
        isEnabled: false,
        posX: window.innerWidth * 0.35, // 初始位置：中间偏左
        posY: window.innerHeight - 100
    };

    // 读取配置
    const savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) {
        try { config = { ...config, ...JSON.parse(savedConfig) }; } catch (e) {}
    }

    // 核心优化 CSS
    const optimizationCSS = `
        body.gemini-optimized-mode pre, 
        body.gemini-optimized-mode code {
            contain: strict !important;
            content-visibility: auto !important;
            background: #1e1e1e !important;
            color: #d4d4d4 !important;
        }
        body.gemini-optimized-mode pre * {
            color: inherit !important;
            background: transparent !important;
            display: inline !important;
        }
    `;

    // UI CSS
    const uiCSS = `
        #gemini-lag-controller {
            position: fixed;
            z-index: 2147483647; /* 确保在最顶层 */
            background: #2d2d2d;
            color: #e0e0e0;
            padding: 8px 16px;
            border-radius: 24px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 13px;
            display: flex !important; /* 强制显示 */
            align-items: center;
            gap: 8px;
            cursor: move;
            user-select: none;
            border: 1px solid #444;
            transition: background-color 0.2s;
        }
        #gemini-lag-status-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background-color: #f44336;
        }
        #gemini-lag-controller.active {
            background: #1b3a25;
            border-color: #00e676;
        }
        #gemini-lag-controller.active #gemini-lag-status-dot {
            background-color: #00e676;
            box-shadow: 0 0 8px #00e676;
        }
    `;

    // 注入样式
    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(optimizationCSS + uiCSS);
    } else {
        const style = document.createElement('style');
        style.textContent = optimizationCSS + uiCSS;
        document.documentElement.appendChild(style);
    }

    function saveConfig() {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }

    function applyState() {
        const btn = document.getElementById('gemini-lag-controller');
        const txt = document.getElementById('gemini-lag-text');
        if (!btn) return;

        if (config.isEnabled) {
            document.body.classList.add('gemini-optimized-mode');
            btn.classList.add('active');
            txt.textContent = "防卡顿: ON";
        } else {
            document.body.classList.remove('gemini-optimized-mode');
            btn.classList.remove('active');
            txt.textContent = "防卡顿: OFF";
        }
    }

    function createDraggableUI() {
        if (document.getElementById('gemini-lag-controller')) return;

        const div = document.createElement('div');
        div.id = 'gemini-lag-controller';
        div.style.left = config.posX + 'px';
        div.style.top = config.posY + 'px';
        div.innerHTML = `<div id="gemini-lag-status-dot"></div><span id="gemini-lag-text">加载中...</span>`;
        
        (document.body || document.documentElement).appendChild(div);
        applyState();

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        div.addEventListener('mousedown', (e) => {
            isDragging = false;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = div.offsetLeft;
            initialTop = div.offsetTop;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;
            div.style.left = (initialLeft + dx) + 'px';
            div.style.top = (initialTop + dy) + 'px';
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isDragging) {
                config.posX = parseInt(div.style.left);
                config.posY = parseInt(div.style.top);
                saveConfig();
            } else {
                config.isEnabled = !config.isEnabled;
                saveConfig();
                applyState();
            }
        }
    }

    // 使用 MutationObserver 确保按钮在 SPA 路由跳转后依然存在
    const observer = new MutationObserver(() => {
        if (!document.getElementById('gemini-lag-controller') && document.body) {
            createDraggableUI();
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

})();