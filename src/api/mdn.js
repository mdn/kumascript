/**
 * @prettier
 */
const URL = require('url');
const request = require('request');

const util = require('./util.js');

/**
 * Given a set of names and a corresponding list of values, apply HTML
 * escaping to each of the values and return an object with the results
 * associated with the names.
 *
 * @param {string[]} names
 * @param {string[]} args
 * @return {Object<string, string>}
 */
function htmlEscapeArgs(names, args) {
    /** @type {Object<string, string>} */
    var e = {};
    names.forEach(function(name, idx) {
        e[name] = util.htmlEscape(args[idx]);
    });
    return e;
}

/**
 * Given a set of strings like this:
 *     { "en-US": "Foo", "de": "Bar", "es": "Baz" }
 * Return the one which matches the current locale.
 *
 * @param {Object<string, string>} strings
 * @return {string}
 */
function localString(strings) {
    var lang = this.env.locale;
    if (!(lang in strings)) lang = 'en-US';
    return strings[lang];
}

/**
 * Given a set of string maps like this:
 *     { "en-US": {"name": "Foo"}, "de": {"name": "Bar"} }
 * Return a map which matches the current locale, falling back to en-US
 * properties when the localized map contains partial properties.
 *
 * @param {Object<string, Object<string, string>>} maps
 * @return {Object<string, string>}
 */
function localStringMap(maps) {
    var lang = this.env.locale;
    var defaultMap = maps['en-US'];
    if (lang == 'en-US' || !(lang in maps)) {
        return defaultMap;
    }
    var localizedMap = maps[lang];
    /** @type {Object<string, string>} */
    var map = {};
    for (var name in defaultMap) {
        if (name in localizedMap) {
            map[name] = localizedMap[name];
        } else {
            map[name] = defaultMap[name];
        }
    }
    return map;
}

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
 * @param {Object<string, Object<string, string>>} strings
 * @param {string} key
 * @return {string}
 */
function getLocalString(strings, key) {
    if (!strings.hasOwnProperty(key)) {
        return key;
    }

    var lang = this.env.locale;
    if (!(lang in strings[key])) {
        lang = 'en-US';
    }

    return strings[key][lang];
}

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
 * @param {Object<string | number, string>} replacements
 * @return {string}
 */
function replacePlaceholders(string, replacements) {
    /**
     * @param {string} placeholder
     */
    function replacePlaceholder(placeholder) {
        /** @type {string | number} */
        var index = placeholder.substring(1, placeholder.length - 1);
        if (!Number.isNaN(Number(index))) {
            index = Number(index) - 1;
        }
        return index in replacements ? replacements[index] : '';
    }

    return string.replace(/\$\w+\$/g, replacePlaceholder);
}

/**
 * Accepts a relative URL or an attachment object
 * Returns the content of a given file.
 *
 * @param {string|{url:string}} fileObjOrUrl
 */
async function getFileContent(fileObjOrUrl) {
    var file_url =
        typeof fileObjOrUrl === 'string' ? fileObjOrUrl : fileObjOrUrl.url;
    if (!file_url) return '';

    let base_url = '';

    // New file urls include attachment host, so we don't need to
    // prepend it
    var fUrl = URL.parse(file_url);
    if (!fUrl.host) {
        var p = URL.parse(this.env.url, true);
        base_url = p.protocol + '//' + p.host;
    }
    file_url = base_url + file_url;
    let key = 'kuma:get_attachment_content:' + file_url.toLowerCase();
    return await util.cacheFn(key, this.env.cache_control, next => {
        try {
            request(
                {
                    method: 'GET',
                    headers: {
                        'Cache-Control': this.env.cache_control
                    },
                    url: file_url
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
}

/**
 * Fetch an HTTP resource with JSON representation, parse the JSON and
 * return a JS object.
 *
 * @param {string} url
 * @param {object} [opts]
 */
async function fetchJSONResource(url, opts) {
    opts = util.defaults(opts || {}, {
        headers: {
            'Cache-Control': this.env.cache_control,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        }
    });
    return JSON.parse(await this.MDN.fetchHTTPResource(url, opts));
}

/**
 * Fetch an HTTP resource, return the response body.
 *
 * @param {string} url
 * @param {object} [opts]
 * @return {Promise<string>}
 */
async function fetchHTTPResource(url, opts) {
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
        return await util.cacheFnIgnoreCacheControl(opts.cache_key, to_cache);
    } else {
        return await util.cacheFn(
            opts.cache_key,
            this.env.cache_control,
            to_cache
        );
    }
}

/**
 * @see http://www.bugzilla.org/docs/4.2/en/html/api/Bugzilla/WebService/Bug.html#search
 *
 * @param {string} query
 */
async function bzSearch(query) {
    /* Fix colon (":") encoding problems */
    query = query.replace(/&amp;/g, '&');
    query = encodeURI(query);
    query = query.replace(/&/g, '%26');
    var url =
        'https://bugzilla.mozilla.org/jsonrpc.cgi?method=Bug.search&params=' +
        query;
    var resource = await this.MDN.fetchJSONResource(url);
    return resource.result;
}

/**
 * Derive the site URL from the request URL
 *
 * @return {string}
 */
function siteURL() {
    var p = URL.parse(this.env.url, true),
        site_url = p.protocol + '//' + p.host;
    return site_url;
}

module.exports = {
    htmlEscapeArgs,
    localString,
    localStringMap,
    getLocalString,
    replacePlaceholders,

    /**
     * Given a string, escapes all quotes within it.
     */
    escapeQuotes: util.escapeQuotes,
    getFileContent,
    fetchJSONResource,
    fetchHTTPResource,
    bzSearch,
    siteURL
};
