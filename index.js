'use strict';

var debug = require('diagnostics')('temper')
  , TickTock = require('tick-tock')
  , destroy = require('demolish')
  , crypto = require('crypto')
  , path = require('path')
  , fs = require('fs');

/**
 * Temper compiles templates to client-side compatible templates as well as it's
 * server side equivalents.
 *
 * @constructor
 * @param {Object} options Temper configuration.
 * @api public
 */
function Temper(options) {
  if (!this) return new Temper(options);
  options = options || {};

  //
  // We only want to cache the templates in production as it's so we can easily
  // change templates when we're developing.
  //
  options.cache = 'cache' in options
    ? options.cache
    : process.env.NODE_ENV !== 'production';

  this.installed = Object.create(null);   // Installed module for extension cache.
  this.required = Object.create(null);    // Template engine require cache.
  this.compiled = Object.create(null);    // Compiled template cache.
  this.timers = new TickTock(this);       // Keep track of timeouts.
  this.file = Object.create(null);        // File lookup cache.
  this.cache = options.cache;             // Cache compiled templates.
}

/**
 * List of supported templates engines mapped by file extension for easy
 * detection. The engines are also the npm modules that should be installed in
 * order to compile the given template language.
 *
 * @type {Object}
 * @private
 */
Temper.prototype.supported = {
  '.mustache': ['hogan.js', 'mustache', 'handlebars'],
  '.handlebars': ['handlebars'],
  '.hbs': ['handlebars'],
  '.jsx': ['react-jsx'],
  '.html': ['html'],
  '.jade': ['jade'],
  '.ejs': ['ejs']
};

/**
 * Require a cached require, or require it normally.
 *
 * @param {String} engine Module name.
 * @param {String} extname The extension for which we need the compiler.
 * @return {Mixed} The module.
 * @api private
 */
Temper.prototype.require = function requires(engine, extname) {
  if (engine in this.required) return this.required[engine];

  var temper = this;

  try { this.required[engine] = 'html' !== engine ? require(engine) : null; }
  catch (e) {
    throw new Error('The '+ engine +' module isn\'t installed which we need to compile '+ extname +' templates. Run `npm install --save '+ engine +'` in the root of your project.');
  }

  //
  // Release the cached template compilers again, there is no need to keep it.
  // @TODO also remove them from the `require` cache.
  //
  this.timers.setTimeout('require-'+ engine, function cleanup() {
    debug('removing cached engine (%s) to reduce memory', engine);
    delete temper.required[engine];
  }, '5 minutes');

  return this.required[engine];
};

/**
 * Reads a file in to the cache and returns the contents.
 *
 * @param {String} file The absolute location of a file.
 * @returns {String} The file contents.
 * @api private
 */
Temper.prototype.read = function read(file) {
  if (file in this.file) return this.file[file];

  var temper = this;

  //
  // Temporarily store the file in our cache. Remove it after a while because
  // we're going to compile the source to a template function anyways so this
  // will no longer serve it's use.
  //
  try {
    this.file[file] = fs.readFileSync(file, 'utf-8');
  } catch (e) {
    throw new Error('Unable to read '+ file +' due to '+ e.message);
  }

  this.timers.setTimeout('read-'+ file, function cleanup() {
    debug('removing cached template (%s) to reduce memory', file);
    delete temper.file[file];
  }, '1 minute');

  return this.file[file];
};

/**
 * Pre-fetch a new template in to the cache.
 *
 * @param {String} file The file that needs to be compiled.
 * @param {String} engine The engine we need to use.
 * @returns {Object} The compiled template information.
 * @api public
 */
Temper.prototype.fetch =
Temper.prototype.prefetch = function prefetch(file, engine) {
  if (file in this.compiled) return this.compiled[file];

  var compiled = this.compile(this.read(file), {
    engine: engine || this.discover(file),
    name: this.normalizeName(file),
    filename: file
  });

  if (!this.cache) return compiled;

  debug('caching compiled template (%s)', file);
  return this.compiled[file] = compiled;
};

/**
 * Convert the filename into a safe JavaScript function name
 *
 * @param {String} file The name of the file to convert into a safe function name
 * @returns {String} Name to use for the template function in certain supporting compilers.
 * @api private
 */
Temper.prototype.normalizeName = function(file) {
  var name = path.basename(file, path.extname(file));

  //
  // Remove leading numbers.
  // Remove all but alphanumeric or _ or $.
  //
  return name.replace(/^[0-9]+/, '').replace(/[^\w$]/g, '');
};

/**
 * Discover which template engine we need to use for the given file path.
 *
 * @param {String} file The filename.
 * @returns {String} Name of the template engine.
 * @api private
 */
Temper.prototype.discover = function discover(file) {
  var extname = path.extname(file)
    , list = this.supported[extname]
    , temper = this
    , found;

  //
  // Already found a working template engine for this extensions. Use this
  // instead of trying to require more pointless template engines.
  //
  if (extname in this.installed) return this.installed[extname];

  //
  // A unknown file extension, we have no clue how to process this, so throw.
  //
  if (!list) {
    debug('file %s required an template engine that we\'re not supporting', file);
    throw new Error('Unknown file extension. '+ extname +' is not supported');
  }

  found = list.filter(function filter(engine) {
    var compiler;

    try { compiler = temper.require(engine, extname); }
    catch (e) {
      debug('failed to require %s to compile template, searching for another', engine);
      return false;
    }

    temper.required[engine] = compiler;
    temper.installed[extname] = engine;

    return true;
  });

  if (found.length) return found[0];

  //
  // We couldn't find any valid template engines for the given file. Prompt the
  // user to install one of our supported template engines.
  //
  debug('failed to compile template %s missing template engines %s', file, list.join());
  throw new Error('No compatible template engine installed, please run: npm install --save '+ list[0]);
};

