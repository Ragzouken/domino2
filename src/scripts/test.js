/** @type {Set<DominoDataCard>} */
const selected = new Set();
/** @type {DominoDataGroup[]} */
let selectedGroups = [];
/** @type {DominoDataCard} */
let linking;
/** @type {CardEditor} */
let cardEditor;
/** @type {DominoBoardView} */
let boardView;

async function test() {
    boardView = new DominoBoardView();
    cardEditor = new CardEditor();

    listen(scene.viewport, "dblclick", (event) => {
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

        insertCard(scene, card);
    });

    setActionHandler("global/home", centerOrigin);
    
    setActionHandler("project/save", () => saveProject(boardView.projectData, "save"))

    setActionHandler("selection/edit", editSelected);
    setActionHandler("selection/group", groupSelection);
    setActionHandler("selection/link", beginLink);
    setActionHandler("selection/cancel", deselectCards);
    setActionHandler("selection/center", centerSelection);
    setActionHandler("selection/delete", () => {
        Array.from(selected).forEach((card) => deleteCard(card));
    });

    setActionHandler("group/recolor", recolorGroup);
    setActionHandler("group/delete", deleteGroup);
    setActionHandler("group/select", selectGroupCards);

    setActionHandler("card-editor/close", closeEditor);
    
    // image pasting
    window.addEventListener("paste", (event) => cardEditor.paste(event));
}

/** @param {DominoDataGroup} group */
function getGroupCards(group) {
    const cards = new Set(group.cards);
    return boardView.projectData.cards.filter((card) => cards.has(card.id));
}

function updateToolbar() {
    const selection = selected.size > 0;
    const selectedGroup = selectedGroups.length > 0;
    elementByPath("global", "div").hidden = selection || selectedGroup;
    elementByPath("selection", "div").hidden = !selection;
    elementByPath("group", "div").hidden = !selectedGroup;

    elementByPath("selection/link", "div").hidden = true;//selected.size > 1;
    //elementByPath("selection/group", "div").hidden = selected.size === 1;

    // selections
    const active = selectedGroups.length > 0 ? new Set(getGroupCards(selectedGroups[0])) : selected;
    boardView.cardToView.forEach((view, card) => view.setSelected(active.has(card)));
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
}

function deleteCard(card) {
    arrayDiscard(boardView.projectData.cards, card);

    boardView.projectData.groups.forEach((group) => arrayDiscard(group.cards, card));
    refreshSVGs();

    deselectCard(card);
    boardView.cardToView.get(card).rootElement.remove();
    boardView.cardToView.delete(card);
}

function deselectAll() {
    deselectCards();
    deselectGroup();
    updateToolbar();
}

function deselectCards() {
    selected.forEach((card) => boardView.cardToView.get(card).setSelected(false));
    selected.clear();

    updateToolbar();
}

function deselectGroup() {
    selectedGroups.forEach((group) => boardView.groupToView.get(group).setHighlight(false));
    selectedGroups.length = 0;
    updateToolbar();
}

function selectGroupCards() {
    const group = selectedGroups[0];
    group.cards.forEach(selectCard);
}

function deleteGroup() {
    const group = selectedGroups.shift();
    arrayDiscard(boardView.projectData.groups, group);
    boardView.groupToView.get(group).dispose();
    deselectGroup();
}

function recolorGroup() {
    const group = selectedGroups[0];
    group.color = `rgb(${randomInt(0, 255)} ${randomInt(0, 255)} ${randomInt(0, 255)})`;
    boardView.groupToView.get(group).regenerateSVG();
}

function closeEditor() {
    cardEditor.close();
}

function editSelected() {
    if (selected.size !== 1) return;
    const card = Array.from(selected)[0];

    centerSelection();
    cardEditor.open(card);
}

function selectCard(card) {
    selected.add(card);
    boardView.cardToView.get(card).setSelected(true);

    deselectGroup();
    updateToolbar();
}

function deselectCard(card) {
    selected.delete(card);
    boardView.cardToView.get(card).setSelected(false);

    updateToolbar();
}

function beginLink() {
    if (selected.size !== 1) return;
    linking = Array.from(selected)[0];
    updateToolbar();
}

function selectCardToggle(card) {
    if (linking) {
        const link = { id: nanoid(), cardA: linking.id, cardB: card.id };
        boardView.projectData.links.push(link);
        linking = undefined;
        refreshSVGs();
        console.log("LINK");
    } else if (selectedGroups.length > 0) {
        const group = selectedGroups[0];
        if (group.cards.indexOf(card) >= 0) arrayDiscard(group.cards, card);
        else group.cards.push(card);
        refreshSVGs();
        updateToolbar();
    } else {
        if (selected.has(card)) deselectCard(card);
        else selectCard(card);
    }
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
    const combined = new Set([...groups, ...selectedGroups]);
    const same = combined.size === selectedGroups.length && combined.size === groups.length;

    if (same) {
        cycleGroup();
    } else {
        const prev = selectedGroups[0];

        deselectCards();
        deselectGroup();
        selectedGroups.push(...groups);
        boardView.groupToView.get(selectedGroups[0]).setHighlight(true);
        updateToolbar();
        
        if (prev === selectedGroups[0]) cycleGroup();
    }
}

