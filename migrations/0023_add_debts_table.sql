-- 채무 관리 테이블 생성
CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creditor TEXT NOT NULL,              -- 채권자 (빌려준 사람/기관)
  amount REAL NOT NULL,                -- 채무 금액
  remaining_amount REAL NOT NULL,      -- 남은 금액
  interest_rate REAL DEFAULT 0,        -- 이자율 (%)
  start_date TEXT NOT NULL,            -- 시작일
  due_date TEXT,                       -- 만기일
  status TEXT DEFAULT 'active',        -- 상태 (active, paid, overdue)
  category TEXT DEFAULT '개인',        -- 카테고리 (개인, 은행, 카드, 기타)
  notes TEXT,                          -- 메모
  user_id TEXT NOT NULL,               -- 사용자 ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 채무 상환 내역 테이블
CREATE TABLE IF NOT EXISTS debt_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id INTEGER NOT NULL,
  amount REAL NOT NULL,                -- 상환 금액
  payment_date TEXT NOT NULL,          -- 상환일
  notes TEXT,                          -- 메모
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_user_id ON debt_payments(user_id);
