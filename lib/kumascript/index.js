/**
 * ## KumaScript index package
 *
 * This loads up and exports references to the rest of the main modules of the
 * package.
 */

/* jshint node: true, expr: false, boss: true */

// ### Re-export these statically to support bundlers and intelli-sense
module.exports = {
    server:     require('./server.js'),
    caching:    require('./caching.js'),
    conf:       require('./conf.js'),
    loaders:    require('./loaders.js'),
    templates:  require('./templates.js'),
    macros:     require('./macros.js'),
    api:        require('./api.js'),
    errors:     require('./errors.js'),
    repl:       require('./repl.js'),
    utils:      require('./utils.js'),
    test_utils: require('./test-utils.js'),
};
