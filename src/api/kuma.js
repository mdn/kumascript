/**
 * @prettier
 */
const url = require('url');
const { htmlEscape } = require('./util.js');

module.exports = {
    /** Expose url from node.js to templates. */
    url,
    htmlEscape,
};
