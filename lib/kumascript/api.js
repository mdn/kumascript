// ## KumaScript template API
//
// This module provides the API exposed to templates for utilities and wiki
// query functionality.
//
// A lot of this code started from implementing APIs that are vaguely
// compatible with [things provided by MindTouch in DekiScript][dekiref].
//
// This shouldn't end up being a full reimplementation of the DekiScript API,
// though. We just need a subset of the API actually used by legacy MDN
// templates, and we can diverge from there.
//
// [dekiref]: http://developer.mindtouch.com/en/docs/DekiScript/Reference
//
// TODO: Maybe split this module up into namespace-specific modules for easier
// editing?

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    _ = require('underscore'),
    async = require('async'),
    Fiber = require('fibers'),
    Future = require('fibers/future'),
    request = require('request'),
    Memcached = require('memcached'),
    ks_errors = require(__dirname + '/errors'),
    ks_utils = require(__dirname + '/utils');

// ### BaseAPI
//
// Base container for a namespaced sub-API
var BaseAPI = ks_utils.Class({

    initialize: function (options) {
        this.parent = this.options.parent;

        // HACK: Create mixed case name aliases for all functions.
        var fn_names = _.functions(this);
        for (var i=0, name; name=fn_names[i]; i++) {
            setCaseVariantAliases(this, name, this[name]);
        }
    },

    // #### setVars(object)
    // Copy the properties from the given object onto this API.
    setVars: function (vars) {
        var $this = this;
        _.each(vars, function (v,n) {
            setCaseVariantAliases($this, n, v);
        });
    }

});

