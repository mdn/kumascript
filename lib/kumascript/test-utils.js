// ## KumaScript testing utilities
//
// Provides utilities used by many tests.

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    _ = require('underscore'),

    express = require('express'),
    request = require('request'),
    morgan = require('morgan'),
    
    ks_utils = require(__dirname + '/utils'),
    ks_loaders = require(__dirname + '/loaders'),
    ks_templates = require(__dirname + '/templates');

var DEBUG = false;

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

var BrokenCompilationTemplate = ks_utils.Class(ks_templates.BaseTemplate, {
    initialize: function (options) {
        throw new Error("ERROR INITIALIZING " + this.options.name);
    }
});

var BrokenExecutionTemplate = ks_utils.Class(ks_templates.BaseTemplate, {
    execute: function (args, ctx, next) {
        throw new Error("ERROR EXECUTING " + this.options.name);
    }
});

var LocalClassLoader = ks_utils.Class(ks_loaders.BaseLoader, {
    load: function (name, cb) {
        var templates = this.options.templates;
        if (name in templates && templates[name]) {
            cb(null, name);
        } else {
            cb('NOT FOUND', null);
        }
    },
    compile: function (name, cb) {
        var templates = this.options.templates;
        var module = require(this.options.module);
        var cls = (name in templates) ?
            module[templates[name]] : JSONifyTemplate;
        try {
            cb(null, new cls({ name: name }));
        } catch (e) {
            cb(e, null);
        }
    }
});

// Creates an HTTP server for fixtures
function createTestServer (port) {
    var app = express();
    
    if (DEBUG) app.use(morgan('TEST: :method :url :status :res[content-length] - :response-time ms'));

    app.use(function (req, res, mw_next) {
        // Force a delay, which tickles async bugs in need of fixes
        setTimeout(mw_next, 50);
    });
    app.use(express['static'](__dirname + '/../../tests/fixtures'));
    
    app._kumascript_listener = app.listen(port || 9001);
    return app;
}

// ### Exported public API
module.exports = {
    JSONifyTemplate: JSONifyTemplate,
    JSONifyLoader: JSONifyLoader,
    LocalLoader: LocalLoader,
    LocalClassLoader: LocalClassLoader,
    BrokenCompilationTemplate: BrokenCompilationTemplate,
    BrokenExecutionTemplate: BrokenExecutionTemplate,
    createTestServer: createTestServer
};
