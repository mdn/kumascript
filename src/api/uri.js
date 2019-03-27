/**
 * @prettier
 */

/**
 * Encode text as a URI component.
 *
 * FIXME: This actually calls `encodeURI` instead of `encodeURIComponent`.
 *
 * @param {string} str
 * @return {string}
 */
function encode(str) {
    return encodeURI(str);
}

module.exports = {
    encode
};
