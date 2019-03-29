/**
 * @prettier
 */

async function asyncReplace(source, pattern, asyncReplacer) {
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
}

function StartsWith(str, sub_str) {
    return ('' + str).indexOf(sub_str) === 0;
}

function EndsWith(str, suffix) {
    str = '' + str;
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function Contains(str, sub_str) {
    return ('' + str).indexOf(sub_str) !== -1;
}

function Deserialize(str) {
    return JSON.parse(str);
}

/* Check if first character in string is a decimal digit. */
function IsDigit(str) {
    return /^\d/.test('' + str);
}

/* Check if first character in string is an alphabetic character. */
function IsLetter(str) {
    return /^[a-zA-Z]/.test('' + str);
}

function Serialize(val) {
    return JSON.stringify(val);
}

function Substr(str, start, length) {
    if (length) {
        return ('' + str).substr(start, length);
    } else {
        return ('' + str).substr(start);
    }
}

function toLower(str) {
    return ('' + str).toLowerCase();
}

function ToUpperFirst(str) {
    return ('' + str).charAt(0).toUpperCase() + ('' + str).slice(1);
}

function Trim(str) {
    return ('' + str).trim();
}

function Remove(str, index, count) {
    var out = '' + str.substring(0, Number(index));
    if (count) {
        out += '' + str.substring(Number(index) + Number(count));
    }
    return out;
}

function Replace(str, from, to) {
    return ('' + str).replace(RegExp(from, 'g'), to);
}

function Join(list, sep) {
    return list.join(sep);
}

function Length(str) {
    return ('' + str).length;
}

module.exports = {
    asyncReplace,
    StartsWith,
    EndsWith,
    Contains,
    Deserialize,
    IsDigit,
    IsLetter,
    Serialize,
    Substr,
    toLower,
    ToUpperFirst,
    Trim,
    Remove,
    Replace,
    Join,
    Length
};
