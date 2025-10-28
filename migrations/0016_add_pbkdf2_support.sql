-- PBKDF2 비밀번호 해싱 지원 추가
-- 기존 SHA-256 사용자와 호환성 유지

-- users 테이블에 salt와 iterations 컬럼 추가
ALTER TABLE users ADD COLUMN salt TEXT;
ALTER TABLE users ADD COLUMN iterations INTEGER;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
