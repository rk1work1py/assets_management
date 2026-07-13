function getMonthExpenseSummary_(date) {
  const year = Number(Utilities.formatDate(date, APP_TIME_ZONE, 'yyyy'));
  const month = Number(Utilities.formatDate(date, APP_TIME_ZONE, 'M')) - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  const byCategory = {};
  let total = 0;
  getDataRows_(SHEET_NAMES.EXPENSES).forEach(function (row) {
    const rowDate = row[EXPENSE_COLUMNS.DATE - 1];
    if (!(rowDate instanceof Date) || rowDate < start || rowDate >= end ||
        row[EXPENSE_COLUMNS.STATUS - 1] !== EXPENSE_STATUS.CONFIRMED) return;
    const amount = Number(row[EXPENSE_COLUMNS.AMOUNT - 1]) || 0;
    const category = String(row[EXPENSE_COLUMNS.CATEGORY - 1] || 'その他');
    total += amount;
    byCategory[category] = (byCategory[category] || 0) + amount;
  });
  return { yearMonth: formatYearMonth_(start), total: total, byCategory: byCategory };
}

function addMonths_(date, delta) {
  const result = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  return result;
}

function buildMonthlyReport_(targetDate, limitCategories) {
  const current = getMonthExpenseSummary_(targetDate);
  if (!current.total) return '📊 ' + current.yearMonth + '\n登録がありません。';
  const previous = getMonthExpenseSummary_(addMonths_(targetDate, -1));
  const categories = Object.keys(current.byCategory)
    .sort(function (a, b) { return current.byCategory[b] - current.byCategory[a]; });
  if (limitCategories) categories.splice(limitCategories);
  const lines = ['📊 ' + current.yearMonth + 'の支出', '合計: ' + formatYen_(current.total)];
  categories.forEach(function (category) { lines.push('・' + category + ': ' + formatYen_(current.byCategory[category])); });
  if (previous.total) {
    const diff = current.total - previous.total;
    const percent = Math.round(diff / previous.total * 100);
    lines.push('前月比: ' + (diff >= 0 ? '+' : '') + formatYen_(diff) + ' (' + (percent >= 0 ? '+' : '') + percent + '%)');
  }
  const budgets = {};
  getDataRows_(SHEET_NAMES.CATEGORIES).forEach(function (row) {
    const budget = Number(row[CATEGORY_COLUMNS.MONTHLY_BUDGET - 1]);
    if (budget > 0) budgets[String(row[CATEGORY_COLUMNS.NAME - 1])] = budget;
  });
  Object.keys(budgets).forEach(function (category) {
    const actual = current.byCategory[category] || 0;
    const diff = budgets[category] - actual;
    lines.push(category + '予算: ' + (diff >= 0 ? '残り ' : '超過 ') + formatYen_(Math.abs(diff)));
  });
  return lines.join('\n');
}

function runMonthlyReport() {
  const today = new Date();
  const reportDay = Number(getSettingValues_(SETTING_KEYS.REPORT_DAY)[0] || 1);
  if (Number(Utilities.formatDate(today, APP_TIME_ZONE, 'd')) !== reportDay) return;
  let message = buildMonthlyReport_(addMonths_(today, -1), 5);
  if (!hasAssetSnapshotForMonth_(formatYearMonth_(today))) {
    message += '\n\n💰「資産」と送って今月の残高を登録してください。';
  }
  const userIds = Array.from(new Set(getSettingValues_(SETTING_KEYS.DELIVERY_USER_ID).map(String)));
  userIds.forEach(function (userId) {
    try { pushMessage(userId, message); } catch (error) { console.error('Monthly push failed for ' + userId + ': ' + error.stack); }
  });
}
