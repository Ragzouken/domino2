class DominoBoardView {
    constructor() {
        /** @type {Map<DominoDataCard, DominoCardView>} */
        this.cardToView = new Map();
        /** @type {Map<DominoDataGroup, DominoGroupView>} */
        this.groupToView = new Map();
        /** @type {Map<DominoDataLink, DominoLinkView>} */
        this.linkToView = new Map();
    }

    /** @param {DominoDataProject} projectData */
    loadProject(projectData) {
        this.projectData = projectData;

        this.projectData.cards.forEach((card) => {
            const view = new DominoCardView(scene);
            view.setCard(card);
            this.cardToView.set(card, view);
        });
    }
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

    frameRect(rect, minScale=.25, maxScale=2) {
        const bounds = this.viewport.getBoundingClientRect();

        // find scale that contains all width, all height, and is within limits
        const sx = bounds.width / rect.width;
        const sy = bounds.height / rect.height;
        const scale = clamp(Math.min(sx, sy), minScale, maxScale);

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

function fakedownToTag(text, fd, tag) {
    const pattern = new RegExp(`${fd}([^${fd}]+)${fd}`, 'g');
    return text.replace(pattern, `<${tag}>$1</${tag}>`);
}

function parseFakedown(text) {
    if (text.startsWith('`'))
        return `<pre>${text.slice(1)}</pre>`;
    text = text.replace(/([^-])--([^-])/g, '$1—$2');
    text = fakedownToTag(text, '##', 'h3');
    text = fakedownToTag(text, '~~', 's');
    text = fakedownToTag(text, '__', 'strong');
    text = fakedownToTag(text, '\\*\\*', 'strong');
    text = fakedownToTag(text, '_', 'em');
    text = fakedownToTag(text, '\\*', 'em');
    text = text.replace(/\n/g, '<br>');
    return text;
}