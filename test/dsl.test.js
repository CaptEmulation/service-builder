'use strict';

const chai = require('chai');
const dsl = require('../lib');
const expect = chai.expect;

describe.only('dsl test suite', () => {
  describe('the shape of a dsl', () => {
    let f, d;

    beforeEach(() => {
      f = dsl();
      f.define({
        breakfast: function (meat, egg, juice) {
          return `${meat} ${egg} eggs ${juice} juice`;
        }
      });
      d = f.dsl();
    });

    it('make a dsl', () => {
      expect(d).to.have.keys('withMeat', 'withEgg', 'withJuice');
    });

    it('is a function', () => {
      expect(d.withMeat).to.be.a('function');
    })

    it('dsl makes more dsl', () => {
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
      f = dsl();
      f.define({
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
      f = dsl();
      f.define({
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
      let dsl = d.withMeat();
      expect(dsl).to.have.keys('getMeat', 'withEgg', 'withJuice');
      dsl = dsl.withEgg();
      expect(dsl).to.have.keys('getMeat', 'getSolids', 'withJuice');
      dsl = dsl.withJuice();
      expect(dsl).to.have.keys('getBreakfast', 'getMeat', 'getSolids');
    });
  });
});

