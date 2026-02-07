// ==UserScript==
// @name         Gemini 代码块防卡顿 (Gemini Code Block Anti-Lag)
// @namespace    http://tampermonkey.net/
// @version      0.1beta
// @description  解决 Gemini 生成大量代码时网页严重卡顿的问题。开启后将代码块简化为纯文本以极速渲染；关闭后可完美恢复代码高亮和样式。
// @author       KanameMadoka520
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @run-at       document-start
// @license      MIT
// ==/UserScript==

/**
 * 项目说明：
 * 当 Gemini 输出几千行的长代码时，网页前端的高亮渲染会消耗大量 CPU 资源，导致系统卡顿。
 * 这个脚本的作用是：在检测到代码块时，暂时移除复杂的颜色高亮，只保留纯文本，从而保证网页流畅。
 * 当你需要阅读代码高亮时，只需关闭开关，脚本会自动把之前的样式还原回去。
 */

(function() {
    'use strict';

    // === 1. 配置管理 ===
    // 保存按钮位置和开关状态
    const CONFIG_KEY = 'gemini_antilag_config_kaname_v1';
    
    // 默认配置
    let config = {
        isEnabled: false,
        posX: window.innerWidth * 0.2,
        posY: window.innerHeight - 80
    };

    try {
        const saved = localStorage.getItem(CONFIG_KEY);
        if (saved) config = { ...config, ...JSON.parse(saved) };
    } catch(e) {
        console.warn('配置文件读取失败，使用默认设置。');
    }

    // === 2. 样式注入 ===
    // 通过 CSS 类名控制样式，方便一键还原
    GM_addStyle(`
        /* 开启防卡顿模式后的样式：强制黑底白字，去除复杂效果 */
        body.gemini-optimized pre,
        body.gemini-optimized pre code,
        body.gemini-optimized pre .code-block {
            background-color: #1e1e1e !important;
            color: #d4d4d4 !important;
            font-family: 'Consolas', 'Monaco', monospace !important;
            font-variant-ligatures: none !important; /* 关闭连字 */
            white-space: pre-wrap !important;
            transition: none !important;
            box-shadow: none !important;
        }
        
        /* 隐藏可能残留的高亮标签 */
        body.gemini-optimized pre span,
        body.gemini-optimized code span {
            color: inherit !important;
            background: transparent !important;
            font-weight: normal !important;
        }

        /* 悬浮按钮样式 */
        #gemini-lag-controller {
            position: fixed;
            z-index: 2147483647; /* 顶层显示 */
            background: #2d2d2d;
            color: #e0e0e0;
            padding: 8px 16px;
            border-radius: 24px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            font-family: sans-serif;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            user-select: none;
            border: 1px solid #444;
            transition: transform 0.1s;
        }
        #gemini-lag-controller:active { transform: scale(0.95); }
        
        /* 状态指示灯 */
        #gemini-lag-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #f44336; /* 关闭状态：红灯 */
            box-shadow: 0 0 4px rgba(244, 67, 54, 0.6);
            transition: background-color 0.3s;
        }
        
        /* 开启状态样式 */
        #gemini-lag-controller.active #gemini-lag-status-dot {
            background-color: #00e676; /* 开启状态：绿灯 */
            box-shadow: 0 0 8px #00e676;
        }
        #gemini-lag-controller.active {
            border-color: #00e676;
            background: #1b3a25;
        }
    `);

    // === 3. 核心逻辑 ===

    function processNode(node) {
        if (!config.isEnabled) return;
        if (node.nodeType !== 1) return;

        // 只处理 PRE 标签，它是代码块的容器
        if (node.tagName === 'PRE') {
            simplifyElement(node);
        } else if (node.querySelectorAll) {
            const pres = node.querySelectorAll('pre');
            pres.forEach(simplifyElement);
        }
    }

    /**
     * 简化元素：移除复杂结构，只留纯文本
     */
    function simplifyElement(el) {
        // 如果已经是处理过的纯文本，跳过
        if (el.childElementCount === 0 && el.dataset.optimized === 'true') return;

        // 1. 备份：在修改前，先把原始的 HTML 存起来，方便后面还原
        // 只有当这是第一次处理，且内容不为空时才备份
        if (!el.dataset.backupHtml && el.innerHTML.length > 0) {
            el.dataset.backupHtml = el.innerHTML;
        }

        // 2. 简化：如果检测到有子元素（说明正在渲染高亮），直接替换为纯文本
        if (el.childElementCount > 0) {
            el.textContent = el.innerText; 
            el.dataset.optimized = 'true';
        }
    }

    /**
     * 还原：恢复原始的高亮和样式
     */
    function restoreAll() {
        const targets = document.querySelectorAll('[data-optimized="true"]');
        
        targets.forEach(el => {
            // 1. 尝试从备份恢复 HTML
            if (el.dataset.backupHtml) {
                // 安全检查：防止流式输出的新内容被旧备份覆盖
                // 只有当长度变化不大时才恢复 HTML
                if (Math.abs(el.textContent.length - el.dataset.backupHtml.length) < 5000) { 
                     el.innerHTML = el.dataset.backupHtml;
                }
            }
            
            // 2. 清理标记
            delete el.dataset.optimized;
            delete el.dataset.backupHtml;

            // 3. 清除残留样式
            el.style.cssText = ''; 
        });
    }

    // === 4. 监听网页变化 ===
    const observer = new MutationObserver((mutations) => {
        if (!config.isEnabled) return;

        for (let mutation of mutations) {
            // 有新节点插入时
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(processNode);
            } 
            // 文本发生变化时 (针对流式输出)
            else if (mutation.type === 'characterData' || mutation.type === 'subtree') {
                let target = mutation.target;
                if (target.tagName === 'PRE') {
                    simplifyElement(target);
                } else if (target.parentNode && target.parentNode.tagName === 'PRE') {
                    simplifyElement(target.parentNode);
                }
            }
        }
    });

    // === 5. UI 界面逻辑 ===
    
    function saveConfig() { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }

    function toggleMode() {
        config.isEnabled = !config.isEnabled;
        saveConfig();
        applyState();

        if (config.isEnabled) {
            // 开启时：立即处理页面上现有的代码块
            document.querySelectorAll('pre').forEach(simplifyElement);
        } else {
            // 关闭时：立即还原
            restoreAll();
        }
    }

    function applyState() {
        const btn = document.getElementById('gemini-lag-controller');
        const txt = document.getElementById('gemini-lag-text');
        if (!btn) return;

        if (config.isEnabled) {
            document.body.classList.add('gemini-optimized');
            btn.classList.add('active');
            txt.textContent = "防卡顿: ON";
            // 确保监听器开启
            observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        } else {
            document.body.classList.remove('gemini-optimized');
            btn.classList.remove('active');
            txt.textContent = "防卡顿: OFF";
        }
    }

    function createUI() {
        if (document.getElementById('gemini-lag-controller')) return;
        
        const div = document.createElement('div');
        div.id = 'gemini-lag-controller';
        div.style.left = config.posX + 'px';
        div.style.top = config.posY + 'px';
        div.innerHTML = `<div id="gemini-lag-status-dot"></div><span id="gemini-lag-text">防卡顿: OFF</span>`;
        document.body.appendChild(div);

        applyState();

        // 拖拽功能
        let isDragging = false, startX, startY, initialLeft, initialTop;
        
        div.addEventListener('mousedown', (e) => {
            isDragging = false;
            startX = e.clientX; startY = e.clientY;
            initialLeft = div.offsetLeft; initialTop = div.offsetTop;
            
            const onMove = (e) => {
                if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) isDragging = true;
                div.style.left = (initialLeft + e.clientX - startX) + 'px';
                div.style.top = (initialTop + e.clientY - startY) + 'px';
            };
            
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (isDragging) {
                    config.posX = parseFloat(div.style.left);
                    config.posY = parseFloat(div.style.top);
                    saveConfig();
                } else { 
                    toggleMode(); 
                }
            };
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    // === 6. 启动 ===
    const start = () => {
        if (!document.body) return setTimeout(start, 100);
        createUI();
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    
    start();
    
    // 定时检查按钮是否存在 (防止被网页刷新清除)
    setInterval(createUI, 2000);

})();