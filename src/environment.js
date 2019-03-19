/**
 * An Environment object defines the API available to KumaScript macros
 * through the MDN, wiki, page and other global objects. When you create
 * an Environment object, pass an object that defines the per-page
 * macro execution context. This defines values like env.locale and
 * env.title that macros can use.
 *
 * To render a single macro, call the getExecutionContext() method, passing
 * in the list of arguments to be exposed to the macro. This returns an
 * object that you can pass to the render() method of your Templates object.
 *
 * The functions defined on the various *Prototype objects in this file
 * will be bound to the global kumascript macro execution environment and
 * can use `this.mdn`, `this.wiki`, `this.env`, etc to refer to the parts
 * of that execution environment. Because the functions will all be bound
 * (see the prepareProto() function at the end of this file) they can not
 * use `this` to refer to the objects in which they are actually defined.
 *
 * TODO(djf): The *Prototype objects could each be defined in a
 * separate src/api/*.js file and imported with require(). That would
 * be tidier, and would keep separate the code with poor test coverage
 * from the rest of the file which is well tested.
 *
 * @prettier
 */
const url = require('url');
const request = require('request');

/**
 * Utility functions are collected here. These are functions that are used
 * by the exported functions below. Some of them are themselves exported.
 */
const util = require('./api/util');

/**
 * The properties of this object will be globals in the macro
 * execution environment.
 */
const globalsPrototype = {
    /**
     * #### require(name)
     *
     * Load an npm package (the real "require" has its own cache).
     */
    require: require
};

const kumaPrototype = {
    /**
     * Expose url from node.js to templates
     */
    url: url,
    htmlEscape: util.htmlEscape
};

const mdnPrototype = require('./api/mdn');
const stringPrototype = require('./api/string');

