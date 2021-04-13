/**
 * @typedef {Object} DominoDataCardIcon
 * @property {string} icon
 * @property {string} action
 */

/**
 * @typedef {Object} DominoDataCard
 * @property {string} id
 * @property {Vector2} position
 * @property {Vector2} size
 * @property {string} text
 * @property {DominoDataCardIcon[]} icons
 */

/**
 * @typedef {Object} DominoDataLink
 * @property {string} id
 * @property {string} cardA
 * @property {string} cardB
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
 * @property {DominoDataLink[]} links
 */

/** @type {DominoDataProject} */
const EMPTY_PROJECT_DATA = {
    details: {
        id: "EMPTY.PROJECT",
        name: "project",
        title: "empty project"
    },
    cards: [],
    links: []
}
