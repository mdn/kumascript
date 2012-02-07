// ## KumaScript HTTP service
//
// Provides the HTTP service for document processing

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    _ = require('underscore'),
    request = require('request'),
    express = require('express'),
    ks_loaders = require(__dirname + '/loaders'),
    ks_macros = require(__dirname + '/macros'),
    ks_utils = require(__dirname + '/utils');

// ### Server
//
// KumaScript service instance.
var Server = ks_utils.Class({

    // Service accepts these options:
    default_options: {
        // Port on which the HTTP service will listen.
        port: 9000,
        // Template used to resolve incoming URL paths to document source URLs.
        document_url_template: "http://localhost:9001/docs/{path}?raw=1",
        // Template used to resolve macro names to URLs for the loader.
        template_url_template: "http://localhost:9001/templates/{name}?raw=1"
    },

    // Build the service, but do not listen yet.
    initialize: function (options) {
        var $this = this,
            app = this.app = express.createServer();

        app.configure(function () {
            app.use(express.logger({
                format: 'SRVC: :method :url :status :res[content-length] - :response-time ms'
            }));
            app.use(express.bodyParser());
        });
        
        app.get('/docs/*', _.bind(this.GET_docs, this));

        this.template_loader = new ks_loaders.HTTPLoader({
            url_template: this.options.template_url_template
        });

        this.macro_processor = new ks_macros.MacroProcessor({
            loader: this.template_loader
        });
    },

    // Start the service listening
    listen: function () {
        this.app.listen(this.options.port);
    },

    // Close down the service
    close: function () {
        this.app.close();
    },

    // #### GET /docs/*
    //
    // Process source documents, respond with the result of macro evaluation.
    GET_docs: function (req, res) {
        var $this = this,
            path = req.params[0],
            url_tmpl = $this.options.document_url_template,
            doc_url = ks_utils.tmpl(url_tmpl, {path: path});

        // TODO: Need document caching here
        request(doc_url, function (err, doc_resp, doc_body) {
            
            // TODO: Build a proper API context based on the doc_resp and doc_body
            var api_ctx = {
            };
            
            $this.macro_processor.process(doc_body, api_ctx, function (err, result) {
                res.send(result);
            });

        });
    }

});

// ### Exported public API
module.exports = {
    Server: Server
};
