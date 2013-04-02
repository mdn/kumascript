// ## KumaScript index package
//
// This loads up and exports references to the rest of the main modules of the
// package.

/*jshint node: true, expr: false, boss: true */

var _ = require('underscore');
    submodules = ['server', 'caching', 'loaders', 'templates', 'macros', 'api',
                  'repl', 'utils', 'test-utils'];

for (var i=0,n; n=submodules[i]; i++) {
    var pn = n.replace('-', '_');
    module.exports[pn] = require(__dirname + '/' + n + '.js');
}
