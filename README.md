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
```

# Async

If any dependencies return a promise, then the promise will be resolved before being used as dependency.  A side effect of this behavior is that any service that depends on a promise will also return a promise.

```
import builder from 'service-builder;

const dsl = builder({
  breakfast: function (meat, eggs, drink) {
    return `${meat} with ${eggs} and ${drink}`;
  },
  // Get eggs async
  eggs: eggStyle => Promise.resolve(`${eggStyle} eggs`),
  solids: (meat, eggs) => [meat, eggs].join(', ')
});

dsl
  .withMeat('ham')
  .withEggStyle('scrambled')
  .withDrink('orange juice')
  .getBreakfast()
  .then(console.log);
// => 'ham with scrambled eggs and orange juice'

const subDsl = dsl
  .withMeat('ham')
  .withEggStyle('scrambled');

subDsl.getSolids()
  .then(console.log);
// => 'ham, scrambled eggs'

subDsl.getEggs()
  .then(console.log);
// => 'scrambled eggs'

subDsl.getBreakfast()
  .then(console.log);
// => Error
```

# Surviving Uglification

Minification / uglifying code mangles variable names which breaks being able to resolve dependencies from function names.  The fix is the same as Angular, to use array style dependencies.  The example above can be written as follows in order to survive minifcation.

```
import builder from 'service-builder;

const dsl = builder({
  breakfast: ['meat', 'eggs', 'drink', function (meat, eggs, drink) {
    return `${meat} with ${eggs} and ${drink}`;
  }],
  eggs: ['eggStyle', eggStyle => `${eggStyle} eggs`],
  solids: ['meat', 'egg', (meat, eggs) => [meat, eggs].join(', ')]
});

// Everything continues to work as before, except you can now safely uglify code
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
```
