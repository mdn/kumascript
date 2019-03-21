/**
 * Utility functions are collected here. These are functions that are used
 * by the exported functions below. Some of them are themselves exported.
 *
 * @prettier
 */
const url = require('url');
const path = require('path');

const cache = require('../cache');
const config = require('../config');

/**
 * Fill in undefined properties in object with values from the
 * defaults objects, and return the object. As soon as the property is
 * filled, further defaults will have no effect.
 *
 * Stolen from http://underscorejs.org/#defaults
 *
 * @param {any} obj
 * @param {any[]} sources
 * @return {any}
 */
function defaults(obj, ...sources) {
	for (let source of sources) {
		for (var prop in source) {
			if (obj[prop] === void 0) obj[prop] = source[prop];
		}
	}
	return obj;
}

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
function promiseify(f) {
	return function() {
		return new Promise((resolve, reject) => {
			try {
				f(resolve);
			} catch (e) {
				reject(e);
			}
		});
	};
}

/**
 * @callback ComputeValue
 * @param {(value?: T | PromiseLike<T>) => void} resolve
 * @template T
 */

/**
 * @param {string} key
 * @param {string} cacheControl
 * @param {ComputeValue<string | null>} computeValue
 * @return {Promise<string>}
 */
async function cacheFn(key, cacheControl, computeValue) {
	let skipCache = cacheControl === 'no-cache';
	return await cache(key, util.promiseify(computeValue), skipCache);
}

/**
 * @param {string} key
 * @param {ComputeValue<string | null>} computeValue
 * @return {Promise<string>}
 */
async function cacheFnIgnoreCacheControl(key, computeValue) {
	return await cache(key, util.promiseify(computeValue));
}

/**
 * Prepares the provided path by looking for legacy paths that
 * need to be prefixed by "/en-US/docs", as well as ensuring
 * it starts with a "/" and replacing its spaces (whether
 * encoded or not) with underscores.
 *
 * @param {string} path
 * @return {string}
 */
function preparePath(path) {
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
}

/**
 * Given a path, attempt to construct an absolute URL to the wiki.
 *
 * @param {string} path
 * @return {string}
 */
function buildAbsoluteURL(path) {
	return util.apiURL(util.preparePath(path));
}

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
function apiURL(path) {
	if (!path) {
		return config.documentURL;
	}
	let parts = url.parse(encodeURI(path));
	path = parts.path + (parts.hash ? parts.hash : '');
	return url.resolve(config.documentURL, path);
}

/**
 * #### htmlEscape(string)
 * Escape the given string for HTML inclusion.
 *
 * @param {string} [s]
 * @return {string}
 */
function htmlEscape(s) {
	return ('' + s)
		.replace(/&/g, '&amp;')
		.replace(/>/g, '&gt;')
		.replace(/</g, '&lt;')
		.replace(/"/g, '&quot;');
}

/**
 * @param {string} a
 * @return {string}
 */
function escapeQuotes(a) {
	var b = '';
	for (var i = 0, len = a.length; i < len; i++) {
		var c = a[i];
		if (c == '"') {
			c = '&quot;';
		}
		b += c;
	}
	return b.replace(/(<([^>]+)>)/gi, '');
}

/**
 * @param {string} str
 * @return {string}
 */
function spacesToUnderscores(str) {
	var re1 = / /gi;
	var re2 = /%20/gi;
	str = str.replace(re1, '_');
	return str.replace(re2, '_');
}

/**
 * @param {string} macroPath The path of the macro
 * @return {NodeRequireFunction}
 */
function createRequire(macroPath) {
    return function require(id) {
        if (id && id[0] === '.') {
            id = path.resolve(macroPath, id);
        }

        return module.require(id);
    }
}

const util = module.exports = {
    defaults,
    promiseify,
    cacheFn,
    cacheFnIgnoreCacheControl,
    preparePath,
    buildAbsoluteURL,
    apiURL,
    htmlEscape,
    escapeQuotes,
    spacesToUnderscores,
    createRequire,
};
