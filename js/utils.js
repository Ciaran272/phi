/**
 * 工具函数
 * 包含辅助功能函数
 */

/**
 * 防抖函数
 * @param {Function} func - 需要防抖的函数
 * @param {number} wait - 等待时间(ms)
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 清理缓存
 * 释放内存时调用
 */
function clearCache() {
    if (typeof categoryCache !== 'undefined') categoryCache.clear();
    if (typeof variantCache !== 'undefined') variantCache.clear();
}
