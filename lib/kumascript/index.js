// ## KumaScript index package
//
// This loads up and exports references to the rest of the main modules of the
// package.

/*jshint node: true, expr: false, boss: true */

var _ = require('underscore');
    submodules = ['server', 'loaders', 'templates', 'macros', 'api', 'utils'];

for (var i=0,n; n=submodules[i]; i++) {
    module.exports[n] = require(__dirname + '/' + n + '.js');
}
