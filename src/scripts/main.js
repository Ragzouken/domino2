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

    /** @type {DominoDataProject} */
    const data = JSON.parse(dataElement.innerHTML);

    await test();
    data.details.id = nanoid();
    dataManager.reset(data);
    if (data.details.focus) centerCards(getCardsByIds(data.details.focus.slice(1).split(",")));

    console.log("player", player);
    if (player) {
        // data
        boardView.editable = false;
    } else {
        // data
    }
}

async function loadData() {
    console.log("data");
}

async function loadDataDeferred() {
    console.log("deferred");

    const css = html("style", { id: "active-font" });
    css.textContent = document.getElementById("font").textContent;
    css.setAttribute("data-editor-only", undefined);
    document.head.appendChild(css);
}
