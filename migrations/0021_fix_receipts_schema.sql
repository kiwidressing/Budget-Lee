-- Fix receipts table schema to match current API requirements
-- Add missing columns and rename store_name to merchant

-- Add is_tax_deductible if not exists
ALTER TABLE receipts ADD COLUMN is_tax_deductible INTEGER DEFAULT 0;

-- Add merchant column if not exists
ALTER TABLE receipts ADD COLUMN merchant TEXT;

-- Create index on user_id and date
CREATE INDEX IF NOT EXISTS idx_receipts_user_date ON receipts(user_id, purchase_date);
