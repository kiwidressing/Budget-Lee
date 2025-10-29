-- Rollback authentication system to single-user mode (user_id = 1)
-- Migration: 0020_rollback_authentication.sql

-- Drop authentication tables
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS transfers;

-- Remove user_id from all tables and default to 1
-- We'll handle this in the backend code instead of migrations
-- to avoid data loss

-- Note: All API endpoints will now use hardcoded user_id = 1
