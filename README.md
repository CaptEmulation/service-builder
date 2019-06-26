[![npm version](https://badge.fury.io/js/service-builder.svg)](https://badge.fury.io/js/service-builder) [![Build Status](https://travis-ci.org/CaptEmulation/service-builder.svg?branch=master)](https://travis-ci.org/CaptEmulation/service-builder)

# Introduction

`service-builder` is a dependency injection framework that helps developers write factories that satisfy the principle of least privilege for functional arguments. The target audience for this library are those that like having factories but not necessarily writing them. In addition, this library makes writing unit tests with mocked dependencies a breeze.  

# Example

Let's assume we are building a car module.  The initial approach might be to create an object that has implicit dependencies:

```
function createCar() {
  const engine = createEngine();
  const wheels = createWheels();
  return {
    start() {
      engine.start();
    },
    drive() {
      if (engine.isRunning) {
        wheels.rotate();
      }
    }
  }
}
```
 - [ ] Supports dependency injection
 - [x] Supports principle of least privilege

This initial version is great because calling `createCar` is all that is needed to make a car.  Nothing more is needed to be known about how a car works.  However, the car that is being create is not very flexible.  Only one type of car can exist.

Later developers learn that engines can have a variable number of cylinders and wheels can have different friction coefficients.  To support these the `createCar` factory is modified:

```
function createCar(engineCylinders, wheelFriction) {
  const engine = createEngine(engineCylinders);
  const wheels = createWheels(wheelFriction);
  return {
    start() {
      engine.start();
    },
    drive() {
      if (engine.isRunning) {
        wheels.rotate();
      }
    }
  }
}
```

- [ ] Supports dependency injection
- [ ] Supports principle of least privilege

Uh-oh... Now the `createCar` class is becoming very tightly coupled to its dependencies.  Furthermore, any changes to `createEngine` or `createWheels` now requires changes to `createCar` *and any code that is dependent on Car*.  We still don't support dependency injection, but also now `createCar` needs to know more about `createEngine` and `createWheels`.

For reasons of dependency injection, passing in dependencies as arguments helps write code that supports dependency injection.

```
function createCar(engine, wheels) {
  return {
    start() {
      engine.start();
    },
    drive() {
      if (engine.isRunning) {
        wheels.rotate();
      }
    }
  }
}
```

- [x] Supports dependency injection
- [ ] Supports principle of least privilege

Great!  Now `createCar` doesn't care where `engine` and `wheels` came from.  However, the problem of least privilege has only been moved around.  Now, in order to make a car instance, clients need to also make an `engine` and `wheels`.  Our code for instantiating a car has gone from:

```
const car = createCar();
```
to
```
const car = createCar(6, 0.2);
```
to
```
const car = createCar(createEngine(6), createWheels(0.2));
```

Now imagine that `createEngine` and `createWheels` end up needing additional dependencies.  Before long, in order to use `createCar`, the developer will need to first create the rubber, the metal, the wood panelling and then tighten every screw.

`service-builder` can create a factory for building cars.

```
import builder from 'service-builder';

const carBlueprint = builder({
  car(engine, wheels): createCar,
  engine(cylinders): createEngine,
  wheels(friction): createWheels,
});

const sportsCarFactory = carBlueprint.dsl({
  cylinders: 8,
  friction: 0.9,
});

// Now anyone can make a sports car:
const sportsCar = sportsCarFactory.getCar();
```

`service-builder` will automatically create, walk and fill the dependency tree in order to create a instances.  Users of the factory do not need to car how instances are built.


Now that we have a blueprint, we can create new factories with different dependencies:

```
const sedanFactory = blueprint.dsl({
  cylinders: 4,
  friction: 0.6,
});

// Make a sedan
const sedan = sedanFactory.getCar();
```

Or even with entirely new types:

```
const rocketCarFactory = blueprint.dsl({
  engine: createJetEngine,
  wheels: createRetractableWheels,
});

const rocketCar = rocketCarFactory.getCar();
```

With the factory DSL, dependencies do not need to be provided initially.

```
const enginelessCarFactory = builder({
  car(engine, wheels): createCar,
  wheels(friction): createWheels,
}).dsl({
  friction: 0.9,
});

enginelessCarFactory.getCar(); // Error: Failed to resolve engine from wheels,friction at car

enginelessCarFactory
  .withEngine(engine)
  .getCar(); // Success
```

# Functional Factories

Instead of the DSL syntax, a functional factory can be created.

```
const carBlueprint = builder({
  car(engine, wheels): createCar,
  engine(cylinders): createEngine,
  wheels(friction): createWheels,
});

const racingCarFactory = carBlueprint.factory({
  cylinders: 12,
  friction: 0.95,
});

racingCarFactory(car => {
  // Do something with car
});
```

The function passed into the factory will have dependencies matching the name of the arguments injected into the function when it is called.

# Dependency Injection

Creating a factory is always a two-step process.  The examples here go from builder => blueprint => factory.  Blueprint dependencies can be replaced at any time or overloaded when creating the final factory.  This is most useful for test.

```
const carBlueprint = builder({
  car(engine, wheels): createCar,
  engine(cylinders): createEngine,
  wheels(friction): createWheels,
});

// Create factory with mock wheels
const mockWheels = { rotate: mockFunc };
const testCarFactory = carBlueprint.dsl({
  cylinders: 0,
  // Since we are injecting the wheels, friction is no longer required
  wheels: mockWheels,
});

const testCar = testCarFactory.getCar();
testCar.start();
testCar.drive();
expect(mockWheels.rotate).toHaveBeenCalled();
```

# Additional Usage

```
import builder from 'service-builder'

const blueprint = builder({
  breakfast: function (meat, eggs, drink) {
    return `${meat} with ${eggs} and ${drink}`;
  },
  eggs: eggStyle => `${eggStyle} eggs`,
  solids: (meat, eggs) => [meat, eggs].join(', ')
});

const factory = blueprint.dsl();

factory
  .withMeat('ham')
  .withEggStyle('scrambled')
  .withDrink('orange juice')
  .getBreakfast();
// => 'ham with scrambled eggs and orange juice'

const anotherFactory = blueprint.dsl({
  meat: 'sausage'
})
  .withEggStyle('scrambled');

anotherFactory.getSolids();
// => 'ham, scrambled eggs'

anotherFactory.getEggs();
// => 'scrambled eggs'

anotherFactory.getBreakfast();
// => Error: Failed to resolve drink from meat,eggStyle,eggs at breakfast
```
# Lazy properties
Instead of using the getter functions, there are also lazily evaluated properties on the factory

```
const blueprint = builder({
  eggs: eggStyle => `${eggStyle} eggs`,
});
const factory = blueprint.dsl({
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
const factory = blueprint.dsl();
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
const factory = blueprint.dsl({
  eggStyle: 'fried',
  meatStyle: 'rare',
});
console.log(factory.$((meat, eggs) => `${eggs} and ${meat}`));
// => 'fried eggs and rare steak'
```

Alternatively, you can forgo the DSL syntax in favor of a pure resolver.  A resolver will accept a function and will call the function with all dependencies resolved (or will throw an error):

```
const blueprint = builder({
  eggs: eggStyle => `${eggStyle} eggs`,
  meat: meatStyle => `${meatStyle} steak`,
});
const $ = blueprint.factory({
  eggStyle: 'fried',
  meatStyle: 'rare',
});
console.log($((meat, eggs) => `${eggs} and ${meat}`));
// => 'fried eggs and rare steak'

// DSLs will also include a factory resolver named $

const factory = blueprint.dsl({
  eggStyle: 'fried',
  meatStyle: 'rare',
});
console.log(factory.$((meat, eggs) => `${eggs} and ${meat}`));
```

# Promises

If any dependencies return a promise, then the promise will be resolved before being used as dependency.  A side effect of this behavior is that any service that depends on a promise will also return a promise.

```
import builder from 'service-builder'

const blueprint = builder({
  breakfast: function (meat, eggs, drink) {
    return `${meat} with ${eggs} and ${drink}`;
  },
  // Get eggs async
  eggs: eggStyle => Promise.resolve(`${eggStyle} eggs`),
  solids: (meat, eggs) => [meat, eggs].join(', ')
});

const factory = blueprint.dsl();

factory
  .withMeat('ham')
  .withEggStyle('scrambled')
  .withDrink('orange juice')
  .getBreakfast()
  .then(console.log.bind(console));
// => 'ham with scrambled eggs and orange juice'

const anotherFactory = blueprint.dsl()
  .withMeat('ham')
  .withEggStyle('scrambled');

anotherFactory.getSolids()
  .then(console.log.bind(console));
// => 'ham, scrambled eggs'

anotherFactory.getEggs()
  .then(console.log.bind(console));
// => 'scrambled eggs'

anotherFactory.getBreakfast()
  .then(console.log.bind(console), console.error.bind(console));
// => Error: Failed to resolve drink from meat,eggStyle,eggs at breakfast

```

# Async

Promise providers work well with async / await

```
import builder from 'service-builder'

const blueprint = builder({
  breakfast: function (meat, eggs, drink) {
    return `${meat} with ${eggs} and ${drink}`;
  },
  // Get eggs async
  eggs: async eggStyle => await asyncOperation(`${eggStyle} eggs`),
  solids: (meat, eggs) => [meat, eggs].join(', ')
});

const factory = blueprint.dsl();

console.log(await factory
  .withMeat('ham')
  .withEggStyle('scrambled')
  .withDrink('orange juice')
  .getBreakfast());
// => 'ham with scrambled eggs and orange juice'

const anotherFactory = blueprint.dsl()
  .withMeat('ham')
  .withEggStyle('scrambled');

console.log(await anotherFactory.getSolids());
// => 'ham, scrambled eggs'

console.log(await anotherFactory.getEggs());
// => 'scrambled eggs'

console.log(await anotherFactory.getBreakfast());
// => Error: Failed to resolve drink from meat,eggStyle,eggs at breakfast
```

# Surviving Uglification

Minification / uglifying code mangles variable names which breaks being able to resolve dependencies from function names.  The fix is the same as Angular 1.x, to use array style dependencies.  service-builder also supports annotate-ng style tags and is compatible with `ng-annotate` and `babel-plugin-angularjs-annotate`

```
import builder from 'service-builder'

const blueprint = builder({
  // Array style
  breakfast: ['meat', 'eggs', 'drink', function (meat, eggs, drink) {
    return `${meat} with ${eggs} and ${drink}`;
  }],
  // Directive style
  eggs: eggStyle => {
    "ngInject";
    return `${eggStyle} eggs`
  },
  // Wrapper function style
  solids: ng((meat, eggs) => [meat, eggs].join(', ')),
});

const factory = blueprint.dsl();

// Everything continues to work as before, except you can now safely uglify code
factory
  .withMeat('ham')
  .withEggStyle('scrambled')
  .withDrink('orange juice')
  .getBreakfast();
// => 'ham with scrambled eggs and orange juice'

const anotherFactory = blueprint.dsl()
  .withMeat('steak')
  .withEggStyle('pouched');

anotherFactory.getSolids();
// => 'steak, pouched eggs'

anotherFactory.getEggs();
// => 'puched eggs'

anotherFactory.getBreakfast();
// => Error: Failed to resolve drink from meat,eggStyle,eggs at breakfast
```

# License

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
