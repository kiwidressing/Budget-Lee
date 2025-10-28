-- 월별 통계 캐시 테이블 생성
-- 매번 거래 내역을 집계하는 대신, 미리 계산된 월별 요약 사용

CREATE TABLE IF NOT EXISTS monthly_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year_month TEXT NOT NULL,              -- 'YYYY-MM' 형식 (예: '2025-10')
  user_id TEXT NOT NULL,                 -- 사용자 ID
  income INTEGER DEFAULT 0,              -- 월 수입 합계
  expense INTEGER DEFAULT 0,             -- 월 지출 합계
  savings INTEGER DEFAULT 0,             -- 월 저축 합계
  transaction_count INTEGER DEFAULT 0,   -- 거래 건수
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(year_month, user_id)            -- 사용자당 월별 하나의 레코드만
);

-- 인덱스 생성 (빠른 조회)
CREATE INDEX IF NOT EXISTS idx_monthly_summary_user_ym 
  ON monthly_summary(user_id, year_month);

-- 업데이트 시간 인덱스 (오래된 캐시 정리용)
CREATE INDEX IF NOT EXISTS idx_monthly_summary_updated 
  ON monthly_summary(updated_at);
