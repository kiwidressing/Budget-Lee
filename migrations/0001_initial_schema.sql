-- 저축 통장 (Savings Accounts)
CREATE TABLE IF NOT EXISTS savings_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  balance INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 거래 내역 (Transactions)
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'savings')),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  savings_account_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (savings_account_id) REFERENCES savings_accounts(id) ON DELETE CASCADE
);

-- 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
