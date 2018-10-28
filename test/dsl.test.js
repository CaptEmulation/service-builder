'use strict';

const chai = require('chai');
const builder = require('../lib');
const expect = chai.expect;

chai.use(require('chai-as-promised'));
chai.config.includeStack = true;

describe('builder test suite', () => {
  describe('the shape of a builder', () => {
    let f, d;

    beforeEach(() => {
      f = builder({
        breakfast: function (meat, egg, juice) {
          return `${meat} ${egg} eggs ${juice} juice`;
        }
      });
      d = f.construct();
    });

    it('make a builder', () => {
      expect(d).to.have.keys('withMeat', 'withEgg', 'withJuice', 'getBreakfast', 'breakfast');
    });

    it('is a function', () => {
      expect(d.withMeat).to.be.a('function');
    })

    it('builder makes more builder', () => {
      expect(d.withMeat()).to.have.keys('withEgg', 'withJuice', 'getBreakfast', 'breakfast');
    });

    it('eventually exposes a service', () => {
      expect(d.withMeat().withEgg().withJuice()).to.have.keys('getBreakfast', 'breakfast');
    });

    it('which returns a value', () => {
      const dsl = d.withMeat('bacon').withEgg('scrambled').withJuice('orange');
      expect(dsl.getBreakfast()).to.equal('bacon scrambled eggs orange juice');
      expect(dsl.breakfast).to.equal('bacon scrambled eggs orange juice');
    });
  });

  describe('no dep services', () => {
    let f, d;

    beforeEach(() => {
      f = builder({
        foo: () => 'bar'
      });
      d = f.construct();
    });

    it('exists', () => {
      expect(d.getFoo()).to.equal('bar');
    });
  });

  describe('$ is implicit', () => {
    it('won\'t allow $ as a dependency', () => {
      expect(() => builder({
        $: () => 'foo',
      })).to.throw(Error);
    });

    it('$ is available as a dependency', () => {
      expect(builder({
        foo: $ => $(bar => bar),
        bar: () => 'bar',
      }).construct().getFoo()).to.equal('bar');
    });

    it('$ ran resolve new deps', () => {
      const b = builder({
        foo: $ => $(bar => bar),
      });
      const f = b.construct();
      b.define({
        bar: 'bar',
      });
      expect(f.foo).to.equal('bar');
    });
  });

  describe('no dsl', () => {
    before(() => {
      builder.config({
        dsl: false,
      });
    });
    after(() => {
      builder.config({
        dsl: true,
      });
    });

    it('Returns a resolver', () => {
      const b = builder({
        foo: 'foo',
      });
      expect(b.construct()(foo => foo)).to.equal('foo');
    });

    it('can still use a resolver', () => {
      const b = builder({
        foo: $ => $(bar => bar),
        bar: () => 'bar',
      });
      expect(b.construct()(foo => foo)).to.equal('bar');
    });
  })

  describe('extending', () => {
    it('can define new deps', () => {
      const b = builder({
        foo: 'foo',
      });
      const f = b.construct();
      b.define({
        bar: foo => foo,
      });
      expect(f.$(bar => bar)).to.equal('foo');
    });
  });

  describe('multiple services', () => {
    let f, d;

    beforeEach(() => {
      f = builder({
        breakfast: function (meat, egg, juice) {
          return `${meat} ${egg} eggs ${juice} juice`;
        },
        solids: (meat, egg) => `${meat} ${egg}`
      });
      d = f.construct();
    });

    it('exposing services', () => {
      let builder = d.withMeat();
      expect(builder).to.have.keys('withEgg', 'withJuice', 'getBreakfast', 'getSolids', 'breakfast', 'solids');
      builder = builder.withEgg();
      expect(builder).to.have.keys('getSolids', 'withJuice', 'getBreakfast', 'breakfast', 'solids');
      builder = builder.withJuice();
      expect(builder).to.have.keys('getBreakfast', 'getSolids', 'breakfast', 'solids');
    });

    it('inject deps', () => {
      d = f.construct({
        meat: 'ham',
        egg: 'scrambled',
        juice: 'orange'
      });
      expect(d).to.have.keys('getBreakfast', 'getSolids', 'breakfast', 'solids');
      expect(d.getBreakfast()).to.equal('ham scrambled eggs orange juice');
    });

    it('obtain deps', () => {
      d = f.construct({
        meat: 'ham',
        egg: 'scrambled',
        juice: 'orange'
      });
      expect(d.$(breakfast => breakfast)).to.equal('ham scrambled eggs orange juice');
    });
  });

  describe('bling', function () {
    it('obtain deps', () => {
      const f = builder({
        breakfast: function (meat, egg, juice) {
          return `${meat} ${egg} eggs ${juice} juice`;
        },
      }).construct({
        meat: 'ham',
        egg: 'scrambled',
        juice: 'orange',
      });
      expect(f.$(breakfast => breakfast)).to.equal('ham scrambled eggs orange juice');
    });

    it('obtain construct instance', () => {
      const f = builder().construct({
        meat: 'ham',
      });
      expect(f.$(meat => meat)).to.equal('ham');
    });

    it('multiple deps', () => {
      const f = builder().construct({
        meat: 'ham',
        egg: 'scrambled',
        juice: 'orange',
      });
      expect(f.$((meat, egg, juice) => meat + egg + juice)).to.equal('hamscrambledorange');
    });

    it('async', () => {
      const f = builder().construct({
        meat: Promise.resolve('ham'),
      });
      return expect(f.$(meat => meat)).to.eventually.equal('ham');
    });

    it('async failure', () => {
      const f = builder().construct({
        meat: Promise.reject(new Error('ham')),
      });
      return expect(f.$(meat => meat)).to.rejectedWith(Error);
    });
  });

  describe('multiple services as $Inject', function () {
    let f,d;

    beforeEach(function () {
      const breakfast = function breakfast(meat, egg, juice) {
        return meat + ' ' + egg + ' eggs ' + juice + ' juice';
      };
      breakfast.$Inject = [ 'meat', 'egg', 'juice' ];
      const solids = function solids(meat, egg) {
        return meat + ' ' + egg;
      };
      solids.$Inject = ['meat', 'egg' ];
      f = builder({
        breakfast,
        solids,
      });
      d = f.construct();
    });

    it('exposing services', function () {
      var builder = d.withMeat();
      expect(builder).to.have.keys('withEgg', 'withJuice', 'getBreakfast', 'getSolids', 'breakfast', 'solids');
      builder = builder.withEgg();
      expect(builder).to.have.keys('getSolids', 'withJuice', 'getBreakfast', 'breakfast', 'solids');
      builder = builder.withJuice();
      expect(builder).to.have.keys('getBreakfast', 'getSolids', 'breakfast', 'solids');
    });

    it('inject deps', function () {
      d = f.construct({
        meat: 'ham',
        egg: 'scrambled',
        juice: 'orange'
      });
      expect(d).to.have.keys('getBreakfast', 'getSolids', 'breakfast', 'solids');
      expect(d.getBreakfast()).to.equal('ham scrambled eggs orange juice');
    });

    it('$ ran resolve new deps', () => {
      const barProvider = bar => bar;
      barProvider.$Inject = ['bar'];
      const foo = $ => $(barProvider);
      foo.$Inject = ['$']
      const b = builder({
        foo,
      });
      const f = b.construct();
      b.define({
        bar: 'bar',
      });
      expect(f.foo).to.equal('bar');
    });
  });

  describe('multiple services as array', function () {
    let f,d;

    beforeEach(function () {
      f = builder({
        breakfast: [ 'meat', 'egg', 'juice', function breakfast(meat, egg, juice) {
          return meat + ' ' + egg + ' eggs ' + juice + ' juice';
        }],
        solids: ['meat', 'egg', function solids(meat, egg) {
          return meat + ' ' + egg;
        }]
      });
      d = f.construct();
    });

    it('exposing services', function () {
      var builder = d.withMeat();
      expect(builder).to.have.keys('withEgg', 'withJuice', 'getBreakfast', 'getSolids', 'breakfast', 'solids');
      builder = builder.withEgg();
      expect(builder).to.have.keys('getSolids', 'withJuice', 'getBreakfast', 'breakfast', 'solids');
      builder = builder.withJuice();
      expect(builder).to.have.keys('getBreakfast', 'getSolids', 'breakfast', 'solids');
    });

    it('inject deps', function () {
      d = f.construct({
        meat: 'ham',
        egg: 'scrambled',
        juice: 'orange'
      });
      expect(d).to.have.keys('getBreakfast', 'getSolids', 'breakfast', 'solids');
      expect(d.getBreakfast()).to.equal('ham scrambled eggs orange juice');
    });

    it('$ ran resolve new deps', () => {
      const b = builder({
        foo: ['$', $ => $(['bar', bar => bar])],
      });
      const f = b.construct();
      b.define({
        bar: 'bar',
      });
      expect(f.foo).to.equal('bar');
    });
  });

  describe('lazy dependency init', () => {
    let d;

    beforeEach(() => {
      d = builder({
        meal: (meat, veggie) => `${meat} and ${veggie}`,
        meat: (meatStyle, meatCut) => `${meatStyle} ${meatCut}`,
        veggie: (veggieStyle, vegatable) => `${veggieStyle} ${vegatable}`
      }).construct();
    });

    it('loads a dependency', () => {
      expect(d.withVeggieStyle('steamed')
        .withVegatable('beans')
        .withMeatCut('steak')
        .withMeatStyle('grilled')
        .getMeal())
        .to.equal('grilled steak and steamed beans');
    });
  });

  describe('async dependencies', () => {
    it('loads a dependency with all promises', () => {
      const d = builder({
        meal: (meat, veggie) => Promise.resolve(`${meat} and ${veggie}`),
        meat: (meatStyle, meatCut) => Promise.resolve(`${meatStyle} ${meatCut}`),
        veggie: (veggieStyle, vegatable) => Promise.resolve(`${veggieStyle} ${vegatable}`)
      }).construct()
      return expect(d.withVeggieStyle('steamed')
        .withVegatable('beans')
        .withMeatCut('steak')
        .withMeatStyle('grilled')
        .getMeal())
        .to.eventually.equal('grilled steak and steamed beans');
    });

    it('loads a dependency with some promises', () => {
      const d = builder({
        meal: (meat, veggie) => `${meat} and ${veggie}`,
        meat: (meatStyle, meatCut) => Promise.resolve(`${meatStyle} ${meatCut}`),
        veggie: (veggieStyle, vegatable) => Promise.resolve(`${veggieStyle} ${vegatable}`)
      }).construct()
      return expect(d.withVeggieStyle('steamed')
        .withVegatable('beans')
        .withMeatCut('steak')
        .withMeatStyle('grilled')
        .getMeal())
        .to.eventually.equal('grilled steak and steamed beans');
    });
  });

  describe('disallows circular dependency', () => {
    let d;

    beforeEach(() => {
      d = builder({
        a: b => b,
        b: c => c,
        c: a => a
      }).construct();
    });

    it('with error message', () => {
      expect(d.getA).to.throw('Circular dependency error with a at a => c => b');
    });
  });
});
