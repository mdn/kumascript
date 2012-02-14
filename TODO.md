TODO
----

* Move the test server base URLs to test-utils?
    * The constants are sprinkled hard-coded everywhere.
    * ie. http://localhost:9000 and http://localhost:9001

* Handle document "syntax errors" gracefully

* Handle template-not-found errors gracefully

* Cascading template loaders
    * Like Django. If template not found, fall back to the next in the list
    * eg. HTTP -> file -> local hash

* Switch doc parser from PEG.js to [Jison][]?
    * Not that there's a known problem, but CoffeeScript uses Jison.
    * PEG grammar is much more readable, though, IMO.

* Revisit Sandbox, or some kind of process separation for executing templates
