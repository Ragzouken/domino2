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
 * @property {string?} image
 * @property {string?} alttext
 * @property {string?} style
 */

/** 
 * @typedef {Object} DominoDataGroup
 * @property {string[]} cards
 * @property {string} color
 */

/**
 * @typedef {Object} DominoDataLink
 * @property {string} cardA
 * @property {string} cardB
 * @property {string} color
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
 * @property {DominoDataGroup[]} groups
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
    groups: [],
    links: []
}
