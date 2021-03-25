const cellWidth = 256;
const cellHeight = 160;

const cellGap = 16;
const cellWidth2 = 112;
const cellHeight2 = 64;

/** @type {Map<DominoDataCard, DominoCardView>} */
const cardToView = new Map();
/** @type {Map<DominoCardGroup, DominoGroupView>} */
const groupToView = new Map();

/** @type {DominoDataProject} */
const PROJECT = JSON.parse(JSON.stringify(EMPTY_PROJECT_DATA));

/** @type {Set<DominoDataCard>} */
const selected = new Set();
/** @type {DominoCardGroup[]} */
let selectedGroups = [];
/** @type {PanningScene} */
let scene;

async function test() {
    initui();

    scene = new PanningScene(document.getElementById("scene"));

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
            text: "new card :)"
        }

        insertCard(scene, card);
    });
    
    for (let i = 0; i < 15; ++i) {
        const x = randomInt(-1, 5) * cellWidth;
        const y = randomInt(-1, 5) * cellHeight;
        const card = { 
            id: `card:${i}`,
            position: { x, y }, 
            size: { x: randomInt(2, 3), y: randomInt(2, 3) },
            text: "hello <b>this</b> is a <i>domino</i> test card text bla bla bla bla bla",
        };

        insertCard(scene, card);
    }

    setActionHandler("global/home", centerOrigin);

    setActionHandler("selection/group", groupSelection);
    setActionHandler("selection/cancel", deselectCards);
    setActionHandler("selection/center", centerSelection);
    setActionHandler("selection/delete", () => {
        Array.from(selected).forEach((card) => deleteCard(card));
    });

    setActionHandler("group/recolor", recolorGroup);
    setActionHandler("group/delete", deleteGroup);
    setActionHandler("group/select", selectGroupCards);
}

function updateToolbar() {
    const selection = selected.size > 0;
    const selectedGroup = selectedGroups.length > 0;
    elementByPath("global", "div").hidden = selection || selectedGroup;
    elementByPath("selection", "div").hidden = !selection;
    elementByPath("group", "div").hidden = !selectedGroup;
}

function insertCard(scene, card) {
    PROJECT.cards.push(card);
    const view = new DominoCardView(scene);
    view.setCard(card);
    cardToView.set(card, view);
}

function deleteCard(card) {
    arrayDiscard(PROJECT.cards, card);

    groups.forEach((group) => arrayDiscard(group.cards, card));
    refreshGroups();

    deselectCard(card);
    cardToView.get(card).rootElement.remove();
    cardToView.delete(card);
}

function deselectAll() {
    deselectCards();
    deselectGroup();
    updateToolbar();
}

function deselectCards() {
    selected.forEach((card) => cardToView.get(card).setSelected(false));
    selected.clear();

    updateToolbar();
}

function deselectGroup() {
    selectedGroups.forEach((group) => groupToView.get(group).setSelected(false));
    selectedGroups.length = 0;
    updateToolbar();
}

function selectGroupCards() {
    const group = selectedGroups[0];
    group.cards.forEach(selectCard);
}

function deleteGroup() {
    const group = selectedGroups.shift();
    arrayDiscard(groups, group);
    groupToView.get(group).dispose();
    deselectGroup();
}

function recolorGroup() {
    const group = selectedGroups[0];
    group.color = `rgb(${randomInt(0, 255)} ${randomInt(0, 255)} ${randomInt(0, 255)})`;
    groupToView.get(group).regenerateSVG();
}

function selectCard(card) {
    selected.add(card);
    cardToView.get(card).setSelected(true);

    deselectGroup();
    updateToolbar();
}

function deselectCard(card) {
    selected.delete(card);
    cardToView.get(card).setSelected(false);

    updateToolbar();
}

function selectCardToggle(card) {
    if (selectedGroups.length > 0) {
        const group = selectedGroups[0];
        if (group.cards.indexOf(card) >= 0) arrayDiscard(group.cards, card);
        else group.cards.push(card);
        refreshGroups();
    } else {
        if (selected.has(card)) deselectCard(card);
        else selectCard(card);
    }
}

