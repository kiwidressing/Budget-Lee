-- 투자 (주식) 관리 테이블
CREATE TABLE IF NOT EXISTS investments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,           -- 주식 심볼 (예: AAPL, TSLA)
  name TEXT NOT NULL,              -- 회사 이름
  quantity INTEGER NOT NULL,       -- 보유 수량
  purchase_price REAL NOT NULL,   -- 매수 평균가
  purchase_date DATE NOT NULL,     -- 매수일
  notes TEXT,                      -- 메모
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 투자 거래 내역 (매수/매도 기록)
CREATE TABLE IF NOT EXISTS investment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),  -- 매수/매도
  quantity INTEGER NOT NULL,       -- 수량
  price REAL NOT NULL,             -- 거래 가격
  total_amount REAL NOT NULL,      -- 총 금액
  transaction_date DATE NOT NULL,  -- 거래일
  notes TEXT,                      -- 메모
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_investments_symbol ON investments(symbol);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_investment_id ON investment_transactions(investment_id);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_date ON investment_transactions(transaction_date);
