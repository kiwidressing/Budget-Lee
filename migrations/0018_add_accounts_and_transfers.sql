-- Task 8: 계좌(Accounts) 및 이체(Transfers) 모델 추가

-- ===== 계좌 테이블 =====
-- 다양한 금융 계좌 관리: 입출금 통장, 신용카드, 현금 등
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,                  -- 계좌명 (예: "신한은행 입출금", "삼성카드", "현금")
  type TEXT NOT NULL,                  -- 유형: checking, savings, credit_card, cash
  balance INTEGER DEFAULT 0,           -- 현재 잔액 (원)
  currency TEXT DEFAULT 'KRW',         -- 통화 (KRW, USD, EUR 등)
  is_active INTEGER DEFAULT 1,         -- 활성 여부 (0=비활성, 1=활성)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ===== 이체 테이블 =====
-- 계좌 간 자금 이동 기록
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  from_account_id INTEGER NOT NULL,    -- 출금 계좌
  to_account_id INTEGER NOT NULL,      -- 입금 계좌
  amount INTEGER NOT NULL,             -- 이체 금액 (원)
  description TEXT,                    -- 이체 메모
  transfer_date DATE NOT NULL,         -- 이체 날짜
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CHECK (from_account_id != to_account_id),  -- 동일 계좌 이체 방지
  CHECK (amount > 0)                         -- 0원 이하 이체 방지
);

-- ===== 인덱스 생성 =====
-- 계좌 조회 성능 최적화
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);

-- 이체 조회 성능 최적화
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_account ON transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_account ON transfers(to_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(transfer_date);

-- ===== 기존 transactions 테이블에 account_id 컬럼 추가 =====
-- 각 거래가 어느 계좌에서 발생했는지 추적
-- 기존 거래는 NULL 허용 (나중에 계좌 할당)
ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;

-- 거래의 계좌별 조회 성능 최적화
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
