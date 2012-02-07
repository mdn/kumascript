// ## KumaScript HTTP service
//
// Provides the HTTP service for document processing

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    _ = require('underscore'),
    request = require('request'),
    express = require('express'),
    ks_utils = require(__dirname + '/utils');

var Server = ks_utils.Class({

    default_options: {
        port: 9000,
        document_url_template: "http://localhost:9001/docs/{path}?raw=1",
        template_url_template: "http://localhost:9001/templates/{path}?raw=1"
    },

    initialize: function (options) {
        var app = this.app = express.createServer();
        app.configure(function () {
            // app.use(express.logger());
            app.use(express.logger({
                format: 'SRVC: :method :url :status :res[content-length] - :response-time ms'
            }));
        
        });
    },

    listen: function () {
        this.app.listen(this.options.port);
    },

    close: function () {
        this.app.close();
    }

});

// ### Exported public API
module.exports = {
    Server: Server
};
