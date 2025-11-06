-- Migration: Add Google OAuth support columns to users table
-- This migration adds email and google_id columns for Google OAuth integration

ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN google_id TEXT;

-- Create unique index on google_id for faster lookups and to enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
