/**
 * @prettier
 */
const Environment = require('../../src/environment.js');
const Templates = require('../../src/templates.js');

const MAX_DEPTH = 4;

function mockjson(name, depth = 0) {
    return new Proxy(
        {},
        {
            get(o, p, proxy) {
                if (p in o) {
                    return o[p];
                }

                if (p === 'length') {
                    return depth >= MAX_DEPTH ? 0 : 3;
                }
                if (p === 'locale') {
                    return 'en-US';
                }
                if (p === 'toString') {
                    return () => name;
                }
                if (p === 'forEach') {
                    if (depth >= MAX_DEPTH) {
                        return () => {};
                    }
                    return f => {
                        f(mockjson(`${name}.0`, depth + 1), 0, proxy);
                        f(mockjson(`${name}.1`, depth + 1), 1, proxy);
                        f(mockjson(`${name}.2`, depth + 1), 2, proxy);
                    };
                } else if (p === Symbol.iterator) {
                    if (depth >= MAX_DEPTH) {
                        return function*() {};
                    }
                    return function*() {
                        yield mockjson(`${name}[0]`, depth + 1);
                        yield mockjson(`${name}[1]`, depth + 1);
                        yield mockjson(`${name}[2]`, depth + 1);
                    };
                }
                if (p === 'then') {
                    return undefined;
                }
                if (p in String.prototype) {
                    return String.prototype[p];
                }
                if (p in Array.prototype) {
                    return Array.prototype[p];
                }
                if (p in Object.prototype) {
                    return Object.prototype[p];
                }

                let value;
                if (p === Symbol.toPrimitive) {
                    value = hint => {
                        if (hint === 'number') {
                            return [...name]
                                .map(s => s.charCodeAt(0))
                                .reduce((x, y) => x + y);
                        }
                        return `|:${name}:|`;
                    };
                } else if (typeof p === 'string') {
                    value = mockjson(name + '.' + p, depth + 1);
                } else {
                    // Deal with symbol properties, but don't make a record of them
                    return Reflect.get(o, p, proxy);
                }
                o[p] = value;
                return o[p];
            },

            ownKeys(o) {
                if (depth < MAX_DEPTH) {
                    if (!(0 in o)) o[0] = mockjson(`${name}[0]`, depth + 1);
                    if (!(1 in o)) o[1] = mockjson(`${name}[1]`, depth + 1);
                    if (!(2 in o)) o[2] = mockjson(`${name}[2]`, depth + 1);
                }
                return Reflect.ownKeys(o);
            }
        }
    );
}

let pageContext = {
    locale: 'en-US',
    url: 'https://developer.mozilla.org/en-US/docs/Web/Fake',
    title: 'Fake page title',
    slug: 'Web/Fake',
    files: [{ filename: 'arg0', url: 'fake url for file 0' }],
    cache_control: '',
    interactive_examples: { base_url: 'fake_interactive_examples_url' },
    live_samples: { base_url: 'fake_live_samples_url' }
};

let templates = new Templates(__dirname + '/../../macros/');
let environment = new Environment(pageContext, templates, true);

let mocks = environment.prototypeEnvironment;

mocks.mdn.fetchJSONResource = mocks.MDN.fetchJSONResource = async url => {
    return Promise.resolve(mockjson(`[${url}]`));
};
mocks.mdn.fetchHTTPResource = mocks.MDN.fetchHTTPResource = async url => {
    return Promise.resolve(`["Content of ${url}"]`);
};
mocks.page.hasTag = () => {
    return true;
};
mocks.wiki.getPage = async url => {
    return Promise.resolve(mockjson(`[${url}]`));
};

async function snapshot(macroName, args) {
    let context = environment.getExecutionContext(args);
    return await templates.render(macroName, context);
}

module.exports = snapshot;
