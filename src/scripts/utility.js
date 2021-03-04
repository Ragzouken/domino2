'use strict'

/**
 * @typedef {Object} Vector2
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} Rect
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @param {string} query 
 * @param {ParentNode} element 
 * @returns {HTMLElement}
 */
const ONE = (query, element = undefined) => (element || document).querySelector(query);
/**
 * @param {string} query 
 * @param {HTMLElement | Document} element 
 * @returns {HTMLElement[]}
 */
const ALL = (query, element = undefined) => Array.from((element || document).querySelectorAll(query));

// async equivalent of Function constructor
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor

/**
 * @param {HTMLElement} element 
 */
function removeAllChildren(element) {
    while (element.children.length) 
        element.removeChild(element.children[0]);   
}

/**
 * @param {MouseEvent | Touch} event 
 * @param {HTMLElement} element 
 */
function eventToElementPixel(event, element) {
    const rect = element.getBoundingClientRect();
    return [event.clientX - rect.x, event.clientY - rect.y];
}

/** @param {Event} event */
function killEvent(event) {
    event.stopPropagation();
    event.preventDefault();
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>} image
 */
async function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = document.createElement("img");
        image.addEventListener("load", () => resolve(image));
        image.src = src;
    });
}

/** @param {HTMLImageElement} image */
function imageToRendering2D(image) {
    const rendering = createRendering2D(image.naturalWidth, image.naturalHeight);
    rendering.drawImage(image, 0, 0);
    return rendering;
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tagName 
 * @param {*} attributes 
 * @param  {...(Node | string)} children 
 * @returns {HTMLElementTagNameMap[K]}
 */
function html(tagName, attributes = {}, ...children) {
    const element = /** @type {HTMLElementTagNameMap[K]} */ (document.createElement(tagName)); 
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    children.forEach((child) => element.append(child));
    return element;
}

// from https://github.com/ai/nanoid/blob/master/non-secure/index.js
const urlAlphabet = 'ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KqYTJkLxpZXIjQW';
function nanoid(size = 21) {
    let id = '';
    let i = size;
    while (i--) id += urlAlphabet[(Math.random() * 64) | 0];
    return id
}

/**
 * @param {File} file 
 * @return {Promise<string>}
 */
async function textFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => resolve(/** @type {string} */ (reader.result));
        reader.readAsText(file); 
    });
}

/**
 * @param {File} file 
 * @return {Promise<string>}
 */
async function dataURLFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => resolve(/** @type {string} */ (reader.result));
        reader.readAsDataURL(file); 
    });
}

/**
 * @param {string} source
 */
async function htmlFromText(source) {
    const template = document.createElement('template');
    template.innerHTML = source;
    return template.content;
}

/**
 * @param {string} text 
 */
function textToBlob(text, type = "text/plain") {
    return new Blob([text], { type });
}

/**
 * @param {string} accept 
 * @param {boolean} multiple 
 * @returns {Promise<File[]>}
 */
async function pickFiles(accept = "*", multiple = false) {
    return new Promise((resolve) => {
        const fileInput = html("input", { type: "file", accept, multiple });
        fileInput.addEventListener("change", () => resolve(Array.from(fileInput.files)));
        fileInput.click();
    });
}

function translationMatrix(translation) {
    const matrix = new DOMMatrix();
    matrix.e = translation.x;
    matrix.f = translation.y;
    return matrix;
}

/** @param {DOMMatrix} matrix */
function getMatrixTranslation(matrix) {
    return { x: matrix.e, y: matrix.f };
}

/** @param {DOMMatrix} matrix */
function getMatrixScale(matrix) {
    return { 
        x: Math.sqrt(matrix.a*matrix.a + matrix.c*matrix.c),
        y: Math.sqrt(matrix.b*matrix.b + matrix.d*matrix.d),
    };
}

/**
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * @param {Rect} rect 
 * @param {number} padding 
 */
function padRect(rect, padding) {
    rect.x -= padding;
    rect.y -= padding;
    rect.width += padding * 2;
    rect.height += padding * 2;
    return rect;
}

/**
 * @param {Rect} rect
 * @param {{ x: number, y: number }} point 
 */
function rectContainsPoint(rect, point) {
    return point.x >= rect.x
        && point.y >= rect.y
        && point.x <  rect.x + rect.width
        && point.y <  rect.y + rect.height;
}

/**
 * @param {Rect[]} rects
 * @param {Rect} fallback
 * @returns {Rect}
 */
function boundRects(rects, fallback = { x: 0, y: 0, width: 0, height: 0 }) {
    const bounds = DOMRect.fromRect(rects[0] || fallback);
    rects.forEach((rect) => {
        const { x, y, width, height } = rect;
        let [top, left, bottom, right] = [y, x, y + height, x + width];
        left = Math.min(bounds.left, left);
        top = Math.min(bounds.top, top);
        right = Math.max(bounds.right, right);
        bottom = Math.max(bounds.bottom, bottom);
        bounds.x = left;
        bounds.y = top;
        bounds.width = right - left;
        bounds.height = bottom - top;
    });
    return bounds;
}

/**
 * @param {any} item 
 * @param {any[]} array 
 */
function removeItemFromArray(item, array) {
    const index = array.indexOf(item);
    array.splice(index, 1);
}

/**
 * 
 * @param {string} original 
 * @param {string} insert 
 * @param {number} start 
 * @param {number} end 
 */
function insertText(original, insert, start, end) {
    const left = original.substring(0, start);
    const right = original.substring(end);
    return `${left}${insert}${right}`;
}

/**
 * @param {number} min 
 * @param {number} max 
 */
function range(min, max) {
    return Array.from(new Array(max-min+1), (x, i) => i + min);
}

/**
 * @param {number} min 
 * @param {number} max 
 */
function randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
}

/** @param {number} milliseconds */
function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

class EventEmitter {
    constructor() {
        this.listeners = {};
    }

    on(event, listener) {
        if (this.listeners[event] === undefined)
            this.listeners[event] = [];
        this.listeners[event].push(listener);
        return () => this.off(event, listener);
    }

    off(event, listener) {
        const listeners = this.listeners[event] || [];
        const index = listeners.indexOf(listener);
        if (index !== -1)
            this.listeners[event].splice(index, 1);
    }

    emit(event, ...args) {
        const listeners = this.listeners[event] || [];
        [...listeners].forEach((listener) => listener(...args));
    }

    once(event, listener) {
        const remove = this.on(event, (...args) => {
            remove();
            listener(...args);
        });
        return remove;
    }

    async wait(event, timeout = undefined) {
        return new Promise((resolve, reject) => {
            if (timeout) setTimeout(reject, timeout);
            this.once(event, resolve);
        });
    }
};

/**
 * @template {keyof WindowEventMap} K
 * @param {Window | Document | HTMLElement} element 
 * @param {K} type 
 * @param {(event: WindowEventMap[K]) => any} listener
 */
function listen(element, type, listener) {
    element.addEventListener(type, listener);
    return () => element.removeEventListener(type, listener);
}
