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

function factory(services) {
  const serviceMap = {};

  const dsl = {
    define(services) {
      Object.keys(services).forEach(name => {
        let dependencies, provider = services[name];
        if (Array.isArray(provider)) {
          dependencies = provider;
          provider = provider.pop();
        } else {
          dependencies = getParameterNames(provider);
        }
        dsl.service({ provider, dependencies, name});
      });
      return dsl;
    },
    service(deps) {
      const name = deps.name;
      const dependencies = deps.dependencies;
      const provider = deps.provider;

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
      const deps = input || {};

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

      // Create an object to satify the remaining dependencies
      const subDsl = remaining.reduce((prev, dep) => {
        prev[camelPrepend('with', dep)] = param => {
          deps[dep] = param;
          return dsl.dsl(deps);
        };
        return prev;
      }, {});
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
                throw new Error(`Failed to resolve ${dep} at ${loading.join(' => ')}`);
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

      // Append services
      Object.keys(serviceMap).reduce((prev, serviceName) => {
        let service = serviceMap[serviceName];
        prev[camelPrepend('get', serviceName)] = resolver(serviceName, [serviceName], service);
        return prev;
      }, subDsl);

      return subDsl;
    }
  };
  return dsl.define(services || {});
}

module.exports = factory;
