'use strict';

const chai = require('chai');
const builder = require('../lib');
const expect = chai.expect;

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
      expect(d).to.have.keys('withMeat', 'withEgg', 'withJuice');
    });

    it('is a function', () => {
      expect(d.withMeat).to.be.a('function');
    })

    it('builder makes more builder', () => {
      expect(d.withMeat()).to.have.keys('withEgg', 'withJuice');
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
        meat: meat => meat,
        solids: (meat, egg) => `${meat} ${egg}`
      });
      d = f.dsl();
    });

    it('single dep', () => {
      expect(d.withMeat('bacon').getMeat()).to.equal('bacon');
    });

    it('exposing services', () => {
      let builder = d.withMeat();
      expect(builder).to.have.keys('getMeat', 'withEgg', 'withJuice');
      builder = builder.withEgg();
      expect(builder).to.have.keys('getMeat', 'getSolids', 'withJuice');
      builder = builder.withJuice();
      expect(builder).to.have.keys('getBreakfast', 'getMeat', 'getSolids');
    });

    it('inject deps', () => {
      d = f.dsl({
        meat: 'ham',
        egg: 'scrambled',
        juice: 'orange'
      });
      expect(d).to.have.keys('getBreakfast', 'getMeat', 'getSolids');
      expect(d.getBreakfast()).to.equal('ham scrambled eggs orange juice');
    });
  });
});

