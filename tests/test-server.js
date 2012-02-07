/*jshint node: true, expr: false, boss: true */

var util = require('util'),
    fs = require('fs'),
    _ = require('underscore'),
    nodeunit = require('nodeunit'),
    express = require('express'),
    request = require('request'),

    kumascript = require('..'),
    ks_utils = kumascript.utils,
    ks_server = kumascript.server,
    ks_test_utils = kumascript.test_utils;

module.exports = nodeunit.testCase({

    // Build both a service instance and a document server for test fixtures.
    setUp: function (next) {
        this.server = new ks_server.Server({
            port: 9000,
            document_url_template: "http://localhost:9001/documents/{path}?raw=1",
            template_url_template: "http://localhost:9001/templates/{path}?raw=1"
        });
        this.server.listen();

        this.test_server = ks_test_utils.createTestServer();

        next();
    },

    // Kill all the servers on teardown.
    tearDown: function (next) {
        this.server.close();
        this.test_server.close();
        next();
    },

    "PLAY": function (test) {

        request('http://localhost:9001/macros1.txt', function (err, resp, body) {
            test.done();
        });

        /*
        request('http://localhost:9000/docs/document1.txt', function (err, resp, body) {
            util.debug("ERR " + err);
            test.done();
        });
        */

    }

});
