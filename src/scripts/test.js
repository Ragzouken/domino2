/** @type {Set<DominoDataCard>} */
const selectedCards = new Set();
/** @type {DominoDataGroup[]} */
const selectedGroups = [];
/** @type {DominoDataLink[]} */
const selectedLinks = [];
/** @type {DominoDataCard} */
let linking;
/** @type {LinkEditor} */
let linkEditor;
/** @type {GroupEditor} */
let groupEditor;
/** @type {CardEditor} */
let cardEditor;
/** @type {DominoBoardView} */
let boardView;
/** @type {DominoProjectManager} */
let dataManager;

/** @type {CardStyleEditor} */
let cardStyleEditor;

async function test() {
    dataManager = new DominoProjectManager();
    boardView = new DominoBoardView();
    cardEditor = new CardEditor();
    linkEditor = new LinkEditor();
    groupEditor = new GroupEditor();
    cardStyleEditor = new CardStyleEditor();

    listen(scene.viewport, "dblclick", (event) => {
        if (!boardView.editable) return;

        killEvent(event);    
        const transform = scene.mouseEventToSceneTransform(event);
        transform.e -= cellWidth/2;
        transform.f -= cellHeight/2;
        gridSnap(transform);
        const position = getMatrixTranslation(transform);

        const card = {
            id: nanoid(),
            position,
            size: { x: 2, y: 2 },
            text: "new card :)",
            icons: [],
        }

        dataManager.makeCheckpoint();
        insertCard(scene, card);
        deselectAll();
        selectCard(card);
        invokeAction("global-editor/open");
        switchTab("sidebar/selection");
    });

    setActionHandler("global/undo", () => dataManager.undo());
    setActionHandler("global/redo", () => dataManager.redo());

    setActionHandler("project/reset", () => dataManager.reset(JSON.parse(ONE("#project-data").innerHTML)));

    setActionHandler("selection/copy-id", () => {
        const ids = Array.from(selectedCards).map((card) => card.id);
        navigator.clipboard.writeText('#' + ids.join(","));
    });
    setActionHandler("selection/group", groupSelection);
    setActionHandler("selection/link", beginLink);
    setActionHandler("selection/cancel", deselectCards);
    setActionHandler("selection/center", centerSelection);
    setActionHandler("selection/delete", () => {
        dataManager.makeCheckpoint();
        Array.from(selectedCards).forEach((card) => deleteCard(card));
    });

    setActionHandler("group/delete", deleteSelectedGroup);
    setActionHandler("group/select", selectGroupCards);

    setActionHandler("link/delete", deleteSelectedLink);
    setActionHandler("link/select", selectLinkCards);

    setActionHandler("card-editor/close", closeEditor);

    setActionHandler("picker/cancel", () => {
        linking = undefined;
        updateToolbar();
    });
    
    // image pasting
    window.addEventListener("paste", (event) => cardEditor.paste(event));

    // hotkeys
    document.addEventListener("keydown", (event) => {
        const targetTag = event.target.tagName.toLowerCase();
        const textedit = targetTag === "input" || targetTag === "textarea";

        if (event.ctrlKey && event.key === "s") {
            invokeAction("project/save");
        } else if (!textedit && event.key === "Escape") {
            deselectAll();
        } else if (!textedit && event.key === "Delete") {
            if (selectedCards.size > 0) invokeAction("selection/delete");
            if (selectedGroups.length > 0) invokeAction("group/delete");
            if (selectedLinks.length > 0) invokeAction("link/delete");
        } else if (!textedit && event.ctrlKey && event.key == "z") {
            dataManager.undo();
        } else if (!textedit && event.ctrlKey && event.key == "y") {
            dataManager.redo();
        } else {
            return;
        }

        killEvent(event);
    });
}

/** @param {DominoDataGroup} group */
function getGroupCards(group) {
    const cards = new Set(group.cards);
    return boardView.projectData.cards.filter((card) => cards.has(card.id));
}

/** @param {string[]} ids */
function getCardsByIds(ids) {
    const cards = new Set(ids);
    return boardView.projectData.cards.filter((card) => cards.has(card.id));
}