function cycleGroup() {
    const current = selectedGroups.shift();
    selectedGroups.push(current);
    groupToView.get(current).setSelected(false);
    groupToView.get(selectedGroups[0]).setSelected(true);
    updateToolbar();
}

/** @param {DominoCardGroup[]} groups */
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
        groupToView.get(selectedGroups[0]).setSelected(true);
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
    const rect = boundRects(Array.from(selected).map((card) => new DOMRect(card.position.x, card.position.y, cellWidth, cellHeight)));
    padRect(rect, 64);
    scene.frameRect(rect);
}

/** 
 * @typedef {Object} DominoCardGroup
 * @property {DominoDataCard[]} cards
 * @property {string} color
 */

/** @type {DominoCardGroup[]} */
const groups = [];

function groupSelection() {
    const cards = Array.from(selected);
    const color = `rgb(${randomInt(0, 255)} ${randomInt(0, 255)} ${randomInt(0, 255)})`;
    const group = { cards, color };
    groups.push(group);
    refreshGroups();
    selectGroups([group]);
}

/** @type {Map<SVGElement, DominoCardGroup} */
const svgToGroup = new Map();

function dragGroups(event) {
    const overlapping = document.elementsFromPoint(event.clientX, event.clientY);
    const svgs = overlapping.map((overlap) => overlap.closest("svg")).filter((svg) => svg !== null);
    const groups = new Set(svgs.map((svg) => svgToGroup.get(svg)));

    groups.forEach((group) => {
        group.cards.forEach((card) => {
            cardToView.get(card).startDrag(event);
        });
    });
    selectGroups(Array.from(groups));
}

