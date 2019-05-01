/**
 * Test the API Overview page sidebar macro
 *
 * @prettier
 */

// Get necessary modules
const { assert, describeMacro, beforeEachMacro, itMacro } = require("./utils");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const GROUP_DATA = {
    "Fetch API": {
        "overview":   [ "Fetch API" ],
        "interfaces": [ "Body",
                        "Headers",
                        "Request",
                        "Response" ],
        "methods":    [ "WindowOrWorkerGlobalScope.fetch()" ],
    },
};

/**
 * @param {HTMLDetailsElement} details
 * @param {string} summary
 * @param {boolean} [isOpen]
 */
function testDetails(details, summary, isOpen = true) {
    assert.equal(details.open, isOpen);
    assert.equal(details.querySelector("summary").textContent, summary);
}

describeMacro("DefaultAPISidebar", () => {
    beforeEachMacro(macro => {
        let realTemplate = macro.ctx.template;
        macro.ctx.template = jest.fn(
            async name => {
                switch (String(name).toLowerCase()) {
                    case "groupdata":
                        return JSON.stringify([GROUP_DATA]);
                    default:
                        return realTemplate(name);
                }
            }
        );
    });

    itMacro("No arguments result in no sidebar", macro => {
        return assert.eventually.equal(macro.call(),
            '<span style="color: red;">DefaultAPISidebar must be called with the group parameter.</span>');
    });

    itMacro("Correct result", async macro => {
        macro.ctx.page.subpagesExpand = jest.fn(async _ => new Array());

        const result = await macro.call("Fetch API");
        const dom = JSDOM.fragment(result);

        // elements found in resulting DOM
        expect(dom.children.length).toBeGreaterThanOrEqual(1);
        assert.equal(dom.firstElementChild.localName, "section", "Top-level element isn't a section");
        assert(dom.firstElementChild.classList.contains("Quick_links"), "Section does not contain Quick_links class");

        /** @type {HTMLOListElement} */
        const list = dom.firstElementChild.firstElementChild;
        expect(list).toEqual(expect.anything());
        assert.equal(list.firstElementChild.textContent, "Fetch API");

        /** @type {NodeListOf<HTMLDetailsElement>} */
        let details = list.querySelectorAll("li > details");
        assert.equal(details.length, 2);

        testDetails(details[0], "Interfaces");
        testDetails(details[1], "Methods");
    });
});
