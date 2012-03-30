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
    vm = require("vm"),
    _ = require('underscore'),

    // This also injects `Fiber` and `yield`
    fibers = require('fibers'),
    Future = require('fibers/future'),
    wait = Future.wait,
    request = require('request'),

    ks_macros = require(__dirname + '/macros'),
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
// Grab bag of Kuma-specific API methods and utilities
var KumaAPI = ks_utils.Class(BaseAPI, {

});

// ### StringAPI
// See also: <http://developer.mindtouch.com/en/docs/DekiScript/Reference/DekiScript_Functions_and_Variables#String_Functions>
var StringAPI = ks_utils.Class(BaseAPI, {

    StartsWith: function (str, sub_str) {
        return (''+str).indexOf(sub_str) === 0;
    },

    Contains: function (str, sub_str) {
        return (''+str).indexOf(sub_str) !== -1;
    },

    toLower: function (str) {
        return (''+str).toLowerCase();
    },

    Substr: function (str, start) {
        return (''+str).substr(start);
    }

});

// ### UriAPI
// See also: <http://developer.mindtouch.com/en/docs/DekiScript/Reference/DekiScript_Functions_and_Variables#Uri_Functions>
var UriAPI = ks_utils.Class(BaseAPI, {

    // Decompose a URI into its component parts. (Obsoletes uri.parse)
    // [See also](http://developer.mindtouch.com/en/docs/DekiScript/Reference/DekiScript_Functions_and_Variables/Uri.Parts)
    parts: function (str) {
        var url = require('url'),
            p = url.parse(str, true);

        var out = {
            host: p.hostname,
            port: p.port,
            path: p.pathname.substr(1).split('/'),
            fragment: p.hash,
            query: p.query,
            scheme: p.protocol
        };

        if (p.auth) {
            var auth_parts = p.auth.split(':');
            out.user = auth_parts[0];
            out.password = auth_parts[1];
        }

        return out;
    }

});

// ### PageAPI
// <http://developer.mindtouch.com/en/docs/DekiScript/Reference/Wiki_Functions_and_Variables/Page>
var PageAPI = ks_utils.Class(BaseAPI, {
    
    initialize: function (options) {
        BaseAPI.prototype.initialize.call(this, options);
        var $this = this;

        // TODO: Need to thread through page details from Server to APIContext to here.
        this.setVars({
            uri: 'http://example.com/en/HTML/FakePage',
            language: 'en'
        });
    }

});

// ### WebAPI
// <http://developer.mindtouch.com/en/docs/DekiScript/Reference/DekiScript_Functions_and_Variables#Web_Functions>
var WebAPI = ks_utils.Class(BaseAPI, {

    // Insert a hyperlink.
    // [See also](http://developer.mindtouch.com/en/docs/DekiScript/Reference/DekiScript_Functions_and_Variables/Web.Link)
    link: function (uri, text, title, target) {
        var out = [
            '<a href="' + htmlEscape(uri) + '"'
        ];
        if (title) {
            out.push(' title="' + htmlEscape(title) + '"');
        }
        if (target) {
            out.push(' target="' + htmlEscape(target) + '"');
        }
        out.push('>', htmlEscape(text || uri), '</a>');
        return out.join('');
    }


});

// ### WikiAPI
// <http://developer.mindtouch.com/en/docs/DekiScript/Reference/Wiki_Functions_and_Variables>
var WikiAPI = ks_utils.Class(BaseAPI, {

    // Check if the given wiki page exists.
    // [See also](http://developer.mindtouch.com/en/docs/DekiScript/Reference/Wiki_Functions_and_Variables/Wiki.PageExists)
    pageExists: function (path) {
        // TODO
        // Need to make an HTTP HEAD to the wiki.
        // Needs configuration data threaded through from the server for base URI & etc.
        return true;
    },

    // Retrieve the full uri of a given wiki page.
    // [See also](http://developer.mindtouch.com/en/docs/DekiScript/Reference/Wiki_Functions_and_Variables/Wiki.Uri)
    uri: function (path, query) {
        // TODO
        // Needs configuration data threaded through from the server for base URI & etc.
        var out = 'https://developer.mozilla.org/' + path;
        if (query) {
            out += '?' + query;
        }
        return out;
    },

    // A link to the wiki page that you will add, that will be in a different language.
    // [See also](http://developer.mindtouch.com/en/docs/DekiScript/Reference/Wiki_Functions_and_Variables/Wiki.Languages)
    languages: function (langs) {
        // TODO
        var out = ['<ul>'];
        _.each(langs, function (url, lang) {
            out.push('<li><a href="', htmlEscape(url), '">',
                     htmlEscape(lang), '</a></li>');
        });
        out.push('</ul>');
        return out.join('');
    }

});

