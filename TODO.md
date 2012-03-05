TODO
----

## v1.0

* Handle document "syntax errors" gracefully

* Handle template-not-found errors gracefully

* Problem with kuma page slugs containing spaces

* More closely consider issues of case-sensitivity in Kuma doc slugs and
  kumascript template names.

* Think about relaxing Bleach on Template:* pages, just apply on output?

* Changes to Django Kuma to use the kumascript proxy
    * Caching in Kuma from kumascript
    * Caching in kumascript from Kuma

* Report to user when kumascript has errors
    * Hidden panel? Session flash message?
    * Pass errors in HTTP headers? Special HTML block?

* Complete the MindTouch-compat API
    * Continue burning through most-used and longest-source MDN templates

* Make API libs wiki-editable? (eg. wiki, page, etc)
    * Shared libraries in wiki source?
    * Load from templates with a node.js-like require()?
        * kuma.require?

* Handle language alternates in markup?
    * eg. span lang="en-US"; lang="zh-CN"; lang="*"
    * See also Template:JSInherits

* Move `run.js` to `bin/kumascript`
    * Add a bin section to package.json

## Future

* Use StatsD
    * execution time and counts for templates
    * execution time and counts for pages overall
    * see also: https://github.com/mozilla/browserid/blob/dev/lib/statsd.js

* Scripting jig to allow template editing and macro evaluation on the fly
    * 3 panes: Template source editor, test document editor, execution result

* Move the test server base URLs to test-utils?
    * The constants are sprinkled hard-coded everywhere.
    * ie. http://localhost:9000 and http://localhost:9001

* Cascading template loaders
    * Like Django. If template not found, fall back to the next in the list
    * eg. HTTP -> file -> local hash

* Switch doc parser from PEG.js to [Jison][]?
    * Not that there's a known problem, but CoffeeScript uses Jison.
    * PEG grammar is much more readable, though, IMO.

* Revisit Sandbox, or some kind of process separation for executing templates
