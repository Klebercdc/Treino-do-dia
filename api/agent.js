var chatHandler = require('./chat');

module.exports = function(req, res) {
  req.body = Object.assign({}, req.body || {}, {
    legacyAgentAdapter: true,
    stream: false
  });
  return chatHandler(req, res);
};