function centerOrigin() {
    scene.locked = true;
    animateElementTransform(scene.container, .2).then(() => scene.locked = false);
    const rect = new DOMRect(-cellWidth*2, -cellHeight*2, cellWidth*4, cellHeight*4)
    padRect(rect, 64);
    scene.frameRect(rect);
}

function centerSelection() {
    scene.locked = true;
    animateElementTransform(scene.container, .2).then(() => scene.locked = false);
    const rect = boundCards(Array.from(selected));
    padRect(rect, 64);
    scene.frameRect(rect, .25, 1);
}

function groupSelection() {
    const cards = Array.from(selected).map((card) => card.id);
    const color = `rgb(${randomInt(0, 255)} ${randomInt(0, 255)} ${randomInt(0, 255)})`;
    const group = { cards, color };
    boardView.projectData.groups.push(group);
    refreshSVGs();
    selectGroups([group]);
}

/** @type {Map<SVGElement, DominoDataGroup>} */
const svgToGroup = new Map();

function dragGroups(event) {
    const overlapping = document.elementsFromPoint(event.clientX, event.clientY);
    const svgs = overlapping.map((overlap) => overlap.closest("svg")).filter((svg) => svg !== null);
    const groups = new Set(svgs.map((svg) => svgToGroup.get(svg)));

    boardView.projectData.groups.forEach((group) => {
        getGroupCards(group).forEach((card) => {
            boardView.cardToView.get(card).startDrag(event);
        });
    });
    selectGroups(Array.from(groups));
}

function refreshSVGs() {
    boardView.projectData.groups.forEach((group) => {
        const view = boardView.groupToView.get(group) || new DominoGroupView(group);
        boardView.groupToView.set(group, view);
        view.regenerateSVG();
    });

    boardView.projectData.links.forEach((link) => {
        const view = boardView.linkToView.get(link) || new DominoLinkView(link);
        boardView.linkToView.set(link, view);
        view.regenerateSVG();
    });
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

class DominoLinkView {
    /** @param {DominoDataLink} link */
    constructor(link) {
        this.link = link;
        this.root = svg("svg", { class: "link" });
        this.selected = false;

        const background = document.getElementById("svgs");
        background.appendChild(this.root);
    }

    dispose() {
        this.root.remove();
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
        const main = svg("line", { ...line, stroke: "magenta" });
        
        //padRect(rect, 8);           
        //this.selectElement = svg("line", {...rect, rx: 24, fill: "gray", "class": "selection-flash" });
        
        //this.root.appendChild(this.selectElement);
        this.root.appendChild(main);

        {
            const { x, y, width, height } = this.root.getBBox();
            this.root.setAttributeNS(null, "width", width.toString());
            this.root.setAttributeNS(null, "height", height.toString());
            this.root.setAttributeNS(null, "viewBox", `${x} ${y} ${width} ${height}`);
            this.root.setAttributeNS(null, "transform", translationMatrix({ x, y }).toString());
        }

        //this.setHighlight(this.selected);
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
        });
        
        this.scene.container.appendChild(this.rootElement);

        listen(resize.children[0], "pointerdown", (event) => {
            killEvent(event);
            this.startResize(event);
        });

        listen(this.rootElement, "pointerdown", (event) => {
            killEvent(event);

            let drags;

            if (selected.has(this.card)) {
                drags = Array.from(selected).map((card) => boardView.cardToView.get(card).startDrag(event));
            } else {
                //if (!event.shiftKey) deselectCards();
                drags = [this.startDrag(event)];
            }

            drags[0].on("click", (event) => {
                selectCardToggle(this.card);
            })
        });

        listen(this.rootElement, "dblclick", (event) => {
            killEvent(event);
            deselectCards();
            selectCard(this.card);
            editSelected();
        });
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

        this.card.icons.forEach((data, i) => {
            const element = this.iconElements[i];
            element.innerHTML = data.icon;
            element.href = data.action;
            element.classList.toggle('blank', data.icon === '');
            element.classList.toggle('cosmetic', data.action === '');
        });

        if (this.card.style) {
            this.bodyElement.setAttribute("style", this.card.style);
        } else {
            this.bodyElement.removeAttribute("style");
        }

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
            refreshSVGs();
        });
        gesture.on("pointerup", (event) => {
            const bounds = boundCard(this.card);
            this.rootElement.style.width = `${bounds.width}px`;
            this.rootElement.style.height = `${bounds.height}px`;

            // snap card to grid
            animateElementSize(this.rootElement, .1).then(() => target.remove());
            target.remove();

            refreshSVGs();
        });
    }

    /** @param {PointerEvent} event */
    startDrag(event) {
        // determine and save the relationship between mouse and element
        // G = M1^ . E (element relative to mouse)
        const mouse = this.scene.mouseEventToSceneTransform(event);
        const grab = mouse.invertSelf().multiplySelf(translationMatrix(this.card.position));

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
            refreshSVGs();
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
            refreshSVGs();
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
            const scale = Math.max(tw / image.width, th / image.height);
            const [fw, fh] = [image.width * scale, image.height * scale];
            const [ox, oy] = [(tw - fw)/2, (th - fh)/2];

            const context = canvas.getContext('2d');
            context.drawImage(image, ox, oy, fw, fh);
            const url = canvas.toDataURL('image/jpeg', quality);

            console.log(`${url.length}B`);
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