function updateToolbar() {
    const selection = selectedCards.size > 0;
    const selectedGroup = selectedGroups.length > 0;
    const selectedLink = selectedLinks.length > 0;

    elementByPath("picker", "div").hidden = !linking;

    if (selection) switchTab("sidebar/selection/cards");
    else if (selectedGroup) switchTab("sidebar/selection/group");
    else if (selectedLink) switchTab("sidebar/selection/link");
    else switchTab("sidebar/selection/none");

    // selections
    const active = selectedGroups.length > 0 ? new Set(getGroupCards(selectedGroups[0])) : selectedCards;
    boardView.cardToView.forEach((view, card) => view.setSelected(active.has(card)));

    ONE("#undo").classList.toggle("disabled", !dataManager.canUndo);
    ONE("#redo").classList.toggle("disabled", !dataManager.canRedo);
}

/** 
 * @param {PanningScene} scene
 * @param {DominoDataCard} card
 */
function insertCard(scene, card) {
    boardView.projectData.cards.push(card);
    const view = new DominoCardView(scene);
    view.setCard(card);
    boardView.cardToView.set(card, view);
    return view;
}

/** @param {DominoDataCard} card */
function deleteCard(card) {
    arrayDiscard(boardView.projectData.cards, card);

    boardView.projectData.groups.forEach((group) => {
        if (arrayDiscard(group.cards, card.id)) refreshGroup(group);
        if (group.cards.length === 0) deleteGroup(group);
    });
    boardView.projectData.links.forEach((link) => {
        if (link.cardA === card.id || link.cardB === card.id) {
            deleteLink(link);
        }
    });

    deselectCard(card);
    boardView.cardToView.get(card).rootElement.remove();
    boardView.cardToView.delete(card);
}

function deselectAll() {
    deselectCards();
    deselectGroup();
    deselectLink();
    updateToolbar();
}

function deselectCards() {
    selectedCards.forEach((card) => boardView.cardToView.get(card).setSelected(false));
    selectedCards.clear();

    updateToolbar();
    cardEditor.close();
}

function deselectGroup() {
    selectedGroups.forEach((group) => boardView.groupToView.get(group).setHighlight(false));
    selectedGroups.length = 0;
    updateToolbar();
    groupEditor.close();
}

function selectGroupCards() {
    getCardsByIds(selectedGroups[0].cards).forEach(selectCard);
}

function deleteSelectedGroup() {
    deleteGroup(selectedGroups.shift());
    deselectGroup();
}

function deleteGroup(group) {
    arrayDiscard(boardView.projectData.groups, group);
    boardView.groupToView.get(group).dispose();
    boardView.groupToView.delete(group);
}

function deselectLink() {
    selectedLinks.forEach((link) => boardView.linkToView.get(link).setHighlight(false));
    selectedLinks.length = 0;
    updateToolbar();
    linkEditor.close();
}

function selectLinkCards() {
    const cards = [selectedLinks[0].cardA, selectedLinks[0].cardB];
    getCardsByIds(cards).forEach(selectCard);
}

function deleteSelectedLink() {
    dataManager.makeCheckpoint();
    deleteLink(selectedLinks.shift());
    deselectLink();
}

function deleteLink(link) {
    arrayDiscard(boardView.projectData.links, link);
    boardView.linkToView.get(link).dispose();
    boardView.linkToView.delete(link);
}

function closeEditor() {
    cardEditor.close();
}

function selectCard(card) {
    if (selectedCards.size === 0) {
        switchTab("sidebar/selection");
    }

    selectedCards.add(card);
    boardView.cardToView.get(card).setSelected(true);

    deselectGroup();
    deselectLink();
    updateToolbar();

    cardEditor.openMany(Array.from(selectedCards));
}

function deselectCard(card) {
    selectedCards.delete(card);
    boardView.cardToView.get(card).setSelected(false);

    updateToolbar();
    cardEditor.openMany(Array.from(selectedCards));
}

function beginLink() {
    if (selectedCards.size !== 1) return;
    linking = Array.from(selectedCards)[0];
    updateToolbar();
}

/** @param {DominoDataCard} card */
function selectCardToggle(card) {
    if (linking) {
        const link = { cardA: linking.id, cardB: card.id, color: 'black' };
        dataManager.makeCheckpoint();
        boardView.projectData.links.push(link);
        linking = undefined;
        refreshLink(link);
        selectLinks([link]);
    } else if (selectedGroups.length > 0) {
        const group = selectedGroups[0];
        if (!arrayDiscard(group.cards, card.id)) group.cards.push(card.id);
        refreshGroup(group);
        updateToolbar();
    } else {
        if (selectedCards.has(card)) deselectCard(card);
        else selectCard(card);
    }
}

function deselectAll() {
    deselectCards();
    deselectGroup();
    deselectLink();
}

