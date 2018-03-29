'use strict';

var service = require('./service');
var hooks = require('./hooks');

service.hooks = hooks;
module.exports = service;