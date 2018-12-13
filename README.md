# Introduction

`service-builder` is a dependency injection and service factory framework.

# Usage

```
import builder from 'service-builder;

const blueprint = builder({
  breakfast: function (meat, eggs, drink) {
    return `${meat} with ${eggs} and ${drink}`;
  },
  eggs: eggStyle => `${eggStyle} eggs`,
  solids: (meat, eggs) => [meat, eggs].join(', ')
});

const factory = blueprint.construct();

factory
  .withMeat('ham')
  .withEggStyle('scrambled')
  .withDrink('orange juice')
  .getBreakfast();
// => 'ham with scrambled eggs and orange juice'

const anotherFactory = blueprint.construct({
  meat: 'sausage'
})
  .withEggStyle('scrambled');

anotherFactory.getSolids();
// => 'ham, scrambled eggs'

anotherFactory.getEggs();
// => 'scrambled eggs'

anotherFactory.getBreakfast();
// => Error
```
# Lazy properties
Instead of using the getter functions, there are also lazily evaluated properties on the factory

```
const blueprint = builder({
  eggs: eggStyle => `${eggStyle} eggs`,
});
const factory = blueprint.construct({
  eggStyle: 'fried',
});
console.log(factory.eggs);
// => 'fried eggs'
```

# Implicit properties
If a non-function non-array is passed in as a dependency, then it will be implicitly wrapped in a function.

```
const blueprint = builder({
  foo: bar => `foo${bar}`,
  bar: 'bar',  
});
const factory = blueprint.construct();
console.log(factory.foo);
// => 'foobar'
```

# Resolver

`$` is a resolver for dependencies

```
const blueprint = builder({
  eggs: eggStyle => `${eggStyle} eggs`,
  meat: meatStyle => `${meatStyle} steak`,
});
const factory = blueprint.construct({
  eggStyle: 'fried',
  meatStyle: 'rare',
});
console.log(factory.$((meat, eggs) => `${eggs} and ${meat}`));
// => 'fried eggs and rare steak'
```

Alternatively, you can forgo the DSL syntax of the constructed factory entirely in favor of a resolver:

```
builder.config({ dsl: false });
const blueprint = builder({
  eggs: eggStyle => `${eggStyle} eggs`,
  meat: meatStyle => `${meatStyle} steak`,
});
const $ = blueprint.construct({
  eggStyle: 'fried',
  meatStyle: 'rare',
});
console.log($((meat, eggs) => `${eggs} and ${meat}`));
// => 'fried eggs and rare steak'
```

# Promises

If any dependencies return a promise, then the promise will be resolved before being used as dependency.  A side effect of this behavior is that any service that depends on a promise will also return a promise.

```
import builder from 'service-builder;

const blueprint = builder({
  breakfast: function (meat, eggs, drink) {
    return `${meat} with ${eggs} and ${drink}`;
  },
  // Get eggs async
  eggs: eggStyle => Promise.resolve(`${eggStyle} eggs`),
  solids: (meat, eggs) => [meat, eggs].join(', ')
});

const factory = blueprint.construct();

factory
  .withMeat('ham')
  .withEggStyle('scrambled')
  .withDrink('orange juice')
  .getBreakfast()
  .then(console.log);
// => 'ham with scrambled eggs and orange juice'

const anotherFactory = blueprint.construct()
  .withMeat('ham')
  .withEggStyle('scrambled');

anotherFactory.getSolids()
  .then(console.log);
// => 'ham, scrambled eggs'

anotherFactory.getEggs()
  .then(console.log);
// => 'scrambled eggs'

anotherFactory.getBreakfast()
  .then(console.log);
// => Error

```

# Async

Promise providers work will with async / await

```
import builder from 'service-builder;

const blueprint = builder({
  breakfast: function (meat, eggs, drink) {
    return `${meat} with ${eggs} and ${drink}`;
  },
  // Get eggs async
  eggs: async eggStyle => await asyncOperation(`${eggStyle} eggs`),
  solids: (meat, eggs) => [meat, eggs].join(', ')
});

const factory = blueprint.construct();

factory
  .withMeat('ham')
  .withEggStyle('scrambled')
  .withDrink('orange juice')
  .getBreakfast()
  .then(console.log);
// => 'ham with scrambled eggs and orange juice'

const anotherFactory = blueprint.construct()
  .withMeat('ham')
  .withEggStyle('scrambled');

console.log(await anotherFactory.getSolids());
// => 'ham, scrambled eggs'

console.log(await anotherFactory.getEggs());
// => 'scrambled eggs'

console.log(await anotherFactory.getBreakfast());
// => Error
```

# Surviving Uglification

Minification / uglifying code mangles variable names which breaks being able to resolve dependencies from function names.  The fix is the same as Angular 1.x, to use array style dependencies.  service-builder also supports annotate-ng style tags and is compatible with `ng-annotate` and `babel-plugin-angularjs-annotate`

```
import builder from 'service-builder;

const blueprint = builder({
  // Array style
  breakfast: ['meat', 'eggs', 'drink', function (meat, eggs, drink) {
    return `${meat} with ${eggs} and ${drink}`;
  }],
  // Directive tyle
  eggs: eggStyle => {
    "ngInject";
    return `${eggStyle} eggs`
  },
  // Wrapper function style
  solids: ng((meat, eggs) => [meat, eggs].join(', ')),
});

const factory = blueprint.construct();

// Everything continues to work as before, except you can now safely uglify code
factory
  .withMeat('ham')
  .withEggStyle('scrambled')
  .withDrink('orange juice')
  .getBreakfast();
// => 'ham with scrambled eggs and orange juice'

const anotherFactory = blueprint.construct()
  .withMeat('steak')
  .withEggStyle('pouched');

anotherFactory.getSolids();
// => 'steak, pouched eggs'

anotherFactory.getEggs();
// => 'puched eggs'

anotherFactory.getBreakfast();
// => Error unable to resolve drink at breakfast
```
