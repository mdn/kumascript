/**
 * New Relic agent configuration.
 *
 * See lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */

// Load from nconf to keep conf values in a single place
var ks_conf = require(__dirname + '/lib/kumascript/conf');

var newrelic_conf = ks_conf.nconf.get('newrelic');

exports.config = newrelic_conf;
