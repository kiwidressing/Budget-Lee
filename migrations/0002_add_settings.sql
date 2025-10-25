-- 설정 (Settings)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  currency TEXT DEFAULT 'KRW',
  initial_balance INTEGER DEFAULT 0,
  initial_savings INTEGER DEFAULT 0,
  category_colors TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기본값 삽입
INSERT OR IGNORE INTO settings (id, currency, initial_balance, initial_savings) 
VALUES (1, 'KRW', 0, 0);
