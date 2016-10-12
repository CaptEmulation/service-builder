'use strict';

const chai = require('chai');
const builder = require('../lib');
const expect = chai.expect;

chai.use(require('chai-as-promised'));
chai.config.includeStack = true;

describe.only('builder test suite', () => {
  describe('the shape of a builder', () => {
    let f, d;

    beforeEach(() => {
      f = builder({
        breakfast: function (meat, egg, juice) {
          return `${meat} ${egg} eggs ${juice} juice`;
        }
      });
      d = f.dsl();
    });

    it('make a builder', () => {
      expect(d).to.have.keys('withMeat', 'withEgg', 'withJuice', 'getBreakfast');
    });

    it('is a function', () => {
      expect(d.withMeat).to.be.a('function');
    })

    it('builder makes more builder', () => {
      expect(d.withMeat()).to.have.keys('withEgg', 'withJuice', 'getBreakfast');
    });

    it('eventually exposes a service', () => {
      expect(d.withMeat().withEgg().withJuice()).to.have.keys('getBreakfast');
    });

    it('which returns a value', () => {
      expect(d.withMeat('bacon').withEgg('scrambled').withJuice('orange').getBreakfast()).to.equal('bacon scrambled eggs orange juice');
    });
  });

  describe('no dep services', () => {
    let f, d;

    beforeEach(() => {
      f = builder({
        foo: () => 'bar'
      });
      d = f.dsl();
    });

    it('exists', () => {
      expect(d.getFoo()).to.equal('bar');
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
      d = f.dsl();
    });

    it('exposing services', () => {
      let builder = d.withMeat();
      expect(builder).to.have.keys('withEgg', 'withJuice', 'getBreakfast', 'getSolids');
      builder = builder.withEgg();
      expect(builder).to.have.keys('getSolids', 'withJuice', 'getBreakfast');
      builder = builder.withJuice();
      expect(builder).to.have.keys('getBreakfast', 'getSolids');
    });

    it('inject deps', () => {
      d = f.dsl({
        meat: 'ham',
        egg: 'scrambled',
        juice: 'orange'
      });
      expect(d).to.have.keys('getBreakfast', 'getSolids');
      expect(d.getBreakfast()).to.equal('ham scrambled eggs orange juice');
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
      d = f.dsl();
    });

    it('exposing services', function () {
      var builder = d.withMeat();
      expect(builder).to.have.keys('withEgg', 'withJuice', 'getBreakfast', 'getSolids');
      builder = builder.withEgg();
      expect(builder).to.have.keys('getSolids', 'withJuice', 'getBreakfast');
      builder = builder.withJuice();
      expect(builder).to.have.keys('getBreakfast', 'getSolids');
    });

    it('inject deps', function () {
      d = f.dsl({
        meat: 'ham',
        egg: 'scrambled',
        juice: 'orange'
      });
      expect(d).to.have.keys('getBreakfast', 'getSolids');
      expect(d.getBreakfast()).to.equal('ham scrambled eggs orange juice');
    });
  });

  describe('lazy dependency init', () => {
    let d;

    beforeEach(() => {
      d = builder({
        meal: (meat, veggie) => `${meat} and ${veggie}`,
        meat: (meatStyle, meatCut) => `${meatStyle} ${meatCut}`,
        veggie: (veggieStyle, vegatable) => `${veggieStyle} ${vegatable}`
      }).dsl();
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
      }).dsl()
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
      }).dsl()
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
      }).dsl();
    });

    it('with error message', () => {
      expect(d.getA).to.throw('Circular dependency error with a at a => c => b');
    });
  });
});
