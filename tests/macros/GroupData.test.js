/**
 * @prettier
 */

const { itMacro, describeMacro } = require('./utils');

/**
 * Different strings in GroupData objects have different sets of
 * permitted characters.
 */
const PERMITTED_CHARACTERS = {
    group: /^[\w ()-]+$/,
    overview: /^[\w ()-]+$/,
    interface: /^[A-Z][\w.]+$/,
    property: /^[\w.]+$/,
    method: /^[\w.()]+$/,
    event: /^[\w()]+$/,
    dictionary: /^\w+$/,
    callback: /^\w+$/,
    type: /^\w+$/,
    guideTitle: /^[\w .,]+$/,
    guideUrl: /^\/[\w-.~/]+$/,
};

/**
 * Properties that are allowed in a group
 */
const PERMITTED_GROUP_PROPERTIES = [
    'overview',
    'interfaces',
    'methods',
    'properties',
    'dictionaries',
    'callbacks',
    'types',
    'events',
    'guides',
];

/**
 * Properties that must be present in a group
 */
const MANDATORY_GROUP_PROPERTIES = [
    'interfaces',
    'methods',
    'properties',
    'events',
];

/**
 * Properties that are allowed in a guide
 */
const PERMITTED_GUIDE_PROPERTIES = [
    // Enforce newline
    'title',
    'url',
];

/**
 * Properties that must be present in a guide
 */
const MANDATORY_GUIDE_PROPERTIES = [
    // Enforce newline
    'title',
    'url',
];

/**
 * Check that `obj` contains:
 * - only the properties in `permitted`
 * - all the properties in `mandatory`
 *
 * @param {object} obj
 * @param {string[]} permitted
 * @param {string[]} mandatory
 */
function checkProperties(obj, permitted, mandatory) {
    let props = Object.keys(obj);
    for (let prop of props) {
        expect(permitted).toContain(prop);
    }
    for (let prop of mandatory) {
        expect(props).toContain(prop);
    }
}

/**
 * Check that `strings` is an array of strings,
 * and that each string matches the given regex.
 *
 * @param {string[]} strings
 * @param {RegExp} permitted
 */
function checkStringArray(strings, permitted) {
    expect(Array.isArray(strings)).toBe(true);
    for (let string of strings) {
        expect(string).toMatch(permitted);
    }
    return JSON.stringify(strings) !== JSON.stringify([...strings].sort());
}

/**
 * Performs basic validation of the GroupData JSON object
 *
 * @param {string} groupDataJson
 */
function checkGroupData(groupDataJson) {
    const groupData = JSON.parse(groupDataJson);

    // GroupData is an array containing exactly one object
    expect(Array.isArray(groupData)).toBe(true);
    expect(groupData.length).toBe(1);

    // the one object has one property for each group
    // the property's key is the group name
    const groupNames = Object.keys(groupData[0]);

    /** @type {string[]} */
    let unsortedGroups = [];

    for (let groupName of groupNames) {
        // the group name contains only the permitted characters
        expect(groupName).toMatch(PERMITTED_CHARACTERS.group);

        const group = groupData[0][groupName];

        // the group has the correct properties
        checkProperties(
            group,
            PERMITTED_GROUP_PROPERTIES,
            MANDATORY_GROUP_PROPERTIES
        );

        let groupUnsorted = false;

        // string arrays contain only their permitted characters
        groupUnsorted =
            checkStringArray(
                group.interfaces,
                PERMITTED_CHARACTERS.interface
            ) || groupUnsorted;
        groupUnsorted =
            checkStringArray(group.properties, PERMITTED_CHARACTERS.property) ||
            groupUnsorted;
        groupUnsorted =
            checkStringArray(group.methods, PERMITTED_CHARACTERS.method) ||
            groupUnsorted;
        groupUnsorted =
            checkStringArray(group.events, PERMITTED_CHARACTERS.event) ||
            groupUnsorted;

        // dictionaries, callbacks, and types are optional
        if (group.dictionaries) {
            groupUnsorted =
                checkStringArray(
                    group.dictionaries,
                    PERMITTED_CHARACTERS.dictionary
                ) || groupUnsorted;
        }
        if (group.callbacks) {
            groupUnsorted =
                checkStringArray(
                    group.callbacks,
                    PERMITTED_CHARACTERS.callback
                ) || groupUnsorted;
        }
        if (group.types) {
            groupUnsorted =
                checkStringArray(group.types, PERMITTED_CHARACTERS.type) ||
                groupUnsorted;
        }

        // overview is optional
        if (group.overview) {
            // if present it is an array containing 1 element
            expect(Array.isArray(group.overview)).toBe(true);
            expect(group.overview.length).toBe(1);
            // ... and the element must contain only the permitted characters
            expect(group.overview[0]).toMatch(PERMITTED_CHARACTERS.overview);
        }

        // guides is optional
        if (group.guides) {
            // if present it is an array of guides
            expect(Array.isArray(group.guides)).toBe(true);
            for (let guide of group.guides) {
                // check that the guide has the correct properties
                checkProperties(
                    guide,
                    PERMITTED_GUIDE_PROPERTIES,
                    MANDATORY_GUIDE_PROPERTIES
                );

                // these are both strings that contain only the permitted characters
                expect(guide.title).toMatch(PERMITTED_CHARACTERS.guideTitle);
                expect(guide.url).toMatch(PERMITTED_CHARACTERS.guideUrl);
            }
        }

        if (groupUnsorted) {
            unsortedGroups.push(groupName);
        }
    }

    // TODO: Have this fail the test
    if (
        unsortedGroups.length ||
        JSON.stringify(groupNames) !== JSON.stringify([...groupNames].sort())
    ) {
        let unsortedMessage = 'GroupData is unsorted';
        if (unsortedGroups.length) {
            unsortedMessage += '\nUnsorted APIs: ';
            unsortedMessage += JSON.stringify(unsortedGroups, null, 2);
        }
        console.warn(unsortedMessage);
    }
}

describeMacro('GroupData', () => {
    itMacro('Validate GroupData JSON', macro => {
        return macro.call().then(checkGroupData);
    });
});
