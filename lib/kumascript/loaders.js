// ## KumaScript template script loaders
//
// This module houses the machinery for template loading, compilation, and
// caching.

/*jshint node: true, esversion: 6, expr: false, boss: true */

// ### Prerequisites
var fs = require('fs'),
    path = require('path'),
    _ = require('underscore'),
    ks_templates = require('./templates.js'),
    ks_utils = require('./utils.js');

/**
 * @callback LoaderCallback
 * @param {Error} [error]
 * @param {*} [result]
 */

/**
 * @callback LoaderCacheCallback
 * @param {Error} [error]
 * @param {*} [result]
 * @param {boolean} cache_hit
 */

/**
 * ### BaseLoader
 *
 * The base API to template loading. FileLoader overrides most of
 * this class, but we still need it for testing. See test-utils.js.
 */
var BaseLoader = ks_utils.Class({

    initialize: function (options) {},

    /**
     * #### get(name, cb)
     *
     * Get the named template, pass it to the callback when available.
     * The callback should expect `(err, fn)` parameters
     *
     * Try not to override this method, since it takes care of basics like
     * trapping errors and compiling the template. Instead, override
     * the `load()` method.
     *
     * @param {string} name
     * @param {LoaderCallback} cb
     */
    get: function (name, cb) {
        try {
            this.load(name, (err, source) => {
                if (!source || err) {
                    cb(err, null, false);
                } else {
                    this.compile(source, cb, false);
                }
            });
        } catch (e) {
            cb(e, null);
        }
    },

    /**
     * #### compile(source, cb)
     *
     * Compile the given source using the configured template class, call
     * cb(error, tmpl_instance)
     *
     * @param {string} source
     * @param {LoaderCacheCallback} cb
     * @param {boolean} cache_hit
     */
    compile: function (source, cb, cache_hit) {
        try {
            var tmpl_cls = this.options.template_class;
            cb(null, new tmpl_cls({ source: source }), cache_hit);
        } catch (e) {
            cb(e, null, cache_hit);
        }
    },

    /**
     * By default, a loader doesn't know what macros are available
     */
    can_list_macros: false,

    /**
     * #### macros_data()
     *
     * Return data about the macros known to this loader
     */
    macros_data: function () {
        return {
            'can_list_macros': this.can_list_macros,
            'macros': this.macros_details(),
        };
    },

    /**
     * ### macros_details()
     *
     * Return details of macros known by this loader.
     */
    macros_details: function () {
        // By default, loader doesn't know what macros are available
        return [];
    }
});

/**
 * ### FileLoader
 */
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

    /**
     * Don't use caching, as we're loading from the local filesystem.
     * TODO(djf): maybe it is worth caching them in local memory once compiled?
     */
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

    /**
     * FileLoader does have a list of all known macros
     */
    can_list_macros: true,

    /**
     * Returns list of macro detail objects with these key: value pairs:
     *  name: the mixed-case name of the macro
     *  filename: path to filename in macros folder
     *
     * @return {Array<{name:string,filename:string}>}
     */
    macros_details: function() {
        var macros = [],
            macro_dir = this.macro_dir + path.sep;
        for (var lc_name in this.template_map) {
            /** @type {string}  */
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
