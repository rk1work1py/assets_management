function getActiveAssets_() {
  return getDataRows_(SHEET_NAMES.ASSET_MASTER).map(function (row) {
    return { name: String(row[0]), type: String(row[1]), order: Number(row[2]) || 999, enabled: row[3] === true || String(row[3]).toUpperCase() === 'TRUE' };
  }).filter(function (asset) { return asset.name && asset.enabled; })
    .sort(function (a, b) { return a.order - b.order; });
}

function startAssetInput_(userId) {
  const assets = getActiveAssets_();
  if (!assets.length) return '資産マスタに有効な資産を登録してください。';
  setState_(userId, { type: STATE_TYPES.ASSET_INPUT });
  const rows = getDataRows_(SHEET_NAMES.ASSET_SNAPSHOTS);
  const lines = ['💰 資産名と現在額を1行ずつ送ってください。'];
  assets.forEach(function (asset) {
    const history = rows.filter(function (row) { return String(row[1]) === asset.name; })
      .sort(function (a, b) { return String(b[0]).localeCompare(String(a[0])); });
    lines.push(asset.name + (history.length ? ' (前回 ' + formatYen_(history[0][3]) + ')' : ''));
  });
  lines.push('\n例:\n〇〇銀行 1200000\nNISA投信 800000');
  return lines.join('\n');
}

function handleAssetInput_(userId, text) {
  const assets = getActiveAssets_();
  const successes = [];
  const errors = [];
  String(text).split(/\r?\n/).filter(Boolean).forEach(function (line) {
    const match = line.trim().match(/^(.+?)\s+([\d,]+)円?$/);
    if (!match) { errors.push(line + ': 形式を確認してください'); return; }
    const inputName = match[1].trim();
    const exact = assets.filter(function (asset) { return asset.name === inputName; });
    const prefix = exact.length ? exact : assets.filter(function (asset) { return asset.name.indexOf(inputName) === 0; });
    if (prefix.length !== 1) { errors.push(line + ': 資産名を特定できません'); return; }
    successes.push({ asset: prefix[0], amount: Number(match[2].replace(/,/g, '')) });
  });
  if (!successes.length) return '⚠️ ' + errors.join('\n');
  const yearMonth = formatYearMonth_(new Date());
  successes.forEach(function (entry) { upsertAssetSnapshot_(yearMonth, entry.asset, entry.amount); });
  clearState_(userId);
  const current = getAssetTotalForMonth_(yearMonth);
  const previous = getPreviousAssetTotal_(yearMonth);
  let response = '📈 登録しました。純資産: ' + formatYen_(current);
  if (previous !== null) response += '（前月比 ' + (current - previous >= 0 ? '+' : '') + formatYen_(current - previous) + '）';
  if (errors.length) response += '\n⚠️ ' + errors.join('\n');
  return response;
}

function upsertAssetSnapshot_(yearMonth, asset, amount) {
  const sheet = getSheet_(SHEET_NAMES.ASSET_SNAPSHOTS);
  const rows = getDataRows_(SHEET_NAMES.ASSET_SNAPSHOTS);
  const index = rows.findIndex(function (row) { return String(row[0]) === yearMonth && String(row[1]) === asset.name; });
  const values = [yearMonth, asset.name, asset.type, amount, new Date(), ''];
  if (index >= 0) sheet.getRange(index + 2, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
}

function getAssetTotalForMonth_(yearMonth) {
  return getDataRows_(SHEET_NAMES.ASSET_SNAPSHOTS).filter(function (row) { return String(row[0]) === yearMonth; })
    .reduce(function (sum, row) { return sum + (Number(row[3]) || 0); }, 0);
}

function getPreviousAssetTotal_(yearMonth) {
  const months = Array.from(new Set(getDataRows_(SHEET_NAMES.ASSET_SNAPSHOTS).map(function (row) { return String(row[0]); })))
    .filter(function (month) { return month < yearMonth; }).sort().reverse();
  return months.length ? getAssetTotalForMonth_(months[0]) : null;
}

function hasAssetSnapshotForMonth_(yearMonth) {
  return getDataRows_(SHEET_NAMES.ASSET_SNAPSHOTS).some(function (row) { return String(row[0]) === yearMonth; });
}

function buildAssetTrend_() {
  const totals = {};
  getDataRows_(SHEET_NAMES.ASSET_SNAPSHOTS).forEach(function (row) { totals[String(row[0])] = (totals[String(row[0])] || 0) + (Number(row[3]) || 0); });
  const months = Object.keys(totals).sort().slice(-12);
  if (!months.length) return '資産スナップショットがまだありません。';
  return '📈 純資産推移\n' + months.map(function (month) { return month + ': ' + formatYen_(totals[month]); }).join('\n');
}
