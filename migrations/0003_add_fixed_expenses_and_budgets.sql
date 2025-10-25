-- 고정지출 (Fixed Expenses)
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  frequency TEXT NOT NULL CHECK(frequency IN ('monthly', 'weekly')),
  week_of_month INTEGER CHECK(week_of_month BETWEEN 1 AND 4),
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 고정지출 지불 기록 (Fixed Expense Payments)
CREATE TABLE IF NOT EXISTS fixed_expense_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fixed_expense_id INTEGER NOT NULL,
  transaction_id INTEGER NOT NULL,
  payment_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fixed_expense_id) REFERENCES fixed_expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fixed_expense_payments_date 
ON fixed_expense_payments(fixed_expense_id, payment_date);

-- 카테고리별 예산 (Category Budgets)
CREATE TABLE IF NOT EXISTS category_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL UNIQUE,
  monthly_budget INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_category_budgets_category ON category_budgets(category);