function cycleGroup() {
    const current = selectedGroups.shift();
    selectedGroups.push(current);
    boardView.groupToView.get(current).setHighlight(false);
    boardView.groupToView.get(selectedGroups[0]).setHighlight(true);
    updateToolbar();
}

/** @param {DominoDataGroup[]} groups */
function selectGroups(groups) {
    if (selectedGroups.length === 0) switchTab("sidebar/selection");

    const combined = new Set([...groups, ...selectedGroups]);
    const same = combined.size === selectedGroups.length && combined.size === groups.length;

    if (same) {
        cycleGroup();
    } else {
        const prev = selectedGroups[0];

        deselectAll();
        selectedGroups.push(...groups);
        boardView.groupToView.get(selectedGroups[0]).setHighlight(true);
        updateToolbar();
        
        if (prev === selectedGroups[0]) cycleGroup();
    }

    groupEditor.openGroups([selectedGroups[0]]);
}

function cycleLink() {
    const current = selectedLinks.shift();
    selectedLinks.push(current);
    boardView.linkToView.get(current).setHighlight(false);
    boardView.linkToView.get(selectedLinks[0]).setHighlight(true);
    updateToolbar();
}

/** @param {DominoDataLink[]} links */
function selectLinks(links) {
    if (selectedLinks.length === 0) switchTab("sidebar/selection");

    const combined = new Set([...links, ...selectedLinks]);
    const same = combined.size === selectedLinks.length && combined.size === links.length;

    if (same) {
        cycleLink();
    } else {
        const prev = selectedLinks[0];

        deselectAll();
        selectedLinks.push(...links);
        boardView.linkToView.get(selectedLinks[0]).setHighlight(true);
        updateToolbar();
        
        if (prev === selectedLinks[0]) cycleLink();
    }

    linkEditor.openLinks([selectedLinks[0]]);
}

function centerSelection() {
    centerCards(Array.from(selectedCards));
}

function centerCards(cards) {
    scene.locked = true;
    animateElementTransform(scene.container, .2).then(() => scene.locked = false);
    const rect = boundCards(cards);
    padRect(rect, 64);
    scene.frameRect(rect, .25, 1);

    if (cards.length === 1) window.location.replace("#" + cards[0].id);
}

function groupSelection() {
    dataManager.makeCheckpoint();
    const cards = Array.from(selectedCards).map((card) => card.id);
    const color = `rgb(${randomInt(0, 255)} ${randomInt(0, 255)} ${randomInt(0, 255)})`;
    const group = { cards, color };
    boardView.projectData.groups.push(group);
    refreshGroup(group);
    selectGroups([group]);
}

/** @type {Map<SVGElement, DominoDataGroup>} */
const svgToGroup = new Map();
/** @type {Map<SVGElement, DominoDataLink>} */
const svgToLink = new Map();

function dragGroups(event) {
    dataManager.makeCheckpoint();
    const overlapping = document.elementsFromPoint(event.clientX, event.clientY);
    const svgs = overlapping.map((overlap) => overlap.closest("svg")).filter((svg) => svg !== null);
    const groups = new Set(svgs.map((svg) => svgToGroup.get(svg)).filter((group) => group !== undefined));

    groups.forEach((group) => {
        getCardsByIds(group.cards).forEach((card) => {
            boardView.cardToView.get(card).startDrag(event);
        });
    });
    selectGroups(Array.from(groups));
}

function dragLinks(event) {
    dataManager.makeCheckpoint();
    const overlapping = document.elementsFromPoint(event.clientX, event.clientY);
    const svgs = overlapping.map((overlap) => overlap.closest("svg")).filter((svg) => svg !== null);
    const links = new Set(svgs.map((svg) => svgToLink.get(svg)).filter((link) => link !== undefined));

    links.forEach((link) => {
        getCardsByIds([link.cardA, link.cardB]).forEach((card) => {
            boardView.cardToView.get(card).startDrag(event);
        });
    });
    selectLinks(Array.from(links));
}

function onCardMoved(card) {
    boardView.projectData.groups.forEach((group) => {
        const view = boardView.groupToView.get(group) || new DominoGroupView(group);
        boardView.groupToView.set(group, view);
        if (group.cards.includes(card.id)) view.regenerateSVG();
    });

    boardView.projectData.links.forEach((link) => {
        const view = boardView.linkToView.get(link) || new DominoLinkView(link);
        boardView.linkToView.set(link, view);
        if (link.cardA === card.id || link.cardB === card.id) view.regenerateSVG();
    });
} 

