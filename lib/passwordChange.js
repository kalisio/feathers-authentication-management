'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

/* eslint-env node */

var errors = require('feathers-errors');
var debug = require('debug')('authManagement:passwordChange');

var _require = require('./helpers'),
    ensureValuesAreStrings = _require.ensureValuesAreStrings,
    ensureObjPropsValid = _require.ensureObjPropsValid,
    hashPassword = _require.hashPassword,
    comparePasswords = _require.comparePasswords,
    notifier = _require.notifier;

module.exports = function passwordChange(options, identifyUser, oldPassword, password) {
  debug('passwordChange', oldPassword, password);
  var users = options.app.service(options.service);
  var usersIdName = users.id;
  var sanitizeUserForClient = options.sanitizeUserForClient;


  return Promise.resolve().then(function () {
    ensureValuesAreStrings(oldPassword, password);
    ensureObjPropsValid(identifyUser, options.identifyUserProps);

    return users.find({ query: identifyUser }).then(function (data) {
      return Array.isArray(data) ? data[0] : data.data[0];
    });
  }).then(function (user1) {
    return Promise.all([user1, hashPassword(options.app, password), comparePasswords(oldPassword, user1.password, function () {
      return new errors.BadRequest('Current password is incorrect.', { errors: { oldPassword: 'Current password is incorrect.' } });
    })]);
  }).then(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2),
        user1 = _ref2[0],
        hashedPassword = _ref2[1];

    return (// value from comparePassword is not needed
      patchUser(user1, {
        password: hashedPassword
      })
    );
  }).then(function (user1) {
    return notifier(options.notifier, 'passwordChange', user1);
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