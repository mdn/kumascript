var util = require('util');

// See also: <https://github.com/darwin/firelogger/wiki>
module.exports = function (options) {

    options = options || {};
    var levels = options.levels ||
        ['debug', 'info', 'warning', 'error', 'critical'];

    return function (req, res, mw_next) {
        var messages = [],
            orig_writeHead = res.writeHead;

        res.log = function (data) {
            var now = new Date();
            data = data || {};
            data.time = now.toTimeString();
            data.timestamp = now.getTime() * 1000;
            messages.push(data);
        };

        levels.forEach(function (level) {
            res.log[level] = function (msg, data) {
                data = data || {};
                data.level = level;
                data.message = msg;
                res.log(data);
            };
        });

        res.writeHead = function (status, headers) {

            // Wrap up the common exit point
            function wh_next() {
                res.writeHead = orig_writeHead;
                res.writeHead(status, headers);
            }

            // Patch the Vary: header to include X-FireLogger, to indicate that
            // the response changes based on its value.
            var curr_vary = (''+res.header('Vary')),
                fl_vary = 'X-FireLogger';
            if (curr_vary.indexOf(fl_vary) === -1) {
                res.header('Vary', (curr_vary) ? (curr_vary + ',' + fl_vary) :
                                                 fl_vary);
            }

            // Do nothing if there's no X-FireLogger header
            var fl_ver = req.header('X-FireLogger');
            if (!fl_ver) { return wh_next(); }

            // Do nothing, if there are no messages
            if (!messages.length) { return wh_next(); }

            var uid = parseInt(Math.random() * 1000000, 16);
            var d_lines = [];
            if ('plaintext' == fl_ver) {
                // Non-standard `X-FireLogger: plaintext` header skips the
                // base64 part and sticks each JSON-encoded log message into a
                // header. Good for debugging by curl
                d_lines = messages.map(JSON.stringify);
            } else {
                // `X-FireLogger: 1.2` is what's expected from the add-on, but
                // accept anything else.
                var d_logs = { logs: messages },
                    d_json = JSON.stringify(d_logs),
                    d_b64 = (new Buffer(d_json, 'utf-8')).toString('base64');
                d_lines = d_b64.match(/(.{1,75})/g);
            }

            for (var i=0; i<d_lines.length; i++) {
                res.header('FireLogger-' + uid + '-' + i, d_lines[i]);
            }

            wh_next();
        };

        mw_next();
    };

};
