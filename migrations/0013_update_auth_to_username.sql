-- Update authentication schema: email -> username
-- Migration: 0013_update_auth_to_username.sql

-- Create new users table with username instead of email
CREATE TABLE IF NOT EXISTS users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- Copy existing data (if any)
INSERT INTO users_new (id, username, password_hash, name, created_at, last_login)
SELECT id, email, password_hash, name, created_at, last_login FROM users;

-- Drop old table and rename new table
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Update sessions table to have cleaner structure (optional)
DROP TABLE IF EXISTS sessions;
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
