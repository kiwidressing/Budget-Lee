-- 거래 내역에 결제 수단 추가
-- Migration: 0009_add_payment_method_and_cash.sql
-- Note: Columns already exist in production database from previous runs
-- This migration is kept for history but converted to no-op

-- Create marker table
CREATE TABLE IF NOT EXISTS _migration_0009_executed (
  id INTEGER PRIMARY KEY,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO _migration_0009_executed (id) VALUES (1);

-- 인덱스 추가 (IF NOT EXISTS ensures idempotency)
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
