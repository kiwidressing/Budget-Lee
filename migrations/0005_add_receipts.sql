-- Receipts table for managing receipt images and metadata
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_name TEXT NOT NULL,                    -- 구매처 (예: 스타벅스, 쿠팡, 다이소)
  purchase_date DATE NOT NULL,                 -- 구매 날짜
  amount REAL NOT NULL,                        -- 금액
  category TEXT,                               -- 카테고리 (선택사항: 식비, 생활용품 등)
  description TEXT,                            -- 구매 내역 설명 (예: 커피 2잔, 노트북 거치대)
  payment_method TEXT,                         -- 결제수단 (선택사항: 신용카드, 현금 등)
  image_data TEXT NOT NULL,                    -- Base64 encoded image data
  image_type TEXT NOT NULL,                    -- Image MIME type (image/jpeg, image/png, etc.)
  tags TEXT,                                   -- 태그 (콤마로 구분, 예: "세금공제,사업비용")
  notes TEXT,                                  -- 추가 메모
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(purchase_date);
CREATE INDEX IF NOT EXISTS idx_receipts_store ON receipts(store_name);
CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category);
CREATE INDEX IF NOT EXISTS idx_receipts_tags ON receipts(tags);
