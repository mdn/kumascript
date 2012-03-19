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
    load: function (name, loaded_cb) {
        loaded_cb(null, new JSONifyTemplate({name: name}));
    }
});

// Loader which pulls from a pre-defined object full of named templates.
var LocalLoader = ks_utils.Class(ks_loaders.BaseLoader, {
    default_options: {
        templates: { }
    },
    load: function (name, loaded_cb) {
        if (name in this.options.templates) {
            loaded_cb(null, this.options.templates[name]);
        } else {
            loaded_cb("not found", null);
        }
    }
});

// Creates an HTTP server for fixtures
function createTestServer (port) {
    var app = express.createServer(port || 9001);
    app.configure(function () {
        app.use(express.logger({
            format: 'TEST: :method :url :status :res[content-length] - :response-time ms'
        }));
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