/**
 * Compile a given template to a server side and client side component.
 *
 * Options:
 *
 * - debug: Include debugging information
 * - engine: The node module that we need to use to compile the templates.
 * - filename: The full file name.
 * - name: Safe JS function name.
 *
 * @param {String} template The templates content.
 * @param {Object} options Additional configuration.
 * @returns {Object}
 * @api private
 */
Temper.prototype.compile = function compile(template, options) {
  var compiler = this.require(options.engine, path.extname(options.filename))
    , library, directory, server, client;

  switch (options.engine) {
    //
    // Hogan.js template engine from twitter:
    // @see http://twitter.github.io/hogan.js/
    //
    case 'hogan.js':
      server = (function hulk(template) {
        return function render(data) {
          return template.render(data);
        };
      })(compiler.compile(template));

      client = [
        '(function hulk() {',
          'var template = new Hogan.Template(',
            compiler.compile(template, { asString: 1 }),
          ');',
        'return function render(data) { return template.render(data); };'
      ].join('');

      directory = path.dirname(require.resolve(options.engine));
      library = path.join(directory, 'template.js');
    break;

    //
    // Handlebars:
    // @see http://handlebarsjs.com/
    //
    case 'handlebars':
      server = compiler.compile(template);
      client = compiler.precompile(template);

      directory = path.dirname(require.resolve(options.engine));
      library = path.join(directory, '..', 'dist', 'handlebars.runtime.js');
    break;

    //
    // ejs: Embedded JavaScript
    // @see https://github.com/mde/ejs
    //
    case 'ejs':
      server = compiler.compile(template, {
        compileDebug: options.debug,    // Include debug instrumentation
        filename: options.filename,     // Used for debugging.
        debug: options.debug            // Should we output the generated function.
      });

      client = this.transform(compiler.compile(template, {
        client: true,                   // Ensure we export it for client usage.
        compileDebug: options.debug,    // Include debug instrumentation.
        debug: options.debug,           // Should we output the generated function.
        filename: options.filename      // Used for debugging.
      }), options.name);
    break;

    //
    // Jade-lang:
    // @see https://github.com/jadejs/jade
    //
    case 'jade':
      server = compiler.compile(template, {
        debug: options.debug,           // Should we output the generated function.
        compileDebug: options.debug,    // Include debug instrumentation.
        filename: options.filename      // Required for handling includes.
      });

      client = this.transform((compiler.compileClient || compiler.compile)(template, {
        client: true,                   // Required for older Jade versions.
        pretty: false,                  // Prevent pretty code as it inserts unwanted data.
        debug: options.debug,           // Should we output the generated function.
        compileDebug: options.debug,    // Include debug instrumentation.
        filename: options.filename      // Required for handling includes.
      }), options.name);

      directory = path.dirname(require.resolve(options.engine));
      library = path.join(directory, 'runtime.js');
    break;

    //
    // React JSX:
    // @see https://github.com/bigpipe/react-jsx
    //
    case 'react-jsx':
      client = this.transform(compiler.client(template, {
        filename: options.filename,   // Required for source map generation.
        debug: options.debug          // Include inline source-maps.
      }), options.name);

      server = compiler.server(template, {
        filename: options.filename,   // Required for source map generation.
        debug: options.debug,         // Include inline source-maps.
        raw: true
      });
    break;

    //
    // Plain ol HTML Files.
    //
    case 'html':
      client = this.transform(
        new Function('data', [
          Temper.html.toString(),
          //
          // We need to JSON.stringify the template to prevent it from throwing
          // errors.
          //
          'return html('+ JSON.stringify(template) +', data || {});'
        ].join('\n')
      ), options.name);

      server = function render(data) {
        return Temper.html(template, data || {});
      };
    break;
  }

  debug('compiled template %s using engine %s', options.filename, options.engine);

  //
  // Read the client-side framework if needed.
  //
  library = library ? this.read(library) : '';

  return {
    library: library,                             // Front-end library.
    client: client,                               // Pre-compiled code.
    server: server,                               // Compiled template.
    engine: options.engine,                       // The engine's name.
    hash: {
      library: this.hash(library),                // Hash of the library.
      client: this.hash(client),                  // Hash of the client.
      server: this.hash(server)                   // Hash of the server.
    }
  };
};

/**
 * Transform an Anonymous function in to a named function string.
 *
 * @param {Function} fn The anonymous function.
 * @param {String} name Actual name of the function.
 * @returns {String} String representation of the named function.
 * @api public
 */
Temper.prototype.transform = function transform(fn, name) {
  return fn.toString().replace('function anonymous', 'function ' + name);
};

/**
 * Generate a hash of the given code.
 *
 * @param {String} code The code to hash.
 * @returns {String} The hash
 * @api private
 */
Temper.prototype.hash = function hash(code) {
  return crypto.createHash('md5').update(code.toString()).digest('hex');
};

/**
 * Minimal HTML template engine for simple placeholder replacements.
 *
 * @param {String} template HTML template
 * @param {Object} data Template data
 * @returns {String}
 * @api private
 */
Temper.html = function html(template, data, key) {
  var has = Object.prototype.hasOwnProperty;

  for (key in data) {
    if (has.call(data, key)) {
      //
      // Prevent
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
      // from messing up the content.
      //
      template = template.replace(new RegExp('{'+ key +'}','g'), function hack() {
        return data[key];
      });
    }
  }

  return template;
};

/**
 * Destroy and completely clean up the temper instance.
 *
 * @returns {Boolean}
 * @api public
 */
Temper.prototype.destroy = destroy('installed, required, compiled, timers, file');

//
// Expose temper.
//
module.exports = Temper;
