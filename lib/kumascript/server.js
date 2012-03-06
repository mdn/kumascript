// ## KumaScript HTTP service
//
// Provides the HTTP service for document processing

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    _ = require('underscore'),
    
    request = require('request'),
    express = require('express'),
    log = require('winston'),

    ks_loaders = require(__dirname + '/loaders'),
    ks_macros = require(__dirname + '/macros'),
    ks_templates = require(__dirname + '/templates'),
    ks_api = require(__dirname + '/api'),
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
        template_url_template: "http://localhost:9001/templates/{name}?raw=1",
        // kumascript.templates class used by default to render templates
        default_template_class: 'EJSTemplate'
    },

    // Build the service, but do not listen yet.
    initialize: function (options) {
        var $this = this,
            app = this.app = express.createServer();

        log.info('Service pid ' + process.pid + ' initializing');

        app.configure(function () {
            // Configure a logger that pipes to the winston logger.
            app.use(express.logger({
                format: ':remote-addr - - [:date] ":method :url ' +
                        'HTTP/:http-version" :status :res[content-length] ' +
                        '":referrer" ":user-agent" :response-time',
                stream: {
                    write: function(s) {
                        log.info(s.trim(), { source: "server" });
                    }
                }
            }));
        });
        
        app.get('/docs/*', _.bind(this.docs_GET, this));
        app.post('/docs/', _.bind(this.docs_POST, this));

        var template_class = ks_templates[this.options.default_template_class] ||
                             ks_templates.EJSTemplate;

        this.template_loader = new ks_loaders.HTTPLoader({
            url_template: this.options.template_url_template,
            template_class: template_class
        });

        this.macro_processor = new ks_macros.MacroProcessor({
            loader: this.template_loader
        });
    },

    // Start the service listening
    listen: function () {
        log.info('Starting up service on port ' + this.options.port);
        this.app.listen(this.options.port);
    },

    // Close down the service
    close: function () {
        this.app.close();
    },

    // #### GET /docs/*
    //
    // Process source documents, respond with the result of macro evaluation.
    docs_GET: function (req, res) {
        var $this = this,
            path = req.params[0],
            url_tmpl = $this.options.document_url_template,
            doc_url = ks_utils.tmpl(url_tmpl, {path: path});

        // TODO: Need document caching here
        request(doc_url, function (err, doc_resp, src) {
            $this._evalMacros(src, req, res);
        });
    },

    // #### POST /docs/
    //
    // Process POST body, respond with result of macro evaluation
    docs_POST: function (req, res) {
        var $this = this,
            buf = '';
        
        // TODO: Be more flexible with encodings.
        req.setEncoding('utf8');
        req.on('data', function (chunk) { buf += chunk; });
        req.on('end', function () {
            try {
                var src = buf.length ? buf : '';
                $this._evalMacros(src, req, res);
            } catch (err){
                // TODO: Handle errors more gracefully
                $this._evalMacros('', req, res);
            }
        });
    },

    // #### _evalMacros()
    //
    // Shared macro evaluator used by GET and POST
    _evalMacros: function (src, req, res) {
        var $this = this;
        
        // TODO: Build a proper API context based on the doc_resp and doc_body
        var api_ctx = new ks_api.APIContext({
            request: req,
            response: res,
            source: src
        });
        
        $this.macro_processor.process(src, api_ctx, function (err, result) {
            res.send(result);
        });
    }

});

// ### Exported public API
module.exports = {
    Server: Server
};
