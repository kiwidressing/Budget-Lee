-- 거래 내역에 결제 수단 추가
ALTER TABLE transactions ADD COLUMN payment_method TEXT DEFAULT 'card';

-- 설정 테이블에 현금 보유량 추가 및 초기 저축액 제거
ALTER TABLE settings ADD COLUMN cash_on_hand INTEGER DEFAULT 0;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
