/**
 * Spreadsheet schema and shared storage helpers.
 * Keep sheet names, columns, commands, and other cross-file literals here.
 */

const APP_TIME_ZONE = 'Asia/Tokyo';

const SCRIPT_PROPERTY_KEYS = Object.freeze({
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  LINE_CHANNEL_ACCESS_TOKEN: 'LINE_CHANNEL_ACCESS_TOKEN',
  LINE_CHANNEL_SECRET: 'LINE_CHANNEL_SECRET',
  GEMINI_API_KEY: 'GEMINI_API_KEY',
});

const SHEET_NAMES = Object.freeze({
  EXPENSES: '支出',
  ASSET_SNAPSHOTS: '資産スナップショット',
  ASSET_MASTER: '資産マスタ',
  CATEGORIES: 'カテゴリ',
  SETTINGS: '設定',
});

const SHEET_HEADERS = Object.freeze({
  [SHEET_NAMES.EXPENSES]: Object.freeze([
    'id', '日付', '金額', 'カテゴリ', '店名・メモ', '入力方法', 'LINEユーザーID', '登録日時', '状態',
  ]),
  [SHEET_NAMES.ASSET_SNAPSHOTS]: Object.freeze([
    '年月', '資産名', '種別', '評価額', '登録日時', 'メモ',
  ]),
  [SHEET_NAMES.ASSET_MASTER]: Object.freeze([
    '資産名', '種別', '表示順', '有効',
  ]),
  [SHEET_NAMES.CATEGORIES]: Object.freeze([
    'カテゴリ名', 'キーワード', '月予算',
  ]),
  [SHEET_NAMES.SETTINGS]: Object.freeze([
    'key', '値', '説明',
  ]),
});

const EXPENSE_COLUMNS = Object.freeze({
  ID: 1,
  DATE: 2,
  AMOUNT: 3,
  CATEGORY: 4,
  MEMO: 5,
  INPUT_METHOD: 6,
  LINE_USER_ID: 7,
  CREATED_AT: 8,
  STATUS: 9,
});

const ASSET_SNAPSHOT_COLUMNS = Object.freeze({
  YEAR_MONTH: 1,
  ASSET_NAME: 2,
  TYPE: 3,
  VALUE: 4,
  CREATED_AT: 5,
  MEMO: 6,
});

const ASSET_MASTER_COLUMNS = Object.freeze({
  ASSET_NAME: 1,
  TYPE: 2,
  DISPLAY_ORDER: 3,
  ENABLED: 4,
});

const CATEGORY_COLUMNS = Object.freeze({
  NAME: 1,
  KEYWORDS: 2,
  MONTHLY_BUDGET: 3,
});

const SETTING_COLUMNS = Object.freeze({
  KEY: 1,
  VALUE: 2,
  DESCRIPTION: 3,
});

const DEFAULT_CATEGORIES = Object.freeze([
  '食費',
  '外食',
  '日用品',
  '交通',
  '住居・光熱',
  '通信',
  '医療・健康',
  '衣服・美容',
  '趣味・娯楽',
  '交際費',
  '特別支出',
  'その他',
]);

const ASSET_TYPES = Object.freeze([
  '現金預金', '株式', '投資信託', '年金', 'その他',
]);

const COMMANDS = Object.freeze({
  HELP: 'ヘルプ',
  THIS_MONTH: '今月',
  LAST_MONTH: '先月',
  ASSET: '資産',
  ASSET_TREND: '資産推移',
  CANCEL_LAST: '取消',
  CONFIRM: 'OK',
  CANCEL: 'キャンセル',
});

const EXPENSE_STATUS = Object.freeze({
  CONFIRMED: '確定',
  CANCELLED: '取消',
});

const INPUT_METHODS = Object.freeze({
  TEXT: 'text',
  RECEIPT: 'receipt',
});

const SETTING_KEYS = Object.freeze({
  REPORT_DAY: 'レポート配信日',
  DELIVERY_USER_ID: '配信先ユーザーID',
});

const TRIGGER_FUNCTIONS = Object.freeze({
  MONTHLY_REPORT: 'runMonthlyReport',
});

/**
 * Returns the configured spreadsheet.
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty(SCRIPT_PROPERTY_KEYS.SPREADSHEET_ID);

  if (!spreadsheetId) {
    throw new Error(
      'Script property SPREADSHEET_ID is not configured. ' +
      'Set it in Apps Script project settings before running setup().'
    );
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * Returns a required sheet or throws a descriptive error.
 * @param {string} sheetName
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Required sheet is missing: ' + sheetName + '. Run setup() first.');
  }
  return sheet;
}
