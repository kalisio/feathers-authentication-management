'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

/* eslint-env node */

var errors = require('feathers-errors');
var debug = require('debug')('authManagement:identityChange');

var _require = require('./helpers'),
    getLongToken = _require.getLongToken,
    getShortToken = _require.getShortToken,
    ensureObjPropsValid = _require.ensureObjPropsValid,
    comparePasswords = _require.comparePasswords,
    notifier = _require.notifier;

module.exports = function identityChange(options, identifyUser, password, changesIdentifyUser) {
  // note this call does not update the authenticated user info in hooks.params.user.
  debug('identityChange', password, changesIdentifyUser);
  var users = options.app.service(options.service);
  var usersIdName = users.id;
  var sanitizeUserForClient = options.sanitizeUserForClient;


  return Promise.resolve().then(function () {
    ensureObjPropsValid(identifyUser, options.identifyUserProps);
    ensureObjPropsValid(changesIdentifyUser, options.identifyUserProps);

    return users.find({ query: identifyUser }).then(function (data) {
      return Array.isArray(data) ? data[0] : data.data[0];
    });
  }).then(function (user1) {
    return Promise.all([user1, getLongToken(options.longTokenLen), getShortToken(options.shortTokenLen, options.shortTokenDigits), comparePasswords(password, user1.password, function () {
      return new errors.BadRequest('Password is incorrect.', { errors: { password: 'Password is incorrect.', $className: 'badParams' } });
    })]);
  }).then(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 3),
        user1 = _ref2[0],
        longToken = _ref2[1],
        shortToken = _ref2[2];

    var patchToUser = {
      verifyExpires: Date.now() + options.delay,
      verifyToken: longToken,
      verifyShortToken: shortToken,
      verifyChanges: changesIdentifyUser
    };

    return patchUser(user1, patchToUser);
  }).then(function (user1) {
    return notifier(options.notifier, 'identityChange', user1, null);
  }).then(function (user1) {
    return sanitizeUserForClient(user1);
  });

  function patchUser(user1, patchToUser) {
    return users.patch(user1[usersIdName], patchToUser, {}) // needs users from closure
    .then(function () {
      return Object.assign(user1, patchToUser);
    });
  }
};