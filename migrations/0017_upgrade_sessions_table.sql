-- 기존 sessions 테이블 업그레이드 (Access/Refresh Token 시스템)
-- 0012에서 생성된 기본 sessions 테이블을 확장

-- 1. token 컬럼을 refresh_token으로 변경하기 위해 새 테이블 생성
CREATE TABLE IF NOT EXISTS sessions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_address TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. 기존 데이터 복사 (token -> refresh_token)
INSERT INTO sessions_new (id, user_id, refresh_token, expires_at, created_at, last_used_at)
SELECT id, user_id, token, expires_at, created_at, created_at FROM sessions;

-- 3. 기존 테이블 삭제
DROP TABLE sessions;

-- 4. 새 테이블을 sessions로 이름 변경
ALTER TABLE sessions_new RENAME TO sessions;

-- 5. 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_refresh_token_unique ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
