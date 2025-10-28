-- 영수증과 거래내역 연결을 위한 transaction_id 추가
ALTER TABLE receipts ADD COLUMN transaction_id INTEGER;

-- 외래 키 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_receipts_transaction ON receipts(transaction_id);

-- image_type을 nullable로 변경 (이미지가 없을 수도 있음)
-- SQLite는 ALTER COLUMN을 지원하지 않으므로, 새로운 영수증은 NULL을 허용
