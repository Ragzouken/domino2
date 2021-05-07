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
