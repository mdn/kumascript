TODO
----

## v1.0

* Changes to Django Kuma to use the kumascript proxy
    * bug 730714: Caching in Kuma from kumascript
    * bug 730715: Caching in kumascript from Kuma
        * Loader abstraction class for document fetch, like template loader

* Honor Vary: header in response caching

* Build switchable response cache backends
    * locmem
    * memcache
    * filesystem
    * ?

* bug 733831: Report to user when kumascript has errors
    * Hidden panel? Session flash message?

* Problem with kuma page slugs containing spaces

* More closely consider issues of case-sensitivity in Kuma doc slugs and
  kumascript template names.

* bug 730707: Complete the MindTouch-compat API
    * Continue burning through most-used and longest-source MDN templates

* Make API libs wiki-editable? (eg. wiki, page, etc)
    * Shared libraries in wiki source?
    * Load from templates with a node.js-like require()?
        * kuma.require?

* General kumascript env and metadata vars in headers with JSON-encoded values?
    * For use by the API methods.
    * Examples:
        * x-kumascript-var-locale: "en-US"
        * x-kumascript-var-slug: "DOM/Storage"
        * x-kumascript-var-title: "DOM Storage"
        * x-kumascript-var-username: "lmorchard"
        * x-kumascript-var-tags: [ "JavaScript", "HTML5", "CSS" ]

* bug 731655: Handle language alternates in markup?
    * eg. span lang="en-US"; lang="zh-CN"; lang="*"
    * See also Template:JSInherits

* Move `run.js` to `bin/kumascript`
    * Add a bin section to package.json

* Think about relaxing Bleach on Template:* pages, just apply on output?

## Future

* Implement stale-while-revalidate for response caching?
    * <http://www.mnot.net/blog/2007/12/12/stale>
    * When cache content available but stale, respond with stale content but
      kick off a fresh response in the background for future requests.
    * Shortcircuit for Cache-Control: no_cache and max-age=0

* Use StatsD
    * execution time and counts for templates
    * execution time and counts for pages overall
    * no-cache and max-age=0 requests, 200 and 304 responses to measure cache usage
    * see also: https://github.com/mozilla/browserid/blob/dev/lib/statsd.js

* Scripting jig to allow template editing and macro evaluation on the fly
    * 3 panes: Template source editor, test document editor, execution result

* Move the test server base URLs to test-utils?
    * The constants are sprinkled hard-coded everywhere.
    * ie. http://localhost:9000 and http://localhost:9001

* Cascading template loaders
    * Like Django. If template not found, fall back to the next in the list
    * eg. HTTP -> file -> local hash

* Multiple template loaders, selectable by document type
    * Switch loader classes by Content-Type of template resource
    * Switch loader based on a custom header from the template resource GET

* Switch doc parser from PEG.js to [Jison][]?
    * Not that there's a known problem, but CoffeeScript uses Jison.
    * PEG grammar is much more readable, though, IMO.

* Revisit Sandbox, or some kind of process separation for executing templates
