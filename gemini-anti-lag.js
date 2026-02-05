// ==UserScript==
// @name         Gemini Anti-Lag & Performance Booster
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  为 Gemini 网页版增加一个悬浮开关，开启后通过 CSS 强力限制渲染开销，解决生成长代码时的卡顿问题。
// @author       KanameMadoka520
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // === 配置项与状态 ===
    const CONFIG_KEY = 'gemini_antilag_config_v2';

    // 默认配置（初始位置在左下偏中）
    let config = {
        isEnabled: false,
        posX: window.innerWidth * 0.2, // 屏幕左侧 20%
        posY: window.innerHeight - 80  // 屏幕底部上方 80px
    };

    // 读取本地存储
    const savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) {
        try {
            const parsed = JSON.parse(savedConfig);
            // 合并配置，防止旧数据缺少字段
            config = { ...config, ...parsed };
        } catch (e) {
            console.error('配置读取失败，重置默认');
        }
    }

    // === 核心 CSS：降维打击渲染 (保持不变) ===
    const optimizationCSS = `
        /* 开启优化模式时的样式 */
        body.gemini-optimized-mode pre,
        body.gemini-optimized-mode code,
        body.gemini-optimized-mode .code-block {
            contain: strict !important;
            content-visibility: auto !important;
            background: #1e1e1e !important;
            color: #d4d4d4 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            transition: none !important;
            animation: none !important;
        }
        body.gemini-optimized-mode pre * {
            color: inherit !important;
            background: transparent !important;
            font-weight: normal !important;
            font-style: normal !important;
            display: inline !important;
        }
    `;

    // === UI 样式：悬浮窗 ===
    const uiCSS = `
        #gemini-lag-controller {
            position: fixed;
            z-index: 99999;
            background: #2d2d2d;
            color: #e0e0e0;
            padding: 8px 16px;
            border-radius: 24px; /* 胶囊形状 */
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            font-family: sans-serif;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: move; /* 鼠标变成移动图标 */
            user-select: none;
            border: 1px solid #444;
            transition: background-color 0.2s, box-shadow 0.2s, transform 0.1s;
        }

        /* 状态指示灯 */
        #gemini-lag-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #f44336; /* 默认红灯 */
            box-shadow: 0 0 4px rgba(244, 67, 54, 0.6);
            transition: background-color 0.3s;
        }

        /* 激活状态 */
        #gemini-lag-controller.active {
            background: #1b3a25; /* 深绿色背景 */
            border-color: #00e676;
            box-shadow: 0 0 15px rgba(0, 230, 118, 0.2);
        }
        #gemini-lag-controller.active #gemini-lag-status-dot {
            background-color: #00e676; /* 绿灯 */
            box-shadow: 0 0 8px #00e676;
        }
    `;

    // 注入 CSS
    const styleElement = document.createElement('style');
    styleElement.textContent = optimizationCSS + uiCSS;
    document.head.appendChild(styleElement);

    // === 逻辑实现 ===

    function saveConfig() {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }

    function toggleMode() {
        config.isEnabled = !config.isEnabled;
        saveConfig();
        applyState();
    }

    function applyState() {
        const btn = document.getElementById('gemini-lag-controller');
        const txt = document.getElementById('gemini-lag-text');

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

    // === 创建可拖动 UI ===
    function createDraggableUI() {
        const div = document.createElement('div');
        div.id = 'gemini-lag-controller';
        div.style.left = config.posX + 'px';
        div.style.top = config.posY + 'px';
        div.innerHTML = `
            <div id="gemini-lag-status-dot"></div>
            <span id="gemini-lag-text">防卡顿: OFF</span>
        `;
        document.body.appendChild(div);

        // 初始化状态
        applyState();

        // === 拖拽逻辑 ===
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        div.addEventListener('mousedown', (e) => {
            isDragging = false; // 重置拖拽标记
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = div.offsetLeft;
            initialTop = div.offsetTop;

            // 绑定移动和松开事件到 document，防止鼠标移出按钮范围失效
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // 如果移动距离超过 3像素，视为拖拽，而不是点击
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                isDragging = true;
            }

            // 更新位置
            div.style.left = (initialLeft + dx) + 'px';
            div.style.top = (initialTop + dy) + 'px';
        }

        function onMouseUp(e) {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (isDragging) {
                // 如果是拖拽结束，保存位置
                config.posX = parseFloat(div.style.left);
                config.posY = parseFloat(div.style.top);
                saveConfig();
            } else {
                // 如果没有发生拖拽，则视为点击，触发开关
                toggleMode();
            }
        }
    }

    // 启动
    window.addEventListener('load', createDraggableUI);
    // 针对单页应用可能的延迟加载
    setTimeout(() => {
        if (!document.getElementById('gemini-lag-controller')) {
            createDraggableUI();
        }
    }, 1500);

})();