// ## KumaScript template script loaders
//
// This module houses the machinery for template loading, compilation, and
// caching.

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    fs = require('fs'),
    crypto = require('crypto'),
    _ = require('underscore'),
    request = require('request'),
    Memcached = require('memcached'),

    ks_templates = require(__dirname + '/templates'),
    ks_caching = require(__dirname + '/caching'),
    ks_utils = require(__dirname + '/utils');

// ### BaseLoader
//
// The base API to template loading.
var BaseLoader = ks_utils.Class({

    initialize: function (options) {
        // Create a memcache instance, if necessary
        if (this.options.memcache) {
            var mo = this.options.memcache;
            this.memcached = new Memcached(mo.server, mo.options || {});
        } else {
            // If the configuration is missing, use the fake stub cache
            this.memcached = new ks_utils.FakeMemcached();
        }
    },

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
            $this.cache_fetch(name, function (err, source) {
                if (source && !err && $this.options.cache_control != 'no-cache') {
                    return $this.compile(source, cb);
                }
                $this.load(name, function (err, source) {
                    if (!source || err) {
                        return cb(err, null);
                    }
                    $this.cache_store(name, source, function (err) {
                        return $this.compile(source, cb);
                    });
                });
            });
        } catch (e) {
            return cb(e, null);
        }
    },

    // #### compile(source, cb)
    //
    // Compile the given source using the configured template class, call
    // cb(error, tmpl_instance)
    compile: function (source, cb) {
        var $this = this;
        try {
            var tmpl_cls = $this.options.template_class;
            cb(null, new tmpl_cls({ source: source }));
        } catch (e) {
            cb(e, null);
        }
    },

    // #### cache_fetch(name, cb)
    //
    // Attempt to fetch the named template from cache. 
    //
    // If it's a miss, the callback gets an error. Otherwise, the callback gets
    // the cached template.
    cache_fetch: function (name, cb) {
        var key = 'kumascript:loader:' + ks_utils.md5(name);
        this.memcached.get(key, function (err, result) {
            if (err || !result) {
                cb(err, null);
            } else {
                var source = (new Buffer(result, 'base64')).toString('utf-8');
                cb(null, source);
            }
        });
    },

    // #### cache_store(name, cb)
    //
    // Store the named template into the cache. This should really just be a
    // pass-through and not telegraph any errors onto the callback.
    cache_store: function (name, source, cb) {
        var key = 'kumascript:loader:' + ks_utils.md5(name);
        var timeout = this.options.cache_timeout || 3600;
        var cache_source = (new Buffer(source,'utf8')).toString('base64');
        this.memcached.set(key, cache_source, timeout, function (err, result) {
            return (err) ? cb(err, null) : cb(null, source);
        });
    }

});

// ### FileLoader
var FileLoader = ks_utils.Class(BaseLoader, {

    default_options: {
        // URL template used to resolve template name to URL.
        filename_template: 'http://localhost/templates/{name}.ejs',
        // Class used to render templates
        template_class: ks_templates.EJSTemplate
    },
    
    load: function (name, cb) {
        var $this = this,
            tmpl_fn = ks_utils.tmpl($this.options.filename_template,
                                    {name: name})
                              .toLowerCase();
        fs.readFile(tmpl_fn, 'utf8', function (err, source) {
            if (err) { cb(err, null); }
            else { cb(null, source); }
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

    initialize: function (options) {
        BaseLoader.prototype.initialize.apply(this, arguments);
        // Create a memcache instance, if necessary
        if (this.options.memcache) {
            var mo = this.options.memcache;
            this.memcached = new Memcached(mo.server, mo.options || {});
        } else {
            // If the configuration is missing, use the fake stub cache
            this.memcached = new ks_utils.FakeMemcached();
        }
    },

    // #### get(name, cb)
    get: function (name, cb) {
        var $this = this;
        var tmpl_url = ks_utils.tmpl($this.options.url_template,
                                     {name: name.toLowerCase()});
        var req_opts = {
            memcached: this.memcached,
            timeout: this.options.cache_timeout || 3600,
            cache_control: this.options.cache_control,
            url: tmpl_url
        };
        ks_caching.request(req_opts, function (err, resp, source) {
            if (err) {
                cb(err, null);
            } else {
                $this.compile(source, cb);
            }
        });
    }

});

// ### Exported public API
module.exports = {
    BaseLoader: BaseLoader,
    FileLoader: FileLoader,
    HTTPLoader: HTTPLoader
};
