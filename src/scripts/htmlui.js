/**
 * @param {string} path 
 * @returns {[string, string]}
 */
function pathToRootLeaf(path) {
    const parts = path.split('/');
    const root = parts.slice(0, -1).join('/');
    const leaf = parts.slice(-1)[0];
    return [root, leaf];
}

const toggleStates = new Map();
const actionHandlers = new Map();
const pathToElement = new Map();

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {*} path 
 * @param {K} tagName
 * @returns {HTMLElementTagNameMap[K]}
 */
function elementByPath(path, tagName) {
    /** @type {HTMLElementTagNameMap[K]} */
    const element = pathToElement.get(path);
    if (element === undefined)
        throw Error(`No element at ${path}`);
    if (element.tagName.toLowerCase() !== tagName)
        throw Error(`Element at ${path} is ${element.tagName} not ${tagName}`);
    return element;
}

function setActionHandler(action, callback) {
    actionHandlers.set(action, callback);
}

function invokeAction(action) {
    const handler = actionHandlers.get(action);
    if (handler) handler();
}

function switchTab(path) {
    elementByPath(`toggle:${path}`, "button").click();
}

function initui() {
    const toggles = ALL("[data-tab-toggle]");
    const bodies = ALL("[data-tab-body]");
    const buttons = ALL("[data-action]");

    const paths = ALL("[data-path]");
    paths.forEach((element) => {
        const path = element.getAttribute("data-path");
        pathToElement.set(path, element);
    });

    buttons.forEach((element) => {
        const action = element.getAttribute("data-action");

        element.addEventListener("click", (event) => {
            killEvent(event);
            invokeAction(action);
        });
    })

    function setGroupActiveTab(group, tab) {
        toggleStates.set(group, tab);
        toggles.forEach((element) => {
            const [group_, tab_] = pathToRootLeaf(element.getAttribute("data-tab-toggle"));
            if (group_ === group) element.classList.toggle("active", tab_ === tab);
        });
        bodies.forEach((element) => {
            const [group_, tab_] = pathToRootLeaf(element.getAttribute("data-tab-body"));
            if (group_ === group) element.hidden = (tab_ !== tab);
        });

        invokeAction(`hide:${group}`);
        invokeAction(`show:${group}/${tab}`);
    }

    toggles.forEach((element) => {
        const path = element.getAttribute("data-tab-toggle");
        pathToElement.set("toggle:" + path, element);
        const [group, tab] = pathToRootLeaf(element.getAttribute("data-tab-toggle"));
        element.addEventListener('click', (event) => {
            killEvent(event);
            setGroupActiveTab(group, tab);
        });
    });

    bodies.forEach((element) => {
        element.hidden = true;
    });

    ALL("[data-tab-default]").forEach((element) => element.click());
}
