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
    ONE('#sidebar-toggle', clone).hidden = true;
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

setActionHandler("global/import", async () => {
    const [file] = await pickFiles("text/html");
    const text = await textFromFile(file);
    const html = await htmlFromText(text);

    const json = ONE("#project-data", html).innerHTML;
    const projectData = JSON.parse(json);
    projectData.details.id = nanoid();
    dataManager.reset(projectData);
});

setActionHandler("global/new", async () => {
    /** @type {DominoDataProject} */
    const blank = {
        details: {
            id: nanoid(),
            title: "new project",
            name: "project",
            focus: "",
        },
        cards: [],
        groups: [],
        links: [],
        cardStyles: COPY(boardView.projectData.cardStyles),
        boardStyle: COPY(boardView.projectData.boardStyle), 
    }

    dataManager.reset(blank);
});

async function refreshSaves() {
    const saves = await listProjects();
    saves.sort((a, b) => (new Date(b.date)).getTime() - (new Date(a.date)).getTime());

    const options = saves.map(({ title, date, id }) => {
        const date_ = new Date(date).toLocaleDateString();
        const label = `${title} (${date_})`;
        return html("option", { value: id }, label);
    });
    elementByPath("global/saves", "select").replaceChildren(...options);
}

setActionHandler("project/save", async () => {
    await saveProject(boardView.projectData, boardView.projectData.details.id);
    refreshSaves();
});

setActionHandler("global/saves/load", async () => {
    const id = elementByPath("global/saves", "select").value;
    const project = await loadProject(id);
    dataManager.reset(project);
});

setActionHandler("global/saves/duplicate", async () => {
    const id = elementByPath("global/saves", "select").value;
    const project = COPY(await loadProject(id));
    project.details.id = nanoid();
    project.details.title += " (copy)";
    await saveProject(project, project.details.id);
    refreshSaves();
});

setActionHandler("global/saves/delete", async () => {
    const id = elementByPath("global/saves", "select").value;
    await deleteProject(id);
    refreshSaves();
});

setActionHandler("show:sidebar/board", refreshSaves);

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

    const viewButton = ONE("#neocities-view");
    viewButton.disabled = false;
    viewButton.onclick = () => window.open(url);
});

class LinkEditor {
    constructor() {
        this.colorInput = elementByPath("link/color", "input");
        /** @type {DominoDataLink[]} */
        this.links = [];

        this.colorInput.addEventListener("input", () => {
            this.links.forEach((link) => {
                link.color = this.colorInput.value;
                boardView.linkToView.get(link).regenerateSVG();
            });
        });
    }

    /** @param {DominoDataLink[]} links */
    openLinks(links) {
        this.links = links;
        
        if (links.length === 1) this.colorInput.value = links[0].color;
    }

    close() {
        this.links = [];
    }
}

class GroupEditor {
    constructor() {
        this.colorInput = elementByPath("group/color", "input");
        /** @type {DominoDataGroup[]} */
        this.groups = [];

        this.colorInput.addEventListener("input", () => {
            this.groups.forEach((group) => {
                group.color = this.colorInput.value;
                boardView.groupToView.get(group).regenerateSVG();
            });
        });
    }

    /** @param {DominoDataGroup[]} groups */
    openGroups(groups) {
        this.groups = groups;
        
        if (groups.length === 1) this.colorInput.value = groups[0].color;
    }

    close() {
        this.groups = [];
    }
}