function refreshGroups() {
    groups.forEach((group) => {
        const view = groupToView.get(group) || new DominoGroupView(group);
        groupToView.set(group, view);
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

/** @param {DominoDataCard[]} cards */
function boundCards(cards) {
    return boundRects(cards.map(boundCard));
}

function gridSize(cells, cellWidth, cellGap) {
    return cellWidth + (cells - 1) * (cellWidth + cellGap);
}

class DominoGroupView {
    /**
     * @param {DominoCardGroup} group 
     */
    constructor(group) {
        this.group = group;
        this.root = svg("svg", { class: "group" });
        this.selected = false;

        const background = document.getElementById("groups");
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

    setSelected(value) {
        this.selected = value;

        if (this.selectElement) {
            this.selectElement.style.display = value ? "unset" : "none";
        }
    }

    regenerateSVG() {
        while (this.root.children.length > 0) this.root.children[0].remove();

        const { x, y, width, height } = boundCards(this.group.cards);
        const rect = { x, y, width, height };
        rect.width -= 16;
        rect.height -= 16;

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

        this.setSelected(this.selected);
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
        const body = html("div", { class: "card-body" }, this.textElement, resize);
        const icons = html("div", { class: "card-icon-bar" }, html("a", {}, "🥰"), html("a"), html("a"), html("a"));
        this.rootElement = html("div", { class: "card-root" }, body, icons);

        icons.children[0].addEventListener("click", (event) => {
            killEvent(event);
            //deleteCard(this.card);
        });
        
        this.scene.container.appendChild(this.rootElement);

        listen(resize.children[0], "pointerdown", (event) => {
            killEvent(event);
            this.startResize(event);
        });

        listen(this.rootElement, "pointerdown", (event) => {
            killEvent(event);

            if (selected.has(this.card)) {
                selected.forEach((card) => cardToView.get(card).startDrag(event));
            } else {
                //if (!event.shiftKey) deselectCards();
                this.startDrag(event);
            }
        });

        listen(this.rootElement, "dblclick", (event) => {
            killEvent(event);
            /*
            deselectCards();
            selectCard(this.card);
            centerSelection();
            */
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
        this.textElement.innerHTML = this.card.text;

        const bounds = boundCard(this.card);
        this.rootElement.style.width = `${bounds.width}px`;
        this.rootElement.style.height = `${bounds.height}px`;
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
        });
        gesture.on("pointerup", (event) => {
            const bounds = boundCard(this.card);
            this.rootElement.style.width = `${bounds.width}px`;
            this.rootElement.style.height = `${bounds.height}px`;

            // snap card to grid
            animateElementSize(this.rootElement, .1).then(() => target.remove());
            target.remove();
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
            refreshGroups();
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
            refreshGroups();
        });
        drag.on("click", (event) => {
            selectCardToggle(this.card);
        })

        this.setCursor("grabbing");
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

class PanningScene {
    get hidden() { return this.container.hidden; }
    set hidden(value) { this.container.hidden = value; }

    /**
     * @param {HTMLElement} container 
     */
    constructor(container) {
        this.viewport = container.parentElement;
        this.container = container;
        this.transform = new DOMMatrix();
        this.locked = false;

        this.viewport.addEventListener("pointerdown", (event) => {
            if (this.hidden || this.locked) return;
            killEvent(event);

            // determine and save the relationship between mouse and scene
            // G = M1^ . S (scene relative to mouse)
            const mouse = this.mouseEventToViewportTransform(event);
            const grab = mouse.invertSelf().multiplySelf(this.transform);
            document.body.style.setProperty("cursor", "grabbing");
            this.viewport.style.setProperty("cursor", "grabbing");

            const gesture = trackGesture(event);
            gesture.on("pointermove", (event) => {
                // preserve the relationship between mouse and scene
                // D2 = M2 . G (drawing relative to scene)
                const mouse = this.mouseEventToViewportTransform(event);
                this.transform = mouse.multiply(grab);
                this.refresh();
            });
            gesture.on("pointerup", (event) => {
                document.body.style.removeProperty("cursor");
                this.viewport.style.removeProperty("cursor");
            });
            gesture.on("click", (event) => {
                deselectAll();
            })
        });
        
        this.viewport.addEventListener('wheel', (event) => {
            if (this.hidden || this.locked) return;

            event.preventDefault();

            const mouse = this.mouseEventToViewportTransform(event);
            const origin = (this.transform.inverse().multiply(mouse)).transformPoint();

            const [minScale, maxScale] = [.25, 2];
            const prevScale = getMatrixScale(this.transform).x;
            const [minDelta, maxDelta] = [minScale/prevScale, maxScale/prevScale];
            const magnitude = Math.min(Math.abs(event.deltaY), 25);
            const exponent = Math.sign(event.deltaY) * magnitude * -.01;
            const deltaScale = clamp(Math.pow(2, exponent), minDelta, maxDelta);

            // prev * delta <= max -> delta <= max/prev
            this.transform.scaleSelf(
                deltaScale, deltaScale, deltaScale,
                origin.x, origin.y, origin.z,
            );

            this.refresh();
        });

        this.refresh();
    }

    refresh() {
        setElementTransform(this.container, this.transform);
    }

    frameRect(rect) {
        const bounds = this.viewport.getBoundingClientRect();

        // find scale that contains all width, all height, and is within limits
        const sx = bounds.width / rect.width;
        const sy = bounds.height / rect.height;
        const scale = clamp(Math.min(sx, sy), .25, 2);

        // find translation that centers the rect in the viewport
        const ex = (1/scale - 1/sx) * bounds.width * .5;
        const ey = (1/scale - 1/sy) * bounds.height * .5;
        const [ox, oy] = [-rect.x + ex, -rect.y + ey];

        this.transform = new DOMMatrix();
        this.transform.scaleSelf(scale, scale);
        this.transform.translateSelf(ox, oy);
        this.refresh();
    }

    mouseEventToViewportTransform(event) {
        const rect = this.viewport.getBoundingClientRect();
        const [sx, sy] = [event.clientX - rect.x, event.clientY - rect.y];
        const matrix = (new DOMMatrixReadOnly()).translate(sx, sy);
        return matrix;
    }

    mouseEventToSceneTransform(event) {
        const mouse = this.mouseEventToViewportTransform(event);
        mouse.preMultiplySelf(this.transform.inverse());
        return mouse;
    }
}

