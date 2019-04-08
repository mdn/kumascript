/**
 * Command line KumaScript server runner.
 *
 * This file just configures logging and sets up ^C handlers.
 * See src/ for the interesting code.
 *
 * @prettier
 */
/* eslint-disable no-console */

// Start New Relic logging if it is configured
if (process.env.NEW_RELIC_LICENSE_KEY && process.env.NEW_RELIC_APP_NAME) {
    console.log('Starting New Relic logging for KumaScript.');
    require('newrelic');
}

// Start up a server instance.
const config = require('./src/config.js');
const Server = require('./src/server.js');
console.log(`KumaScript server starting (PID ${process.pid}).`);
var server = new Server();
server.listen(config.port);
console.log(`KumaScript server listening on port ${config.port}`);

// More gracefully handle some common exit conditions...

function exit() {
    console.log(`KumaScript server (PID ${process.pid}) exiting.`);
    server.close();
    process.exit(0);
}

process.on('SIGINT', function() {
    console.log('Received SIGINT, exiting...');
    exit();
});
process.on('SIGTERM', function() {
    console.log('Received SIGTERM, exiting...');
    exit();
});
process.on('uncaughtException', function(err) {
    console.error('uncaughtException:', err.message);
    console.error(err.stack);
    exit();
});
