describe('temper', function () {
  'use strict';

  var Temper = require('../')
    , assume = require('assume')
    , temper;

  beforeEach(function () {
    temper = new Temper();
  });

  afterEach(function () {
    temper.destroy();
  });

  it('has list with supported types', function () {
    assume(temper.supported).to.have.property('.ejs');
    assume(temper.supported).to.have.property('.jade');
    assume(temper.supported).to.have.property('.mustache');
    assume(temper.supported).to.have.property('.hbs');
    assume(temper.supported).to.have.property('.handlebars');

    assume(temper.supported['.ejs']).to.include('ejs');
    assume(temper.supported['.jade']).to.include('jade');
    assume(temper.supported['.mustache']).to.include('hogan.js');
    assume(temper.supported['.mustache']).to.include('mustache');
    assume(temper.supported['.mustache']).to.include('handlebars');
    assume(temper.supported['.hbs']).to.include('handlebars');
    assume(temper.supported['.handlebars']).to.include('handlebars');
    assume(temper.supported['.html']).to.include('html');
  });

  describe('#read', function () {
    it('should read the file contents and return a string', function () {
      var data = temper.read(__dirname +'/fixtures/template.jade');

      assume(data).is.a('string');
      assume(data).to.contain('doctype 5');
    });

    it('should cache the file lookup', function () {
      var data = temper.read(__dirname +'/fixtures/template.jade');
      assume(data).is.a('string');
      assume(data).to.contain('doctype 5');

      assume(temper.file).to.have.property(__dirname +'/fixtures/template.jade');

      data = temper.read(__dirname +'/fixtures/template.jade');
      assume(data).is.a('string');
      assume(data).to.contain('doctype 5');
    });
  });

  describe('#require', function () {
    it('requires the module and returns it', function () {
      var jade = temper.require('jade');

      assume(jade).equals(require('jade'));
    });

    it('caches the module', function () {
      var jade = temper.require('jade');

      assume(jade).equals(require('jade'));
      assume(temper.required.jade).equals(require('jade'));
    });

    it('registers engine `null` for HTML', function () {
      var html = temper.require('html');

      assume(html).equals(null);
      assume(temper.required.html).equals(null);
    });

    it('throws an error if a module doesnt exist', function () {
      try { temper.require('cowdoodlesack'); }
      catch (e) {
        assume(e).to.be.instanceOf(Error);
        assume(e.message).to.include('npm install');
        return assume(e.message).to.include('cowdoodlesack');
      }

      throw new Error('I should have failed');
    });
  });

  describe('#discover', function () {
    it('should throw an error for a unknown extension', function () {
      try { temper.discover('/care/bear/path/template.trololol'); }
      catch (e) {
        assume(e).to.be.instanceOf(Error);
        assume(e.message).to.include('trololol');
        return assume(e.message).to.include('Unknown file extension');
      }

      throw new Error('I should have failed');
    });

    it('returns the correct engine', function () {
      assume(temper.discover('foo.jade')).equals('jade');
      assume(temper.discover('foo.ejs')).equals('ejs');
      assume(temper.discover('foo.mustache')).equals('hogan.js');
      assume(temper.discover('foo.html')).equals('html');
    });
  });

  describe('#compile', function () {
    describe('.jade', function () {
      it('compiles a jade template', function () {
        var obj = temper.compile('h1 hello', 'jade');

        assume(obj.client).is.a('string');
        assume(obj.library).is.a('string');
        assume(obj.server).is.a('function');
        assume(obj.server()).equals('<h1>hello</h1>');
        assume(obj.hash).is.a('object');
        assume(obj.hash.client).is.a('string');
        assume(obj.hash.server).is.a('string');
        assume(obj.hash.library).is.a('string');
      });
    });

    describe('.html', function () {
      it('returns surrogate compiler for HTML', function () {
        var obj = temper.compile('<h1>regular</h1>', 'html');

        assume(obj.client).is.a('string');
        assume(obj.library).is.a('string');
        assume(obj.library).equals('');
        assume(obj.server).is.a('function');
        assume(obj.server()).equals('<h1>regular</h1>');

        var client = (new Function('return '+ obj.client))();
        assume(client).is.a('function');
        assume(client()).equals('<h1>regular</h1>');
      });

      it('supports basic replacements of data', function () {
        var obj = temper.compile('<h1>{key}</h1>', 'html');

        obj.client = (new Function('return '+ obj.client))();

        assume(obj.server({ key: 'bar' })).equals('<h1>bar</h1>');
        assume(obj.client({ key: 'bar' })).equals('<h1>bar</h1>');
      });

      it('doesnt die when supplied with an Object.create(null)', function () {
        var obj = temper.compile('<h1>{key}</h1>', 'html')
          , data = Object.create(null);

        obj.client = (new Function('return '+ obj.client))();

        data.key = 'bar';
        assume(obj.server(data)).equals('<h1>bar</h1>');
        assume(obj.client(data)).equals('<h1>bar</h1>');
      });
    });
  });

  describe('#normalizeName', function () {
    it('handles filenames without special characters', function() {
      var name = temper.normalizeName('/home/templates/template.jade');

      assume(name).equals('template');
    });

    it('handles filenames with special characters in filenames', function() {
      var name = temper.normalizeName('/home/templates/09$-money_$00-test.jade');

      assume(name).equals('$money_$00test');
    });

  });
});
