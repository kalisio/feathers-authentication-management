'use strict';

/* eslint-env node */

var errors = require('feathers-errors');
var debug = require('debug')('authManagement:main');

var checkUniqueness = require('./checkUniqueness');
var resendVerifySignup = require('./resendVerifySignup');

var _require = require('./verifySignup'),
    verifySignupWithLongToken = _require.verifySignupWithLongToken,
    verifySignupWithShortToken = _require.verifySignupWithShortToken;

var sendResetPwd = require('./sendResetPwd');

var _require2 = require('./resetPassword'),
    resetPwdWithLongToken = _require2.resetPwdWithLongToken,
    resetPwdWithShortToken = _require2.resetPwdWithShortToken;

var passwordChange = require('./passwordChange');
var identityChange = require('./identityChange');

var _require3 = require('./helpers'),
    sanitizeUserForClient = _require3.sanitizeUserForClient;

var optionsDefault = {
  app: null,
  service: '/users', // need exactly this for test suite
  path: 'authManagement',
  notifier: function notifier() {
    return Promise.resolve();
  },
  longTokenLen: 15, // token's length will be twice this
  shortTokenLen: 6,
  shortTokenDigits: true,
  resetDelay: 1000 * 60 * 60 * 2, // 2 hours
  delay: 1000 * 60 * 60 * 24 * 5, // 5 days
  identifyUserProps: ['email'],
  sanitizeUserForClient: sanitizeUserForClient
};

module.exports = function () {
  var options1 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  debug('service being configured.');
  var options = Object.assign({}, optionsDefault, options1);

  return function () {
    return authManagement(options, this);
  };
};

function authManagement(options, app) {
  // 'function' needed as we use 'this'
  debug('service initialized');
  options.app = app;

  options.app.use(options.path, {
    create: function create(data) {
      debug('service called. action=' + data.action);

      switch (data.action) {
        case 'checkUnique':
          return checkUniqueness(options, data.value, data.ownId || null, data.meta || {});
        case 'resendVerifySignup':
          return resendVerifySignup(options, data.value, data.notifierOptions);
        case 'verifySignupLong':
          return verifySignupWithLongToken(options, data.value);
        case 'verifySignupShort':
          return verifySignupWithShortToken(options, data.value.token, data.value.user);
        case 'sendResetPwd':
          return sendResetPwd(options, data.value, data.notifierOptions);
        case 'resetPwdLong':
          return resetPwdWithLongToken(options, data.value.token, data.value.password);
        case 'resetPwdShort':
          return resetPwdWithShortToken(options, data.value.token, data.value.user, data.value.password);
        case 'passwordChange':
          return passwordChange(options, data.value.user, data.value.oldPassword, data.value.password);
        case 'identityChange':
          return identityChange(options, data.value.user, data.value.password, data.value.changes);
        case 'options':
          return Promise.resolve(options);
        default:
          return Promise.reject(new errors.BadRequest('Action \'' + data.action + '\' is invalid.', { errors: { $className: 'badParams' } }));
      }
    }
  });
}