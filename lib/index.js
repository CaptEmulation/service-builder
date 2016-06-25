'use strict';

const _ = require('lodash');
const getParameterNames = require('get-parameter-names');

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
        const provider = services[name];
        const dependencies = getParameterNames(provider);
        dsl.service({ provider, dependencies, name});
      });
      return dsl;
    },
    service(opts) {
      const name = opts.name;
      const dependencies = opts.dependencies;
      const provider = opts.provider;

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
      const opts = input || {};

      // Get an array of all dependency arrays
      let deps = _(serviceMap)
        .values()
        .map(v => v.dependencies)
        .value();

      // Find the union set of all dependencies
      deps = _.union.apply(_, deps);

      // Find the dependencies not yet defined in opts
      const keys = Object.keys(opts);
      const remaining = _.difference(deps, keys);

      // Create an object to satify the remaining dependencies
      const subDsl = remaining.reduce((prev, dep) => {
        prev[camelPrepend('with', dep)] = param => {
          opts[dep] = param;
          return dsl.dsl(opts);
        };
        return prev;
      }, {});

      // Find satisfied dependencies to append services
      Object.keys(serviceMap).reduce((prev, serviceName) => {
        let service = serviceMap[serviceName];
        if (service.dependencies.length === 0 || _.difference(service.dependencies, Object.keys(opts)).length === 0) {
          prev[camelPrepend('get', serviceName)] = () => {
            const args = service.dependencies.map(dep => opts[dep]);
            return service.provider.apply(null, args);
          }
        }
        return prev;
      }, subDsl);

      return subDsl;
    }
  };
  return dsl.define(services || {});
}

module.exports = factory;