// ### APIContext
//
// Instances of this class manage instances of sub-APIs, supplying them with
// contextual info about the page in which macros are evaluated. Template
// scripts, in turn, use instances of this class to access sub-APIs.
var APIContext = ks_utils.Class({

    default_options: {
        apis: {
            wiki: WikiAPI,
            web: WebAPI,
            string: StringAPI,
            uri: UriAPI,
            page: PageAPI,
            kuma: KumaAPI
        }
    },
    
    // #### initialize
    //
    // Initialize the API context.
    initialize: function (options) {
        _.each(this.options.apis, _.bind(this.installAPI, this));

        // Create a new cache for required templates.
        this._require_cache = {};
    },

    // #### Future
    //
    // Allow access to node-fiber Future from templates.
    Future: Future,

    // #### request
    //
    // Allow access to mikeal/request in templates and libraries, so they can
    // easily make HTTP requests. 
    //
    // TODO: Very permissive. Should there be more restrictions on net access?
    request: request,
    
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
    performAutoRequire: function () {
        if (this.options.autorequire) {
            var $this = this;
            // require() expects to run inside a Fiber
            Fiber(function () {
                _.each($this.options.autorequire,
                    function (tmpl_name, install_name) {
                        var exports = $this.require(tmpl_name);
                        setCaseVariantAliases($this, install_name, exports);
                    }
                );
            }).run();
        }
    },

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
                    tmpl.execute(args, $this, function (err, result) {
                        if (err) { 
                            // There was an error executing the template. :(
                            var tok = {type: 'none', name: 'none'};
                            errors.push(new ks_macros.TemplateExecutionError(
                                        {token: tok, error: err}));
                        }
                        output = result;
                        future['return']();
                    });
                } else {
                    // There was an error loading the template. :(
                    errors.push(new ks_macros.TemplateLoadingError(
                                {name: name, error: err}));
                    future['return']();
                }
            });
        } catch (e) {
            // There was an error executing the template. :(
            errors.push(new ks_macros.TemplateLoadingError(
                        {name: name, error: e}));
            future['return']();
        }

        // Wait here for the async magic to complete.
        future.wait();

        return output;
    },

    // #### require(path)
    //
    // Attempts to load and execute a template which, as a side effect, can
    // populate an exports object in quasi-CommonJS style. The template output
    // is ignored.
    require: function (name) {

        // Use an internal cache, so that repeated require() calls reuse the
        // previously loaded results.
        if (!(name in this._require_cache)) {

            // Let's pretend we're following CommonJS module conventions
            this.module = { exports: {} };
            this.exports = this.module.exports;

            // This is just like calling a template, only we ignore the output
            // and return the side effect of populating exports.
            var output = this.template(name, []);
            this._require_cache[name] = this.module.exports;

            // Clean out the exports
            delete this.module;
            delete this.exports;
        }

        return this._require_cache[name];
    }

});

// ### htmlEscape(string)
// Escape the given string for HTML inclusion.
function htmlEscape (s) {                                       
    return (''+s).replace(/&/g,'&amp;').
             replace(/>/g,'&gt;').
             replace(/</g,'&lt;').
             replace(/"/g,'&quot;');
}

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
    KumaAPI: KumaAPI,
    WikiAPI: WikiAPI
};