const wikiPrototype = {
    //
    // Given a string, escape any quotes within it so it can be
    // passed to other functions.
    //
    escapeQuotes: util.escapeQuotes,

    // Check if the given wiki page exists.
    // This was "temporarily" disabled 7 years ago!
    pageExists(/*path*/) {
        // Temporarily disabling this.
        // See: https://bugzilla.mozilla.org/show_bug.cgi?id=775590#c4
        return true;
    },

    // Retrieve the content of a document for inclusion,
    // optionally filtering for a single section.
    //
    // Doesn't support the revision parameter offered by DekiScript
    //
    async page(path, section, revision, show, heading, ignore_cache_control) {
        var key_text = path.toLowerCase();
        if (section) {
            key_text += '?section' + section;
        }
        var key = 'kuma:include:' + key_text;

        // Adjusts the visibility and heading levels of the specified HTML.
        //
        // The show parameter indicates whether or not the top level
        // heading/title should be displayed. The heading parameter
        // sets the heading level of the top level of the text to the
        // specified value and adjusts all subsequent headings
        // accordingly. This adjustment happens regardless of the
        // value of show.  The heading parameter uses the values 0-5,
        // as did DekiScript, 0 represents a page header or H1, 1 -
        // H2, 2 - H3 etc
        function adjustHeadings(html, section, show, heading) {
            if (html && heading) {
                // Get header level of page or section level
                var level = 1;
                if (section) {
                    level = Number(html.match(/^<h(\d)[^>]*>/i)[1]);
                }
                var offset = 1 - level + Number(heading);
                // Change content header levels.
                // There is probably a better way of doing this...
                var re;
                if (offset > 0) {
                    for (let i = 6; i >= level; i--) {
                        re = new RegExp('(</?h)' + i + '([^>]*>)', 'gi');
                        html = html.replace(re, '$1' + (i + offset) + '$2');
                    }
                } else if (offset < 0) {
                    for (let i = level; i <= 6; i++) {
                        re = new RegExp('(</?h)' + i + '([^>]*>)', 'gi');
                        html = html.replace(re, '$1' + (i + offset) + '$2');
                    }
                }
            }

            if (show) {
                return html;
            }

            // Rip out the section header
            if (html) {
                html = html.replace(/^<h\d[^>]*>[^<]*<\/h\d>/gi, '') + '';
            }
            return html;
        }

        var regenerate = next => {
            var params = ['raw=1', 'macros=1', 'include=1'];

            if (section) {
                params.push('section=' + encodeURIComponent(section));
            }

            var opts = {
                method: 'GET',
                headers: {
                    'Cache-Control': this.env.cache_control
                },
                url: util.buildAbsoluteURL(path) + '?' + params.join('&')
            };

            try {
                request(opts, function(err, resp, body) {
                    var result = '';
                    if (resp && 200 == resp.statusCode) {
                        result = body || '';
                        if (show == undefined) {
                            show = 0;
                        }
                        result = adjustHeadings(result, section, show, heading);
                    }
                    next(result);
                });
            } catch (e) {
                next('');
            }
        };
        if (ignore_cache_control) {
            return await util.cacheFnIgnoreCacheControl(key, regenerate);
        } else {
            return await util.cacheFn(key, this.env.cache_control, regenerate);
        }
    },

    // Returns the page object for the specified page.
    async getPage(path) {
        var key = 'kuma:get_page:' + path.toLowerCase();
        return JSON.parse(
            await util.cacheFn(key, this.env.cache_control, next => {
                var opts = {
                    method: 'GET',
                    headers: {
                        'Cache-Control': this.env.cache_control
                    },
                    url: util.buildAbsoluteURL(path) + '$json'
                };
                try {
                    request(opts, function(err, resp, body) {
                        let result;
                        if (resp && 200 == resp.statusCode) {
                            result = body;
                        } else {
                            result = '{}';
                        }
                        next(result);
                    });
                } catch (e) {
                    next('{}');
                }
            })
        );
    },

    // Retrieve the full uri of a given wiki page.
    uri(path, query) {
        const parts = url.parse(this.env.url);
        var out = parts.protocol + '//' + parts.host + util.preparePath(path);
        if (query) {
            out += '?' + query;
        }
        return out;
    },

    // Inserts a pages sub tree
    // if reverse is non-zero, the sort is backward
    // if ordered is true, the output is an <ol> instead of <ul>
    //
    // Special note: If ordered is true, pages whose locale differ from
    // the current page's locale are omitted, to work around misplaced
    // localizations showing up in navigation.
    async tree(path, depth, self, reverse, ordered) {
        // If the path ends with a slash, remove it.
        if (path.substr(-1, 1) === '/') {
            path = path.slice(0, -1);
        }

        var pages = await this.page.subpages(path, depth, self);

        if (reverse == 0) {
            pages.sort(alphanumForward);
        } else {
            pages.sort(alphanumBackward);
        }

        return process_array(null, pages, ordered != 0, this.env.locale);

        function chunkify(t) {
            var tz = [],
                x = 0,
                y = -1,
                n = 0,
                i,
                j;

            while ((i = (j = t.charAt(x++)).charCodeAt(0))) {
                var m = i == 46 || (i >= 48 && i <= 57);
                if (m !== n) {
                    tz[++y] = '';
                    n = m;
                }
                tz[y] += j;
            }
            return tz;
        }

        function alphanumForward(a, b) {
            var aa = chunkify(a.title);
            var bb = chunkify(b.title);

            for (let x = 0; aa[x] && bb[x]; x++) {
                if (aa[x] !== bb[x]) {
                    var c = Number(aa[x]),
                        d = Number(bb[x]);
                    if (c == aa[x] && d == bb[x]) {
                        return c - d;
                    } else return aa[x] > bb[x] ? 1 : -1;
                }
            }
            return aa.length - bb.length;
        }

        function alphanumBackward(a, b) {
            var bb = chunkify(a.title);
            var aa = chunkify(b.title);

            for (let x = 0; aa[x] && bb[x]; x++) {
                if (aa[x] !== bb[x]) {
                    var c = Number(aa[x]),
                        d = Number(bb[x]);
                    if (c == aa[x] && d == bb[x]) {
                        return c - d;
                    } else return aa[x] > bb[x] ? 1 : -1;
                }
            }
            return aa.length - bb.length;
        }

        function process_array(folderItem, arr, ordered, locale) {
            var result = '';
            var openTag = '<ul>';
            var closeTag = '</ul>';

            if (ordered) {
                openTag = '<ol>';
                closeTag = '</ol>';
            }

            if (arr.length) {
                result += openTag;

                // First add an extra item for linking to the folder's page
                // (only for ordered lists)
                if (folderItem != null && ordered) {
                    result +=
                        '<li><a href="' +
                        folderItem.url +
                        '">' +
                        util.htmlEscape(folderItem.title) +
                        '</a></li>';
                }

                // Now dive into the child items

                arr.forEach(function(item) {
                    if (!item) {
                        return;
                    }
                    if (ordered && item.locale != locale) {
                        return;
                    }
                    result +=
                        '<li><a href="' +
                        item.url +
                        '">' +
                        util.htmlEscape(item.title) +
                        '</a>' +
                        process_array(
                            item,
                            item.subpages || [],
                            ordered,
                            locale
                        ) +
                        '</li>';
                });
                result += closeTag;
            }
            return result;
        }
    }
};

