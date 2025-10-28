-- Add savings goal to savings accounts
ALTER TABLE savings_accounts ADD COLUMN savings_goal INTEGER DEFAULT 0;