// ### KumaAPI
//
// Grab bag of Kuma-specific API methods and utilities.
//
// This has to live in a node.js module, rather than in an auto-required
// template: It grants access to some node.js modules that are otherwise
// inaccessible to templates which are not allowed to use node.js require()
//
// However, the contents here will be somewhat Kuma-specific. It might be less
// useful to someone trying to use KumaScript separately from Kuma.
var KumaAPI = ks_utils.Class(BaseAPI, {

    // #### debug
    // Expose util.debug from node.js
    debug: util.debug,

    // #### inspect
    // Expose util.inspect from node.js
    inspect: util.inspect,

    // #### url
    // Expose url from node.js to templates
    url: require('url'),

    // #### htmlEscape(string)
    // Escape the given string for HTML inclusion.
    htmlEscape: function (s) {
        return (''+s).replace(/&/g,'&amp;').
                 replace(/>/g,'&gt;').
                 replace(/</g,'&lt;').
                 replace(/"/g,'&quot;');
    },

    // #### fetchFeed(url)
    // Fetch an Atom/RSS feed, return an object with properties error, meta,
    // and articles containing the parsed data
    fetchFeed: function (url) {
        var FeedParser = require('feedparser'),
            result = {error: null, meta: {}, articles: []},
            f = new Future();

        var end = _.once(function (error) {
            if (error) { result.error = error; }
            f['return']();
        });

        request(url)
            .pipe(FeedParser())
            .on('meta', function (meta) {
                result.meta = meta;
            })
            .on('readable', function () {
                var stream = this, item;
                while (item = stream.read()) {
                    result.articles.push(item);
                }
            })
            .on('error', end)
            .on('end', end);

        f.wait();
        return result;
    }

});

// ### APIContext
//
// Instances of this class manage instances of sub-APIs, supplying them with
// contextual info about the page in which macros are evaluated. Template
// scripts, in turn, use instances of this class to access sub-APIs.
var APIContext = ks_utils.Class({

    default_options: {
        server_options: {},
        env: {},
        source: '',
        apis: {
            kuma: KumaAPI
        }
    },

    // #### initialize
    //
    // Initialize the API context.
    initialize: function (options) {
        _.each(this.options.apis, _.bind(this.installAPI, this));

        if (this.options) {
            this.env = this.options.env;
            this.log = this.options.log;
            this.loader = this.options.loader;
            this.errors = this.options.errors;
            if (this.options.arguments) {
                this.setArguments(this.options.arguments);
            }
            if (this.options.request) {
                this.request = this.options.request;
            }
        }

        // Create a memcache instance, if necessary
        if (this.options.memcache) {
            var mo = this.options.memcache;
            this.memcached = new Memcached(mo.server, mo.options || {});
        } else {
            // If the configuration is missing, use the fake stub cache
            this.memcached = new ks_utils.FakeMemcached();
        }

        // Create a new cache for required templates.
        this._require_cache = {};
    },

    // #### BaseAPI
    // Grant access to the BaseAPI class
    BaseAPI: BaseAPI,

    // #### Future
    // Allow access to node-fiber Future from templates.
    Future: Future,
    Fiber: Fiber,
    yield: Fiber.yield,

    // #### request
    //
    // Allow access to mikeal/request in templates and libraries, so they can
    // easily make HTTP requests.
    //
    // TODO: Very permissive. Should there be more restrictions on net access?
    request: request,

    // #### zlib
    //
    // Allow access to built-in zlib, e.g. for handling gzip'd HTTP responses
    zlib: require('zlib'),

    // #### md5
    // Return the MD5 hex digest of the given utf8 string
    md5: ks_utils.md5,

    // Install a new instance of the given API class, with the given name.
    installAPI: function (cls, name) {
        setCaseVariantAliases(this, name, new cls({parent: this}));
    },

    // #### buildAPI(prototype)
    //
    // Utility method for building a new BaseAPI-based API, useful for building
    // APIs in templates. Handy in conjuction with autorequire. See tests for
    // details.
    buildAPI: function (proto) {
        var cls = ks_utils.Class(BaseAPI, proto);
        return new cls({ parent: this });
    },

    // #### performAutoRequire
    //
    // Auto-require some templates and install the exports as APIs. This is
    // kind of a hack, but I wanted to use the require method.
    performAutoRequire: function (next) {
        var $this = this,
            autorequire = $this.options.autorequire;

        // Skip this whole thing, if there are no autorequires
        if (!autorequire) { return next(null); }

        // Run this in a parallel forEach, to block less on network.
        // NOTE: Keep this in series, for now. There seems to be a race
        // condition exposed under load that crashes the process.
        async.forEach(
            _.keys(autorequire),
            function (install_name, fe_next) {
                // require() expects to run inside a Fiber
                Fiber(function () {
                    var tmpl_name = autorequire[install_name],
                        exports = $this.require_macro(tmpl_name);
                    setCaseVariantAliases($this, install_name, exports);
                    fe_next();
                }).run();
            },
            next
        );
    },

    // #### setArguments
    // Given a list of arguments, make them available to a template as $0..$n
    // variables.
    setArguments: function (args) {
        var $this = this;
        // Both arguments and $$ are aliases for the list of macro args.
        $this['arguments'] = $this.$$ = args || [];
        // HACK: Clear out, yet ensure $0..$99 exist
        for (var i=0; i<99; i++) {
            $this['$'+i] = '';
        }
        // Assign each element of args to $0..$n
        _.each(args, function (v, i) {
            $this['$'+i] = v;
        });
        return this;
    },

    // #### cacheFn
    // Cache the results of a function with the given key and timeout
    cacheFn: function (key, tm_out, to_cache) {
        var result = null,
            err_result = null,
            f = new Future(),
            env = this.env,
            mc = this.memcached;
        mc.get(key, function (err, c_result) {
            if (c_result && env.cache_control != 'no-cache') {
                result = c_result;
                f['return']();
            } else {
                try {
                    to_cache(function (val) {
                        mc.set(key, val, tm_out, function (err, c_result) {
                            result = val;
                            f['return']();
                        });
                    });
                } catch (e) {
                    err_result = e;
                    result = '';
                    f['return']();
                }
            }
        });
        f.wait();
        if (err_result) { throw err_result; }
        return result;
    },

    // #### template(name, arguments)
    //
    // Attempt to load and execute a template with the given name and
    // arguments. The output, if any, is returned. Errors, if any, are pushed
    // up to the macro processor
    template: function (name, args) {
        // TODO: Implement caching here by building a key out of hashed args?
        // Probably not a big win, since the result of the template calling
        // this template will itself be cached during macro evaluation.

        // Try loading the template, using a node-fibers Future to avoid
        // imposing async on templates.
        var $this = this,
            future = new Future(),
            loader = $this.loader,
            errors = $this.errors,
            output = '';

        try {
            // Try loading the template...
            loader.get(name, function (err, tmpl) {
                if (!err) {
                    // Try executing the template...
                    var clone_ctx = _.clone($this).setArguments(args);
                    tmpl.execute(args, clone_ctx, function (err, result) {
                        if (err) {
                            // There was an error executing the template. :(
                            var tok = {type: 'none', name: name};
                            errors.push(new ks_errors.TemplateExecutionError(
                                        {token: tok, error: err}));
                        }
                        output = result;
                        future['return']();
                    });
                } else {
                    // There was an error loading the template. :(
                    errors.push(new ks_errors.TemplateLoadingError(
                                {name: name, error: err}));
                    future['return']();
                }
            });
        } catch (e) {
            // There was an error executing the template. :(
            errors.push(new ks_errors.TemplateLoadingError(
                        {name: name, error: e}));
            future['return']();
        }

        // Wait here for the async magic to complete.
        future.wait();

        return output;
    },

    // #### require_macro(name)
    //
    // This is a request to load a Kumascript macro as a module. It attempts
    // to load and execute the named macro which, as a side effect, should
    // populate an "exports" or "module.exports" object in nodejs style (the
    // macro output is ignored).
    require_macro: function (name) {
        // Use an internal cache, so that repeated require() calls
        // reuse the previously loaded results.
        if (!(name in this._require_cache)) {
            var clone_ctx = _.clone(this);

            // Let's pretend we're following nodejs module conventions.
            clone_ctx.module = { exports: {} };
            clone_ctx.exports = clone_ctx.module.exports;

            // We ignore the output and return the side effect of
            // populating the "module.exports" object.
            clone_ctx.template(name, []);
            this._require_cache[name] = clone_ctx.module.exports;
        }
        return this._require_cache[name];
    },

    // #### require(name)
    //
    // Load an npm package (the real "require" has its own cache).
    require: require

});

// ### setCaseVariantAliases
//
// THIS IS A BIG FAT HAIRY HACK. And, it has a long name, so no one forgets it.
//
// Set a property on an object with aliases of various mixed cases. For example:
//
//     page.location, Page.location, Page.Location, page.Location
//
// There's no such thing as case-insensitive object keys in JS, but
// apparently there are in DekiScript. This hack just covers the most
// common slack in known MDN templates.
//
// Harmony proxies might be a solution, in that an attribute access proxy could
// intercept and squash case. But, it requires a compiled C++ component and
// seems like overkill.
//
// <https://github.com/samshull/node-proxy>
//
// Running with the V8 option --harmony_proxies seems like a lead, especially
// when combined with this (thanks, David Bruant):
//
// <https://github.com/Benvie/Direct-Proxies-Shim-Shim-for-Node-and-Chrome>
//
// But, `--harmony_proxies` is off by default, which makes me hesitant to rely
// on it for a production service.
//
function setCaseVariantAliases($this, name, val) {

    // As-is from the source.
    $this[name] = val;

    // lowercase
    $this[name.toLowerCase()] = val;

    // Capitalized
    var uc_name = name.charAt(0).toUpperCase() + name.slice(1);
    $this[uc_name] = val;

}

// ### Exported public API
module.exports = {
    APIContext: APIContext,
    BaseAPI: BaseAPI,
    KumaAPI: KumaAPI
};
