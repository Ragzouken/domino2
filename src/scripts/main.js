const cellWidth = 256;
const cellHeight = 160;

const cellGap = 16;
const cellWidth2 = 112;
const cellHeight2 = 64;

/** @type {PanningScene} */
let scene;

async function start() {
    initui();
    scene = new PanningScene(document.getElementById("scene"));

    const dataElement = ONE("#project-data");
    const player = ONE("body").getAttribute("data-player") === "true";

    const save = await loadProject("save");
    const data = (player || !save) ? JSON.parse(dataElement.innerHTML) : save;

    await test();
    boardView.loadProject(data);
    refreshSVGs();

    if (player) {
        // data
    } else {
        // data
    }
}

async function loadData() {
    console.log("data");
}

async function loadDataDeferred() {
    console.log("deferred");

    const css = html("style");
    css.textContent = document.getElementById("font").textContent;
    css.setAttribute("data-editor-only", undefined);
    document.head.appendChild(css);
}
