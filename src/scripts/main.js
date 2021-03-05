async function start() {
    console.log("start");

    test();
}

async function loadData() {
    console.log("data");
}

async function loadDataDeferred() {
    console.log("deferred");

    const css = html("style");
    css.textContent = document.getElementById("font").textContent;
    document.head.appendChild(css);
}