const uriPrototype = {
    // Encode text as a URI component.
    encode(str) {
        return encodeURI(str);
    }
};

const webPrototype = {
    // Insert a hyperlink.
    link(uri, text, title, target) {
        var out = [
            '<a href="' + util.spacesToUnderscores(util.htmlEscape(uri)) + '"'
        ];
        if (title) {
            out.push(' title="' + util.htmlEscape(title) + '"');
        }
        if (target) {
            out.push(' target="' + util.htmlEscape(target) + '"');
        }
        out.push('>', util.htmlEscape(text || uri), '</a>');
        return out.join('');
    },

    // Given a URL, convert all spaces to underscores. This lets us fix a
    // bunch of places where templates assume this is done automatically
    // by the API, like MindTouch did.
    spacesToUnderscores(str) {
        return util.spacesToUnderscores(str);
    }
};

const pagePrototype = {
    // Determines whether or not the page has the specified tag. Returns
    // true if it does, otherwise false. This is case-insensitive.
    //
    hasTag: function(aPage, aTag) {
        // First, return false at once if there are no tags on the page

        if (
            aPage.tags == undefined ||
            aPage.tags == null ||
            aPage.tags.length == 0
        ) {
            return false;
        }

        // Convert to lower case for comparing

        var theTag = aTag.toLowerCase();

        // Now look for a match

        for (var i = 0; i < aPage.tags.length; i++) {
            if (aPage.tags[i].toLowerCase() == theTag) {
                return true;
            }
        }

        return false;
    },

    // Optional path, defaults to current page
    //
    // Optional depth. Number of levels of children to include, 0
    // is the path page
    //
    // Optional self, defaults to false. Include the path page in
    // the results
    //
    // This is not called by any macros, and is only used here by
    // wiki.tree(), so we could move it to be part of that function.
    async subpages(path, depth, self) {
        var url = util.apiURL((path ? path : this.env.url) + '$children');
        var depth_check = parseInt(depth);
        if (depth_check >= 0) {
            url += '?depth=' + depth_check;
        }

        var subpages = await this.MDN.fetchJSONResource(url);
        var result = [];
        if (subpages != null) {
            if (!self) {
                result = subpages.subpages || [];
            } else {
                result = [subpages];
            }
        }
        return result;
    },

    // Optional path, defaults to current page
    //
    // Optional depth. Number of levels of children to include, 0
    // is the path page
    //
    // Optional self, defaults to false. Include the path page in
    // the results
    //
    async subpagesExpand(path, depth, self) {
        var url = util.apiURL(
            (path ? path : this.env.url) + '$children?expand'
        );
        var depth_check = parseInt(depth);
        if (depth_check >= 0) {
            url += '&depth=' + depth_check;
        }
        var subpages = await this.MDN.fetchJSONResource(url);
        var result = [];
        if (subpages != null) {
            if (!self) {
                result = subpages.subpages || [];
            } else {
                result = [subpages];
            }
        }
        return result;
    },

    // Flatten subPages list
    subPagesFlatten(pages) {
        var output = [];

        process_array(pages);

        return output;

        function process_array(arr) {
            if (arr.length) {
                arr.forEach(function(item) {
                    if (!item) {
                        return;
                    }
                    process_array(item.subpages || []);
                    // If only a header for a branch
                    if (item.url == '') {
                        return;
                    }
                    item.subpages = [];
                    output.push(item);
                });
            }
        }
    },

    async translations(path) {
        var url = util.apiURL((path ? path : this.env.url) + '$json');
        var json = await this.MDN.fetchJSONResource(url);
        var result = [];
        if (json != null) {
            result = json.translations || [];
        }
        return result;
    }
};

