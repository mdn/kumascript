/**
 * @prettier
 */
const config = require('../config');
const util = require('./util');

module.exports = {
    /**
     * #### require(name)
     *
     * Load an npm package (the real "require" has its own cache).
     */
    // TODO: Consider supporting macros in sub-directories
    require: util.createRequire(config.macrosDirectory),
};
