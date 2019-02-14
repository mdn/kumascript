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

const cache = require('./cache.js');
const config = require('./config.js');

// Utility functions are collected here. These are functions that are used
// by the exported functions below. Some of them are themselves exported.
const util = {
    // Fill in undefined properties in object with values from the
    // defaults objects, and return the object. As soon as the property is
    // filled, further defaults will have no effect.
    //
    // Stolen from http://underscorejs.org/#defaults
    defaults(obj, ...sources) {
        for (let source of sources) {
            for (var prop in source) {
                if (obj[prop] === void 0) obj[prop] = source[prop];
            }
        }
        return obj;
    },
    /**
     * This function takes a function argument that asynchronously
     * computes a value and passes that value to a callback
     * function. It returns a Promise-based version of f. Note that
     * f() calls its callback with a single success value and there is
     * no provision for reporting async errors.  That is not ideal,
     * but it is the legacy system that the cacheFn() and
     * cacheFnIgnoreCacheControl() functions below use.
     *
     * @template T
     * @param {function(function((T|PromiseLike<T>)):void):void} f
     * @return {function():Promise<T>}
     */
    promiseify(f) {
        return function() {
            return new Promise((resolve, reject) => {
                try {
                    f(resolve);
                } catch (e) {
                    reject(e);
                }
            });
        };
    },

    async cacheFn(key, cacheControl, computeValue) {
        let skipCache = cacheControl === 'no-cache';
        return await cache(key, util.promiseify(computeValue), skipCache);
    },

    async cacheFnIgnoreCacheControl(key, computeValue) {
        return await cache(key, util.promiseify(computeValue));
    },

    /**
     * Prepares the provided path by looking for legacy paths that
     * need to be prefixed by "/en-US/docs", as well as ensuring
     * it starts with a "/" and replacing its spaces (whether
     * encoded or not) with underscores.
     *
     * @param {string} path
     * @return {string}
     */
    preparePath(path) {
        if (path.charAt(0) != '/') {
            path = '/' + path;
        }
        if (path.indexOf('/docs') == -1) {
            // HACK: If this looks like a legacy wiki URL, throw /en-US/docs
            // in front of it. That will trigger the proper redirection logic
            // until/unless URLs are corrected in templates
            path = '/en-US/docs' + path;
        }
        return path.replace(/ |%20/gi, '_');
    },

    // Given a path, attempt to construct an absolute URL to the wiki.
    buildAbsoluteURL(path) {
        return util.apiURL(util.preparePath(path));
    },

    /**
     * Build an absolute URL from the given "path" that uses the
     * protocol and host of the document service rather than those
     * of the public-facing website. If the "path" argument is an
     * absolute URL, everything will be discarded except its "path"
     * and "hash" attributes (as defined by "url.parse()"). If the
     * "path" argument is not provided or is falsy, the base URL of
     * the document service will be returned.
     *
     * @param {string} [path]
     * @return {string}
     */
    apiURL(path) {
        if (!path) {
            return config.documentURL;
        }
        let parts = url.parse(encodeURI(path));
        path = parts.path + (parts.hash ? parts.hash : '');
        return url.resolve(config.documentURL, path);
    },

    /**
     * #### htmlEscape(string)
     * Escape the given string for HTML inclusion.
     *
     * @param {string} [s]
     * @return {string}
     */
    htmlEscape(s) {
        return ('' + s)
            .replace(/&/g, '&amp;')
            .replace(/>/g, '&gt;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    },

    /**
     * @param {string} a
     * @return {string}
     */
    escapeQuotes(a) {
        var b = '';
        for (var i = 0, len = a.length; i < len; i++) {
            var c = a[i];
            if (c == '"') {
                c = '&quot;';
            }
            b += c;
        }
        return b.replace(/(<([^>]+)>)/gi, '');
    },

    /**
     * @param {string} str
     * @return {string}
     */
    spacesToUnderscores(str) {
        var re1 = / /gi;
        var re2 = /%20/gi;
        str = str.replace(re1, '_');
        return str.replace(re2, '_');
    }
};

// The properties of this object will be globals in the macro
// execution environment.
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

const mdnPrototype = {
    /**
     * Given a set of names and a corresponding list of values, apply HTML
     * escaping to each of the values and return an object with the results
     * associated with the names.
     *
     * @param {string[]} names
     * @param {string[]} args
     * @return {Record<string, string>}
     */
    htmlEscapeArgs(names, args) {
        var e = {};
        names.forEach(function(name, idx) {
            e[name] = util.htmlEscape(args[idx]);
        });
        return e;
    },

    /**
     * Given a set of strings like this:
     *     { "en-US": "Foo", "de": "Bar", "es": "Baz" }
     * Return the one which matches the current locale.
     *
     * @param {Record<string, string>} strings
     * @return {string}
     */
    localString(strings) {
        var lang = this.env.locale;
        if (!(lang in strings)) lang = 'en-US';
        return strings[lang];
    },

    /**
     * Given a set of string maps like this:
     *     { "en-US": {"name": "Foo"}, "de": {"name": "Bar"} }
     * Return a map which matches the current locale, falling back to en-US
     * properties when the localized map contains partial properties.
     *
     * @param {Record<string, Record<string, string>>} maps
     * @return {Record<string, string>}
     */
    localStringMap(maps) {
        var lang = this.env.locale;
        var defaultMap = maps['en-US'];
        if (lang == 'en-US' || !(lang in maps)) {
            return defaultMap;
        }
        var localizedMap = maps[lang];
        var map = {};
        for (var name in defaultMap) {
            if (name in localizedMap) {
                map[name] = localizedMap[name];
            } else {
                map[name] = defaultMap[name];
            }
        }
        return map;
    },

    /**
     * Given a set of strings like this:
     *
     *    {
     *      "hello": { "en-US": "Hello!", "de": "Hallo!" },
     *      "bye": { "en-US": "Goodbye!", "de": "Auf Wiedersehen!" }
     *    }
     *
     * Returns the one, which matches the current locale.
     *
     * @example
     *    getLocalString({"hello": {"en-US": "Hello!", "de": "Hallo!"}}, "hello");
     *    // => "Hallo!" (in case the locale is 'de')
     *
     * @param {Record<string, Record<string, string>>} strings
     * @param {string} key
     * @return {string}
     */
    getLocalString(strings, key) {
        if (!strings.hasOwnProperty(key)) {
            return key;
        }

        var lang = this.env.locale;
        if (!(lang in strings[key])) {
            lang = 'en-US';
        }

        return strings[key][lang];
    },

    /**
     * Given a string, replaces all placeholders outlined by
     * $1$, $2$, etc. (i.e. numeric placeholders) or
     * $firstVariable$, $secondVariable$, etc. (i.e. string placeholders)
     * within it.
     *
     * If numeric placeholders are used, the 'replacements' parameter
     * must be an array. The number within the placeholder indicates
     * the index within the replacement array starting by 1.  If
     * string placeholders are used, the 'replacements' parameter must
     * be an object. Its property names represent the placeholder
     * names and their values the values to be inserted.
     *
     * @example
     *   replacePlaceholders("$1$ $2$, $1$ $3$!",
     *                       ["hello", "world", "contributor"])
     * // => "hello world, hello contributor!"
     *
     * @example
     *   replacePlaceholders("$hello$ $world$, $hello$ $contributor$!",
     *       {hello: "hallo", world: "Welt", contributor: "Mitwirkender"})
     * // => "hallo Welt, hallo Mitwirkender!"
     *
     * @param {string} string
     * @param {Record<string, string>} replacements
     * @return {string}
     */
    replacePlaceholders(string, replacements) {
        function replacePlaceholder(placeholder) {
            var index = placeholder.substring(1, placeholder.length - 1);
            if (!Number.isNaN(Number(index))) {
                index--;
            }
            return index in replacements ? replacements[index] : '';
        }

        return string.replace(/\$\w+\$/g, replacePlaceholder);
    },

    /**
     * Given a string, escapes all quotes within it.
     */
    escapeQuotes: util.escapeQuotes,

    /**
     * Accepts a relative URL or an attachment object
     * Returns the content of a given file.
     *
     * @param {string|{url:string}} fileObjOrUrl
     */
    async getFileContent(fileObjOrUrl) {
        var url = fileObjOrUrl.url || fileObjOrUrl;
        if (!url) return '';

        let base_url = '';

        // New file urls include attachment host, so we don't need to
        // prepend it
        var fUrl = url.parse(url);
        if (!fUrl.host) {
            var p = url.parse(this.env.url, true);
            base_url = p.protocol + '//' + p.host;
        }
        url = base_url + url;
        let key = 'kuma:get_attachment_content:' + url.toLowerCase();
        return await util.cacheFn(key, this.env.cache_control, next => {
            try {
                request(
                    {
                        method: 'GET',
                        headers: {
                            'Cache-Control': this.env.cache_control
                        },
                        url: url
                    },
                    function(err, resp, body) {
                        if (resp && 200 == resp.statusCode) {
                            next(body);
                        } else if (err) {
                            next(null);
                        }
                    }
                );
            } catch (e) {
                next('error: ' + e);
            }
        });
    },
    /**
     * Fetch an HTTP resource with JSON representation, parse the JSON and
     * return a JS object.
     *
     * @param {string} url
     * @param {object} [opts]
     */
    async fetchJSONResource(url, opts) {
        opts = util.defaults(opts || {}, {
            headers: {
                'Cache-Control': this.env.cache_control,
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        });
        return JSON.parse(await this.MDN.fetchHTTPResource(url, opts));
    },

    /**
     * Fetch an HTTP resource, return the response body.
     *
     * @param {string} url
     * @param {object} [opts]
     * @return {Promise<string>}
     */
    async fetchHTTPResource(url, opts) {
        opts = util.defaults(opts || {}, {
            method: 'GET',
            headers: {
                'Cache-Control': this.env.cache_control,
                Accept: 'text/plain',
                'Content-Type': 'text/plain'
            },
            url: url,
            cache_key: 'kuma:http_resource:' + url.toLowerCase(),
            ignore_cache_control: false
        });

        function to_cache(next) {
            try {
                request(opts, (error, response, body) => {
                    if (error) {
                        next(null);
                    } else {
                        next(body);
                    }
                });
            } catch (e) {
                next(null);
            }
        }

        if (opts.ignore_cache_control) {
            return await util.cacheFnIgnoreCacheControl(
                opts.cache_key,
                to_cache
            );
        } else {
            return await util.cacheFn(
                opts.cache_key,
                this.env.cache_control,
                to_cache
            );
        }
    },

    /**
     * @see http://www.bugzilla.org/docs/4.2/en/html/api/Bugzilla/WebService/Bug.html#search
     *
     * @param {string} query
     */
    async bzSearch(query) {
        /* Fix colon (":") encoding problems */
        query = query.replace(/&amp;/g, '&');
        query = encodeURI(query);
        query = query.replace(/&/g, '%26');
        var url =
            'https://bugzilla.mozilla.org/jsonrpc.cgi?method=Bug.search&params=' +
            query;
        var resource = await this.MDN.fetchJSONResource(url);
        return resource.result;
    },

    /**
     * Derive the site URL from the request URL
     *
     * @return {string}
     */
    siteURL() {
        var p = url.parse(this.env.url, true),
            site_url = p.protocol + '//' + p.host;
        return site_url;
    }
};

const stringPrototype = {
    /**
     * @param {string} source
     * @param {string|RegExp} pattern
     * @param {function(...any):Promise<string>} asyncReplacer
     * @return {string}
     */
    async asyncReplace(source, pattern, asyncReplacer) {
        // Find all the matches, replace with "", and discard the result
        let matches = [];
        source.replace(pattern, (...match) => {
            matches.push(match);
            return '';
        });

        // Now loop through those matches and create an array of alternating
        // string and Promise<string> elements corresponding to the unreplaced
        // parts of the osurce string and the async replacements for the
        // replaced parts
        let parts = [];
        let lastMatchEnd = 0;
        for (let i = 0; i < matches.length; i++) {
            let match = matches[i];
            let matchIndex = match[match.length - 2];
            // Add any text before the first match to the parts array
            if (matchIndex > lastMatchEnd) {
                parts.push(source.substring(lastMatchEnd, matchIndex));
            }
            lastMatchEnd = matchIndex + match[0].length;

            // Now push a promise on the stack for this match.
            // Note that we don't await it now; we'll do that with
            // Promise.all(). Note that if the replace function isn't
            // actually async and just returns a string, that is okay, too.
            parts.push(asyncReplacer(...match));
        }
        // If there is any non-matched text at the end of the strings, add
        // that to the parts array as well
        if (lastMatchEnd < source.length) {
            parts.push(source.substring(lastMatchEnd));
        }

        // Now wait for all the promises to resolve
        let strings = await Promise.all(parts);

        // Join it all together and return it
        return strings.join('');
    },

    /**
     * @param {string} str
     * @param {string} sub_str
     * @return {boolean}
     */
    StartsWith(str, sub_str) {
        return ('' + str).indexOf(sub_str) === 0;
    },

    /**
     * @param {string} str
     * @param {string} suffix
     * @return {boolean}
     */
    EndsWith(str, suffix) {
        str = '' + str;
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    },

    /**
     * @param {string} str
     * @param {string} sub_str
     * @return {boolean}
     */
    Contains(str, sub_str) {
        return ('' + str).indexOf(sub_str) !== -1;
    },

    /**
     * @param {string} str
     * @return {any}
     */
    Deserialize(str) {
        return JSON.parse(str);
    },

    /**
     * Check if first character in string is a decimal digit.
     *
     * @param {string} str
     * @return {boolean}
     */
    IsDigit(str) {
        return /^\d/.test('' + str);
    },

    /**
     * Check if first character in string is an alphabetic character.
     *
     * @param {string} str
     * @return {boolean}
     */
    IsLetter(str) {
        return /^[a-zA-Z]/.test('' + str);
    },

    /**
     * @param {string} val
     * @return {string}
     */
    Serialize(val) {
        return JSON.stringify(val);
    },

    /**
     * @param {string} str
     * @param {number} start
     * @param {number} [length]
     * @return {string}
     */
    Substr(str, start, length) {
        if (length) {
            return ('' + str).substr(start, length);
        } else {
            return ('' + str).substr(start);
        }
    },

    /**
     * @param {string} str
     * @return {string}
     */
    toLower(str) {
        return ('' + str).toLowerCase();
    },

    /**
     * @param {string} str
     * @return {string}
     */
    ToUpperFirst(str) {
        return ('' + str).charAt(0).toUpperCase() + ('' + str).slice(1);
    },

    /**
     * @param {string} str
     * @return {string}
     */
    Trim(str) {
        return ('' + str).trim();
    },

    /**
     * @param {string} str
     * @param {number} index
     * @param {number} [count]
     * @return {string}
     */
    Remove(str, index, count) {
        var out = '' + str.substring(0, Number(index));
        if (count) {
            out += '' + str.substring(Number(index) + Number(count));
        }
        return out;
    },

    /**
     * @param {string} str
     * @param {string|RegExp} from
     * @param {string} to
     * @return {string}
     */
    Replace(str, from, to) {
        return ('' + str).replace(RegExp(from, 'g'), to);
    },

    /**
     * @param {any[]} list
     * @param {string} [sep]
     * @return {string}
     */
    Join(list, sep) {
        return list.join(sep);
    },

    /**
     * @param {string} str
     * @return {number}
     */
    Length(str) {
        return ('' + str).length;
    }
};

const wikiPrototype = {
    /**
     * Given a string, escape any quotes within it so it can be
     * passed to other functions.
     */
    escapeQuotes: util.escapeQuotes,

    /**
     * Check if the given wiki page exists.
     * This was "temporarily" disabled 7 years ago!
     *
     * @param {string} path
     * @return {true}
     */
    pageExists(/*path*/) {
        // Temporarily disabling this.
        // See: https://bugzilla.mozilla.org/show_bug.cgi?id=775590#c4
        return true;
    },

    /**
     * Retrieve the content of a document for inclusion,
     * optionally filtering for a single section.
     *
     * Doesn't support the revision parameter offered by DekiScript
     *
     * @param {string} path
     * @param {string} [section]
     * @param {any} [revision]
     * @param {boolean} [show]
     * @param {number} [heading]
     * @param {boolean} ignore_cache_control
     * @return {Promise<string>}
     */
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

    /**
     * Returns the page object for the specified page.
     *
     * @param {string} path
     * @return {Promise<object>}
     */
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

    /**
     * Retrieve the full uri of a given wiki page.
     *
     * @param {string} path
     * @param {string} query
     * @return {string}
     */
    uri(path, query) {
        const parts = url.parse(this.env.url);
        var out = parts.protocol + '//' + parts.host + util.preparePath(path);
        if (query) {
            out += '?' + query;
        }
        return out;
    },
    /**
     * Inserts a pages sub tree
     * if reverse is non-zero, the sort is backward
     * if ordered is true, the output is an <ol> instead of <ul>
     *
     * Special note: If ordered is true, pages whose locale differ from
     * the current page's locale are omitted, to work around misplaced
     * localizations showing up in navigation.
     *
     * @param {string} path
     * @param {number} depth
     * @param {boolean} self
     * @param {boolean} reverse
     * @param {boolean} ordered
     */
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
                        '</object></li>';
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
    /**
     * Encode text as a URI component.
     *
     * FIXME: This actually calls `encodeURI` instead of `encodeURIComponent`.
     *
     * @param {string} str
     * @return {string}
     */
    encode(str) {
        return encodeURI(str);
    }
};

const webPrototype = {
    /**
     * Insert a hyperlink.
     *
     * @param {string} uri
     * @param {string} [text]
     * @param {string} [title]
     * @param {string} [target]
     * @return {string}
     */
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

    /**
     * Given a URL, convert all spaces to underscores. This lets us fix a
     * bunch of places where templates assume this is done automatically
     * by the API, like MindTouch did.
     *
     * @param {string} str
     * @return {string}
     */
    spacesToUnderscores(str) {
        return util.spacesToUnderscores(str);
    }
};

const pagePrototype = {
    /**
     * Determines whether or not the page has the specified tag. Returns
     * true if it does, otherwise false. This is case-insensitive.
     *
     * @param {object} aPage
     * @param {string[]} [aPage.tags]
     * @param {string} aTag
     * @return {boolean}
     */
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

    /**
     * Optional path, defaults to current page
     *
     * Optional depth. Number of levels of children to include, 0
     * is the path page
     *
     * Optional self, defaults to false. Include the path page in
     * the results
     *
     * This is not called by any macros, and is only used here by
     * wiki.tree(), so we could move it to be part of that function.
     *
     * @param {string} [path]
     * @param {number} [depth]
     * @param {boolean} [self]
     * @return {Promise<any[]>}
     */
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

    /**
     * Optional path, defaults to current page
     *
     * Optional depth. Number of levels of children to include, 0
     * is the path page
     *
     * Optional self, defaults to false. Include the path page in
     * the results
     *
     * @param {string} [path]
     * @param {number} [depth]
     * @param {boolean} [self]
     * @return {Promise<any[]>}
     */
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

    /**
     * Flatten subPages list
     *
     * @param {any[]} pages
     * @return {any[]}
     */
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

    /**
     * @param {string} [path]
     * @return {Promise<any[]>}
     */
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
    /**
     * Initialize an environment object that will be used to render
     * all of the macros in one document or page. We pass in a context
     * object (which may come from HTTP request headers) that gives
     * details like the page title and URL. These are available to macros
     * through the global 'env' object, and some of the properties
     * are also copied onto the global 'page' object.
     *
     * Note that we don't use the Environment object directly when
     * executing macros. Instead call getExecutionContext(), supplying
     * the macro arguments list to get an object specific for executing
     * one macro.
     *
     * Note that we pass the Templates object when we create an Environment.
     * this is so that macros can recursively execute other named macros
     * in the same environment.
     *
     * The optional third argument is for use only by tests. Setting it to
     * true makes us not freeze the environment so that tests can stub out
     * methods in the API like mdn.fetchJSONResources
     *
     * @param {{locale:string,url:string}} perPageContext
     * @param {string} [perPageContext.slug]
     * @param {any} templates
     * @param {boolean} [testing]
     */
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
         *
         * @template {object} T
         * @param {T} o
         * @param {any} binding
         * @return {T}
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

        // Macros use the global template() method to execute other
        // macros. This is the one function that we can't just
        // implement on globalsPrototype because it needs access to
        // this.templates.
        globals.template = this._renderTemplate.bind(this);

        this.prototypeEnvironment = freeze(globals);
    }

    /**
     * A templating function that we define in the global environment
     * so that templates can invoke other templates. This is not part
     * of the public API of the class; it is for use by other templates
     *
     * @param {string} name
     * @param {any[]} [args]
     * @return {Promise<string>}
     */
    async _renderTemplate(name, args) {
        return await this.templates.render(
            name,
            this.getExecutionContext(args)
        );
    }

    /**
     * Get a customized environment object that is specific to a single
     * macro on a page by including the arguments to be passed to that macro.
     *
     * @param {any[]} [args]
     * @return {any}
     */
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
