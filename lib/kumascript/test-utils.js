// ## KumaScript testing utilities
//
// Provides utilities used by many tests.

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    _ = require('underscore'),

    express = require('express'),
    request = require('request'),
    
    ks_utils = require(__dirname + '/utils'),
    ks_loaders = require(__dirname + '/loaders'),
    ks_templates = require(__dirname + '/templates');

// Simple template that just JSONifies the name and arguments for testiing.
var JSONifyTemplate = ks_utils.Class(ks_templates.BaseTemplate, {
    default_options: {
        name: "UNNAMED"
    },
    execute: function (args, ctx, next) {
        next(null, JSON.stringify([this.options.name, args]));
    }
});

// Simple loader subclass that builds JSONifyTemplates.
var JSONifyLoader = ks_utils.Class(ks_loaders.BaseLoader, {
    load: function (name, cb) {
        cb(null, name);
    },
    compile: function (name, cb) {
        cb(null, new JSONifyTemplate({name: name}));
    }
});

// Loader which pulls from a pre-defined object full of named templates.
var LocalLoader = ks_utils.Class(ks_loaders.BaseLoader, {
    default_options: {
        templates: { }
    },
    load: function (name, cb) {
        if (name in this.options.templates) {
            cb(null, this.options.templates[name]);
        } else {
            cb("not found", null);
        }
    },
    compile: function (source, cb) {
        cb(null, source);
    }
});

// Creates an HTTP server for fixtures
function createTestServer (port) {
    var app = express.createServer(port || 9001);
    app.configure(function () {
        app.use(express.logger({
            format: 'TEST: :method :url :status :res[content-length] - :response-time ms'
        }));
        app.use(function (req, res, mw_next) {
            // Force a delay, which tickles async bugs in need of fixes
            setTimeout(mw_next, 50);
        });
        app.use(express['static'](__dirname + '/../../tests/fixtures'));
    });
    app.listen(port || 9001);
    return app;
}

// ### Exported public API
module.exports = {
    JSONifyTemplate: JSONifyTemplate,
    JSONifyLoader: JSONifyLoader,
    LocalLoader: LocalLoader,
    createTestServer: createTestServer
};
