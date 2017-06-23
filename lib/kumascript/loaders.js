// ## KumaScript template script loaders
//
// This module houses the machinery for template loading, compilation, and
// caching.

/*jshint node: true, esversion: 6, expr: false, boss: true */

// ### Prerequisites
var fs = require('fs'),
    path = require('path'),
    _ = require('underscore'),
    Memcached = require('memcached'),
    ks_templates = require(__dirname + '/templates'),
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
                    return $this.compile(source, cb, true);
                }
                $this.load(name, function (err, source) {
                    if (!source || err) {
                        return cb(err, null, false);
                    }
                    $this.cache_store(name, source, function (err) {
                        return $this.compile(source, cb, false);
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
    compile: function (source, cb, cache_hit) {
        var $this = this;
        try {
            var tmpl_cls = $this.options.template_class;
            cb(null, new tmpl_cls({ source: source }), cache_hit);
        } catch (e) {
            cb(e, null, cache_hit);
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
    },

    // By default, a loader doesn't know what macros are available
    can_list_macros: false,

    // #### macros_data()
    //
    // Return data about the macros known to this loader
    macros_data: function () {
        return {
            'can_list_macros': this.can_list_macros,
            'macros': this.macros_details(),
        };
    },

    // ### macros_details()
    //
    // Return details of macros known by this loader.
    macros_details: function () {
        // By default, loader doesn't know what macros are available
        return [];
    }
});

// ### FileLoader
var FileLoader = ks_utils.Class(BaseLoader, {

    default_options: {
        // Root directory for templates (relative to the repo dir).
        root_dir: 'macros',
        // Class used to render templates
        template_class: ks_templates.EJSTemplate
    },

    initialize: function (options) {
        // Build the template map, associating lowercase template names
        // with their paths on the filesystem.

        var dirs = [],
            dir = null,
            duplicates = {},
            template_map = this.template_map = {},
            macro_dir = this.macro_dir = path.resolve(
                __dirname,
                '..', '..',
                this.options.root_dir
            );

        function getTemplateName(fp) {
            // Returns the lowercase basename, without the extension.
            return path.parse(fp).name.toLowerCase();
        }

        function processFilename(fn) {
            // If the given filename is a directory, push it onto
            // the queue, otherwise consider it a template.
            var fp = path.join(dir, fn);
            if (fs.statSync(fp).isDirectory()) {
                dirs.push(fp);
            } else {
                var name = getTemplateName(fn);
                if (_.has(template_map, name)) {
                    // Keep track of all duplicates and throw error later.
                    if (!(_.has(duplicates, name))) {
                        duplicates[name] = [template_map[name]];
                    }
                    duplicates[name].push(fp);
                } else {
                    template_map[name] = fp;
                }
            }
        }

        dirs.push(macro_dir);

        // Walk the directory tree under the specified root directory.
        while (dirs.length > 0) {
            dir = dirs.shift();
            fs.readdirSync(dir).forEach(processFilename);
        }

        if (_.isEmpty(template_map)) {
            // Let's throw an error if no macros could be discovered, since
            // for now this is the only time we check and this loader is
            // useless if there are no macros.
            throw new Error(
                `no macros could be found in "${macro_dir}"`
            );
        }

        if (!(_.isEmpty(duplicates))) {
            // Duplicate template names
            var msg = "duplicate macros:";
            _.keys(duplicates).forEach(function(name) {
                msg += "\n" + name + ": " + duplicates[name].join(", ");
            });
            throw new Error(msg);
        }
    },

    // Don't use caching, as we're loading from the local filesystem.
    get: function (name, cb) {
        var $this = this;
        try {
            // Replace all colons in macro names with dashes.
            var lc_name = name.replace(/:/g, '-').toLowerCase();
            if (_.has(this.template_map, lc_name)) {
                var fp = this.template_map[lc_name];
                fs.readFile(fp, 'utf8', function (err, source) {
                    if (err || !source) {
                        cb(err, null, false);
                    } else {
                        $this.compile(source, cb, false);
                    }
                });
            } else {
                cb(new Error('unable to load: ' + name), null, false);
            }
        } catch (e) {
            cb(e, null, false);
        }
    },

    // FileLoader does have a list of all known macros
    can_list_macros: true,

    // Returns list of macro detail objects with these key: value pairs:
    //  name: the mixed-case name of the macro
    //  filename: path to filename in macros folder
    macros_details: function() {
        var macros = [],
            macro_dir = this.macro_dir + path.sep;
        for (var lc_name in this.template_map) {
            var fp = this.template_map[lc_name],
                name = path.parse(fp).name,
                short_path = fp.slice(macro_dir.length).replace(path.sep, '/');
            macros.push({
                'name': name,
                'filename': short_path
            });
        }
        return macros;
    }
});

// ### Exported public API
module.exports = {
    BaseLoader: BaseLoader,
    FileLoader: FileLoader,
};
