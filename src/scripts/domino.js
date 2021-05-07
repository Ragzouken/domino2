/**
 * @typedef {Object} DominoDataCardStyle
 * @property {string} id
 * @property {string} name
 * @property {Partial<{
 *   "custom-css": string,
 *   "text-font": string,
 *   "text-color": string,
 *   "text-size": string,
 *   "text-center": string,
 *   "card-color": string,
 *   "icon-hide-empty": string,
 * }>} properties
 */

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
 * @property {string?} cardStyle
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
 * @property {DominoDataCardStyle[]} cardStyles
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
    links: [],
    cardStyles: [],
}