function refreshGroup(group) {
    const view = boardView.groupToView.get(group) || new DominoGroupView(group);
    boardView.groupToView.set(group, view);
    view.regenerateSVG();
}

function refreshLink(link) {
    const view = boardView.linkToView.get(link) || new DominoLinkView(link);
    boardView.linkToView.set(link, view);
    view.regenerateSVG();
}

function refreshSVGs() {
    boardView.projectData.groups.forEach(refreshGroup);
    boardView.projectData.links.forEach(refreshLink);
}

const cardStyleVariables = ["card-color", "text-font", "text-size", "text-color"];
/** @param {DominoDataCardStyle} style */
function cardStyleToCss(style) {
    const declarations = [];
    cardStyleVariables.forEach((name) => {
        const value = style.properties[name];
        if (value) declarations.push(`--${name}: ${value};`);
    })

    if (style.properties["text-center"]) declarations.push("--text-align: center;");

    const rules = [
        `.style-${style.id} { ${declarations.join(" ")} }`,
    ];

    if (style.properties["icon-hide-empty"]) {
        rules.push(`.style-${style.id} .blank { display: none; }`);
    }

    // custom css prefix
    if (style.properties["custom-css"]) {
        const doc = document.implementation.createHTMLDocument("");
        const styleElement = document.createElement("style");
        styleElement.textContent = style.properties["custom-css"];
        doc.body.appendChild(styleElement);

        Array.from(styleElement.sheet.cssRules).forEach((rule) => {
            if (rule instanceof CSSStyleRule) {
                const selectors = rule.selectorText.split(",");
                const prefixed = selectors.map((selector) => {
                    if (selector.startsWith(".card-root")) {
                        return `.style-${style.id}${selector}`;
                    } else {
                        return `.style-${style.id} ${selector}`;
                    }
                }).join(",");
                rule.selectorText = prefixed;
                rules.push(rule.cssText);
            }
        });
    }

    return rules.join("\n");
}

function refreshCardStyles() {
    const element = document.getElementById("card-styles");
    const styles = boardView.projectData.cardStyles.map(cardStyleToCss);
    element.innerHTML = styles.join("\n");
    cardStyleEditor.pullData();
}

function refreshBoardStyle() {
    const style = boardView.projectData.boardStyle;
    const bgcolor = style["background-color"];

    if (bgcolor) {
        ONE("#frame").style.setProperty("background-color", bgcolor);
    }
}

/** @param {DominoDataCard} card */
function boundCard(card) {
    return new DOMRect(
        card.position.x, 
        card.position.y, 
        gridSize(card.size.x, cellWidth2, cellGap), 
        gridSize(card.size.y, cellHeight2, cellGap),
    );
}

/** @param {DominoDataCard} card */
function cardCenter(card) {
    return getRectCenter(boundCard(card));
}

/** @param {DominoDataCard[]} cards */
function boundCards(cards) {
    return boundRects(cards.map(boundCard));
}

function gridSize(cells, cellWidth, cellGap) {
    return cellWidth + (cells - 1) * (cellWidth + cellGap);
}

function getCardFromId(cardId) {
    return boardView.projectData.cards.find((card) => card.id === cardId);
}

function runCardAction(action) {
    if (action.startsWith('#')) {
        const ids = action.slice(1).split(",");
        const cards = getCardsByIds(ids);
        
        if (cards.length > 0) {
            window.location.replace('#' + ids.join(","));
            centerCards(cards);
        }
    } else if (action.startsWith('open:')) {
        window.open(action.slice(5));
    } else if (action.length > 0) {
        window.open(action);
    }
}

class DominoLinkView {
    /** @param {DominoDataLink} link */
    constructor(link) {
        this.link = link;
        this.root = svg("svg", { class: "link" });
        this.selected = false;

        const background = document.getElementById("svgs");
        background.appendChild(this.root);

        svgToLink.set(this.root, this.link);
        this.root.addEventListener("pointerdown", (event) => {
            if (!boardView.editable || event.button !== 0) return;
            killEvent(event);
            dragLinks(event);
        });
    }

    dispose() {
        this.root.remove();
    }

    setHighlight(value) {
        this.selected = value;

        if (this.selectElement) {
            this.selectElement.style.display = value ? "unset" : "none";
        }
    }

