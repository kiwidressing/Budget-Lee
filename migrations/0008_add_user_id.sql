-- Add user_id column to all user-specific tables
-- Migration: 0008_add_user_id.sql

-- Add user_id to transactions
ALTER TABLE transactions ADD COLUMN user_id TEXT;

-- Add user_id to savings_accounts
ALTER TABLE savings_accounts ADD COLUMN user_id TEXT;

-- Add user_id to fixed_expenses
ALTER TABLE fixed_expenses ADD COLUMN user_id TEXT;

-- Add user_id to fixed_expense_payments
ALTER TABLE fixed_expense_payments ADD COLUMN user_id TEXT;

-- Add user_id to category_budgets
ALTER TABLE category_budgets ADD COLUMN user_id TEXT;

-- Add user_id to investments
ALTER TABLE investments ADD COLUMN user_id TEXT;

-- Add user_id to investment_transactions
ALTER TABLE investment_transactions ADD COLUMN user_id TEXT;

-- Add user_id to receipts
ALTER TABLE receipts ADD COLUMN user_id TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_accounts_user_id ON savings_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user_id ON fixed_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expense_payments_user_id ON fixed_expense_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_category_budgets_user_id ON category_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_user_id ON investment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
