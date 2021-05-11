function saveAs(blob, name) {
    const element = document.createElement("a");
    const url = window.URL.createObjectURL(blob);
    element.href = url;
    element.download = name;
    element.click();
    window.URL.revokeObjectURL(url);
};

/** @param {DominoDataProject} projectData */
function createStandalonePlayer(projectData) {
    const clone = /** @type {HTMLElement} */ (document.documentElement.cloneNode(true));
    ALL("[data-empty]", clone).forEach((element) => element.replaceChildren());
    ALL("[data-editor-only]", clone).forEach((element) => element.remove());
    ONE("body", clone).setAttribute("data-player", "true");
    ONE("title", clone).innerHTML = projectData.details.name;
    ONE("#project-data", clone).innerHTML = JSON.stringify(projectData);
    ONE('[data-path="global-editor"]', clone).hidden = true;
    return clone;
}

const projectToHTML = () => {
    const clone = createStandalonePlayer(boardView.projectData);
    return clone.outerHTML;
}

setActionHandler("project/export/html", async () => {
    const name = boardView.projectData.details.name + ".html";
    const blob = textToBlob(projectToHTML(), "text/html");
    saveAs(blob, name);
});

setActionHandler("project/import", async () => {
    const [file] = await pickFiles("text/html");
    const text = await textFromFile(file);
    const html = await htmlFromText(text);

    const json = ONE("#project-data", html).innerHTML;
    const projectData = JSON.parse(json);
    boardView.loadProject(projectData);
});

setActionHandler("project/publish/neocities", async () => {
    const ready = new Promise((resolve, reject) => {
        const remove = listen(window, "message", (event) => {
            if (event.origin !== "https://kool.tools") return;
            remove();
            resolve();
        });
    });

    const success = new Promise((resolve, reject) => {
        const remove = listen(window, "message", (event) => {
            if (event.origin !== "https://kool.tools") return;

            if (event.data.error) {
                remove();
                reject(event.data.error);
            } else if (event.data.url) {
                remove();
                resolve(event.data.url);
            }
        });
    });

    const name = boardView.projectData.details.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const popup = window.open(
        "https://kool.tools/neocities-publisher/index.html", 
        "neocities publisher",
        "left=10,top=10,width=320,height=320");
    const html = projectToHTML();
    await ready;
    popup.postMessage({ name, html }, "https://kool.tools");
    const url = await success;
    popup.close();
    //openButton.disabled = false;
    //openButton.onclick = () => window.open(url);
});
