# Temper

[![From bigpipe.io][from]](http://bigpipe.io)[![Version npm][version]](http://browsenpm.org/package/temper)[![Build Status][build]](https://travis-ci.org/bigpipe/temper)[![Dependencies][david]](https://david-dm.org/bigpipe/temper)[![Coverage Status][cover]](https://coveralls.io/r/bigpipe/temper?branch=master)

[from]: https://img.shields.io/badge/from-bigpipe.io-9d8dff.svg?style=flat-square
[version]: http://img.shields.io/npm/v/temper.svg?style=flat-square
[build]: http://img.shields.io/travis/bigpipe/temper/master.svg?style=flat-square
[david]: https://img.shields.io/david/bigpipe/temper.svg?style=flat-square
[cover]: http://img.shields.io/coveralls/bigpipe/temper/master.svg?style=flat-square

Temper is a small module that compiles your templates for server-side usage and
client-side usage through one single interface. This makes it easy to create
isomorphic JavaScript applications, which is awesome.

The following template engines are supported:

- **react-jsx**, automatically discovered by using the `.jsx` extension.
- **jade**, automatically discovered by using the `.jade` extension.
- **ejs**, automatically discovered by using the `.ejs` extension.
- **hogan.js**, automatically discovered by using the `.mustache` extension.
- **mustache**, automatically discovered by using the `.mustache` extension.
- **handlebars**, automatically discovered by using the `.mustache` extension.
- **html**, automatically discovered by using the `.html` extension.

As you can see from the list above, we support multiple version engines for the
`mustache` extension. You can supply your preference through the API. If no
preference is given it will iterate over the template engines and the one that
is successfully required will be used automatically.

### Installation

Temper is distributed through npm:

```
npm install --save temper
```

### Usage

Temper doesn't depend on any template engines so you need to install these your
self. For these examples I'm going to assume that you have `jade` installed as
template engine. Run `npm install --save jade` if this is not the case.

Initialising temper is quite simple:

```js
'use strict';

var Temper = require('temper')
  , temper = new Temper();
```

The `Temper` constructor allows the following options:

- `cache` should we cache the compiled template, this defaults to `true` if
  `NODE_ENV` is set to `production`. You usually want to have this disabled during
  development so you can see the changes in your template without having to
  restart your node process.

The following methods can be used to interact with `temper`:

##### temper.fetch(file, [engine])

The `temper.fetch` method allows you to pre-compile your template file. This
is advised as requiring modules and reading files is done synchronous. Simply
call this method with a file location and an option engine argument.

Temper will try it's best to automatically discover template engines based on
file extensions, but sometimes this is impossible. There are tons of `mustache`
compatible template engines and we cannot figure out which one you want based on
the extension. But for template languages such as `jade` it's quite simple.

```js
var data = temper.prefetch('/file/path/to/template.jade');
var data = temper.prefetch('/file/path/to/template.mustache', 'hogan.js');
```
### Data structure

The fetch method returns an JavaScript object that contains the following
properties:

<dl>
  <dt>library</dt>
  <dd>
    This is an optional property. Some of the supported engines require a helper
    library to be included at the client-side. If this property is not empty you
    should include this string together with your client side template on your
    page.
  </dd>

  <dt>client</dt>
  <dd>
    The client-side compatible version of your given template. This is already
    converted to a string for your convenience.
  </dd>

  <dt>server</dt>
  <dd>
    The server-side compatible version of your given template. It's a function
    that's ready to be used.
  </dd>

  <dt>engine</dt>
  <dd>
    The name of the template engine that was used to compile your template.
  </dd>

  <dt>hash</dt>
  <dd>
    An object that contains the hashes for the library, client and server.
  </dd>
</dl>

### The interface

The resulting compiled template have a uniform interface. It's a function that
accepts the template data as first argument and returns the generated template.

```js
var template = temper.fetch('/file/path/to/template.jade')
  , html = template({ foo: 'bar' });

console.log(html);
```

## License

MIT
