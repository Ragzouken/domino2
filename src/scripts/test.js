const cellWidth = 256;
const cellHeight = 160;

/** @type {Map<DominoDataCard, DominoCardView>} */
const cardToView = new Map();


async function test() {
    const scene = new PanningScene(document.getElementById("scene"));

    /** @type {DominoDataProject} */
    const PROJECT = JSON.parse(JSON.stringify(EMPTY_PROJECT_DATA));
    
    for (let i = 0; i < 15; ++i) {
        const x = randomInt(-1, 5) * cellWidth;
        const y = randomInt(-1, 5) * cellHeight;
        PROJECT.cards.push({ 
            id: `card:${i}`,
            position: { x, y }, 
            text: "hello <b>this</b> is a <i>domino</i> test card text bla bla bla bla bla",
        });
    }

    PROJECT.cards.forEach((card) => {
        const view = new DominoCardView(scene);
        view.setCard(card);
        cardToView.set(card, view);
    });
}

class DominoCardView {
    /**
     * @param {PanningScene} scene 
     */
    constructor(scene) {
        this.scene = scene;
        this.textElement = html("div", { class: "card-text" });
        this.iconsElement = html("div", { class: "card-icon-bar icon-bar" }, html("a", {}, "🥰"), html("a"), html("a"), html("a"));
        this.rootElement = html("div", { class: "card" }, this.textElement, this.iconsElement);
        
        this.scene.container.appendChild(this.rootElement);

        listen(this.rootElement, "pointerdown", (event) => {
            killEvent(event);
            this.startDrag(event);
        });

        listen(this.rootElement, "dblclick", (event) => centerCard());

        function centerCard() {
            scene.locked = true;
            animateElementTransform(scene.container, .2).then(() => scene.locked = false);
            const rect = new DOMRect(this.card.position.x, this.card.position.y, cellWidth, cellHeight);
            padRect(rect, 64);
            scene.frameRect(rect);
        }
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

    regenerate() {
        if (!this.card) return;
        setElementTransform(this.rootElement, translationMatrix(this.card.position));
        this.textElement.innerHTML = this.card.text;
    }

    startDrag(event) {
        // determine and save the relationship between mouse and element
        // G = M1^ . E (element relative to mouse)
        const mouse = this.scene.mouseEventToSceneTransform(event);
        const grab = mouse.invertSelf().multiplySelf(translationMatrix(this.card.position));

        // create target shadow
        const target = html("div", { class: "target" });
        this.scene.container.appendChild(target);
        setElementTransform(target, translationMatrix(this.card.position));

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
        });
        drag.on("pointerup", (event) => {
            const mouse = this.scene.mouseEventToSceneTransform(event);
            const transform = mouse.multiply(grab);
            
            // snap card to grid
            animateElementTransform(this.rootElement, .1).then(() => target.remove());
            gridSnap(transform);
            this.setTransform(transform);

            this.setCursor("grab");
        });

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

/** @param {PointerEvent} event */
function trackGesture(event) {
    const emitter = new EventEmitter();
    const pointer = event.pointerId;

    const removes = [
        listen(document, "pointerup", (event) => {
            if (event.pointerId === pointer) {
                removes.forEach((remove) => remove());
                emitter.emit("pointerup", event);
            }
        }),
        listen(document, "pointermove", (event) => {
            if (event.pointerId === pointer) emitter.emit("pointermove", event);
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
            const exponent = Math.sign(event.deltaY) * magnitude * -.15;
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

