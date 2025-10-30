-- R2 키 기반으로 전환 (이전 base64 컬럼은 남겨 두되 null 허용)
-- Migration: 0020_add_r2_receipts_support.sql

ALTER TABLE receipts ADD COLUMN image_key TEXT;          -- R2 object key
ALTER TABLE receipts ADD COLUMN image_mime TEXT;
ALTER TABLE receipts ADD COLUMN image_size INTEGER;
ALTER TABLE receipts ADD COLUMN image_width INTEGER;
ALTER TABLE receipts ADD COLUMN image_height INTEGER;

-- 업로드-거래 자동 연동을 위해 인덱스 있으면 좋음
CREATE INDEX IF NOT EXISTS idx_receipts_user_date ON receipts(user_id, purchase_date);
