// ## KumaScript template script loaders
//
// This module houses the machinery for template loading, compilation, and
// caching.

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    _ = require('underscore'),

    request = require('request'),

    ks_templates = require(__dirname + '/templates'),
    ks_utils = require(__dirname + '/utils');

// ### BaseLoader
//
// The base API to template loading.
var BaseLoader = ks_utils.Class({

    // #### get(name, cb)
    //
    // Get the named template, pass it to the callback when available.
    // The callback should expect `(err, fn)` parameters
    //
    // This attempts to use a caching mechanism, if one is available.
    get: function (name, cb) {
        var $this = this;
        $this.cache_fetch(name, function (err, fn) {
            if (!err) { return cb(null, fn); }
            $this.load(name, function (err, fn) {
                if (err) { return cb(err, null); }
                $this.cache_store(name, fn, cb);
            });
        });
    },

    // #### load(name, cb)
    //
    // Attempt to load and compile the named template. This should be the first
    // thing a subclass replaces.
    load: function (name, cb) {
        cb("UNIMPLEMENTED", null);
    },

    // #### cache_fetch(name, cb)
    //
    // Attempt to fetch the named template from cache. A caching mixin should
    // replace this, since it does nothing by default.
    cache_fetch: function (name, cb) {
        cb('cache unavailable', null);
    },

    // #### cache_store(name, cb)
    //
    // Store the named template into the cache. A caching mixin should replace
    // this, since it does nothing by default.
    cache_store: function (name, fn, cb) {
        cb(null, fn);
    },

    EOF:null
});

// ### LocalCacheMixin
//
// Cache templates in local memory. No expiry logic or anything smart. If
// anything, this is an example for other caching mechanisms.
var LocalCacheMixin = {

    // Here is the fancy local memory cache:
    cache: {},

    // #### cache_fetch(name, cb)
    //
    // Attempt to fetch the named template from cache. 
    //
    // If it's a miss, the callback gets an error. Otherwise, the callback gets
    // the cached template.
    cache_fetch: function (name, cb) {
        if (name in this.cache) {
            cb(null, this.cache[name]);
        } else {
            cb('cache miss', null);
        }
    },

    // #### cache_store(name, cb)
    //
    // Store the named template into the cache. This should really just be a
    // pass-through and not telegraph any errors onto the callback.
    cache_store: function (name, fn, cb) {
        this.cache[name] = fn;
        cb(null, fn);
    }

};

// ### FileLoader
var FileLoader = ks_utils.Class(BaseLoader, {

});

// ### HTTPLoader
//
// Loads templates via HTTP using a template to construct an URL based on
// template name.
var HTTPLoader = ks_utils.Class(BaseLoader, {

    default_options: {

        // URL template used to resolve template name to URL.
        url_template: 'http://localhost/templates/{name}.ejs',

        // TODO: This should help map response Content-Type and/or other
        // headers to a template class
        type_map: {
            _default: ks_templates.EJSTemplate
        }
    },
    
    load: function (name, loaded_cb) {
        var $this = this,
            tmpl_url = ks_utils.tmpl($this.options.url_template, {name: name});

        request(tmpl_url, function (err, resp, body) {

            // TODO: Do something graceful with errors and 404's

            // TODO: Map response content-type and headers to choose template class
            var tmpl_type = '_default',
                tmpl_cls = $this.options.type_map[tmpl_type];

            // TODO: Do something graceful with template parsing errors?
            var tmpl = new tmpl_cls({ source: body });
            
            loaded_cb(null, tmpl);
        });
    }

});

// ### Exported public API
module.exports = {
    BaseLoader: BaseLoader,
    LocalCacheMixin: LocalCacheMixin,
    FileLoader: FileLoader,
    HTTPLoader: HTTPLoader
};
