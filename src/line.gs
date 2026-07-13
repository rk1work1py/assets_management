const LINE_API_BASE = 'https://api.line.me/v2/bot';
const LINE_DATA_API_BASE = 'https://api-data.line.me/v2/bot';

function replyMessage(replyToken, texts) {
  if (!replyToken) return;
  return callLineApi_('/message/reply', {
    replyToken: replyToken,
    messages: normalizeLineMessages_(texts),
  });
}

function pushMessage(userId, texts) {
  return callLineApi_('/message/push', {
    to: userId,
    messages: normalizeLineMessages_(texts),
  });
}

function getMessageContent(messageId) {
  const response = UrlFetchApp.fetch(LINE_DATA_API_BASE + '/message/' + encodeURIComponent(messageId) + '/content', {
    method: 'get',
    headers: { Authorization: 'Bearer ' + getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_CHANNEL_ACCESS_TOKEN) },
    muteHttpExceptions: true,
  });
  assertHttpSuccess_(response, 'LINE content API');
  return response.getBlob();
}

function callLineApi_(path, payload) {
  const response = UrlFetchApp.fetch(LINE_API_BASE + path, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_CHANNEL_ACCESS_TOKEN) },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  assertHttpSuccess_(response, 'LINE Messaging API');
  return response;
}

function normalizeLineMessages_(texts) {
  const values = Array.isArray(texts) ? texts : [texts];
  return values.slice(0, 5).map(function (value) {
    return typeof value === 'string' ? { type: 'text', text: value.slice(0, 5000) } : value;
  });
}

function assertHttpSuccess_(response, label) {
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(label + ' failed (' + code + '): ' + response.getContentText());
  }
}
