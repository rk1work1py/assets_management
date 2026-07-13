/**
 * Creates the initial spreadsheet schema, seed data, and daily report trigger.
 * This function is idempotent and can safely be run more than once.
 * @return {{createdSheets: string[], initializedSheets: string[], createdTrigger: boolean}}
 */
function setup() {
  const spreadsheet = getSpreadsheet_();
  const result = {
    createdSheets: [],
    initializedSheets: [],
    createdTrigger: false,
  };

  Object.keys(SHEET_HEADERS).forEach(function (sheetName) {
    const sheetResult = ensureSheet_(spreadsheet, sheetName, SHEET_HEADERS[sheetName]);
    if (sheetResult.created) {
      result.createdSheets.push(sheetName);
    }
    if (sheetResult.initialized) {
      result.initializedSheets.push(sheetName);
    }
  });

  seedDefaultCategories_();
  seedDefaultSettings_();
  result.createdTrigger = ensureDailyReportTrigger_();

  console.log(JSON.stringify(result));
  return result;
}

/**
 * Creates a sheet if necessary and writes headers only when the sheet is blank.
 * Existing content is never overwritten.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @param {string} sheetName
 * @param {string[]} headers
 * @return {{created: boolean, initialized: boolean}}
 */
function ensureSheet_(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  const created = !sheet;
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  let initialized = false;
  if (sheet.getLastRow() === 0 && sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    initialized = true;
  }

  return { created: created, initialized: initialized };
}

/** Seeds the category master only when it contains no data rows. */
function seedDefaultCategories_() {
  const sheet = getSheet_(SHEET_NAMES.CATEGORIES);
  if (sheet.getLastRow() > 1) {
    return;
  }

  const rows = DEFAULT_CATEGORIES.map(function (categoryName) {
    return [categoryName, '', ''];
  });
  sheet.getRange(2, 1, rows.length, SHEET_HEADERS[SHEET_NAMES.CATEGORIES].length)
    .setValues(rows);
}

/** Adds the default report day if the setting does not already exist. */
function seedDefaultSettings_() {
  const sheet = getSheet_(SHEET_NAMES.SETTINGS);
  const existingKeys = getExistingSettingKeys_(sheet);
  if (!existingKeys[SETTING_KEYS.REPORT_DAY]) {
    sheet.appendRow([
      SETTING_KEYS.REPORT_DAY,
      1,
      '毎月この日に先月レポートと資産登録リマインドを配信',
    ]);
  }
}

/**
 * Returns settings keys as a lookup object.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @return {Object<string, boolean>}
 */
function getExistingSettingKeys_(sheet) {
  const keys = {};
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return keys;
  }

  sheet.getRange(2, SETTING_COLUMNS.KEY, lastRow - 1, 1)
    .getValues()
    .forEach(function (row) {
      const key = String(row[0] || '').trim();
      if (key) {
        keys[key] = true;
      }
    });
  return keys;
}

/**
 * Ensures exactly one daily 9:00 trigger exists for the monthly report handler.
 * Existing triggers for other handlers are left untouched.
 * @return {boolean} true when a trigger was created
 */
function ensureDailyReportTrigger_() {
  const alreadyExists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === TRIGGER_FUNCTIONS.MONTHLY_REPORT;
  });
  if (alreadyExists) {
    return false;
  }

  ScriptApp.newTrigger(TRIGGER_FUNCTIONS.MONTHLY_REPORT)
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .inTimezone(APP_TIME_ZONE)
    .create();
  return true;
}
