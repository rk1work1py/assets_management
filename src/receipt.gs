const GEMINI_MODEL = 'gemini-2.5-flash';

function handleReceiptImage_(userId, messageId) {
  clearState_(userId);
  const blob = getMessageContent(messageId);
  const categories = getDataRows_(SHEET_NAMES.CATEGORIES).map(function (row) { return String(row[0]); }).filter(Boolean);
  const result = analyzeReceiptWithGemini_(blob, categories);
  setState_(userId, { type: STATE_TYPES.RECEIPT_PENDING, receipt: result });
  let text = '🧾 ' + (result.store || '店名不明') + ' / ' + (result.date || '日付不明') + ' / ' +
    formatYen_(result.total) + ' / ' + result.category + '\nこの内容で登録しますか？\nOK / 金額のみ返信 / キャンセル';
  if (result.confidence === 'low') text = '⚠️ ' + (result.warning || '読み取り結果を確認してください') + '\n' + text;
  return text;
}

function analyzeReceiptWithGemini_(blob, categories) {
  const apiKey = getScriptProperty_(SCRIPT_PROPERTY_KEYS.GEMINI_API_KEY);
  const prompt = '日本のレシートから店名、日付、税込の実際支払合計、カテゴリを抽出する。' +
    '割引・ポイント利用後の支払額を使い、預り金やお釣りと混同しない。' +
    '小計+税=合計を検算し、不一致または不鮮明な場合はconfidenceをlowにしwarningに理由を書く。' +
    'カテゴリは次から1つ: ' + categories.join(', ');
  const schema = { type: 'OBJECT', properties: {
    store: { type: 'STRING', nullable: true }, date: { type: 'STRING', nullable: true },
    total: { type: 'INTEGER' }, category: { type: 'STRING', enum: categories },
    confidence: { type: 'STRING', enum: ['high', 'low'] }, warning: { type: 'STRING', nullable: true },
  }, required: ['total', 'category', 'confidence'] };
  const payload = { contents: [{ parts: [
    { text: prompt }, { inlineData: { mimeType: blob.getContentType() || 'image/jpeg', data: Utilities.base64Encode(blob.getBytes()) } },
  ] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema } };
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(apiKey);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
      assertHttpSuccess_(response, 'Gemini API');
      const body = JSON.parse(response.getContentText());
      const text = body.candidates[0].content.parts.map(function (part) { return part.text || ''; }).join('');
      return validateReceiptResult_(JSON.parse(text), categories);
    } catch (error) { lastError = error; if (attempt === 0) Utilities.sleep(500); }
  }
  throw lastError;
}

function validateReceiptResult_(result, categories) {
  result.total = Number(result.total);
  if (!Number.isInteger(result.total) || result.total <= 0) throw new Error('Gemini returned an invalid receipt total');
  if (categories.indexOf(result.category) < 0) result.category = 'その他';
  if (result.date) {
    const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(result.date);
    const parsed = validFormat ? new Date(result.date + 'T12:00:00+09:00') : null;
    if (!parsed || isNaN(parsed.getTime()) || Utilities.formatDate(parsed, APP_TIME_ZONE, 'yyyy-MM-dd') !== result.date) result.date = null;
  }
  result.confidence = result.confidence === 'low' ? 'low' : 'high';
  return result;
}

function confirmReceipt_(userId, correctedAmount) {
  const state = getState_(userId);
  if (!state || state.type !== STATE_TYPES.RECEIPT_PENDING) return '期限切れです。もう一度写真を送ってください。';
  const receipt = state.receipt;
  const amount = correctedAmount === undefined ? receipt.total : correctedAmount;
  registerExpense_({ userId: userId, memo: receipt.store || 'レシート', amount: amount,
    category: receipt.category, date: receipt.date ? new Date(receipt.date + 'T12:00:00+09:00') : new Date(), inputMethod: INPUT_METHODS.RECEIPT });
  clearState_(userId);
  return '✅ ' + (correctedAmount ? formatYen_(amount) + 'に訂正して' : '') + '登録しました。';
}
