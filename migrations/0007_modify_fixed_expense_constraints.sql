-- day_of_week를 nullable로 변경하기 위해 테이블 재생성
-- SQLite는 컬럼 제약조건을 직접 수정할 수 없으므로 테이블을 재생성해야 함

-- 1. 기존 데이터 백업
CREATE TABLE fixed_expenses_backup AS SELECT * FROM fixed_expenses;

-- 2. 기존 테이블 삭제
DROP TABLE fixed_expenses;

-- 3. 새 테이블 생성 (day_of_week nullable)
CREATE TABLE fixed_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  frequency TEXT NOT NULL CHECK(frequency IN ('monthly', 'weekly', 'monthly_day')),
  week_of_month INTEGER CHECK(week_of_month BETWEEN 1 AND 4),
  day_of_week INTEGER CHECK(day_of_week BETWEEN 0 AND 6),
  payment_day INTEGER CHECK(payment_day BETWEEN 1 AND 31),
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. 데이터 복원
INSERT INTO fixed_expenses SELECT * FROM fixed_expenses_backup;

-- 5. 백업 테이블 삭제
DROP TABLE fixed_expenses_backup;
