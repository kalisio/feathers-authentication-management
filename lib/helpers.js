'use strict';

/* eslint-env node */
/* eslint no-param-reassign: 0 */

var bcrypt = require('bcryptjs');
var crypto = require('crypto');
var auth = require('feathers-authentication-local').hooks;
var errors = require('feathers-errors');
var debug = require('debug')('authManagement:helpers');

var hashPassword = function hashPassword(app1, password) {
  var hook = {
    type: 'before',
    data: { password: password },
    params: { provider: null },
    app: {
      get: function get(str) {
        return app1.get(str);
      }
    }
  };

  return auth.hashPassword()(hook).then(function (hook1) {
    return hook1.data.password;
  });
};

var concatIDAndHash = function concatIDAndHash(id, token) {
  return id + '___' + token;
};

var deconstructId = function deconstructId(token) {
  if (token.indexOf('___') === -1) {
    throw new errors.BadRequest('Token is not in the correct format.', { errors: { $className: 'badParams' } });
  }
  return token.slice(0, token.indexOf('___'));
};

var comparePasswords = function comparePasswords(oldPassword, password, getError) {
  return new Promise(function (resolve, reject) {
    bcrypt.compare(oldPassword, password, function (err, data1) {
      if (err || !data1) {
        return reject(getError());
      }

      return resolve();
    });
  });
};

var _randomBytes = function _randomBytes(len) {
  return new Promise(function (resolve, reject) {
    crypto.randomBytes(len, function (err, buf) {
      return err ? reject(err) : resolve(buf.toString('hex'));
    });
  });
};

var _randomDigits = function _randomDigits(len) {
  var str = '';

  while (str.length < len) {
    str += parseInt('0x' + crypto.randomBytes(4).toString('hex')).toString();
  }

  return str.substr(0, len);
};

var getLongToken = function getLongToken(len) {
  return _randomBytes(len);
};

var getShortToken = function getShortToken(len, ifDigits) {
  if (ifDigits) {
    return Promise.resolve(_randomDigits(len));
  }

  return _randomBytes(Math.floor(len / 2) + 1).then(function (str) {
    str = str.substr(0, len);

    if (str.match(/^[0-9]+$/)) {
      // tests will fail on all digits
      str = 'q' + str.substr(1); // shhhh, secret.
    }

    return str;
  });
};

var getUserData = function getUserData(data, checks) {
  if (Array.isArray(data) ? data.length === 0 : data.total === 0) {
    throw new errors.BadRequest('User not found.', { errors: { $className: 'badParams' } });
  }

  var users = Array.isArray(data) ? data : data.data || [data];
  var user = users[0];

  if (users.length !== 1) {
    throw new errors.BadRequest('More than 1 user selected.', { errors: { $className: 'badParams' } });
  }

  if (checks.includes('isNotVerified') && user.isVerified) {
    throw new errors.BadRequest('User is already verified.', { errors: { $className: 'isNotVerified' } });
  }

  if (checks.includes('isNotVerifiedOrHasVerifyChanges') && user.isVerified && !Object.keys(user.verifyChanges || {}).length) {
    throw new errors.BadRequest('User is already verified & not awaiting changes.', { errors: { $className: 'nothingToVerify' } });
  }

  if (checks.includes('isVerified') && !user.isVerified) {
    throw new errors.BadRequest('User is not verified.', { errors: { $className: 'isVerified' } });
  }

  if (checks.includes('verifyNotExpired') && user.verifyExpires < Date.now()) {
    throw new errors.BadRequest('Verification token has expired.', { errors: { $className: 'verifyExpired' } });
  }

  if (checks.includes('resetNotExpired') && user.resetExpires < Date.now()) {
    throw new errors.BadRequest('Password reset token has expired.', { errors: { $className: 'resetExpired' } });
  }

  return user;
};

var ensureObjPropsValid = function ensureObjPropsValid(obj, props, allowNone) {
  var keys = Object.keys(obj);
  var valid = keys.every(function (key) {
    return props.includes(key) && typeof obj[key] === 'string';
  });
  if (!valid || keys.length === 0 && !allowNone) {
    throw new errors.BadRequest('User info is not valid. (authManagement)', { errors: { $className: 'badParams' } });
  }
};

var ensureValuesAreStrings = function ensureValuesAreStrings() {
  for (var _len = arguments.length, rest = Array(_len), _key = 0; _key < _len; _key++) {
    rest[_key] = arguments[_key];
  }

  if (!rest.every(function (str) {
    return typeof str === 'string';
  })) {
    throw new errors.BadRequest('Expected string value. (authManagement)', { errors: { $className: 'badParams' } });
  }
};

// Verify that obj1 and obj2 have different 'field' field
// Returns false if either object is null/undefined
var ensureFieldHasChanged = function ensureFieldHasChanged(obj1, obj2) {
  return function (field) {
    return obj1 && obj2 && obj1[field] !== obj2[field];
  };
};

var sanitizeUserForClient = function sanitizeUserForClient(user) {
  var user1 = cloneObject(user);

  delete user1.password;
  delete user1.verifyExpires;
  delete user1.verifyToken;
  delete user1.verifyShortToken;
  delete user1.verifyChanges;
  delete user1.resetExpires;
  delete user1.resetToken;
  delete user1.resetShortToken;

  return user1;
};

var sanitizeUserForNotifier = function sanitizeUserForNotifier(user) {
  var user1 = cloneObject(user);
  delete user1.password;
  return user1;
};

/**
 * Returns new object with values cloned from the original object. Some objects
 * (like Sequelize or MongoDB model instances) contain circular references
 * and cause TypeError when trying to JSON.stringify() them. They may contain
 * custom toJSON() or toObject() method which allows to serialize them safely.
 * Object.assign() does not clone these methods, so the purpose of this method
 * is to use result of custom toJSON() or toObject() (if accessible)
 * for Object.assign(), but only in case of serialization failure.
 *
 * @param {Object?} obj - Object to clone
 * @returns {Object} Cloned object
 */
var cloneObject = function cloneObject(obj) {
  var obj1 = obj;

  if (typeof obj.toJSON === 'function' || typeof obj.toObject === 'function') {
    try {
      JSON.stringify(Object.assign({}, obj1));
    } catch (e) {
      debug('Object is not serializable');

      obj1 = obj1.toJSON ? obj1.toJSON() : obj1.toObject();
    }
  }

  return Object.assign({}, obj1);
};

var notifier = function notifier(optionsNotifier, type, user, notifierOptions) {
  debug('notifier', type);

  return Promise.resolve().then(function () {
    var promise = optionsNotifier(type, sanitizeUserForNotifier(user), notifierOptions || {});

    return promise && typeof promise.then === 'function' ? promise.then(function () {
      return user;
    }) : user;
  });
};

module.exports = {
  hashPassword: hashPassword,
  concatIDAndHash: concatIDAndHash,
  deconstructId: deconstructId,
  comparePasswords: comparePasswords,
  randomBytes: function randomBytes() {
    return _randomBytes.apply(undefined, arguments);
  }, // for testing, make safe from hacking
  randomDigits: function randomDigits() {
    return _randomDigits.apply(undefined, arguments);
  }, // for testing, make safe from hacking
  getLongToken: getLongToken,
  getShortToken: getShortToken,
  getUserData: getUserData,
  ensureObjPropsValid: ensureObjPropsValid,
  ensureValuesAreStrings: ensureValuesAreStrings,
  ensureFieldHasChanged: ensureFieldHasChanged,
  sanitizeUserForClient: sanitizeUserForClient,
  sanitizeUserForNotifier: sanitizeUserForNotifier,
  notifier: notifier
};