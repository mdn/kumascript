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

            function wh_next() {
                res.writeHead = orig_writeHead;
                res.writeHead(status, headers);
            }

            var fl_ver = req.header('X-FireLogger');
            if (!fl_ver) { return wh_next(); }

            var d_logs = { logs: messages },
                d_json = JSON.stringify(d_logs),
                d_b64 = (new Buffer(d_json, 'utf-8')).toString('base64'),
                d_lines = d_b64.match(/(.{1,75})/g),
                uid = parseInt(Math.random() * 1000000, 16);

            for (var i=0; i<d_lines.length; i++) {
                res.header('FireLogger-' + uid + '-' + i, d_lines[i]);
            }

            wh_next();
        };

        mw_next();
    };

};
