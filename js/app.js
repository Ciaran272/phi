/**
 * Emoji Picker - 主应用逻辑
 * 版本: 2.0
 */

// 依赖的模块：
// - CONFIG (来自 config.js)
// - emojiData, emojiVariants, flagNames (来自 emoji-data.js)
// - debounce (来自 utils.js)

// 使用IIFE封装，避免全局变量污染
(function() {
    'use strict';
    
    // 性能优化：预计算总表情数（优化2）
    const TOTAL_EMOJIS = (() => {
        let total = 0;
        Object.values(emojiData).forEach(cat => total += cat.emojis.length);
        return total;
    })();
    
    // 性能优化：缓存系统
    window.categoryCache = new Map();      // 缓存分类内容
    window.variantCache = new Map();       // 缓存变体弹出框
    let categoryHeaders = null;             // 缓存分类按钮DOM查询
    
    // 当前激活的分类
    let activeCategory = null;

    /**
     * 渲染表情分类
     */
    function renderEmojis() {
        const container = document.getElementById('emojiContainer');
        // 性能优化1：使用replaceChildren替代innerHTML
        container.replaceChildren();
        
        // 创建分类按钮网格
        const categoriesGrid = document.createElement('div');
        categoriesGrid.className = 'categories-grid';
        
        // 创建表情显示区域
        const emojiContent = document.createElement('div');
        emojiContent.className = 'emoji-content';
        emojiContent.id = 'emojiContent';
        
        Object.keys(emojiData).forEach(categoryName => {
            const category = emojiData[categoryName];
            
            // 创建分类按钮
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            
            const header = document.createElement('div');
            header.className = 'category-header';
            
            // 安全地创建DOM元素
            const iconSpan = document.createElement('span');
            iconSpan.className = 'category-icon';
            iconSpan.textContent = category.icon;
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'category-title';
            titleSpan.textContent = categoryName;
            
            header.appendChild(iconSpan);
            header.appendChild(titleSpan);
            
            // 添加点击事件
            header.addEventListener('click', () => {
                showCategoryEmojis(categoryName, category, emojiContent, header);
            });
            
            categoryDiv.appendChild(header);
            categoriesGrid.appendChild(categoryDiv);
        });
        
        container.appendChild(categoriesGrid);
        container.appendChild(emojiContent);
        
        // 性能优化：缓存分类按钮查询结果
        categoryHeaders = categoriesGrid.querySelectorAll('.category-header');
        
        // 使用事件委托处理emoji点击和右键事件
        emojiContent.addEventListener('click', (e) => {
            const emojiItem = e.target.closest('.emoji-item');
            if (emojiItem && emojiItem.dataset.emoji) {
                copyEmoji(emojiItem.dataset.emoji, emojiItem);
            }
        });
        
        // 性能优化：为右键菜单添加防抖
        const debouncedShowVariant = debounce((emoji, item) => {
            showVariantPopup(emoji, item);
        }, 50);
        
        emojiContent.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const emojiItem = e.target.closest('.emoji-item');
            if (emojiItem && emojiItem.dataset.emoji) {
                debouncedShowVariant(emojiItem.dataset.emoji, emojiItem);
            }
        });
    }

    /**
     * 显示某个分类的表情（优化版：带缓存、虚拟滚动）
     */
    function showCategoryEmojis(categoryName, category, emojiContent, clickedElement) {
        // 优化3：批量更新classList（减少重排）
        requestAnimationFrame(() => {
            if (categoryHeaders) {
                categoryHeaders.forEach(btn => btn.classList.remove('active'));
            } else {
                document.querySelectorAll('.category-header').forEach(btn => btn.classList.remove('active'));
            }
            
            if (clickedElement) {
                clickedElement.classList.add('active');
            }
        });
        
        // 如果点击的是当前激活的分类，则关闭
        if (activeCategory === categoryName) {
            emojiContent.classList.remove('active');
            // 性能优化1：使用replaceChildren替代innerHTML
            emojiContent.replaceChildren();
            activeCategory = null;
            return;
        }
        
        // 设置新的激活分类
        activeCategory = categoryName;
        
        // 性能优化：检查缓存
        if (window.categoryCache.has(categoryName)) {
            const cachedContent = window.categoryCache.get(categoryName);
            // 性能优化1：克隆缓存内容并使用replaceChildren
            const clonedContent = cachedContent.cloneNode(true);
            emojiContent.replaceChildren(...clonedContent.childNodes);
        } else {
            // 首次渲染该分类（优化4：虚拟滚动准备）
            const emojisToShow = category.emojis;
            const fragment = document.createDocumentFragment();
            
            // 优化4：对于大量emoji，分批渲染
            const BATCH_SIZE = 100;
            const totalEmojis = emojisToShow.length;
            
            // 首批立即渲染
            const firstBatch = emojisToShow.slice(0, BATCH_SIZE);
            firstBatch.forEach(emoji => {
                fragment.appendChild(createEmojiElement(emoji));
            });
            
            // 性能优化1：使用replaceChildren
            emojiContent.replaceChildren(fragment);
            
            // 剩余的分批异步渲染（优化4：虚拟滚动）
            if (totalEmojis > BATCH_SIZE) {
                let currentIndex = BATCH_SIZE;
                
                const renderNextBatch = () => {
                    if (activeCategory !== categoryName) return; // 用户已切换分类，停止渲染
                    
                    const nextBatch = emojisToShow.slice(currentIndex, currentIndex + BATCH_SIZE);
                    const batchFragment = document.createDocumentFragment();
                    
                    nextBatch.forEach(emoji => {
                        batchFragment.appendChild(createEmojiElement(emoji));
                    });
                    
                    emojiContent.appendChild(batchFragment);
                    currentIndex += BATCH_SIZE;
                    
                    if (currentIndex < totalEmojis) {
                        requestAnimationFrame(renderNextBatch);
                    } else {
                        // 全部渲染完成后缓存
                        window.categoryCache.set(categoryName, emojiContent.cloneNode(true));
                    }
                };
                
                requestAnimationFrame(renderNextBatch);
            } else {
                // 小量emoji直接缓存（修复bug：需要在添加到DOM后缓存）
                window.categoryCache.set(categoryName, emojiContent.cloneNode(true));
            }
        }
        
        emojiContent.classList.add('active');
        
        // 性能优化：使用requestAnimationFrame延迟滚动
        requestAnimationFrame(() => {
            emojiContent.scrollIntoView({ behavior: CONFIG.UI.SCROLL_BEHAVIOR, block: 'nearest' });
        });
    }
    
    /**
     * 创建单个emoji元素（优化4：提取为独立函数）
     */
    function createEmojiElement(emoji) {
        const emojiItem = document.createElement('div');
        emojiItem.className = 'emoji-item';
        emojiItem.dataset.emoji = emoji;
        
        const emojiChar = document.createElement('span');
        emojiChar.className = 'emoji-char';
        emojiChar.textContent = emoji;
        emojiItem.appendChild(emojiChar);
        
        if (flagNames[emoji]) {
            const label = document.createElement('span');
            label.className = 'emoji-label';
            label.textContent = flagNames[emoji];
            emojiItem.appendChild(label);
        }
        
        if (emojiVariants[emoji] && emojiVariants[emoji].length > 1) {
            const badge = document.createElement('div');
            badge.className = 'emoji-variant-badge';
            emojiItem.appendChild(badge);
        }
        
        emojiItem.title = '点击复制 | 右键查看变体';
        return emojiItem;
    }

    /**
     * 复制表情到剪贴板
     */
    async function copyEmoji(emoji, element) {
        try {
            await navigator.clipboard.writeText(emoji);
            showToast(`已复制: ${emoji}`);
            
            element.classList.add('copied');
            setTimeout(() => {
                element.classList.remove('copied');
            }, CONFIG.ANIMATION.COPY_PULSE_DURATION);
        } catch (err) {
            // 降级方案
            const textarea = document.createElement('textarea');
            textarea.value = emoji;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast(`已复制: ${emoji}`);
            
            element.classList.add('copied');
            setTimeout(() => {
                element.classList.remove('copied');
            }, CONFIG.ANIMATION.COPY_PULSE_DURATION);
        }
    }

    /**
     * 显示提示消息
     */
    function showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, CONFIG.ANIMATION.TOAST_SHOW_DURATION);
    }

    /**
     * 更新统计信息（优化2：使用预计算值）
     */
    function updateStats() {
        document.getElementById('totalCount').textContent = TOTAL_EMOJIS;
    }

    /**
     * 显示变体弹出菜单（优化版：带缓存）
     */
    function showVariantPopup(emoji, targetElement) {
        const variants = emojiVariants[emoji];
        
        if (!variants || variants.length <= 1) {
            return;
        }
        
        const popup = document.getElementById('variantPopup');
        
        // 性能优化：检查缓存
        if (window.variantCache.has(emoji)) {
            const cachedVariants = window.variantCache.get(emoji);
            // 性能优化1：克隆缓存内容并使用replaceChildren
            const clonedVariants = cachedVariants.cloneNode(true);
            popup.replaceChildren(...clonedVariants.childNodes);
        } else {
            // 首次显示该变体
            const fragment = document.createDocumentFragment();
            
            variants.forEach(variant => {
                const variantItem = document.createElement('div');
                variantItem.className = 'variant-item';
                variantItem.textContent = variant;
                variantItem.title = '点击复制';
                
                variantItem.onclick = (e) => {
                    e.stopPropagation();
                    copyEmoji(variant, variantItem);
                    hideVariantPopup();
                };
                
                fragment.appendChild(variantItem);
            });
            
            // 性能优化1：使用replaceChildren
            popup.replaceChildren(fragment);
            // 修复bug：在添加到DOM后缓存实际内容
            window.variantCache.set(emoji, popup.cloneNode(true));
        }
        
        // 位置计算
        const rect = targetElement.getBoundingClientRect();
        popup.classList.add('show');
        
        const popupRect = popup.getBoundingClientRect();
        let left = rect.left + (rect.width / 2) - (popupRect.width / 2);
        let top = rect.top - popupRect.height - CONFIG.UI.POPUP_OFFSET;
        
        const windowWidth = window.innerWidth;
        
        if (left < CONFIG.UI.POPUP_OFFSET) {
            left = CONFIG.UI.POPUP_OFFSET;
        } else if (left + popupRect.width > windowWidth - CONFIG.UI.POPUP_OFFSET) {
            left = windowWidth - popupRect.width - CONFIG.UI.POPUP_OFFSET;
        }
        
        if (top < CONFIG.UI.POPUP_OFFSET) {
            top = rect.bottom + CONFIG.UI.POPUP_OFFSET;
        }
        
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
    }
    
    /**
     * 隐藏变体弹出菜单
     */
    function hideVariantPopup() {
        const popup = document.getElementById('variantPopup');
        popup.classList.remove('show');
    }
    
    /**
     * 初始化页面
     */
    function initPage() {
        renderEmojis();
        updateStats();
        
        // 点击页面其他地方关闭弹出框
        document.addEventListener('click', (e) => {
            const popup = document.getElementById('variantPopup');
            const isClickInPopup = popup && popup.contains(e.target);
            const isClickOnEmoji = e.target.closest('.emoji-item');
            
            if (!isClickInPopup && !isClickOnEmoji) {
                hideVariantPopup();
            }
        });
        
        // 按ESC键关闭弹出框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideVariantPopup();
            }
        });
        
        // 可选：监听内存压力事件
        if ('onmemorywarning' in window) {
            window.addEventListener('memorywarning', clearCache);
        }
    }

    // 页面加载完成后初始化
    document.addEventListener('DOMContentLoaded', initPage);

})();


