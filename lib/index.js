const union = require('lodash.union');
const difference = require('lodash.difference');
const getParameterNames = require('@captemulation/get-parameter-names');

function upperFirst(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function camelPrepend(prefix, name) {
  const ret = `${prefix}${upperFirst(name)}`;
  return ret;
}

function isFunction(func) {
  return typeof func === 'function';
}

function isUndefined(t) {
  return typeof t === 'undefined';
}

function getDeps(_provider) {
  let provider = isFunction(_provider) ? _provider : () => _provider;
  let dependencies = provider;

  if (Array.isArray(_provider)) { // Array style
    dependencies = _provider;
    provider = _provider.pop();
  } else if (_provider.$inject) {
    dependencies = _provider.$inject; // $inject Angular style
  } else { // Code parse only style
    dependencies = getParameterNames(provider);
  }
  return {
    dependencies,
    provider,
  };
}

function createFactory(services) {
  const serviceMap = {};

  function decorateWithSetters({
    $,
    dsl,
    deps,
    resolver,
  }) {
    // Find the dependencies not yet defined in deps
    // Find the union set of all dependencies
    // Get an array of all dependency arrays
    const flattenedDeps = union(...Object.values(serviceMap)
      .map(v => v.dependencies));
    const serviceKeys = Object.keys(serviceMap);
    const remaining = difference(flattenedDeps, Object.keys(deps));

    // Create an object to satify the remaining dependencies
    const retFactory = remaining.reduce((prev, dep) => {
      prev[camelPrepend('with', dep)] = (param) => {
        deps[dep] = param;
        return dsl(deps);
      };
      return prev;
    }, {});

    // Append services
    Object.defineProperties(retFactory,
      serviceKeys
        .reduce((memo, serviceName) => {
          const service = serviceMap[serviceName];

          const getter = resolver(serviceName, [serviceName], service);
          memo[serviceName] = {
            get() {
              return getter();
            },
            enumerable: serviceName !== '$',
            configurable: false,
          };
          if (serviceName !== '$') {
            memo[camelPrepend('get', serviceName)] = {
              value: getter,
              enumerable: true,
              configurable: false,
            };
          }
          return memo;
        }, {}));
    Object.defineProperties(retFactory, {
      $: {
        value: $,
        enumerable: false,
        configurable: false,
      },
    });
    return retFactory;
  }

  function constructFactories(input) {
    let $;
    const deps = input || {};
    /**
     * Returns a function with attempts to load a service.
     *  - cached value of service will be used if already resolved
     *  - unitialized dependencies will be loaded
     *  - circular dependencies will cause error
     */
    function resolver(name, loading, service) {
      let singleton;

      return function serviceResolve() {
        if (!singleton) {
          if (service.loading) {
            throw new Error(`Circular dependency error with ${name} at ${loading.join(' => ')}`);
          }
          service.loading = true;
          // Iterate through dependencies
          const args = service.dependencies.map((dep) => {
            // If not defined but has a service provider, then resolve that
            if (
              isUndefined(deps[dep])
              && serviceMap[dep]
              && isFunction(serviceMap[dep].provider)
            ) {
              const newflattenedDeps = [dep].concat(loading);
              // Recursively resolve the dependency and save
              deps[dep] = resolver(dep, newflattenedDeps, serviceMap[dep])();
            }
            if (dep === '$' && !deps[dep]) {
              deps[dep] = $;
            }
            // uh-oh... unresolved dependency
            if (!Object.prototype.hasOwnProperty.call(deps, dep)) {
              throw new Error(`Failed to resolve ${dep} from ${Object.keys(deps)} at ${loading.join(' => ')}`);
            }
            return deps[dep];
          });
          const isAsync = !!args.filter(
            arg => arg instanceof Promise || (arg && isFunction(arg.then)),
          ).length;
          if (isAsync) {
            singleton = Promise.all(args).then((resolvedArgs) => {
              service.loading = false;
              return service.provider.apply(null, resolvedArgs);
            });
          } else {
            service.loading = false;
            singleton = service.provider.apply(null, args);
          }
        }
        return singleton;
      };
    }

    $ = provider => resolver('$', ['$'], getDeps(provider))();
    return [$, resolver];
  }

  const factory = {
    define(moreServices) {
      // eslint-disable-next-line no-restricted-syntax
      for (const [name, service] of Object.entries(moreServices)) {
        if (name === '$') {
          throw new Error('$ is a reserved internal dependency for factory functions');
        }
        factory.service(Object.assign(getDeps(service), { name }));
      }
      return factory;
    },
    service(deps) {
      const { name, dependencies } = deps;
      const provider = isFunction(deps.provider) ? deps.provider : () => deps.provider;

      if (serviceMap[name]) {
        throw new Error(`Already have ${name} registered`);
      }

      serviceMap[name] = {
        dependencies,
        provider,
      };

      return factory;
    },
    dsl(input = {}) {
      const [$, resolver] = constructFactories(input);
      return decorateWithSetters({
        $,
        dsl: factory.dsl,
        deps: input,
        resolver,
      });
    },
    factory(deps = {}) {
      return constructFactories(deps)[0];
    },
  };
  return factory.define(services || {});
}

module.exports = createFactory;
