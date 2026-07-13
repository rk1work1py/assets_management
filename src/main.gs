function doPost(e) {
  const output = ContentService.createTextOutput('OK');
  const rawBody = e && e.postData ? e.postData.contents : '';
  try {
    const signatureResult = verifyLineSignature_(rawBody, getLineSignature_(e));
    if (signatureResult === false) { console.error('Invalid LINE signature'); return output; }
    const body = JSON.parse(rawBody || '{"events":[]}');
    (body.events || []).forEach(handleLineEventSafely_);
  } catch (error) { console.error('Webhook error: ' + error.stack); }
  return output;
}

function doGet() {
  return ContentService.createTextOutput('LINE household asset management bot is running.');
}

function handleLineEventSafely_(event) {
  try { handleLineEvent_(event); }
  catch (error) {
    console.error('Event error: ' + error.stack);
    if (event.replyToken) {
      try { replyMessage(event.replyToken, buildSafeErrorMessage_(error)); } catch (replyError) { console.error(replyError.stack); }
    }
  }
}

function buildSafeErrorMessage_(error) {
  const message = String(error && error.message || error);
  if (message.indexOf('GEMINI_API_KEY') >= 0) return '⚠️ Gemini APIキーが設定されていません。';
  if (/Gemini API failed \(400\)/.test(message)) return '⚠️ Gemini APIのリクエストエラー（400）です。';
  if (/Gemini API failed \(403\)/.test(message)) return '⚠️ Gemini APIキーの権限エラー（403）です。';
  if (/Gemini API failed \(429\)/.test(message)) return '⚠️ Gemini APIの利用上限（429）です。少し待って再試行してください。';
  if (message.indexOf('LINE content API') >= 0) return '⚠️ LINEから画像を取得できませんでした。';
  return 'エラーが発生しました。もう一度試してください。';
}

function handleLineEvent_(event) {
  const userId = event.source && event.source.userId;
  if (!userId) return;
  if (event.type === 'follow') {
    addAllowedUser_(userId);
    replyMessage(event.replyToken, '友だち追加ありがとうございます！\n' + buildHelpMessage_());
    return;
  }
  if (event.type !== 'message' || !isAllowedUser_(userId)) return;
  if (event.message.type === 'image') {
    replyMessage(event.replyToken, handleReceiptImage_(userId, event.message.id));
    return;
  }
  if (event.message.type !== 'text') return;
  const response = routeTextMessage_(userId, event.message.text);
  if (response) replyMessage(event.replyToken, response);
}

function routeTextMessage_(userId, rawText) {
  const text = String(rawText || '').trim();
  const state = getState_(userId);
  if (text === COMMANDS.HELP) return buildHelpMessage_();
  if (text === COMMANDS.THIS_MONTH) return buildMonthlyReport_(new Date());
  if (text === COMMANDS.LAST_MONTH) return buildMonthlyReport_(addMonths_(new Date(), -1));
  if (text === COMMANDS.ASSET_TREND) return buildAssetTrend_();
  if (text === COMMANDS.ASSET) return startAssetInput_(userId);
  if (text === COMMANDS.CANCEL_LAST) return cancelLastExpense_(userId);
  if (/^(ok|おけ)$/i.test(text)) return confirmReceipt_(userId);
  if (text === COMMANDS.CANCEL && state && state.type === STATE_TYPES.RECEIPT_PENDING) { clearState_(userId); return '破棄しました。'; }
  if (state && state.type === STATE_TYPES.RECEIPT_PENDING && /^[\d,]+円?$/.test(text)) {
    const correctedAmount = Number(text.replace(/[,\u5186]/g, ''));
    return correctedAmount > 0 ? confirmReceipt_(userId, correctedAmount) : '金額は1円以上で送ってください。';
  }
  if (state && state.type === STATE_TYPES.ASSET_INPUT) return handleAssetInput_(userId, text);
  const parsed = parseExpenseText_(text);
  return parsed ? registerTextExpense_(userId, parsed) : '「ランチ 850」のように送ると登録できます。詳しくは「ヘルプ」。';
}

function buildHelpMessage_() {
  return '📖 使い方\n・ランチ 850: 支出登録\n・レシート写真: 読み取り登録\n・今月 / 先月: 支出集計\n・取消: 直前の支出を取消\n・資産: 今月の残高を登録\n・資産推移: 直近12ヶ月を表示';
}

function isAllowedUser_(userId) {
  return getSettingValues_(SETTING_KEYS.DELIVERY_USER_ID).map(String).indexOf(String(userId)) >= 0;
}

function addAllowedUser_(userId) {
  if (isAllowedUser_(userId)) return;
  getSheet_(SHEET_NAMES.SETTINGS).appendRow([SETTING_KEYS.DELIVERY_USER_ID, userId, '月次レポートの配信先']);
}
