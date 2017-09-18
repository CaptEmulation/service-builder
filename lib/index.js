'use strict';

const _ = require('lodash');
const getParameterNames = require('@captemulation/get-parameter-names');

function upperFirst(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function camelPrepend(prefix, name) {
  const ret = `${prefix}${upperFirst(name)}`;
  return ret;
}

const namer = _.curry(camelPrepend)('with');

function getDeps(_provider) {
  let dependencies = provider;
  let provider = _.isFunction(_provider) ? _provider : () => _provider;
  if (Array.isArray(_provider)) {
    dependencies = _provider;
    provider = _provider.pop();
  } else {
    dependencies = getParameterNames(provider);
  }
  return {
    dependencies,
    provider,
  };
}

function factory(services) {
  const serviceMap = {};

  const dsl = {
    define(services) {
      const serviceKeys = Object.keys(services);
      if (serviceKeys.indexOf('$') !== -1) {
        throw new Error('$ is a reserved internal dependency for factory functions');
      }
      serviceKeys.forEach(name => {
        dsl.service(Object.assign(getDeps(services[name]), { name }));
      });
      return dsl;
    },
    service(deps) {
      const name = deps.name;
      const dependencies = deps.dependencies;
      const provider = _.isFunction(deps.provider) ? deps.provider : () => deps.provider;

      if (serviceMap[name]) {
        throw new Error(`Already have ${name} registered`);
      }

      serviceMap[name] = {
        dependencies,
        provider
      };

      return dsl;
    },
    dsl(input) {
      console.warn('service-builder#builder#dsl is deprecated.  Use construct instead');
      return dsl.construct(input);
    },
    construct(input) {
      const deps = input || {};
      serviceMap.$ = {
        provider: () => {},
        dependencies: [],
      };
      const serviceKeys = Object.keys(serviceMap);

      // Get an array of all dependency arrays
      let flattenedDeps = _(serviceMap)
        .values()
        .map(v => v.dependencies)
        .value();

      // Find the union set of all dependencies
      flattenedDeps = _.union.apply(_, flattenedDeps);

      // Find the dependencies not yet defined in deps
      const keys = Object.keys(deps);
      const remaining = _.difference(flattenedDeps, keys);

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
            const args = service.dependencies.map(dep => {
              // If not defined but has a service provider, then resolve that
              if (_.isUndefined(deps[dep]) && serviceMap[dep] && _.isFunction(serviceMap[dep].provider)) {
                const newflattenedDeps = [dep].concat(loading);
                // Recursively resolve the dependency and save
                deps[dep] = resolver(dep, newflattenedDeps, serviceMap[dep])();
              }
              // uh-oh... unresolved dependency
              if (!deps.hasOwnProperty(dep)) {
                throw new Error(`Failed to resolve ${dep} from ${Object.keys(deps)} at ${loading.join(' => ')}`);
              }
              return deps[dep];
            });
            const isAsync = !!args.filter(arg => arg instanceof Promise || (arg && _.isFunction(arg.then))).length;
            if (isAsync) {
              singleton = Promise.all(args).then(resolvedArgs => {
                service.loading = false;
                return service.provider.apply(null, resolvedArgs);
              });
            } else {
              service.loading = false;
              singleton = service.provider.apply(null, args);
            }
          }
          return singleton;
        }
      }

      serviceMap.$.provider = () => provider => resolver('$', ['$'], getDeps(provider))();

      // Create an object to satify the remaining dependencies
      const subDsl = remaining.reduce((prev, dep) => {
        prev[camelPrepend('with', dep)] = param => {
          deps[dep] = param;
          return dsl.construct(deps);
        };
        return prev;
      }, {});

      // Append services
      Object.defineProperties(subDsl,
        serviceKeys
          .reduce((memo, serviceName) => {
            let service = serviceMap[serviceName];

            const getter = resolver(serviceName, [serviceName], service);
            memo[serviceName] = {
              get() {
                return getter();
              },
              enumerable: serviceName !== '$',
              configurable: false,
            }
            if (serviceName !== '$') {
              memo[camelPrepend('get', serviceName)] = {
                value: getter,
                enumerable: true,
                configurable: false,
              };
            }
            return memo;
          }, {}),
      );

      return subDsl;
    }
  };
  return dsl.define(services || {});
}

module.exports = factory;
