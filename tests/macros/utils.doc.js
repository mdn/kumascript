// TODO: Consider using a TypeScript definition file for this.

/**
 * @typedef Macro
 * @property {typeof import('../../src/environment.js').prototype.prototypeEnvironment} ctx
 *           Give the test-case writer access to the macro's globals (ctx).
 *           For example, "macro.ctx.env.locale" can be manipulated to something
 *           other than 'en-US' or "macro.ctx.wiki.getPage" can be mocked
 *           using `jest.fn()` to avoid network calls.
 *
 * @property {(name: string, result: string) => void} mockTemplate
 *           When writing tests for a macro that invokes other macros with
 *           the `template()` function, you sometimes want to specify
 *           a mock return value for those other macros.
 *
 *           This function provides a much easier way to handle that than
 *           using `jest.fn()` directly.
 *
 *           To unmock a template result, simply call `unmockTemplate()`
 *           with the same `name`.
 *
 * @property {(name: string) => boolean} unmockTemplate
 *           Stops mocking the result of a `template()` function call.
 *
 * @property {(...args: any[]) => Promise<string>} call
 *           Use this function to make test calls on the named macro, if applicable.
 *           Its arguments become the arguments to the macro. It returns a promise.
 */

/**
 * @callback MacroTestFunction
 *
 * @param {Macro} macro The macro test object.
 * @return {void|PromiseLike<void>}
 */