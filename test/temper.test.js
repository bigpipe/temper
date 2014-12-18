describe('temper', function () {
  'use strict';

  var Temper = require('../')
    , chai = require('chai')
    , expect = chai.expect
    , temper;

  beforeEach(function () {
    temper = new Temper();
  });

  afterEach(function () {
    temper.destroy();
  });

  it('has list with supported types', function () {
    expect(temper.supported).to.have.property('.ejs');
    expect(temper.supported).to.have.property('.jade');
    expect(temper.supported).to.have.property('.mustache');
    expect(temper.supported).to.have.property('.hbs');
    expect(temper.supported).to.have.property('.handlebars');

    expect(temper.supported['.ejs']).to.include('ejs');
    expect(temper.supported['.jade']).to.include('jade');
    expect(temper.supported['.mustache']).to.include('hogan.js');
    expect(temper.supported['.mustache']).to.include('mustache');
    expect(temper.supported['.mustache']).to.include('handlebars');
    expect(temper.supported['.hbs']).to.include('handlebars');
    expect(temper.supported['.handlebars']).to.include('handlebars');
    expect(temper.supported['.html']).to.include('html');
  });

  describe('#read', function () {
    it('should read the file contents and return a string', function () {
      var data = temper.read(__dirname +'/fixtures/template.jade');

      expect(data).to.be.a('string');
      expect(data).to.contain('doctype 5');
    });

    it('should cache the file lookup', function () {
      var data = temper.read(__dirname +'/fixtures/template.jade');
      expect(data).to.be.a('string');
      expect(data).to.contain('doctype 5');

      expect(temper.file).to.have.property(__dirname +'/fixtures/template.jade');

      data = temper.read(__dirname +'/fixtures/template.jade');
      expect(data).to.be.a('string');
      expect(data).to.contain('doctype 5');
    });
  });

  describe('#require', function () {
    it('requires the module and returns it', function () {
      var jade = temper.require('jade');

      expect(jade).to.equal(require('jade'));
    });

    it('caches the module', function () {
      var jade = temper.require('jade');

      expect(jade).to.equal(require('jade'));
      expect(temper.required.jade).to.equal(require('jade'));
    });

    it('registers engine `null` for HTML', function () {
      var html = temper.require('html');

      expect(html).to.equal(null);
      expect(temper.required.html).to.equal(null);
    });

    it('throws an error if a module doesnt exist', function () {
      try { temper.require('cowdoodlesack'); }
      catch (e) {
        expect(e).to.be.instanceOf(Error);
        expect(e.message).to.include('npm install');
        return expect(e.message).to.include('cowdoodlesack');
      }

      throw new Error('I should have failed');
    });
  });

  describe('#discover', function () {
    it('should throw an error for a unknown extension', function () {
      try { temper.discover('/care/bear/path/template.trololol'); }
      catch (e) {
        expect(e).to.be.instanceOf(Error);
        expect(e.message).to.include('trololol');
        return expect(e.message).to.include('Unknown file extension');
      }

      throw new Error('I should have failed');
    });

    it('returns the correct engine', function () {
      expect(temper.discover('foo.jade')).to.equal('jade');
      expect(temper.discover('foo.ejs')).to.equal('ejs');
      expect(temper.discover('foo.mustache')).to.equal('hogan.js');
      expect(temper.discover('foo.html')).to.equal('html');
    });
  });

  describe('#compile', function () {
    it('compiles a jade template', function () {
      var obj = temper.compile('h1 hello', 'jade');

      expect(obj.client).to.be.a('string');
      expect(obj.library).to.be.a('string');
      expect(obj.server).to.be.a('function');
      expect(obj.server()).to.equal('<h1>hello</h1>');
      expect(obj.hash).to.be.a('object');
      expect(obj.hash.client).to.be.a('string');
      expect(obj.hash.server).to.be.a('string');
      expect(obj.hash.library).to.be.a('string');
    });

    describe('.html', function () {
      it('returns surrogate compiler for HTML', function () {
        var obj = temper.compile('<h1>regular</h1>', 'html');

        expect(obj.client).to.be.a('string');
        expect(obj.library).to.be.a('string');
        expect(obj.library).to.equal('');
        expect(obj.server).to.be.a('function');
        expect(obj.server()).to.equal('<h1>regular</h1>');

        var client = (new Function('return '+ obj.client))();
        expect(client).to.be.a('function');
        expect(client()).to.equal('<h1>regular</h1>');
      });

      it('supports basic replacements of data', function () {
        var obj = temper.compile('<h1>{key}</h1>', 'html');

        obj.client = (new Function('return '+ obj.client))();

        expect(obj.server({ key: 'bar' })).to.equal('<h1>bar</h1>');
        expect(obj.client({ key: 'bar' })).to.equal('<h1>bar</h1>');
      });

      it('doesnt die when supplied with an Object.create(null)', function () {
        var obj = temper.compile('<h1>{key}</h1>', 'html')
          , data = Object.create(null);

        obj.client = (new Function('return '+ obj.client))();

        data.key = 'bar';
        expect(obj.server(data)).to.equal('<h1>bar</h1>');
        expect(obj.client(data)).to.equal('<h1>bar</h1>');
      });
    });
  });

  describe('#normalizeName', function () {
    it('handles filenames without special characters', function() {
      var name = temper.normalizeName('/home/templates/template.jade');

      expect(name).to.equal('template');
    });

    it('handles filenames with special characters in filenames', function() {
      var name = temper.normalizeName('/home/templates/09$-money_$00-test.jade');

      expect(name).to.equal('$money_$00test');
    });

  });
});