    regenerateSVG() {
        while (this.root.children.length > 0) this.root.children[0].remove();
        const [cardA, cardB] = [getCardFromId(this.link.cardA), getCardFromId(this.link.cardB)];
        
        const { x, y, width, height } = boundCards([cardA, cardB]);
        const rect = { x, y, width, height };

        const { x: x1, y: y1 } = cardCenter(cardA);
        const { x: x2, y: y2 } = cardCenter(cardB);
        const line = { x1, y1, x2, y2 };

        padRect(rect, 8);
        const main = svg("line", { ...line, stroke: this.link.color });
        
        //padRect(rect, 8);           
        this.selectElement = svg("line", {...line, "class": "selection-flash" });
        
        this.root.appendChild(this.selectElement);
        this.root.appendChild(main);

        {
            const rect = this.root.getBBox();
            padRect(rect, 16);
            const { x, y, width, height } = rect;
            this.root.setAttributeNS(null, "width", width.toString());
            this.root.setAttributeNS(null, "height", height.toString());
            this.root.setAttributeNS(null, "viewBox", `${x} ${y} ${width} ${height}`);
            this.root.setAttributeNS(null, "transform", translationMatrix({ x, y }).toString());
        }

        this.setHighlight(this.selected);
    }
}

class DominoGroupView {
    /**
     * @param {DominoDataGroup} group 
     */
    constructor(group) {
        this.group = group;
        this.root = svg("svg", { class: "group" });
        this.selected = false;

        const background = document.getElementById("svgs");
        background.appendChild(this.root);
        svgToGroup.set(this.root, this.group);
        this.root.addEventListener("pointerdown", (event) => {
            if (!boardView.editable || event.button !== 0) return;
            killEvent(event);
            dragGroups(event);
        });
    }

    dispose() {
        this.root.remove();
    }

    setHighlight(value) {
        this.selected = value;

        if (this.selectElement) {
            this.selectElement.style.display = value ? "unset" : "none";
        }
    }

    regenerateSVG() {
        while (this.root.children.length > 0) this.root.children[0].remove();

        const { x, y, width, height } = boundCards(getGroupCards(this.group));
        const rect = { x, y, width, height };

        padRect(rect, 8);
        const backing = svg("rect", { ...rect, rx: 16, fill: this.group.color });
        
        padRect(rect, 8);           
        this.selectElement = svg("rect", {...rect, rx: 24, fill: "gray", "class": "selection-flash" });
        
        this.root.appendChild(this.selectElement);
        this.root.appendChild(backing);

        {
            const { x, y, width, height } = this.root.getBBox();
            this.root.setAttributeNS(null, "width", width.toString());
            this.root.setAttributeNS(null, "height", height.toString());
            this.root.setAttributeNS(null, "viewBox", `${x} ${y} ${width} ${height}`);
            this.root.setAttributeNS(null, "transform", translationMatrix({ x, y }).toString());
        }

        this.setHighlight(this.selected);
    }
}

/** 
 * @param {DominoDataCard} card 
 */
function duplicateCard(card) {
    const copy = COPY(card);
    copy.id = nanoid();
    insertCard(scene, copy);
    return copy;
}

class DominoCardView {
    /**
     * @param {PanningScene} scene 
     */
    constructor(scene) {
        this.scene = scene;
        this.textElement = html("div", { class: "card-text" });
        const resize = svg("svg", { class: "resize-handle" }, svg("polygon", { points: "0,32 32,32 32,0" }));
        this.bodyElement = html("div", { class: "card-body" }, this.textElement, resize);
        this.iconElements = [0, 1, 2, 3].map((i) => html("a"));
        const iconbar = html("div", { class: "card-icon-bar" }, ...this.iconElements);
        this.rootElement = html("div", { class: "card-root" }, this.bodyElement, iconbar);

        this.iconElements.forEach((icon, index) => {
            icon.addEventListener("click", (event) => this.onIconClicked(event, index));
            icon.addEventListener('pointerdown', e => e.stopPropagation());
            icon.addEventListener('dblclick', e => e.stopPropagation());
        });
        
        ONE("#cards").appendChild(this.rootElement);

        listen(resize.children[0], "pointerdown", (event) => {
            if (!boardView.editable || event.button !== 0) return;
            killEvent(event);
            this.startResize(event);
        });

        listen(this.rootElement, "pointerdown", (event) => {
            if (!boardView.editable || event.button !== 0) return;
            killEvent(event);

            const duplicate = event.ctrlKey === true;
            const selected = selectedCards.has(this.card);
            const targets = selected ? Array.from(selectedCards) : [this.card];
            const drags = [];

            if (duplicate) {
                dataManager.makeCheckpoint();
                const copies = targets.map(duplicateCard);
                if (selected) {
                    deselectAll();
                    copies.forEach(selectCard);
                }
                drags.push(...copies.map((card) => boardView.cardToView.get(card).startDrag(event)));
                drags[0].on("click", (event) => copies.map(deleteCard));
            } else {
                dataManager.markDirty(`selected/position`);
                drags.push(...targets.map((card) => boardView.cardToView.get(card).startDrag(event)));
            }

            drags[0].on("click", (event) => selectCardToggle(this.card));
        });

        listen(this.rootElement, "dblclick", (event) => {
            killEvent(event);

            if (!boardView.editable) {
                centerCards([this.card]);
            } else {
                deselectCards();
                selectCard(this.card);
    
                invokeAction("global-editor/open");
                switchTab("sidebar/selection");
            }
        });
    }