class Environment {
    // Intialize an environment object that will be used to render
    // all of the macros in one document or page. We pass in a context
    // object (which may come from HTTP request headers) that gives
    // details like the page title and URL. These are available to macros
    // through the global 'env' object, and some of the properties
    // are also copied onto the global 'page' object.
    //
    // Note that we don't use the Environment object directly when
    // executing macros. Instead call getExecutionContext(), supplying
    // the macro arguments list to get an object specific for executing
    // one macro.
    //
    // Note that we pass the Templates object when we create an Environment.
    // this is so that macros can recursively execute other named macros
    // in the same environment.
    //
    // The optional third argument is for use only by tests. Setting it to
    // true makes us not freeze the environment so that tests can stub out
    // methods in the API like mdn.fetchJSONResources
    //
    constructor(perPageContext, templates, testing = false) {
        // Freeze an object unless we're in testing mode
        function freeze(o) {
            return testing ? o : Object.freeze(o);
        }

        /**
         * For each function-valued property in o, bind that function
         * to the specified bindings object, if there is one. Also,
         * create lowercase and titlecase variants of each property in
         * o, and finally, freeze the object o and return it.
         *
         * The binding means that the functions defined in this file can
         * use `this` to refer to the global kumascript environment and
         * can use `this.env.locale` and `this.MDN.fetchJSONResource()`
         * for example.
         *
         * The case-insensitive variants implement legacy behavior in
         * KumaScript, where macros can use case-insensitive names of
         * objects and methods.
         *
         * And the freeze() call is a safety measure to prevent
         * macros from modifying the execution environment.
         */
        function prepareProto(o, binding) {
            let p = {};
            for (let [key, value] of Object.entries(o)) {
                if (binding && typeof value === 'function') {
                    value = value.bind(binding);
                }
                p[key] = value;
                p[key.toLowerCase()] = value;
                p[key[0].toUpperCase() + key.slice(1)] = value;
            }
            return freeze(p);
        }

        this.templates = templates;
        let globals = Object.create(prepareProto(globalsPrototype));

        let kuma = Object.create(prepareProto(kumaPrototype, globals));
        let mdn = Object.create(prepareProto(mdnPrototype, globals));
        let string = Object.create(prepareProto(stringPrototype, globals));
        let wiki = Object.create(prepareProto(wikiPrototype, globals));
        let uri = Object.create(prepareProto(uriPrototype, globals));
        let web = Object.create(prepareProto(webPrototype, globals));
        let page = Object.create(prepareProto(pagePrototype, globals));
        let env = Object.create(prepareProto(perPageContext));

        // The page object also gets some properties copied from
        // the per-page context object
        page.language = perPageContext.locale;
        page.tags = Array.isArray(perPageContext.tags)
            ? [...perPageContext.tags] // defensive copy
            : perPageContext.tags;
        page.title = perPageContext.title;
        page.uri = perPageContext.url;

        // Now update the globals object to define each of the sub-objects
        // and the environment object as global variables
        globals.kuma = globals.Kuma = freeze(kuma);
        globals.MDN = globals.mdn = freeze(mdn);
        globals.string = globals.String = freeze(string);
        globals.wiki = globals.Wiki = freeze(wiki);
        globals.uri = globals.Uri = freeze(uri);
        globals.web = globals.Web = freeze(web);
        globals.page = globals.Page = freeze(page);
        globals.env = globals.Env = freeze(env);

        // Macros use the global template() method to excute other
        // macros. This is the one function that we can't just
        // implement on globalsPrototype because it needs acccess to
        // this.templates.
        globals.template = this._renderTemplate.bind(this);

        this.prototypeEnvironment = freeze(globals);
    }

    // A templating function that we define in the global environment
    // so that templates can invoke other templates. This is not part
    // of the public API of the class; it is for use by other templates
    async _renderTemplate(name, args) {
        return await this.templates.render(
            name,
            this.getExecutionContext(args)
        );
    }

    // Get a customized environment object that is specific to a single
    // macro on a page by including the arguments to be passed to that macro.
    getExecutionContext(args) {
        let context = Object.create(this.prototypeEnvironment);

        // Make a defensive copy of the arguments so that macros can't
        // modify the originals. Use an empty array if no args provided.
        args = args ? [...args] : [];

        // The arguments are either all strings, or there is a single
        // JSON-compatible object. If it is an object, we need to protect it
        // against modifications.
        if (typeof args[0] === 'object') {
            args[0] = JSON.parse(JSON.stringify(args[0]));
        }

        // The array of arguments will be available to macros as the
        // globals "arguments" and "$$". Individual arguments will be $0,
        // $1 and so on.
        context['arguments'] = context['$$'] = args;
        for (let i = 0; i < args.length; i++) {
            context['$' + i] = args[i];
        }

        // Set any unused arguments up to $9 to the empty string
        // NOTE: old KumaScript went up to $99, but we don't have any
        // macros that use two digit argument numbers
        for (let i = args.length; i < 10; i++) {
            context['$' + i] = '';
        }

        return context;
    }
}

module.exports = Environment;
