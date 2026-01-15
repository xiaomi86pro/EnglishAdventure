/**
 * DOMUtil.js
 * Utility functions cho DOM manipulation
 * Giúp code an toàn hơn khi thao tác với DOM
 */

class DOMUtil {
    /**
     * Lấy element theo ID (safe)
     * @param {string} id 
     * @returns {HTMLElement|null}
     */
    static getById(id) {
        return document.getElementById(id);
    }

    /**
     * Lấy element và log warning nếu không tìm thấy
     * @param {string} id 
     * @param {string} context - Tên function đang gọi (để debug)
     * @returns {HTMLElement|null}
     */
    static getByIdSafe(id, context = '') {
        const el = document.getElementById(id);
        if (!el && context) {
            console.warn(`[DOMUtil] Element #${id} not found in ${context}`);
        }
        return el;
    }

    /**
     * Set innerHTML an toàn
     * @param {string} id 
     * @param {string} html 
     * @returns {boolean} - true nếu thành công
     */
    static setHTML(id, html) {
        const el = this.getById(id);
        if (el) {
            el.innerHTML = html;
            return true;
        }
        return false;
    }

    /**
     * Append HTML vào element
     * @param {string} id 
     * @param {string} html 
     * @returns {boolean}
     */
    static appendHTML(id, html) {
        const el = this.getById(id);
        if (el) {
            el.insertAdjacentHTML('beforeend', html);
            return true;
        }
        return false;
    }

    /**
     * Xóa tất cả children của element
     * @param {string} id 
     * @returns {boolean}
     */
    static clearChildren(id) {
        const el = this.getById(id);
        if (el) {
            el.innerHTML = '';
            return true;
        }
        return false;
    }

    /**
     * Thêm class vào element
     * @param {string} id 
     * @param {string} className 
     */
    static addClass(id, className) {
        const el = this.getById(id);
        if (el) {
            el.classList.add(className);
        }
    }

    /**
     * Xóa class khỏi element
     * @param {string} id 
     * @param {string} className 
     */
    static removeClass(id, className) {
        const el = this.getById(id);
        if (el) {
            el.classList.remove(className);
        }
    }

    /**
     * Toggle class
     * @param {string} id 
     * @param {string} className 
     */
    static toggleClass(id, className) {
        const el = this.getById(id);
        if (el) {
            el.classList.toggle(className);
        }
    }

    /**
     * Set style cho element
     * @param {string} id 
     * @param {string} property 
     * @param {string} value 
     */
    static setStyle(id, property, value) {
        const el = this.getById(id);
        if (el) {
            el.style[property] = value;
        }
    }

    /**
     * Set nhiều styles cùng lúc
     * @param {string} id 
     * @param {Object} styles - { width: '100px', color: 'red' }
     */
    static setStyles(id, styles) {
        const el = this.getById(id);
        if (el) {
            Object.entries(styles).forEach(([prop, value]) => {
                el.style[prop] = value;
            });
        }
    }

    /**
     * Set background image
     * @param {string} id 
     * @param {string} url 
     */
    static setBackgroundImage(id, url) {
        this.setStyle(id, 'backgroundImage', `url('${url}')`);
    }

    /**
     * Tạo element mới
     * @param {string} tag 
     * @param {Object} options - { className, id, innerHTML, styles }
     * @returns {HTMLElement}
     */
    static createElement(tag, options = {}) {
        const el = document.createElement(tag);
        
        if (options.id) el.id = options.id;
        if (options.className) el.className = options.className;
        if (options.innerHTML) el.innerHTML = options.innerHTML;
        if (options.innerText) el.innerText = options.innerText;
        
        if (options.styles) {
            Object.entries(options.styles).forEach(([prop, value]) => {
                el.style[prop] = value;
            });
        }
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([attr, value]) => {
                el.setAttribute(attr, value);
            });
        }
        
        return el;
    }

    /**
     * Append element vào parent
     * @param {string} parentId 
     * @param {HTMLElement} element 
     * @returns {boolean}
     */
    static appendChild(parentId, element) {
        const parent = this.getById(parentId);
        if (parent && element) {
            parent.appendChild(element);
            return true;
        }
        return false;
    }

    /**
     * Remove element khỏi DOM
     * @param {string} id 
     * @returns {boolean}
     */
    static removeElement(id) {
        const el = this.getById(id);
        if (el) {
            el.remove();
            return true;
        }
        return false;
    }

    /**
     * Hiển thị loading spinner trong element
     * @param {string} id 
     * @param {string} message 
     */
    static showLoading(id, message = 'Đang tải...') {
        const html = `
            <div class="flex flex-col items-center justify-center gap-4">
                <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-blue-500 font-bold animate-pulse">${message}</p>
            </div>
        `;
        this.setHTML(id, html);
    }

    /**
     * Trigger animation reset (force reflow)
     * @param {string} id 
     * @param {string} className 
     */
    static restartAnimation(id, className) {
        const el = this.getById(id);
        if (el) {
            el.classList.remove(className);
            void el.offsetWidth; // Force reflow
            el.classList.add(className);
        }
    }

    /**
     * Lấy bounding rect của element
     * @param {string} id 
     * @returns {DOMRect|null}
     */
    static getRect(id) {
        const el = this.getById(id);
        return el ? el.getBoundingClientRect() : null;
    }

    /**
     * Tính tọa độ center của element
     * @param {string} id 
     * @returns {{x: number, y: number}|null}
     */
    static getCenter(id) {
        const rect = this.getRect(id);
        if (rect) {
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        }
        return null;
    }

    /**
     * Tính tọa độ tương đối giữa 2 elements
     * @param {string} childId 
     * @param {string} parentId 
     * @returns {{x: number, y: number}|null}
     */
    static getRelativeCenter(childId, parentId) {
        const childRect = this.getRect(childId);
        const parentRect = this.getRect(parentId);
        
        if (childRect && parentRect) {
            return {
                x: (childRect.left - parentRect.left) + (childRect.width / 2),
                y: (childRect.top - parentRect.top) + (childRect.height / 2)
            };
        }
        return null;
    }
}

// Expose ra window
window.DOMUtil = DOMUtil;

// Export
export default DOMUtil;