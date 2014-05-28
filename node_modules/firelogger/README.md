# node-firelogger

Middleware for express/connect that supports the [FireLogger][] [protocol][flp]

[firelogger]: http://firelogger.binaryage.com/
[flp]: https://github.com/darwin/firelogger/wiki

## What?

[The FireLogger protocol][flp] lets you log messages in an HTTP response that
get encoded and delivered in headers, separately from the response body. So, no
matter what you're serving up (eg. HTML, CSS, JS, images), you can send log
messages along with it.

This is a quick and dirty bit of middleware for express/connect that lets you
send FireLogger messages in node.js servers. It was the product of an hour's
hacking and is very light on features or tests. But, someone might find it
handy.

## Usage

See [`example.js`][example] for a demo.

And, if you install the [Firebug][] and [FireLogger][fla] addons in Firefox,
visiting the demo server will yield something like the following when the
Logger tab is active in Firebug:

![Demo screenshot](http://dl.dropbox.com/u/2798055/Screenshots/0.png)

[example]: https://github.com/lmorchard/node-firelogger/blob/master/example.js
[firebug]: https://addons.mozilla.org/en-US/firefox/addon/firebug/
[fla]: https://addons.mozilla.org/en-US/firefox/addon/firelogger/

## How does it work?

See [the FireLogger protocol][flp] for more under-the-hood details. The gist is:

* Log message objects are bundled up in an array
* That array is encoded as JSON string in UTF-8
* That JSON string is encoded with Base64
* That Base64 string is carved up into lines
* Those lines are stuffed into HTTP headers
* Those HTTP headers are sent along with the response
* The FireLogger addon unpacks all the above and delivers the messages

Here's a peek behind the scenes:

    % node example.js &
    [1] 11181

    % curl -sD - 'http://localhost:9001/'; echo                        
    HTTP/1.1 200 OK
    X-Powered-By: Express
    Content-Type: text/html; charset=utf-8
    Content-Length: 13
    Connection: keep-alive

    Hello, world.

    % curl -sD - -H 'X-FireLogger: 1.2' 'http://localhost:9001/'
    HTTP/1.1 200 OK
    X-Powered-By: Express
    Content-Type: text/html; charset=utf-8
    Content-Length: 14
    FireLogger-9667348-0: eyJsb2dzIjpbeyJsZXZlbCI6ImRlYnVnIiwibWVzc2FnZSI6IkRlYnVnIG1lc3NhZ2UiLCJ0aW1
    FireLogger-9667348-1: lIjoiMTI6NTE6MjEgR01ULTA1MDAgKEVTVCkiLCJ0aW1lc3RhbXAiOjEzMzEzMTU0ODE1MzUwMD
    FireLogger-9667348-2: B9LHsibGV2ZWwiOiJ3YXJuaW5nIiwibWVzc2FnZSI6Ildhcm5pbmcgbWVzc2FnZSIsInRpbWUiO
    FireLogger-9667348-3: iIxMjo1MToyMSBHTVQtMDUwMCAoRVNUKSIsInRpbWVzdGFtcCI6MTMzMTMxNTQ4MTUzNjAwMH0s
    FireLogger-9667348-4: eyJuYW1lIjoibG9nZ2VyX25hbWUiLCJsZXZlbCI6ImluZm8iLCJtZXNzYWdlIjoiSW5mb3JtYXR
    FireLogger-9667348-5: pdmUgbWVzc2FnZSIsInRpbWUiOiIxMjo1MToyMSBHTVQtMDUwMCAoRVNUKSIsInRpbWVzdGFtcC
    FireLogger-9667348-6: I6MTMzMTMxNTQ4MTUzNjAwMH0seyJuYW1lIjoic29tZV9tb2R1bGUiLCJsaW5lbm8iOjEyMzQsI
    FireLogger-9667348-7: nBhdGhuYW1lIjoibW9kdWxlL215ZmlsZS5qcyIsImxldmVsIjoiZXJyb3IiLCJtZXNzYWdlIjoi
    FireLogger-9667348-8: U29tZXRoaW5nIHdlbnQgd3JvbmchIiwidGltZSI6IjEyOjUxOjIxIEdNVC0wNTAwIChFU1QpIiw
    FireLogger-9667348-9: idGltZXN0YW1wIjoxMzMxMzE1NDgxNTM2MDAwfSx7Im5hbWUiOiJteWxvZ2dlciIsImxldmVsIj
    FireLogger-9667348-10: oiY3JpdGljYWwiLCJtZXNzYWdlIjoiVGhpcyBpcyB0aGUgbG9uZyBmb3JtIiwidGltZSI6IjEyO
    FireLogger-9667348-11: jUxOjIxIEdNVC0wNTAwIChFU1QpIiwidGltZXN0YW1wIjoxMzMxMzE1NDgxNTM2MDAwfV19
    Connection: keep-alive

    Hello, world.

## License

MIT license, I guess?

I don't really care. Take the code, fork it, do what you want. Don't blame me
if it starts a fire. Say nice things about me, if you like.
