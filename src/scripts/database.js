/** 
 * @template T
 * @param {IDBRequest<T>} request 
 * @returns {Promise<T>}
 */
function promisfyRequest(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/** 
 * @param {IDBTransaction} transaction 
 * @returns {Promise}
 */
 function promisfyTransaction(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
    });
}

async function openDatabase() {
    const request = indexedDB.open("domino2");
    request.addEventListener("upgradeneeded", () => {
        request.result.createObjectStore("projects");
        request.result.createObjectStore("projects-meta");
    });
    return promisfyRequest(request);
}

async function projectsStores(mode) {
    const db = await openDatabase();
    const transaction = db.transaction(["projects", "projects-meta"], mode);
    const projects = transaction.objectStore("projects");
    const meta = transaction.objectStore("projects-meta");
    return { transaction, projects, meta };
}

/**
 * @returns {Promise<DominoDataSaveMetadata[]>}
 */
async function listProjects() {
    const stores = await projectsStores("readonly");
    return promisfyRequest(stores.meta.getAll());
}

/**
 * @param {DominoDataProject} projectData 
 * @returns {Promise}
 */
async function saveProject(projectData, key) {
    /** @type {DominoDataSaveMetadata} */
    const meta = {
        id: projectData.details.id,
        title: projectData.details.title,
        date: (new Date()).toISOString(),
    }

    const stores = await projectsStores("readwrite");
    stores.projects.put(projectData, key);
    stores.meta.put(meta, key);
    return promisfyTransaction(stores.transaction);
}

/**
 * @param {string} key
 * @returns {Promise<DominoDataProject>}
 */
async function loadProject(key) {
    const stores = await projectsStores("readonly");
    return promisfyRequest(stores.projects.get(key));
}

/**
 * @param {string} key
 */
 async function deleteProject(key) {
    const stores = await projectsStores("readwrite");
    stores.projects.delete(key);
    stores.meta.delete(key);
    return promisfyTransaction(stores.transaction);
}
