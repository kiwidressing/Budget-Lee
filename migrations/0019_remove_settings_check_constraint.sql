-- Remove CHECK constraint from settings table to support multiple users
-- Migration: 0019_remove_settings_check_constraint.sql

-- SQLite doesn't support ALTER TABLE DROP CONSTRAINT
-- So we need to recreate the table without the constraint

-- Step 1: Create new settings table without CHECK constraint
CREATE TABLE IF NOT EXISTS settings_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency TEXT DEFAULT 'KRW',
  initial_balance INTEGER DEFAULT 0,
  initial_savings INTEGER DEFAULT 0,
  category_colors TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  cash_on_hand INTEGER DEFAULT 0,
  user_id TEXT
);

-- Step 2: Copy existing data (only columns that exist in old table)
INSERT INTO settings_new (id, currency, initial_balance, initial_savings, category_colors, created_at, user_id)
SELECT id, currency, initial_balance, initial_savings, category_colors, created_at, user_id 
FROM settings;

-- Step 3: Drop old table
DROP TABLE settings;

-- Step 4: Rename new table to settings
ALTER TABLE settings_new RENAME TO settings;

-- Step 5: Recreate index
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
