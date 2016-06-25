# Introduction

`service-builder` is a dependency injection and service factory framework.

# Usage

```
import builder from 'service-builder;

const dsl = builder({
  breakfast: function (meat, eggs, drink) {
    return `${meat} with ${eggs} and ${drink}`;
  },
  eggs: eggStyle => `${eggStyle} eggs`,
  solids: (meat, eggs) => [meat, eggs].join(', ')
});

dsl
  .withMeat('ham')
  .withEggStyle('scrambled')
  .withDrink('orange juice')
  .getBreakfast();
// => 'ham with scrambled eggs and orange juice'

const subDsl = dsl
  .withMeat('ham')
  .withEggStyle('scrambled');

subDsl.getSolids();
// => 'ham, scrambled eggs'

subDsl.getEggs();
// => 'scrambled eggs'

subDsl.getBreakfast();
// => Error