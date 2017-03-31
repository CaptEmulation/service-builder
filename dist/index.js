'use strict';

var _ = require('lodash');
var getParameterNames = require('@captemulation/get-parameter-names');

function upperFirst(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function camelPrepend(prefix, name) {
  var ret = '' + prefix + upperFirst(name);
  return ret;
}

var namer = _.curry(camelPrepend)('with');

function factory(services) {
  var serviceMap = {};

  var _dsl = {
    define: function define(services) {
      Object.keys(services).forEach(function (name) {
        var dependencies = void 0,
            provider = services[name];
        if (Array.isArray(provider)) {
          dependencies = provider;
          provider = provider.pop();
        } else {
          dependencies = getParameterNames(provider);
        }
        _dsl.service({ provider: provider, dependencies: dependencies, name: name });
      });
      return _dsl;
    },
    service: function service(deps) {
      var name = deps.name;
      var dependencies = deps.dependencies;
      var provider = deps.provider;

      if (serviceMap[name]) {
        throw new Error('Already have ' + name + ' registered');
      }

      serviceMap[name] = {
        dependencies: dependencies,
        provider: provider
      };

      return _dsl;
    },
    dsl: function dsl(input) {
      var deps = input || {};

      // Get an array of all dependency arrays
      var flattenedDeps = _(serviceMap).values().map(function (v) {
        return v.dependencies;
      }).value();

      // Find the union set of all dependencies
      flattenedDeps = _.union.apply(_, flattenedDeps);

      // Find the dependencies not yet defined in deps
      var keys = Object.keys(deps);
      var remaining = _.difference(flattenedDeps, keys);

      // Create an object to satify the remaining dependencies
      var subDsl = remaining.reduce(function (prev, dep) {
        prev[camelPrepend('with', dep)] = function (param) {
          deps[dep] = param;
          return _dsl.dsl(deps);
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
        var singleton = void 0;

        return function serviceResolve() {
          if (!singleton) {
            if (service.loading) {
              throw new Error('Circular dependency error with ' + name + ' at ' + loading.join(' => '));
            }
            service.loading = true;
            // Iterate through dependencies
            var args = service.dependencies.map(function (dep) {
              // If not defined but has a service provider, then resolve that
              if (_.isUndefined(deps[dep]) && serviceMap[dep] && _.isFunction(serviceMap[dep].provider)) {
                var newflattenedDeps = [dep].concat(loading);
                // Recursively resolve the dependency and save
                deps[dep] = resolver(dep, newflattenedDeps, serviceMap[dep])();
              }
              // uh-oh... unresolved dependency
              if (!deps.hasOwnProperty(dep)) {
                throw new Error('Failed to resolve ' + dep + ' at ' + loading.join(' => '));
              }
              return deps[dep];
            });
            var isAsync = !!args.filter(function (arg) {
              return arg instanceof Promise || arg && _.isFunction(arg.then);
            }).length;
            if (isAsync) {
              singleton = Promise.all(args).then(function (resolvedArgs) {
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

      // Append services
      Object.keys(serviceMap).reduce(function (prev, serviceName) {
        var service = serviceMap[serviceName];
        prev[camelPrepend('get', serviceName)] = resolver(serviceName, [serviceName], service);
        return prev;
      }, subDsl);

      return subDsl;
    }
  };
  return _dsl.define(services || {});
}

module.exports = factory;