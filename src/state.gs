const STATE_TTL_SECONDS = 30 * 60;
const STATE_TYPES = Object.freeze({ RECEIPT_PENDING: 'receipt_pending', ASSET_INPUT: 'asset_input' });

function getState_(userId) {
  const value = CacheService.getScriptCache().get('state:' + userId);
  if (!value) return null;
  try { return JSON.parse(value); } catch (error) { clearState_(userId); return null; }
}

function setState_(userId, state) {
  CacheService.getScriptCache().put('state:' + userId, JSON.stringify(state), STATE_TTL_SECONDS);
}

function clearState_(userId) {
  CacheService.getScriptCache().remove('state:' + userId);
}
