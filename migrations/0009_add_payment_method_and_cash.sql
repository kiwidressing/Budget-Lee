-- 거래 내역에 결제 수단 추가
-- Migration: 0009_add_payment_method_and_cash.sql

-- Add payment_method column to transactions
ALTER TABLE transactions ADD COLUMN payment_method TEXT;

-- 인덱스 추가 (IF NOT EXISTS ensures idempotency)
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
