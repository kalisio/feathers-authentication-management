'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/* eslint-env node */

var errors = require('feathers-errors');
var debug = require('debug')('authManagement:checkUniqueness');

// This module is usually called from the UI to check username, email, etc. are unique.
module.exports = function checkUniqueness(options, identifyUser, ownId, meta) {
  debug('checkUniqueness', identifyUser, ownId, meta);
  var users = options.app.service(options.service);
  var usersIdName = users.id;

  var keys = Object.keys(identifyUser).filter(function (key) {
    return identifyUser[key] !== undefined && identifyUser[key] !== null;
  });

  return Promise.all(keys.map(function (prop) {
    return users.find({ query: _defineProperty({}, prop, identifyUser[prop].trim()) }).then(function (data) {
      var items = Array.isArray(data) ? data : data.data;
      var isNotUnique = items.length > 1 || items.length === 1 && items[0][usersIdName] !== ownId;

      return isNotUnique ? prop : null;
    });
  })).catch(function (err) {
    throw new errors.GeneralError(err);
  }).then(function (allProps) {
    var errProps = allProps.filter(function (prop) {
      return prop;
    });

    if (errProps.length) {
      var errs = {};
      errProps.forEach(function (prop) {
        errs[prop] = 'Already taken.';
      });

      throw new errors.BadRequest(meta.noErrMsg ? null : 'Values already taken.', { errors: errs });
    }

    return null;
  });
};