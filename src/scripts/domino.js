/**
 * @typedef {Object} DominoDataCard
 * @property {string} id
 * @property {Vector2} position
 * @property {string} text
 */

/**
 * @typedef {Object} DominoDataProjectDetails
 * @property {string} id
 * @property {string} name
 * @property {string} title
 */

/**
 * @typedef {Object} DominoDataProject
 * @property {DominoDataProjectDetails} details
 * @property {DominoDataCard[]} cards
 */

/** @type {DominoDataProject} */
const EMPTY_PROJECT_DATA = {
    details: {
        id: "EMPTY.PROJECT",
        name: "project",
        title: "empty project"
    },
    cards: [],
}
