function parseExpenseText_(text) {
  const value = String(text || '').trim().replace(/\u3000/g, ' ');
  let match = value.match(/^([\d,]+)\s*円?\s+(.+)$/);
  let memo;
  let amountText;
  if (match) {
    amountText = match[1];
    memo = match[2].trim();
  } else {
    match = value.match(/^(.+?)\s+([\d,]+)\s*円?$/);
    if (!match) return null;
    memo = match[1].trim();
    amountText = match[2];
  }
  const amount = Number(amountText.replace(/,/g, ''));
  if (!memo || !Number.isInteger(amount) || amount <= 0) return null;
  return { memo: memo, amount: amount };
}

function inferCategory_(memo) {
  const rows = getDataRows_(SHEET_NAMES.CATEGORIES);
  const exact = rows.find(function (row) { return String(row[CATEGORY_COLUMNS.NAME - 1]) === memo; });
  if (exact) return exact[CATEGORY_COLUMNS.NAME - 1];
  const lowerMemo = String(memo).toLowerCase();
  for (let i = 0; i < rows.length; i += 1) {
    const keywords = String(rows[i][CATEGORY_COLUMNS.KEYWORDS - 1] || '').split(/[,\u3001]/)
      .map(function (keyword) { return keyword.trim().toLowerCase(); }).filter(Boolean);
    if (keywords.some(function (keyword) { return lowerMemo.indexOf(keyword) >= 0; })) {
      return rows[i][CATEGORY_COLUMNS.NAME - 1];
    }
  }
  return 'その他';
}

function registerExpense_(expense) {
  const row = [
    Utilities.getUuid(), expense.date || new Date(), Number(expense.amount),
    expense.category || inferCategory_(expense.memo), expense.memo || '', expense.inputMethod,
    expense.userId, new Date(), EXPENSE_STATUS.CONFIRMED,
  ];
  getSheet_(SHEET_NAMES.EXPENSES).appendRow(row);
  return row;
}

function registerTextExpense_(userId, parsed) {
  const category = inferCategory_(parsed.memo);
  registerExpense_({ userId: userId, memo: parsed.memo, amount: parsed.amount, category: category, inputMethod: INPUT_METHODS.TEXT });
  const total = getMonthExpenseSummary_(new Date()).total;
  return '✅ 登録: ' + category + ' ' + formatYen_(parsed.amount) + '（' + parsed.memo + '）\n今月の合計: ' + formatYen_(total);
}

function cancelLastExpense_(userId) {
  const sheet = getSheet_(SHEET_NAMES.EXPENSES);
  const rows = getDataRows_(SHEET_NAMES.EXPENSES);
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (String(rows[i][EXPENSE_COLUMNS.LINE_USER_ID - 1]) === userId &&
        String(rows[i][EXPENSE_COLUMNS.STATUS - 1]) === EXPENSE_STATUS.CONFIRMED) {
      sheet.getRange(i + 2, EXPENSE_COLUMNS.STATUS).setValue(EXPENSE_STATUS.CANCELLED);
      return '↩️ 取り消しました: ' + rows[i][EXPENSE_COLUMNS.CATEGORY - 1] + ' ' + formatYen_(rows[i][EXPENSE_COLUMNS.AMOUNT - 1]);
    }
  }
  return '取り消せる支出がありません。';
}
