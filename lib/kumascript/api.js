// ## KumaScript template API
//
// This module provides the API exposed to templates for utilities and wiki
// query functionality.

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    vm = require("vm"),
    _ = require('underscore'),
    // This also injects `Fiber` and `yield`
    fibers = require('fibers'),
    Future = require('fibers/future'),
    wait = Future.wait,
    request = require('request'),
    ks_utils = require(__dirname + '/utils');

// ### BaseAPI
//
// Base container for a namespaced sub-API
var BaseAPI = ks_utils.Class({
    initialize: function (options) {
        this.parent = this.options.parent;
    }
});

// ### WikiAPI
//
// 
var WikiAPI = ks_utils.Class(BaseAPI, {

});

// ### APIContext
//
// The API is an object wrapping around content context, once per body of
// content scanned for macros. Aggregates other sub-APIs in its namespace
var APIContext = ks_utils.Class({
    apis: {
        wiki: WikiAPI
    },
    initialize: function (options) {
        var $this = this;
        _.extend(this.apis, this.options.apis || {});
        _.each(this.apis, function (cls, name) {
            $this[name] = new cls({ parent: $this });
        });
    }
});

// ### Exported public API
module.exports = {
    APIContext: APIContext,
    BaseAPI: BaseAPI,
    WikiAPI: WikiAPI
};