    dispose() {
        this.rootElement.remove();
    }

    /**
     * @param {DominoDataCard} card 
     */
    setCard(card) {
        this.card = card;
        this.regenerate();
    }

    /** @param {string} value */
    setCursor(value) {
        this.rootElement.style.cursor = value;
    }

    /** @param {DOMMatrix} transform */
    setTransform(transform) {
        this.card.position = getMatrixTranslation(transform);
        setElementTransform(this.rootElement, transform);
    }

    /** @param {boolean} selected */
    setSelected(selected) {
        this.rootElement.classList.toggle("selected", selected);
    }

    regenerate() {
        if (!this.card) return;
        setElementTransform(this.rootElement, translationMatrix(this.card.position));
        this.textElement.innerHTML = parseFakedown(this.card.text);

        const bounds = boundCard(this.card);
        this.rootElement.style.width = `${bounds.width}px`;
        this.rootElement.style.height = `${bounds.height}px`;
        this.rootElement.setAttribute("class", "card-root " + "style-" + this.card.style ?? "");
        this.setSelected(selectedCards.has(this.card));

        this.card.icons.forEach((data, i) => {
            const element = this.iconElements[i];
            element.innerHTML = data.icon;
            
            if (data.action === "") {
                element.removeAttribute("href");
            } else {
                element.href = data.action;
            }

            element.classList.toggle('blank', data.icon === '');
            element.classList.toggle('cosmetic', data.action === '');
        });

        if (this.card.image) {
            this.bodyElement.style.setProperty('background-image', `url(${this.card.image})`);
        }

        this.bodyElement.classList.toggle('has-image', !!this.card.image);
    }

    /** 
     * @param {MouseEvent} event
     * @param {number} index
     */
    onIconClicked(event, index) {
        killEvent(event);
        runCardAction(this.card.icons[index].action);
    }

    /** @param {PointerEvent} event */
    startResize(event) {
        function fit(value, cellSize, cellGap) {
            let cells;
            for (cells = 1; gridSize(cells, cellSize, cellGap) < value - cellGap; ++cells);
            return cells;
        }

        const { x: x1, y: y1 } = getMatrixTranslation(this.scene.mouseEventToSceneTransform(event));
        const [w1, h1] = [this.rootElement.clientWidth, this.rootElement.clientHeight];

        // create target shadow
        const target = html("div", { class: "target" });
        this.scene.container.appendChild(target);
        setElementTransform(target, translationMatrix(this.card.position));

        const gesture = trackGesture(event);
        gesture.on("pointermove", (event) => {
            const { x: x2, y: y2 } = getMatrixTranslation(this.scene.mouseEventToSceneTransform(event));
            const [dx, dy] = [x2 - x1, y2 - y1];
            const [w2, h2] = [w1 + dx, h1 + dy];

            this.card.size.x = Math.max(2, fit(w2, cellWidth2, cellGap));
            this.card.size.y = Math.max(2, fit(h2, cellHeight2, cellGap));

            this.rootElement.style.width = `${w2}px`;
            this.rootElement.style.height = `${h2}px`;

            const bounds = boundCard(this.card);
            target.style.width = `${bounds.width}px`;
            target.style.height = `${bounds.height}px`;
            onCardMoved(this.card);
        });
        gesture.on("pointerup", (event) => {
            const bounds = boundCard(this.card);
            this.rootElement.style.width = `${bounds.width}px`;
            this.rootElement.style.height = `${bounds.height}px`;

            // snap card to grid
            animateElementSize(this.rootElement, .1).then(() => target.remove());
            target.remove();
            
            onCardMoved(this.card);
        });
        gesture.emit("pointermove", event);
    }

