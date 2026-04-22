var cors  = require('../src/server/apihelpers/_cors');
var auth  = require('../src/server/apihelpers/_auth');
var rl    = require('../src/server/apihelpers/_ratelimit');
var krona = require('../src/core/diet/kronaEngine');

// ─── ROUTE HANDLERS ─────────────────────────────────────────────────────────

// POST /api/diet-engine?__route=generate
// Body: user profile fields
function handleGenerate(req, res, user) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var payload = req.body || {};
  var result = krona.generatePlan(payload);

  if (result.failSafe) {
    return res.status(422).json({
      success: false,
      error: result.error || { reason: 'Dados insuficientes para gerar o plano.' }
    });
  }

  return res.status(200).json({
    success: true,
    activeState: result.activeState,
    prescription: result.prescription,
    strategy: result.strategy
  });
}

// POST /api/diet-engine?__route=substitutions
// Body: { state, mealOrdem, blockName }
function handleSubstitutions(req, res, user) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var body = req.body || {};
  var state     = body.state;
  var mealOrdem = Number(body.mealOrdem);
  var blockName = String(body.blockName || '');

  if (!state || !mealOrdem || !blockName) {
    return res.status(400).json({ success: false, error: 'state, mealOrdem e blockName são obrigatórios.' });
  }

  var result = krona.getSubstitutions(state, mealOrdem, blockName);
  if (result.error) {
    return res.status(404).json({ success: false, error: result.error });
  }

  return res.status(200).json({ success: true, options: result.options });
}

// POST /api/diet-engine?__route=swap
// Body: { state, mealOrdem, blockName, newFoodCode }
function handleSwap(req, res, user) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var body = req.body || {};
  var state       = body.state;
  var mealOrdem   = Number(body.mealOrdem);
  var blockName   = String(body.blockName   || '');
  var newFoodCode = String(body.newFoodCode || '');

  if (!state || !mealOrdem || !blockName || !newFoodCode) {
    return res.status(400).json({ success: false, error: 'state, mealOrdem, blockName e newFoodCode são obrigatórios.' });
  }

  var result = krona.swapFood(state, mealOrdem, blockName, newFoodCode);
  if (result.warnings && result.warnings.length) {
    return res.status(422).json({ success: false, error: result.warnings[0], warnings: result.warnings });
  }

  return res.status(200).json({
    success: true,
    activeState: result.state,
    message: result.message
  });
}

// POST /api/diet-engine?__route=remove-block
// Body: { state, mealOrdem, blockName }
function handleRemoveBlock(req, res, user) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var body = req.body || {};
  var state     = body.state;
  var mealOrdem = Number(body.mealOrdem);
  var blockName = String(body.blockName || '');

  if (!state || !mealOrdem || !blockName) {
    return res.status(400).json({ success: false, error: 'state, mealOrdem e blockName são obrigatórios.' });
  }

  var result = krona.removeBlock(state, mealOrdem, blockName);
  if (result.warnings && result.warnings.length) {
    return res.status(422).json({ success: false, error: result.warnings[0], warnings: result.warnings });
  }

  return res.status(200).json({
    success: true,
    activeState: result.state,
    message: result.message
  });
}

// POST /api/diet-engine?__route=adjust-portion
// Body: { state, mealOrdem, blockName, newGrams }
function handleAdjustPortion(req, res, user) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var body = req.body || {};
  var state     = body.state;
  var mealOrdem = Number(body.mealOrdem);
  var blockName = String(body.blockName || '');
  var newGrams  = Number(body.newGrams  || 0);

  if (!state || !mealOrdem || !blockName || !newGrams) {
    return res.status(400).json({ success: false, error: 'state, mealOrdem, blockName e newGrams são obrigatórios.' });
  }

  var result = krona.adjustPortion(state, mealOrdem, blockName, newGrams);
  if (result.warnings && result.warnings.length) {
    return res.status(422).json({ success: false, error: result.warnings[0] });
  }

  return res.status(200).json({
    success: true,
    activeState: result.state,
    message: result.message
  });
}

// POST /api/diet-engine?__route=print
// Body: { state }
function handlePrint(req, res, user) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var body  = req.body || {};
  var state = body.state;

  if (!state) {
    return res.status(400).json({ success: false, error: 'state é obrigatório.' });
  }

  var printable = krona.renderForPrint(state);
  return res.status(200).json({ success: true, prescription: printable });
}

// ─── ROUTER ─────────────────────────────────────────────────────────────────

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  return auth.requireAuth(req, res, function(user) {
    return rl.rateLimit(req, res, function() {
      var route = (req.query && req.query.__route) || 'generate';

      switch (route) {
        case 'generate':       return handleGenerate(req, res, user);
        case 'substitutions':  return handleSubstitutions(req, res, user);
        case 'swap':           return handleSwap(req, res, user);
        case 'remove-block':   return handleRemoveBlock(req, res, user);
        case 'adjust-portion': return handleAdjustPortion(req, res, user);
        case 'print':          return handlePrint(req, res, user);
        default:
          return res.status(404).json({ error: 'Rota não encontrada: ' + route });
      }
    }, { max: 30, windowMs: 60000, category: 'diet_engine' }, user.id);
  });
};
