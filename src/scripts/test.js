async function test() {
    const scene = new PanningScene(document.getElementById("scene"));

    for (let i = 0; i < 7; ++i) {
        initCard(scene, { position: { x: randomInt(0, 600), y: randomInt(0, 300) } });
    }
}

/** @param {DOMMatrix} transform */
function snap(transform, granularity = 1) {
    transform.e = Math.round(transform.e / granularity) * granularity;
    transform.f = Math.round(transform.f / granularity) * granularity;
}

/**
 * @typedef {Object} DominoCard
 * @property {Vector2} position
 */

/**
 * @param {DominoCard} card
 * @param {HTMLElement} element 
 */
function refreshCardStyle(card, element) {
    element.style.setProperty("transform", translationMatrix(card.position).toString());
}

let grabbing = false;

/**
 * @param {PanningScene} scene 
 * @param {DominoCard} card 
 */
async function initCard(scene, card) {
    const cardElement = html("div", { class: "card" });
    scene.container.appendChild(cardElement);
    
    refreshCardStyle(card, cardElement);

    function refreshCursors(event) {
        const cursor = grabbing ? "grabbing"
                     : false ? "grab"
                     : "pointer";
        cardElement.style.setProperty("cursor", cursor);
    }

    cardElement.addEventListener("dblclick", (event) => {
        killEvent(event);
    })

    function startDrag(event) {
        // determine and save the relationship between mouse and element
        // G = M1^ . E (element relative to mouse)
        const mouse = scene.mouseEventToSceneTransform(event);
        const grab = mouse.invertSelf().multiplySelf(translationMatrix(card.position));

        grabbing = true;

        const drag = trackGesture(event);
        drag.on("pointermove", (event) => {
            // preserve the relationship between mouse and element
            // D2 = M2 . G (drawing relative to scene)
            const mouse = scene.mouseEventToSceneTransform(event);
            const transform = mouse.multiply(grab);
            snap(transform, 64);

            const { x, y } = getMatrixTranslation(transform);
            card.position.x = x;
            card.position.y = y;
            refreshCardStyle(card, cardElement);
        });
        drag.on("pointerup", (event) => grabbing = false);
    }

    cardElement.addEventListener("pointerdown", (event) => {
        killEvent(event);
        startDrag(event);
        refreshCursors(event);
    });
    
    document.addEventListener("pointermove", (event) => {
        if (scene.hidden) return;
        refreshCursors(event);
    });
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

            const [minScale, maxScale] = [.5, 8];
            const prevScale = getMatrixScale(this.transform).x;
            const [minDelta, maxDelta] = [minScale/prevScale, maxScale/prevScale];
            const deltaScale = clamp(Math.pow(2, event.deltaY * -0.01), minDelta, maxDelta);

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
        this.container.style.setProperty("transform", this.transform.toString());
    }

    frameRect(rect) {
        const bounds = this.viewport.getBoundingClientRect();

        // find scale that contains all width, all height, and is within limits
        const sx = bounds.width / rect.width;
        const sy = bounds.height / rect.height;
        const scale = clamp(Math.min(sx, sy), .5, 16);

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

