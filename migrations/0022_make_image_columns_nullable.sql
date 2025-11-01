-- Make image_data and image_type nullable in receipts table
-- Migration: 0022_make_image_columns_nullable.sql

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
CREATE TABLE receipts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_name TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  amount REAL NOT NULL,
  category TEXT,
  description TEXT,
  payment_method TEXT,
  image_data TEXT,  -- Changed from NOT NULL to nullable
  image_type TEXT,  -- Changed from NOT NULL to nullable
  tags TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT,
  transaction_id INTEGER,
  image_key TEXT,
  image_mime TEXT,
  image_size INTEGER,
  image_width INTEGER,
  image_height INTEGER,
  is_tax_deductible INTEGER DEFAULT 0,
  merchant TEXT
);

-- Copy data from old table
INSERT INTO receipts_new SELECT * FROM receipts;

-- Drop old table
DROP TABLE receipts;

-- Rename new table
ALTER TABLE receipts_new RENAME TO receipts;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_date ON receipts(user_id, purchase_date);