    /** @param {PointerEvent} event */
    startDrag(event) {
        // determine and save the relationship between mouse and element
        // G = M1^ . E (element relative to mouse)
        const mouse = this.scene.mouseEventToSceneTransform(event);
        const grab = mouse.invertSelf().multiplySelf(translationMatrix(this.card.position));

        const initialPosition = this.card.position;

        // create target shadow
        const target = html("div", { class: "target" });
        this.scene.container.appendChild(target);
        setElementTransform(target, translationMatrix(this.card.position));
        const bounds = boundCard(this.card);
        target.style.width = `${bounds.width}px`;
        target.style.height = `${bounds.height}px`;

        const drag = trackGesture(event);
        drag.on("pointermove", (event) => {
            // preserve the relationship between mouse and element
            // D2 = M2 . G (drawing relative to scene)
            const mouse = this.scene.mouseEventToSceneTransform(event);
            const transform = mouse.multiply(grab);

            // card drags free from the grid
            this.setTransform(transform);
            // target shadow snaps to grid as card would
            gridSnap(transform);
            setElementTransform(target, transform);

            // TODO: this has gotta have a bigger system for updating
            // on drag and during snap animation etc
            onCardMoved(this.card);
        });
        drag.on("pointerup", (event) => {
            const mouse = this.scene.mouseEventToSceneTransform(event);
            const transform = mouse.multiply(grab);
            
            // snap card to grid
            animateElementTransform(this.rootElement, .1).then(() => target.remove());
            gridSnap(transform);
            this.setTransform(transform);

            this.setCursor("grab");

            // TODO:
            onCardMoved(this.card);

            if (this.card.position.x === initialPosition.x && this.card.position.y === initialPosition.y) {
                dataManager.cancelDirty(`selected/position`);
            } else {
                dataManager.confirmDirty(`selected/position`);
            }
        });

        this.setCursor("grabbing");

        return drag;
    }
}

/** @param {DOMMatrix} transform */
function snap(transform, gx = 1, gy = gx) {
    transform.e = Math.round(transform.e / gx) * gx;
    transform.f = Math.round(transform.f / gy) * gy;
}

function gridSnap(transform) {
    return snap(transform, cellWidth/2, cellHeight/2);
}

/**
 * @param {HTMLElement} element 
 * @param {DOMMatrixReadOnly} transform 
 */
function setElementTransform(element, transform) {
    element.style.setProperty("transform", transform.toString());
}

/**
 * @param {HTMLElement} element 
 * @param {number} duration 
 */
async function animateElementTransform(element, duration) {
    element.style.transition = `transform ${duration}s ease-in-out`;
    await sleep(duration * 1000);
    element.style.transition = "none";
}

/**
 * @param {HTMLElement} element 
 * @param {number} duration 
 */
 async function animateElementSize(element, duration) {
    element.style.transition = `width ${duration}s ease-in-out, height ${duration}s ease-in-out`;
    await sleep(duration * 1000);
    element.style.transition = "none";
}

/** 
 * @param {PointerEvent} event 
 */
function trackGesture(event) {
    const emitter = new EventEmitter();
    const pointer = event.pointerId;

    const clickMovementLimit = 5;
    let totalMovement = 0;

    const removes = [
        listen(document, "pointerup", (event) => {
            if (event.pointerId !== pointer) return;

            removes.forEach((remove) => remove());
            emitter.emit("pointerup", event);
            if (totalMovement <= clickMovementLimit) emitter.emit("click", event);
        }),
        listen(document, "pointermove", (event) => {
            if (event.pointerId !== pointer) return;

            totalMovement += Math.abs(event.movementX);
            totalMovement += Math.abs(event.movementY);
            emitter.emit("pointermove", event);
        }),
    ];

    return emitter;
}

class PointerDrag {
    /** 
     * @param {PointerEvent} event
     */
    constructor(event, { clickMovementLimit = 5 } = {}) {
        this.events = new EventEmitter();
        this.pointerId = event.pointerId;
        this.clickMovementLimit = 5;
        this.totalMovement = 0;

        this.downEvent = event;
        this.lastEvent = event; 

        this.removes = [
            listen(document, "pointerup", (event) => {
                if (event.pointerId !== this.pointerId) return;
    
                this.lastEvent = event;
                this.removes.forEach((remove) => remove());
                this.events.emit("pointerup", event);
                if (this.totalMovement <= clickMovementLimit) {
                    this.events.emit("click", event);
                }
            }),
            listen(document, "pointermove", (event) => {
                if (event.pointerId !== this.pointerId) return;
    
                this.totalMovement += Math.abs(event.movementX);
                this.totalMovement += Math.abs(event.movementY);
                this.lastEvent = event;
                this.events.emit("pointermove", event);
            }),
        ];
    }

