-- Update settings to support multiple users
-- Migration: 0014_update_settings_for_multi_user.sql

-- Add user_id to settings table
ALTER TABLE settings ADD COLUMN user_id TEXT;

-- Create index for better performance  
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
