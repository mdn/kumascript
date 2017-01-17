/* jshint node: true */

var util = require('util'),
    net = require('net'),
    repl = require('repl'),
    _ = require('underscore');

function REPL (options, context) {
    this.options = options;
    this.context = context;
    this.server = null;
}

_.extend(REPL.prototype, {

    close: function () {
        this.server.close();
    },

    listen: function listen(host, port) {
        var context = this.context;
        var log = this.context.log;

        // REPL eval handler that logs all commands
        // Cribbed from https://github.com/joyent/node/blob/v0.6/lib/repl.js#L76
        var vm = require('vm');
        var evaluate = function(code, context, file, cb) {
            log.info("Master REPL (cmd): > " + util.inspect(code));
            var err, result;
            try {
                result = vm.runInContext(code, context, file);
            } catch (e) {
                err = e;
            }
            log.info("Master REPL (result): " + util.inspect([err, result]));
            cb(err, result);
        };

        // Finally, set up the server to accept REPL connections.
        this.server = net.createServer(function (socket) {
            var r_host = socket.remoteAddress;
            var r_port = socket.remotePort;
            var shell = repl.start("ks> ", socket, evaluate);
            _(shell.context).extend(context);
            log.info("Master REPL received connection from "+r_host+":"+r_port);
            socket.on('close', function () {
                log.info("Master REPL connection closed for "+r_host+":"+r_port);
            });
        });
        this.server.listen(port, host);
        log.info("Master REPL interface started on " + host + ":" + port);
    }

});

module.exports = {
    REPL: REPL
};