    cancel() {
        this.removes.forEach((remove) => remove());
    }
}

const imageSize = [512, 512];

async function fileToCompressedImageURL(file) {
    const url = await dataURLFromFile(file);
    const dataURL = await compressImageURL(url, 0.2, imageSize);
    return dataURL;
}

async function dataTransferToImage(dt) {
    const files = filesFromDataTransfer(dt);
    const element = elementFromDataTransfer(dt);
    if (files.length > 0) {
        return await fileToCompressedImageURL(files[0]);
    } else if (element && element.nodeName === 'IMG') {
        return await compressImageURL(element.src, .2, imageSize);
    }
}

function filesFromDataTransfer(dataTransfer) {
    const clipboardFiles = 
        Array.from(dataTransfer.items || [])
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile());
    return clipboardFiles.concat(...(dataTransfer.files || []));
}

function elementFromDataTransfer(dataTransfer) {
    const html = dataTransfer.getData('text/html');
    return html && stringToElement(html);
}

async function compressImageURL(url, quality, size) {
    const image = document.createElement("img");
    image.crossOrigin = "true";
    const canvas = document.createElement("canvas");

    const [tw, th] = size;
    canvas.width = tw;
    canvas.height = th;

    return new Promise((resolve, reject) => {
        image.onload = () => {
            const scale = Math.min(tw / image.width, th / image.height);
            const [fw, fh] = [image.width * scale, image.height * scale];
            const [ox, oy] = [(tw - fw)/2, (th - fh)/2];

            const context = canvas.getContext('2d');
            context.drawImage(image, ox, oy, fw, fh);
            const url = canvas.toDataURL('image/jpeg', quality);

            resolve(url);
        };
        image.onerror = () => resolve(undefined);
        image.src = url;
    });
}

function stringToDocument(string) {
    const template = document.createElement('template');
    template.innerHTML = string;
    return template.content;
}

function stringToElement(string) {
    return stringToDocument(string).children[0];
}

class DominoProjectManager {
    get data() {
        return this.history[this.index];
    }

    get canUndo() {
        return this.index > 0 || this.dirty;
    }

    get canRedo() {
        return this.index < this.history.length - 1 && !this.dirty;
    }

    constructor() {
        /** @type {DominoDataProject[]} */
        this.history = [];
        this.index = -1;
        this.historyLimit = 20;
        this.dirty = undefined;
    }

    /**
     * @param {DominoDataProject} data 
     */
    reset(data) {
        deselectAll();

        this.history.length = 0;
        this.history.push(data);
        this.index = 0;
        boardView.loadProject(this.data);
    }

    markDirty(path="generic") {
        if (path === this.dirty) return;
        this.makeCheckpoint();
        this.dirty = path;
    }

    cancelDirty(path) {
        if (path !== this.dirty) return;
        this.history.splice(this.index, 1);
        this.index -= 1;
        this.dirty = undefined;
        updateToolbar();
    }

    confirmDirty(path) {
        if (path !== this.dirty) return;
        this.dirty = undefined;
        updateToolbar();
    }

    makeCheckpoint() {
        this.dirty = undefined;
        this.history.length = this.index + 1;
        
        this.history[this.index] = COPY(boardView.projectData);
        this.history.push(boardView.projectData);
        
        if (this.index < this.historyLimit) {
            this.index += 1;
        } else {
            // delete earliest history
            this.history.splice(0, 1);
        }
        
        updateToolbar();
    }

    undo() {
        if (!this.canUndo) return;
        this.index -= 1;
        deselectAll();
        boardView.loadProject(this.data);
        this.dirty = undefined;
    }

    redo() {
        if (!this.canRedo) return;
        this.index += 1;
        deselectAll();
        boardView.loadProject(this.data);
        this.dirty = undefined;
    }
}

async function downloadGoogleFont(url) {
    const face = await fetch(url).then((r) => r.text());
    const [, srcURL] = face.match(/url\((http.*woff2)\)/);
    const [, family] = face.match(/font-family: ['"](.*)["'];/);
    const dataURL = await fetch(srcURL).then((r) => r.blob()).then(dataURLFromFile);
    return { family, css: face.replace(srcURL, dataURL) };
}

async function replaceFont(url) {
    const { family, css } = await downloadGoogleFont(url);
    ONE("#active-font").textContent = css;
    document.body.style.fontFamily = family;
}
