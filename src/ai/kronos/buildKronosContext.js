'use strict';

var kronosContextHub = require('../../server/apihelpers/_kronosContextHub');

async function buildKronosContext(options) {
  return kronosContextHub.buildKronosContext(options || {});
}

module.exports = {
  buildKronosContext: buildKronosContext
};
