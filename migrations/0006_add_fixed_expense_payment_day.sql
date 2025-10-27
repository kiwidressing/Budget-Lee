-- 고정지출에 매월 특정 일자 필드 추가
ALTER TABLE fixed_expenses ADD COLUMN payment_day INTEGER CHECK(payment_day BETWEEN 1 AND 31);

-- frequency 체크 제약조건 업데이트 (daily 추가)
-- SQLite는 ALTER TABLE로 CHECK 제약조건을 수정할 수 없으므로 주석으로만 남김
-- 새로운 frequency 값: 'monthly', 'weekly', 'monthly_day' (매월 특정 일자)
