/**
 * @prettier
 */
const util = require('./util');

module.exports = {
    /**
     * Expose url from node.js to templates
     */
    url: require('url'),
    htmlEscape: util.htmlEscape,
};
