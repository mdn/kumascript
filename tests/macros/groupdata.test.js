/**
 * @prettier
 */

const { itMacro, describeMacro } = require('./utils');

/*
Different strings in GroupData objects have different sets of
permitted characters.
*/
const permittedCharacters = {
  group:      /^[\w ()-]+$/,
  overview:   /^[\w ()-]+$/,
  interface:  /^[\w.]+$/,
  property:   /^[\w.]+$/,
  method:     /^[\w.()]+$/,
  event:      /^[\w()]+$/,
  guideTitle: /^[\w .,]+$/,
  guideUrl:   /^\/[\w-.~/]+$/
}

/*
Given `strings`, which should be an array of strings,
and `characters`, which is a regular expression defining
the permitted characters in each string, this checks
that `strings` really is an array and that the strings
it contains contain only the permitted characters.
*/
function checkStringArray(strings, characters) {
  expect(strings).toBeDefined();
  expect(Array.isArray(strings)).toBe(true);
  for (let string of strings) {
    expect(characters.test(string)).toBe(true);
  }
}

/*
Performs basic validation of the GroupData JSON object
*/
function checkGroupData(groupDataJson) {

  const groupData = JSON.parse(groupDataJson);

  // GroupData is an array containing exactly one object
  expect(Array.isArray(groupData)).toBe(true);
  expect(groupData.length).toBe(1);

  // the one object has one property for each group
  // the property's key is the group name
  const groupNames = Object.keys(groupData[0]);

  for (let groupName of groupNames) {
    // the group name contains only the permitted characters
    expect(permittedCharacters.group.test(groupName)).toBe(true);
    group = groupData[0][groupName];

    // the group contains interfaces, properties, methods and events
    // they are all string arrays and contain only the permitted characters
    checkStringArray(group.interfaces, permittedCharacters.interface);
    checkStringArray(group.properties, permittedCharacters.property);
    checkStringArray(group.methods, permittedCharacters.method);
    checkStringArray(group.events, permittedCharacters.event);

    // overview is optional
    if (group.overview) {
      // if present it must contain only the permitted characters
      expect(permittedCharacters.overview.test(group.overview)).toBe(true);
    }

    // guides is optional
    if (group.guides) {
      // if present it is an array...
      expect(Array.isArray(group.guides)).toBe(true);
      for (let guide of group.guides) {
        // ...containing objects that have title and url properties
        // these are both strings that contain only the permitted characters
        expect(guide.title).toBeDefined();
        expect(permittedCharacters.guideTitle.test(guide.title)).toBe(true);
        expect(guide.url).toBeDefined();
        expect(permittedCharacters.guideUrl.test(guide.url)).toBe(true);
      }
    }

  }
}

describeMacro('GroupData', function() {
    itMacro('Validate GroupData JSON', function(macro) {
        return macro.call().then(checkGroupData);
    });
});
