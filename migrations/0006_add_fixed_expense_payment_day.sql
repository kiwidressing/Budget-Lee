-- 고정지출에 매월 특정 일자 필드 추가
-- NOTE: This migration is superseded by 0007_modify_fixed_expense_constraints.sql
-- Migration 0007 recreates the fixed_expenses table with payment_day already included
-- This migration is kept as a no-op for migration history consistency

-- To make this idempotent, we check if column exists before adding
-- Create a dummy table to mark this migration as executed
CREATE TABLE IF NOT EXISTS _migration_0006_executed (
  id INTEGER PRIMARY KEY,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert a record to mark execution
INSERT OR IGNORE INTO _migration_0006_executed (id) VALUES (1);

-- Note: The actual payment_day column is added by migration 0007 during table recreation
-- frequency 체크 제약조건 업데이트 (daily 추가)
-- SQLite는 ALTER TABLE로 CHECK 제약조건을 수정할 수 없으므로 주석으로만 남김
-- 새로운 frequency 값: 'monthly', 'weekly', 'monthly_day' (매월 특정 일자)
-- This is also handled by migration 0007
