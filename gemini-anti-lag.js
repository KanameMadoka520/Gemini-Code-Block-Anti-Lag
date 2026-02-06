// ==UserScript==
// @name         Gemini Anti-Lag Ultimate (JS-Lobotomy Edition)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  不仅通过 CSS 隐藏，更通过 JS 暴力移除代码块的语法高亮标记，彻底根除生成长代码时的 CPU 阻塞。
// @author       KanameMadoka520
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG_KEY = 'gemini_antilag_config_v4';
    let config = {
        isEnabled: false,
        posX: window.innerWidth * 0.35,
        posY: window.innerHeight - 100
    };

    try {
        const savedConfig = localStorage.getItem(CONFIG_KEY);
        if (savedConfig) config = { ...config, ...JSON.parse(savedConfig) };
    } catch (e) { console.error(e); }

    // --- CSS 样式：保留之前的视觉优化 ---
    GM_addStyle(`
        /* 开启模式下的样式强制覆盖 */
        body.gemini-optimized-mode .code-block-decoration, 
        body.gemini-optimized-mode pre > span {
            /* 强制把已经生成的高亮 span 变成素颜，减少重绘 */
            color: #d4d4d4 !important;
            background: transparent !important;
            font-weight: normal !important;
        }
        
        /* 悬浮窗样式 */
        #gemini-lag-controller {
            position: fixed;
            z-index: 2147483647;
            background: #2d2d2d;
            color: #e0e0e0;
            padding: 8px 16px;
            border-radius: 24px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 13px;
            display: flex;
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
            transition: background-color 0.3s, box-shadow 0.3s;
        }
        #gemini-lag-controller.active {
            background: #1b3a25;
            border-color: #00e676;
        }
        #gemini-lag-controller.active #gemini-lag-status-dot {
            background-color: #00e676;
            box-shadow: 0 0 8px #00e676;
        }
    `);

    // --- DOM 工具 ---
    const el = (tag, id, txt) => {
        const e = document.createElement(tag);
        if (id) e.id = id;
        if (txt) e.textContent = txt;
        return e;
    };

    // --- 核心逻辑：JS 阻断器 (The Lobotomizer) ---
    // 这是解决卡顿的关键。它会监听 DOM 插入，一旦发现代码块，立即剥夺其高亮资格。
    
    function processNode(node) {
        if (!config.isEnabled) return;

        // 检查目标节点本身
        if (node.nodeType === 1) { // Element Node
            lobotomize(node);
            
            // 检查子节点（防止成批插入时漏网）
            const children = node.querySelectorAll ? node.querySelectorAll('code[class*="language-"]') : [];
            children.forEach(lobotomize);
        }
    }

    function lobotomize(element) {
        // 识别特征：Gemini 的代码块通常在 code 标签上带有 language-xxx 类
        if (element.matches && element.matches('code[class*="language-"]')) {
            const originalClass = element.getAttribute('class');
            
            // 如果已经是纯文本，跳过
            if (originalClass.includes('language-text')) return;

            // 1. 备份原始类名（为了以后可能恢复，虽然通常不需要）
            element.dataset.originalClass = originalClass;

            // 2. 核心操作：强制改为纯文本模式
            // 这会欺骗前端高亮库，让它以为这是普通文本，从而跳过昂贵的 Token 计算
            element.className = 'language-text';
            
            // 3. 视觉反馈：稍微变灰一点，让你知道它被优化了
            element.style.opacity = '0.9';
        }
    }

    // --- 观察者 ---
    const observer = new MutationObserver((mutations) => {
        if (!config.isEnabled) return;

        for (const mutation of mutations) {
            // 处理新增节点
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(processNode);
            }
            // 防止 Gemini 后来又把 class 改回去 (React 可能会尝试修复 DOM)
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                processNode(mutation.target);
            }
        }
    });

    // --- UI 逻辑 ---
    function saveConfig() {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }

    function applyState(btn, dot, txt) {
        const body = document.body;
        if (config.isEnabled) {
            body.classList.add('gemini-optimized-mode');
            if (btn) btn.classList.add('active');
            if (txt) txt.textContent = "强力防卡: ON";
            
            // 开启瞬间，处理页面上现存的所有代码块
            document.querySelectorAll('code[class*="language-"]').forEach(lobotomize);
            
        } else {
            body.classList.remove('gemini-optimized-mode');
            if (btn) btn.classList.remove('active');
            if (txt) txt.textContent = "强力防卡: OFF";
            
            // 关闭时尝试恢复（可选，可能需要刷新才完美）
            // 恢复逻辑比较复杂，为了防卡顿，我们通常只管杀不管埋
        }
    }

    function createUI() {
        if (document.getElementById('gemini-lag-controller')) return;

        const container = el('div', 'gemini-lag-controller');
        const dot = el('div', 'gemini-lag-status-dot');
        const text = el('span', 'gemini-lag-text', '加载中...');

        container.appendChild(dot);
        container.appendChild(text);

        const safeX = Math.min(Math.max(0, config.posX), window.innerWidth - 120);
        const safeY = Math.min(Math.max(0, config.posY), window.innerHeight - 60);
        container.style.left = safeX + 'px';
        container.style.top = safeY + 'px';

        document.body.appendChild(container);
        applyState(container, dot, text);

        // 拖拽
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        container.addEventListener('mousedown', (e) => {
            isDragging = false;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = container.offsetLeft;
            initialTop = container.offsetTop;
            e.preventDefault();
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;
            container.style.left = (initialLeft + dx) + 'px';
            container.style.top = (initialTop + dy) + 'px';
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isDragging) {
                config.posX = parseInt(container.style.left);
                config.posY = parseInt(container.style.top);
                saveConfig();
            } else {
                config.isEnabled = !config.isEnabled;
                saveConfig();
                applyState(container, dot, text);
            }
        }
    }

    // --- 启动 ---
    const initObserver = new MutationObserver(() => {
        if (!document.getElementById('gemini-lag-controller') && document.body) {
            createUI();
            // 启动核心防卡顿监听
            observer.observe(document.body, { 
                childList: true, 
                subtree: true, 
                attributes: true, 
                attributeFilter: ['class'] 
            });
            initObserver.disconnect();
        }
    });

    if (document.body) {
        initObserver.observe(document.documentElement, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            initObserver.observe(document.documentElement, { childList: true, subtree: true });
        });
    }

})();