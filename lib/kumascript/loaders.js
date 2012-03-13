// ## KumaScript template script loaders
//
// This module houses the machinery for template loading, compilation, and
// caching.

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    fs = require('fs'),
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
    // Try not to override this method, since it takes care of basics like
    // trapping errors and using a cache if available. Instead, override
    // the `load()` method.
    get: function (name, cb) {
        var $this = this;
        try {
            $this.cache_fetch(name, function (err, tmpl) {
                if (!err) { return cb(null, tmpl); }
                $this.load(name, function (err, tmpl) {
                    if (err) { return cb(err, null); }
                    $this.cache_store(name, tmpl, cb);
                });
            });
        } catch (e) {
            return cb(e, null);
        }
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

    default_options: {
        // URL template used to resolve template name to URL.
        filename_template: 'http://localhost/templates/{name}.ejs',
        // Class used to render templates
        template_class: ks_templates.EJSTemplate
    },
    
    load: function (name, loaded_cb) {
        var $this = this,
            tmpl_fn = ks_utils.tmpl($this.options.filename_template,
                                    {name: name})
                              .toLowerCase();
        fs.readFile(tmpl_fn, 'utf8', function (err, body) {
            // TODO: Do something more graceful with errors
            if (err) {
                return loaded_cb("error " + err, null);
            }
            // TODO: Map response content-type and headers to choose template class
            var tmpl_cls = $this.options.template_class;
            // TODO: Do something graceful with template parsing errors?
            var tmpl = new tmpl_cls({ source: body });
            loaded_cb(null, tmpl);
        });
    }

});

// ### HTTPLoader
//
// Loads templates via HTTP using a template to construct an URL based on
// template name.
var HTTPLoader = ks_utils.Class(BaseLoader, {

    default_options: {
        // URL template used to resolve template name to URL.
        url_template: 'http://localhost/templates/{name}.ejs',
        // Class used to render templates
        template_class: ks_templates.EJSTemplate
    },
    
    load: function (name, loaded_cb) {
        var $this = this,
            tmpl_url = ks_utils.tmpl($this.options.url_template,
                                     {name: name.toLowerCase()});
        request(tmpl_url, function (err, resp, body) {
            // TODO: Do something more graceful with errors and 404's
            if (200 !== resp.statusCode) {
                return loaded_cb("status " + resp.statusCode, null);
            }
            // TODO: Map response content-type and headers to choose template class
            var tmpl_cls = $this.options.template_class;
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
