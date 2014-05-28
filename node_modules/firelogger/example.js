var express = require('express');
var firelogger = require('firelogger');
var app = express.createServer();

app.configure(function () {
    app.use(firelogger());
});

app.get('/', function (req, res) {
    res.log.debug("Debug message");
    res.log.warning("Warning message");
    res.log.info("Informative message", {
        name: 'logger_name'
    });
    res.log.error("Something went wrong!", {
        name: 'some_module',
        lineno: 1234, 
        pathname: 'module/myfile.js'
    });
    res.log({
        name: 'mylogger',
        level: 'critical', 
        message: 'This is the long form'
    });
    res.send("Hello, world.\n");
});

app.listen(9001);
