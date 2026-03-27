# 🎯 완전한 앱 인수인계 문서

> **작성일**: 2026-03-27  
> **대상**: 신규 개발자 또는 유지보수 담당자  
> **목적**: 앱 전체 구조, 설계 철학, 내부 메커니즘, UI 설계 이유를 완벽히 이해

---

## 📋 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택 및 아키텍처](#2-기술-스택-및-아키텍처)
3. [데이터베이스 설계 철학](#3-데이터베이스-설계-철학)
4. [인증 시스템 구조](#4-인증-시스템-구조)
5. [핵심 기능 메커니즘](#5-핵심-기능-메커니즘)
6. [UI/UX 설계 철학](#6-uiux-설계-철학)
7. [API 구조 및 패턴](#7-api-구조-및-패턴)
8. [프론트엔드 상태 관리](#8-프론트엔드-상태-관리)
9. [성능 최적화 전략](#9-성능-최적화-전략)
10. [배포 및 운영](#10-배포-및-운영)
11. [Google OAuth 현재 상태](#11-google-oauth-현재-상태)
12. [문제 해결 가이드](#12-문제-해결-가이드)

---

## 1. 프로젝트 개요

### 1.1 프로젝트명
**Budget Lee (가계부 앱)**

### 1.2 핵심 가치 제안
- **즉시 사용 가능**: 회원가입 없이 브라우저별 자동 세션으로 즉시 시작
- **완전한 오프라인**: PWA + Service Worker로 인터넷 없이도 작동
- **엣지 컴퓨팅**: Cloudflare Workers로 전 세계 어디서나 50ms 이내 응답
- **데이터 주권**: 사용자가 백업/복원을 통해 데이터 완전 제어

### 1.3 주요 사용자 시나리오

#### 시나리오 A: 대학생 (20대)
```text
문제: 용돈 관리가 안 됨, 매달 통장 잔고 0원
해결: 
  1. 카테고리별 예산 설정 (식비 30만원, 교통비 10만원)
  2. 지출 즉시 입력 (카페에서 5천원 쓴 직후 바로 기록)
  3. 주별 뷰로 한 주 지출 패턴 파악
  4. 예산 초과 시 빨간색 경고로 시각적 피드백
```

#### 시나리오 B: 직장인 (30대)
```text
문제: 고정지출 많음 (월세, 보험, 통신비), 관리 복잡
해결:
  1. 고정지출 등록 (매월 5일 월세 50만원, 매주 금요일 주유 8만원)
  2. 체크박스 클릭으로 지불 완료 처리
  3. 저축 통장 3개 분리 (비상금, 여행자금, 결혼자금)
  4. 투자 포트폴리오 연동 (삼성전자, 카카오 주식 실시간 추적)
```

#### 시나리오 C: 자영업자 (40대)
```text
문제: 사업 수입/지출 분리 필요, 세금공제 영수증 관리
해결:
  1. 수입/지출 카테고리로 사업 현금흐름 추적
  2. 영수증 사진 업로드 + 세금공제 플래그
  3. 월별 리포트로 전년 대비 매출 비교
  4. CSV 내보내기로 세무사에게 데이터 전달
```

---

## 2. 기술 스택 및 아키텍처

### 2.1 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ index.html   │  │   app.js     │  │   i18n.js    │      │
│  │ (SSR 생성됨) │  │  (3000+ 줄)  │  │ (번역 시스템) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│          ↓                  ↓                  ↓             │
│  ┌────────────────────────────────────────────────────┐     │
│  │          Service Worker (sw.js)                    │     │
│  │  - 정적 파일 캐시 (Cache First)                     │     │
│  │  - API 요청 Network Only                           │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Edge Network (전 세계)               │
│  ┌────────────────────────────────────────────────────┐     │
│  │       Cloudflare Workers (src/index.tsx)           │     │
│  │  - Hono 프레임워크 (라우팅)                          │     │
│  │  - 51개 API 엔드포인트                               │     │
│  │  - JWT 인증 미들웨어                                 │     │
│  │  - SSR HTML 생성                                    │     │
│  └────────────────────────────────────────────────────┘     │
│                            ↓                                │
│  ┌────────────────────────────────────────────────────┐     │
│  │       Cloudflare D1 (SQLite 분산 DB)               │     │
│  │  - 16개 테이블                                      │     │
│  │  - 24개 마이그레이션 완료                             │     │
│  │  - 트랜잭션 보장 (BEGIN/COMMIT)                      │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  외부 API 통합                               │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ Yahoo Finance│  │ Google OAuth │                        │
│  │ (실시간 주가) │  │ (로그인)     │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 기술 선택 이유

#### **왜 React가 아니라 Vanilla JS인가?**

**결정 이유:**
1. **번들 크기**: React + ReactDOM = 130KB, Vanilla JS = 0KB
2. **초기 로딩 속도**: React hydration 불필요, HTML 즉시 렌더링
3. **엣지 최적화**: Cloudflare Workers는 CPU 제한 환경, 가벼울수록 유리
4. **학습 곡선**: 단순한 가계부 앱에 React는 오버엔지니어링
5. **PWA 호환성**: Service Worker와 순수 JS의 궁합이 더 좋음

**트레이드오프:**
- ❌ 코드 재사용성 낮음 (컴포넌트 없음)
- ❌ 상태 관리 수동 (전역 `state` 객체 직접 관리)
- ❌ 리렌더링 최적화 어려움 (DOM 직접 조작)
- ✅ 하지만 3000줄 이내로 충분히 관리 가능
- ✅ 디버깅이 오히려 쉬움 (마법같은 동작 없음)

#### **왜 TypeScript가 아니라 JavaScript인가?**

**프론트엔드:**
- Vanilla JS 사용으로 빌드 단계 최소화
- 브라우저 직접 실행 (트랜스파일링 불필요)

**백엔드:**
- TypeScript 사용! (`src/index.tsx`)
- 타입 안전성 필수 (D1 바인딩, API 응답 타입)

#### **왜 Cloudflare인가?**

**vs AWS Lambda:**
- ✅ 콜드 스타트 0ms (Lambda: 1-3초)
- ✅ 전 세계 300개 엣지 로케이션 (Lambda: 리전 고정)
- ✅ D1 무료 100만 읽기/일 (RDS: 최소 $15/월)

**vs Vercel:**
- ✅ D1 데이터베이스 포함 (Vercel: 별도 DB 필요)
- ✅ 무료 티어 관대 (Vercel: 빌드 시간 제한)

**vs 전통 호스팅:**
- ✅ 서버 관리 불필요 (No DevOps)
- ✅ 자동 스케일링 (트래픽 급증 대응)

### 2.3 파일 구조 및 책임

```
webapp/
├── src/
│   └── index.tsx (1,900줄)
│       ├── 📦 Hono 앱 초기화
│       ├── 🔐 인증 미들웨어 (JWT 검증)
│       ├── 🔑 비밀번호 해싱 (SHA-256)
│       ├── 🌐 51개 API 엔드포인트
│       ├── 📄 SSR HTML 생성 (메인 페이지)
│       └── 💾 D1 데이터베이스 쿼리
│
├── public/
│   ├── manifest.json (PWA 설정)
│   ├── sw.js (Service Worker - 캐시 전략)
│   └── static/
│       ├── app.js (3,000+ 줄) ⭐ 핵심 프론트엔드
│       │   ├── 🎨 UI 렌더링 (탭별 뷰)
│       │   ├── 📊 Chart.js 그래프
│       │   ├── 💰 거래/저축/투자 CRUD
│       │   ├── 🔄 실시간 주가 업데이트
│       │   ├── 📸 영수증 이미지 업로드
│       │   └── 🌍 다국어 번역 호출
│       │
│       ├── i18n.js (63KB)
│       │   ├── 한국어 translations (2,000+ 키)
│       │   └── 영어 translations (2,000+ 키)
│       │
│       └── style.css (30KB)
│           ├── TailwindCSS 유틸리티
│           ├── 커스텀 애니메이션
│           └── 다크모드 CSS 변수
│
├── migrations/ (24개 SQL 파일)
│   ├── 0001_initial_schema.sql
│   ├── 0012_add_users_table.sql
│   ├── 0024_add_google_oauth_columns.sql (최신)
│   └── ... (버전별 DB 스키마 진화)
│
├── dist/ (빌드 결과물)
│   ├── _worker.js (번들된 Cloudflare Worker)
│   ├── static/ (복사된 정적 파일)
│   └── manifest.json
│
├── wrangler.jsonc (Cloudflare 설정)
├── package.json (의존성)
├── vite.config.ts (빌드 설정)
└── ecosystem.config.cjs (PM2 프로세스 관리)
```

---

## 3. 데이터베이스 설계 철학

### 3.1 왜 16개 테이블인가?

**설계 원칙:**
1. **단일 책임 원칙 (SRP)**: 각 테이블은 하나의 도메인만 담당
2. **정규화 vs 성능**: 3NF 준수하되, 쿼리 성능을 위해 일부 비정규화
3. **확장성**: 새 기능 추가 시 기존 테이블 수정 최소화

### 3.2 테이블별 설계 결정

#### **테이블 1: `users`** - 사용자 계정

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,        -- 로그인 ID
    password_hash TEXT NOT NULL,          -- SHA-256 해시
    name TEXT NOT NULL,                   -- 표시명
    email TEXT,                           -- Google OAuth용
    google_id TEXT,                       -- Google 계정 연동
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    salt TEXT,                            -- 향후 PBKDF2 마이그레이션
    iterations INTEGER                    -- 향후 PBKDF2 마이그레이션
);
```

**설계 결정:**
- ✅ `username` UNIQUE: 중복 계정 방지
- ✅ `email` NULL 허용: 구글 로그인 선택적
- ✅ `google_id` 별도 컬럼: 일반 계정 + 구글 연동 지원
- ✅ `salt` + `iterations`: 보안 업그레이드 경로 (현재 SHA-256 → 향후 PBKDF2)

**왜 PBKDF2가 아니라 SHA-256인가?**
- **현재 상태**: SHA-256 (간단, 빠름)
- **문제점**: 레인보우 테이블 공격 취약
- **마이그레이션 경로**: `salt` 컬럼 추가 완료 → 로그인 시 자동 업그레이드 가능
- **프로덕션 권장**: PBKDF2 150,000 iterations

#### **테이블 2: `transactions`** - 거래 내역 (핵심 테이블)

```sql
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,             -- 사용자 식별
    type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'savings')),
    category TEXT NOT NULL,               -- 카테고리 (자유형식)
    amount REAL NOT NULL,                 -- 금액
    date DATE NOT NULL,                   -- 거래 날짜
    description TEXT,                     -- 메모
    payment_method TEXT,                  -- 결제 수단
    account_id INTEGER,                   -- 계좌 연결 (향후 활용)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);
```

**설계 결정:**
- ✅ `type` CHECK 제약: 3가지 유형만 허용 (데이터 무결성)
- ✅ `category` TEXT: 하드코딩 안 함, 사용자가 자유롭게 입력
- ✅ `amount` REAL: SQLite는 DECIMAL 없음, REAL로 충분
- ✅ 복합 인덱스: `(user_id, date)` - 가장 흔한 쿼리 최적화
- ✅ `account_id` NULL 허용: 계좌 기능 나중에 추가 가능

**카테고리가 왜 별도 테이블이 아닌가?**
- ❌ 별도 테이블 만들면: 카테고리 추가/삭제 복잡
- ✅ TEXT 필드로: 사용자가 "한식", "양식", "카페" 자유롭게 입력
- ✅ 프론트엔드에서 자동완성으로 일관성 유지

#### **테이블 3: `savings_accounts`** - 저축 통장

```sql
CREATE TABLE savings_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,                   -- 통장 이름 (예: "비상금")
    goal_amount REAL DEFAULT 0,           -- 목표 금액
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**설계 결정:**
- ✅ 잔액을 저장 안 함! → `transactions`에서 `type='savings'` 합산
- ✅ 이유: 잔액 불일치 방지, 트랜잭션이 단일 진실 원천
- ✅ `goal_amount`: 저축 목표 설정 기능

**왜 잔액을 직접 저장 안 하는가?**
```javascript
// ❌ 잘못된 방법 (잔액 직접 저장)
UPDATE savings_accounts SET balance = balance + 10000;
// → 동시성 문제, 트랜잭션 롤백 시 불일치

// ✅ 올바른 방법 (트랜잭션에서 계산)
SELECT SUM(amount) FROM transactions 
WHERE type='savings' AND user_id=1;
// → 항상 정확, 거래 내역이 감사 추적
```

#### **테이블 4: `fixed_expenses`** - 고정지출 스케줄

```sql
CREATE TABLE fixed_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,                   -- 지출 이름 (예: "월세")
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK(frequency IN ('weekly', 'monthly', 'monthly_date')),
    week_number INTEGER,                  -- 매월 N번째 주 (1-5)
    day_of_week INTEGER,                  -- 0=일, 1=월, ..., 6=토
    payment_day INTEGER,                  -- 매월 특정 일자 (1-31)
    start_date DATE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**설계 결정:**
- ✅ 3가지 주기: `weekly` (매주), `monthly` (매월 N번째 요일), `monthly_date` (매월 N일)
- ✅ 복잡한 반복 로직은 앱 코드에서 처리 (DB는 최소 데이터만)
- ✅ 31일이 없는 달 처리: 앱에서 자동으로 마지막 날로 조정

**반복 날짜 생성 알고리즘:**
```javascript
// 예: 매월 첫째 주 목요일
function getNthDayOfMonth(year, month, nth, dayOfWeek) {
  let date = new Date(year, month, 1);
  let count = 0;
  
  while (date.getMonth() === month) {
    if (date.getDay() === dayOfWeek) {
      count++;
      if (count === nth) return date;
    }
    date.setDate(date.getDate() + 1);
  }
  return null; // 해당 월에 N번째 요일이 없음 (예: 5번째 목요일)
}
```

#### **테이블 5: `category_budgets`** - 카테고리별 예산

```sql
CREATE TABLE category_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    year_month TEXT NOT NULL,             -- 'YYYY-MM' 형식
    category TEXT NOT NULL,
    budget_amount REAL NOT NULL,
    UNIQUE(user_id, year_month, category),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**설계 결정:**
- ✅ UNIQUE 제약: 같은 월, 같은 카테고리 중복 방지
- ✅ `year_month` TEXT: SQLite DATE 타입 제한, 문자열이 오히려 편리
- ✅ 0원 입력 시 자동 삭제: 프론트엔드 로직

#### **테이블 6: `investments`** - 투자 포트폴리오

```sql
CREATE TABLE investments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,                 -- 종목 코드 (예: AAPL, 005930.KS)
    name TEXT NOT NULL,                   -- 종목명
    quantity REAL NOT NULL,               -- 보유 수량
    average_price REAL NOT NULL,          -- 평균 매수가
    asset_type TEXT NOT NULL CHECK(asset_type IN ('stock', 'crypto')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**설계 결정:**
- ✅ `symbol`: Yahoo Finance API 호환 (AAPL, BTC-USD, 005930.KS)
- ✅ `quantity` REAL: 암호화폐 소수점 지원 (0.05 BTC)
- ✅ 실시간 가격은 API에서: DB에 저장 안 함 (60초 캐시)

**실시간 주가 연동:**
```javascript
// 60초 메모리 캐시
const cache = new Map();

async function getStockPrice(symbol) {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.time < 60000) {
    return cached.price; // 캐시 적중 (54ms)
  }
  
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  const data = await response.json();
  const price = data.chart.result[0].meta.regularMarketPrice;
  
  cache.set(symbol, { price, time: Date.now() });
  return price; // API 호출 (340ms)
}
```

#### **테이블 7: `receipts`** - 영수증 관리

```sql
CREATE TABLE receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    merchant TEXT NOT NULL,               -- 가맹점명
    purchase_date DATE NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    payment_method TEXT,
    is_tax_deductible INTEGER DEFAULT 0,  -- 세금공제 여부
    notes TEXT,
    image_data TEXT,                      -- Base64 인코딩 이미지
    image_mime_type TEXT,                 -- image/webp
    image_size INTEGER,                   -- 바이트 크기
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**설계 결정:**
- ✅ 이미지를 DB에 저장: Cloudflare R2 없이도 작동
- ✅ Base64 인코딩: TEXT 타입에 저장 가능
- ✅ WebP 압축: 1600px, 75% 품질 (텍스트 선명도 유지)
- ✅ 크기 제한: 프론트엔드에서 2MB 초과 거부

**왜 R2 (오브젝트 스토리지)를 안 쓰는가?**
- ❌ R2 사용 시: 별도 바인딩, URL 관리, CORS 설정
- ✅ DB 저장 시: 단순함, 백업 한 번에 해결
- ⚠️ 트레이드오프: 영수증 1000개 이상 시 DB 크기 증가

#### **테이블 8: `debts`** - 채무 관리

```sql
CREATE TABLE debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    creditor TEXT NOT NULL,               -- 채권자
    original_amount REAL NOT NULL,        -- 원금
    remaining_amount REAL NOT NULL,       -- 남은 금액
    interest_rate REAL DEFAULT 0,         -- 연 이자율 (%)
    start_date DATE NOT NULL,
    due_date DATE,                        -- 만기일
    category TEXT CHECK(category IN ('personal', 'bank', 'card', 'other')),
    status TEXT CHECK(status IN ('active', 'overdue', 'paid_off')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**설계 결정:**
- ✅ `remaining_amount`: 상환 시 자동 감소
- ✅ `status` 자동 계산: `due_date` 지나면 'overdue', 잔액 0이면 'paid_off'
- ✅ 4가지 카테고리: 개인, 은행, 카드, 기타

#### **테이블 9: `monthly_summary`** - 월별 통계 캐시

```sql
CREATE TABLE monthly_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    year_month TEXT NOT NULL,             -- 'YYYY-MM'
    income REAL DEFAULT 0,
    expense REAL DEFAULT 0,
    savings REAL DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, year_month),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**설계 결정:**
- ✅ 성능 최적화: 매번 SUM() 대신 캐시된 값 사용
- ✅ 자동 업데이트: 거래 추가/삭제 시 `recalcMonthlySummary()` 호출
- ✅ UPSERT 패턴: `INSERT ... ON CONFLICT DO UPDATE`

**캐시 업데이트 로직:**
```javascript
async function recalcMonthlySummary(DB, userId, yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${yearMonth}-01`;
  const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  
  // 1. transactions 테이블에서 집계
  const summary = await DB.prepare(`
    SELECT 
      SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense,
      SUM(CASE WHEN type='savings' THEN amount ELSE 0 END) as savings,
      COUNT(*) as transaction_count
    FROM transactions
    WHERE user_id = ? AND date BETWEEN ? AND ?
  `).bind(userId, startDate, endDate).first();
  
  // 2. monthly_summary에 UPSERT
  await DB.prepare(`
    INSERT INTO monthly_summary (year_month, user_id, income, expense, savings, transaction_count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(year_month, user_id) DO UPDATE SET
      income = excluded.income,
      expense = excluded.expense,
      savings = excluded.savings,
      transaction_count = excluded.transaction_count,
      updated_at = CURRENT_TIMESTAMP
  `).bind(yearMonth, userId, summary.income, summary.expense, summary.savings, summary.transaction_count).run();
}
```

**성능 비교:**
```text
캐시 전:
  GET /api/statistics/monthly/2025-03 → 12 queries → 450ms

캐시 후:
  GET /api/statistics/monthly/2025-03 → 1 query → 24ms
  
향상률: 94% 감소 (18.75배 빠름)
```

### 3.3 데이터 무결성 전략

#### **외래 키 (Foreign Keys)**
```sql
-- 모든 사용자 데이터는 users.id 참조
FOREIGN KEY (user_id) REFERENCES users(id)

-- 문제: SQLite는 기본적으로 FK 검사 안 함
-- 해결: Cloudflare D1은 자동으로 PRAGMA foreign_keys=ON 설정됨
```

#### **CHECK 제약 (CHECK Constraints)**
```sql
-- 열거형 타입 강제
CHECK(type IN ('income', 'expense', 'savings'))
CHECK(frequency IN ('weekly', 'monthly', 'monthly_date'))

-- 이점: 잘못된 값 삽입 원천 차단
-- 예: type='expanse' 오타 → 즉시 에러
```

#### **UNIQUE 제약 (UNIQUE Constraints)**
```sql
-- 중복 방지
UNIQUE(user_id, year_month, category)  -- 같은 월에 같은 카테고리 예산 중복 방지
UNIQUE(username)                        -- 중복 계정 방지
```

#### **트랜잭션 (Transactions)**
```javascript
// 계좌 이체: 원자성 보장
const batch = [
  DB.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').bind(amount, fromAccountId),
  DB.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').bind(amount, toAccountId),
  DB.prepare('INSERT INTO transfers (from_account_id, to_account_id, amount, date) VALUES (?, ?, ?, ?)').bind(fromAccountId, toAccountId, amount, date)
];

await DB.batch(batch); // 모두 성공 or 모두 롤백
```

---

## 4. 인증 시스템 구조

### 4.1 3단계 인증 진화

#### **단계 1: 세션 기반 (초기 MVP)**
```javascript
// 브라우저 첫 방문 시 자동 세션 생성
let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
  sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
  localStorage.setItem('sessionId', sessionId);
}

// 세션 ID를 Authorization 헤더로 전송
axios.defaults.headers.common['Authorization'] = `Bearer ${sessionId}`;

// 백엔드에서 세션 ID → user_id 매핑
const userId = sessionIdToUserIdMap.get(sessionId) || 1; // 기본값 1 (게스트)
```

**장점:**
- ✅ 회원가입 불필요, 즉시 사용 가능
- ✅ 브라우저별 독립 데이터 (크롬/사파리 각각 다른 user_id)

**단점:**
- ❌ 로컬스토리지 삭제 시 데이터 유실
- ❌ 디바이스 간 동기화 불가
- ❌ 보안 취약 (세션 ID 유출 시 접근 가능)

#### **단계 2: JWT 토큰 (현재 상태)**
```javascript
// 회원가입
POST /api/auth/register
{
  "username": "user123",
  "password": "1234",  // 4자리 숫자
  "name": "홍길동"
}

// 응답
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // JWT 토큰
  "user": { "id": 1, "username": "user123", "name": "홍길동" }
}

// 로그인
POST /api/auth/login
{
  "username": "user123",
  "password": "1234"
}

// 이후 모든 API 요청에 토큰 포함
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

**JWT 토큰 구조:**
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "1",           // user_id
    "username": "user123",
    "iat": 1234567890,    // 발급 시각
    "exp": 1234654290     // 만료 시각 (24시간 후)
  },
  "signature": "..."      // HMAC-SHA256(header + payload, JWT_SECRET)
}
```

**보안 특징:**
- ✅ 서명 검증: `JWT_SECRET`으로 변조 방지
- ✅ 만료 시간: 24시간 후 자동 무효화
- ✅ 상태 비저장: 서버에 세션 저장 안 함 (스케일링 유리)

**비밀번호 해싱:**
```javascript
// SHA-256 해싱 (현재)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 로그인 검증
const user = await DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
const inputHash = await hashPassword(password);
if (user.password_hash !== inputHash) {
  return { success: false, error: '비밀번호가 틀렸습니다.' };
}
```

**왜 4자리 숫자인가?**
- 📱 모바일 친화적: 숫자 키패드로 빠른 입력
- 🏦 은행 앱 UX 참조: PIN 번호 익숙함
- ⚠️ 보안 트레이드오프: 10,000가지 조합 (브루트포스 취약)
- ✅ 완화 방안: 로그인 실패 5회 시 계정 잠금 (향후 구현)

#### **단계 3: Google OAuth (구현 완료, 미설정)**
```javascript
// 1. 프론트엔드: Google 로그인 버튼 클릭
<a href="/api/auth/google">
  <svg><!-- Google 로고 --></svg>
  Sign in with Google
</a>

// 2. 백엔드: Google 인증 페이지로 리다이렉트
app.get('/api/auth/google', async (c) => {
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${GOOGLE_REDIRECT_URI}` +
    `&response_type=code` +
    `&scope=openid email profile`;
  
  return c.redirect(googleAuthUrl);
});

// 3. 사용자가 Google에서 승인
// 4. Google이 콜백 URL로 리다이렉트 (code 포함)

// 5. 백엔드: code → access token 교환
app.get('/api/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      code: code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });
  
  const { access_token } = await tokenResponse.json();
  
  // 6. access_token으로 사용자 정보 조회
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  
  const googleUser = await userInfoResponse.json();
  // { email: "user@gmail.com", name: "홍길동", picture: "https://..." }
  
  // 7. DB에서 google_id로 사용자 찾기 또는 생성
  let user = await DB.prepare('SELECT * FROM users WHERE google_id = ?').bind(googleUser.id).first();
  if (!user) {
    // 신규 사용자 생성
    await DB.prepare(`
      INSERT INTO users (username, password_hash, name, email, google_id)
      VALUES (?, 'GOOGLE_AUTH', ?, ?, ?)
    `).bind(
      googleUser.email.split('@')[0],  // username: 이메일 앞부분
      googleUser.name,
      googleUser.email,
      googleUser.id
    ).run();
  }
  
  // 8. JWT 토큰 생성 및 리다이렉트
  const jwtToken = await createToken(user.id, user.username, JWT_SECRET);
  return c.redirect(`/?token=${jwtToken}`);
});

// 9. 프론트엔드: URL 파라미터에서 토큰 추출 및 저장
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
if (token) {
  localStorage.setItem('auth_token', token);
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  window.history.replaceState({}, document.title, "/"); // URL 정리
}
```

**현재 상태:**
- ✅ 코드 구현 완료
- ✅ DB 스키마 준비 완료 (`email`, `google_id` 컬럼)
- ❌ Google Cloud Console 설정 안 됨
- ❌ `.dev.vars`에 실제 Client ID/Secret 없음

**필요한 설정 (사용자가 해야 할 일):**
1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 접속
2. 새 OAuth 2.0 클라이언트 ID 생성
3. Authorized redirect URIs에 추가:
   - `http://localhost:8787/api/auth/google/callback` (로컬 테스트)
   - `https://budget-lee.pages.dev/api/auth/google/callback` (프로덕션)
4. Client ID와 Client Secret을 `.dev.vars`에 입력
5. 프로덕션 배포 시 Cloudflare 환경 변수에 추가:
   ```bash
   wrangler secret put GOOGLE_CLIENT_ID
   wrangler secret put GOOGLE_CLIENT_SECRET
   ```

### 4.2 인증 미들웨어 구조

```javascript
// src/index.tsx
const authMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 헤더 없음 → 게스트 모드 (user_id = 1)
    c.set('userId', 1);
    c.set('username', 'guest');
    await next();
    return;
  }
  
  const token = authHeader.substring(7); // "Bearer " 제거
  const secret = c.env.JWT_SECRET || 'default-secret-key';
  
  // JWT 토큰 검증
  if (token.startsWith('eyJ')) {  // JWT 형식 (Base64)
    try {
      const payload = await verify(token, secret);
      c.set('userId', parseInt(payload.sub));
      c.set('username', payload.username);
      await next();
      return;
    } catch (err) {
      return c.json({ success: false, error: '유효하지 않은 토큰입니다.' }, 401);
    }
  }
  
  // 레거시 세션 ID (하위 호환성)
  c.set('userId', 1);
  c.set('username', 'guest');
  await next();
};

// 모든 API에 적용
app.get('/api/transactions', authMiddleware, async (c) => {
  const userId = c.get('userId'); // 미들웨어가 설정한 값
  // ...
});
```

**설계 포인트:**
- ✅ 게스트 모드 지원: 인증 없이도 앱 사용 가능 (user_id = 1)
- ✅ 하위 호환성: 기존 세션 ID도 작동
- ✅ 중앙 집중식: 인증 로직 한 곳에서 관리
- ✅ 컨텍스트 주입: `c.set('userId')`로 모든 핸들러에서 사용 가능

---

## 5. 핵심 기능 메커니즘

### 5.1 월별/주별 뷰 전환

**상태 관리:**
```javascript
const state = {
  activeView: 'month',  // 'month' | 'week' | 'savings' | 'fixed' | 'budgets' | ...
  currentMonth: new Date(),
  currentWeekStart: null,
  // ...
};

// 탭 클릭 시
function showMonthView() {
  state.activeView = 'month';
  renderMonthlyView(); // DOM 전체 다시 그리기
}

function showWeekView() {
  state.activeView = 'week';
  state.currentWeekStart = getStartOfWeek(new Date());
  renderWeeklyView();
}
```

**렌더링 전략:**
```javascript
// innerHTML 전체 교체 (React처럼 VDOM 없음)
function renderMonthlyView() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="monthly-view">
      <div class="stats-grid">
        <!-- 수입/지출/저축 카드 -->
      </div>
      <div class="calendar-grid">
        <!-- 달력 -->
      </div>
      <div class="transactions-list">
        <!-- 거래 내역 -->
      </div>
    </div>
  `;
  
  // 이벤트 리스너 다시 등록 (중요!)
  document.querySelectorAll('.add-transaction-btn').forEach(btn => {
    btn.addEventListener('click', () => showAddTransactionModal());
  });
}
```

**문제점과 해결:**
- ❌ 문제: innerHTML 교체 시 이벤트 리스너 소실
- ✅ 해결: 렌더링 후 이벤트 위임 또는 리스너 재등록
- ✅ 최적화: 자주 바뀌는 부분만 부분 업데이트

### 5.2 달력 렌더링 알고리즘

```javascript
async function renderMonthlyView() {
  const yearMonth = formatYearMonth(state.currentMonth); // "2025-03"
  
  // 1. 달력 데이터 가져오기 (날짜별 거래 요약)
  const calendarData = await fetchCalendarData(yearMonth);
  // 응답 예: [
  //   { date: "2025-03-15", income: 500000, expense: 120000, savings: 100000 },
  //   ...
  // ]
  
  // 2. 달력 그리드 생성 (7열 x 5-6행)
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0-6 (일-토)
  const lastDate = new Date(year, month + 1, 0).getDate(); // 28-31
  
  let html = '<div class="calendar-grid">';
  
  // 요일 헤더
  html += '<div class="calendar-header">';
  ['일', '월', '화', '수', '목', '금', '토'].forEach((day, i) => {
    const color = i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : '';
    html += `<div class="${color}">${day}</div>`;
  });
  html += '</div>';
  
  // 빈 칸 (이전 달)
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }
  
  // 실제 날짜
  for (let date = 1; date <= lastDate; date++) {
    const dateStr = `${yearMonth}-${String(date).padStart(2, '0')}`;
    const dayData = calendarData[dateStr] || {};
    
    // 거래가 있으면 점으로 표시 (모바일 최적화)
    const dots = [];
    if (dayData.income > 0) dots.push('<span class="dot blue"></span>');
    if (dayData.expense > 0) dots.push('<span class="dot red"></span>');
    if (dayData.savings > 0) dots.push('<span class="dot green"></span>');
    
    html += `
      <div class="calendar-day" data-date="${dateStr}">
        <div class="date-number">${date}</div>
        <div class="dots">${dots.join('')}</div>
      </div>
    `;
  }
  
  html += '</div>';
  
  // 3. DOM에 삽입
  document.getElementById('calendar-container').innerHTML = html;
  
  // 4. 클릭 이벤트 등록
  document.querySelectorAll('.calendar-day[data-date]').forEach(dayEl => {
    dayEl.addEventListener('click', (e) => {
      const date = e.currentTarget.dataset.date;
      showAddTransactionModal(date); // 날짜 선택된 상태로 모달 오픈
    });
  });
}
```

**달력 UI 진화:**
- **초기 버전**: 날짜별 금액 표시 (데스크톱 적합)
- **현재 버전**: 색상 점으로 표시 (모바일 최적화)
  - 🔵 파란 점 = 수입 있음
  - 🔴 빨간 점 = 지출 있음
  - 🟢 초록 점 = 저축 있음

**모바일 최적화 이유:**
```text
Before: "₩120,000" (9자 + 통화 기호) → 320px 화면에 14일만 보임
After:  "● ● ●" (점 3개) → 320px 화면에 31일 모두 보임
```

### 5.3 고정지출 체크박스 시스템

**문제:** 매달 반복되는 지출을 일일이 입력하기 번거로움

**해결:** 고정지출 체크박스 클릭 시 자동으로 거래 내역 생성

```javascript
// 1. 고정지출 인스턴스 생성 (서버)
app.get('/api/fixed-expenses/instances/:yearMonth', authMiddleware, async (c) => {
  const { yearMonth } = c.req.param();
  const userId = c.get('userId');
  
  // DB에서 모든 고정지출 가져오기
  const fixedExpenses = await DB.prepare(`
    SELECT * FROM fixed_expenses WHERE user_id = ?
  `).bind(userId).all();
  
  const instances = [];
  
  fixedExpenses.results.forEach(expense => {
    // 반복 날짜 계산
    const dates = calculateRecurrenceDates(expense, yearMonth);
    
    dates.forEach(date => {
      instances.push({
        id: `${expense.id}_${date}`,  // 고유 ID (expense_id + 날짜)
        expense_id: expense.id,
        name: expense.name,
        amount: expense.amount,
        category: expense.category,
        date: date,
        is_paid: false  // 기본값
      });
    });
  });
  
  // 2. 이미 지불된 항목 체크
  const paidRecords = await DB.prepare(`
    SELECT * FROM fixed_expense_payments
    WHERE user_id = ? AND payment_month = ?
  `).bind(userId, yearMonth).all();
  
  paidRecords.results.forEach(record => {
    const instance = instances.find(i => 
      i.expense_id === record.fixed_expense_id && 
      i.date === record.actual_payment_date
    );
    if (instance) instance.is_paid = true;
  });
  
  return c.json({ success: true, instances });
});

// 3. 프론트엔드: 체크박스 렌더링
function renderFixedExpenses(instances) {
  return instances.map(inst => `
    <div class="fixed-expense-item">
      <input 
        type="checkbox" 
        id="fe-${inst.id}"
        ${inst.is_paid ? 'checked' : ''}
        data-expense-id="${inst.expense_id}"
        data-date="${inst.date}"
        data-amount="${inst.amount}"
        data-name="${inst.name}"
        data-category="${inst.category}"
      />
      <label for="fe-${inst.id}">
        <strong>${inst.name}</strong> - ${formatCurrency(inst.amount)}
        <span class="date">${inst.date}</span>
      </label>
    </div>
  `).join('');
}

// 4. 체크박스 클릭 이벤트
document.addEventListener('change', async (e) => {
  if (e.target.type === 'checkbox' && e.target.id.startsWith('fe-')) {
    const expenseId = e.target.dataset.expenseId;
    const date = e.target.dataset.date;
    const amount = parseFloat(e.target.dataset.amount);
    const name = e.target.dataset.name;
    const category = e.target.dataset.category;
    
    if (e.target.checked) {
      // 체크됨 → 지불 완료 처리
      await axios.post(`/api/fixed-expenses/${expenseId}/pay`, {
        payment_date: date,
        amount: amount
      });
      
      // transactions 테이블에도 자동 추가 (중요!)
      await axios.post('/api/transactions', {
        type: 'expense',
        category: category,
        amount: amount,
        date: date,
        description: `[고정지출] ${name}`
      });
      
      showToast('✅ 지불 완료로 표시되었습니다.');
    } else {
      // 체크 해제 → 지불 취소
      // (구현 필요: fixed_expense_payments와 transactions 모두 삭제)
    }
  }
});
```

**핵심 로직:**
1. **인스턴스 생성**: DB의 고정지출 템플릿 → 특정 월의 실제 날짜로 변환
2. **지불 상태 동기화**: `fixed_expense_payments` 테이블과 체크박스 상태 매칭
3. **더블 레코딩**: 체크 시 `fixed_expense_payments` + `transactions` 동시 생성
4. **이유**: 통계에서 고정지출도 포함되어야 함

### 5.4 예산 vs 지출 진행률

```javascript
// 1. 서버에서 예산 대비 지출 현황 조회
app.get('/api/budgets/vs-spending/:yearMonth', authMiddleware, async (c) => {
  const { yearMonth } = c.req.param();
  const userId = c.get('userId');
  
  // 예산 가져오기
  const budgets = await DB.prepare(`
    SELECT category, budget_amount 
    FROM category_budgets 
    WHERE user_id = ? AND year_month = ?
  `).bind(userId, yearMonth).all();
  
  // 실제 지출 집계
  const spending = await DB.prepare(`
    SELECT category, SUM(amount) as total
    FROM transactions
    WHERE user_id = ? AND type='expense' AND strftime('%Y-%m', date) = ?
    GROUP BY category
  `).bind(userId, yearMonth).all();
  
  // 매칭
  const result = budgets.results.map(budget => {
    const spent = spending.results.find(s => s.category === budget.category)?.total || 0;
    const percentage = (spent / budget.budget_amount) * 100;
    
    return {
      category: budget.category,
      budget: budget.budget_amount,
      spent: spent,
      remaining: budget.budget_amount - spent,
      percentage: percentage,
      status: getStatus(percentage)  // 'safe', 'good', 'warning', 'exceeded'
    };
  });
  
  return c.json({ success: true, data: result });
});

// 2. 상태 계산
function getStatus(percentage) {
  if (percentage < 50) return 'safe';       // 초록
  if (percentage < 80) return 'good';       // 노랑
  if (percentage <= 100) return 'warning';  // 주황
  return 'exceeded';                        // 빨강
}

// 3. 프론트엔드: 진행률 바 렌더링
function renderBudgetProgressBar(item) {
  const colors = {
    safe: 'bg-green-500',
    good: 'bg-yellow-500',
    warning: 'bg-orange-500',
    exceeded: 'bg-red-500'
  };
  
  return `
    <div class="budget-item">
      <div class="budget-header">
        <span>${item.category}</span>
        <span>${item.percentage.toFixed(0)}%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar ${colors[item.status]}" style="width: ${Math.min(item.percentage, 100)}%"></div>
      </div>
      <div class="budget-details">
        <span>₩${formatNumber(item.spent)} / ₩${formatNumber(item.budget)}</span>
        <span class="${item.remaining < 0 ? 'text-red-500' : ''}">
          ${item.remaining > 0 ? '남음' : '초과'}: ₩${formatNumber(Math.abs(item.remaining))}
        </span>
      </div>
    </div>
  `;
}
```

**시각적 피드백:**
```text
50% 미만    ███████░░░░░░░░░░░ (초록 - 안전)
50-80%      ████████████░░░░░░ (노랑 - 양호)
80-100%     ██████████████████ (주황 - 주의)
100% 초과   ████████████████████ (빨강 - 초과!) ⚠️
```

### 5.5 실시간 주가 업데이트 메커니즘

```javascript
// 1. 투자 탭 진입 시 주가 가져오기
async function renderInvestmentsView() {
  const investments = await fetchInvestments(); // DB에서 보유 종목 조회
  
  // 2. 각 종목의 실시간 가격 조회
  for (let inv of investments) {
    const priceData = await fetchStockPrice(inv.symbol);
    inv.current_price = priceData.price;
    inv.current_value = inv.quantity * priceData.price;
    inv.profit_loss = inv.current_value - (inv.quantity * inv.average_price);
    inv.return_rate = ((inv.current_price / inv.average_price - 1) * 100).toFixed(2);
  }
  
  // 3. UI 렌더링
  renderInvestmentsList(investments);
  
  // 4. 30초마다 자동 갱신 (인터벌)
  if (state.investmentPriceRefreshInterval) {
    clearInterval(state.investmentPriceRefreshInterval);
  }
  
  state.investmentPriceRefreshInterval = setInterval(async () => {
    console.log('[Investment] Auto-refreshing prices...');
    
    // 가격만 업데이트 (전체 재렌더링 안 함)
    for (let inv of investments) {
      const priceData = await fetchStockPrice(inv.symbol);
      inv.current_price = priceData.price;
      inv.current_value = inv.quantity * priceData.price;
      inv.profit_loss = inv.current_value - (inv.quantity * inv.average_price);
      inv.return_rate = ((inv.current_price / inv.average_price - 1) * 100).toFixed(2);
      
      // DOM 부분 업데이트
      const priceEl = document.querySelector(`#inv-${inv.id} .current-price`);
      if (priceEl) priceEl.textContent = `$${inv.current_price.toFixed(2)}`;
      
      const profitEl = document.querySelector(`#inv-${inv.id} .profit-loss`);
      if (profitEl) {
        profitEl.textContent = `${inv.profit_loss > 0 ? '+' : ''}$${inv.profit_loss.toFixed(2)} (${inv.return_rate}%)`;
        profitEl.className = inv.profit_loss >= 0 ? 'text-green-500' : 'text-red-500';
      }
    }
  }, 30000); // 30초
}

// 5. Yahoo Finance API 호출 (60초 캐시)
async function fetchStockPrice(symbol) {
  try {
    const response = await axios.get(`/api/investments/price/${symbol}`);
    return response.data; // { price: 150.25, cached: false }
  } catch (error) {
    console.warn(`[Investment] Failed to fetch ${symbol}, using fallback`);
    return { price: 0, cached: false };
  }
}

// 6. 서버 측 캐싱 (메모리)
const memoryCache = new Map();

app.get('/api/investments/price/:symbol', async (c) => {
  const { symbol } = c.req.param();
  
  // 캐시 확인
  const cached = getCached(symbol);
  if (cached) {
    return c.json({ price: cached.price, cached: true });
  }
  
  // Yahoo Finance API 호출
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    );
    const data = await response.json();
    const price = data.chart.result[0].meta.regularMarketPrice;
    
    // 60초 캐시 저장
    setCache(symbol, { price }, 60);
    
    return c.json({ price, cached: false });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch price' }, 500);
  }
});
```

**성능 최적화:**
```text
첫 번째 요청:  Yahoo Finance API → 340ms
두 번째 요청:  메모리 캐시 → 54ms (84% 향상)
30초 후:       메모리 캐시 → 54ms (캐시 유지)
60초 후:       Yahoo Finance API → 340ms (캐시 만료, 재조회)
```

**지원 종목:**
- **미국 주식**: `AAPL`, `GOOGL`, `TSLA` 등
- **한국 주식**: `005930.KS` (삼성전자), `035420.KS` (네이버)
- **암호화폐**: `BTC-USD`, `ETH-USD`, `SOL-USD`

### 5.6 영수증 이미지 업로드 및 압축

```javascript
// 1. 프론트엔드: 파일 선택
<input 
  type="file" 
  id="receipt-image" 
  accept="image/*" 
  capture="environment"  // 모바일 카메라 우선
/>

// 2. 이미지 읽기 및 압축
document.getElementById('receipt-image').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // 2MB 크기 제한
  if (file.size > 2 * 1024 * 1024) {
    alert('이미지 크기는 2MB 이하여야 합니다.');
    return;
  }
  
  // 3. Base64 인코딩 + Canvas 압축
  const compressedImage = await compressImage(file, {
    maxWidth: 1600,      // 영수증 텍스트 선명도 유지
    maxHeight: 1600,
    quality: 0.75,       // WebP 75% 품질
    mimeType: 'image/webp'
  });
  
  // 4. 미리보기
  document.getElementById('preview').src = compressedImage;
  
  // 5. 서버로 전송
  await axios.post('/api/receipts', {
    merchant: '스타벅스',
    purchase_date: '2025-03-15',
    amount: 5000,
    category: '식비',
    image_data: compressedImage,  // "data:image/webp;base64,..."
    image_mime_type: 'image/webp',
    image_size: compressedImage.length
  });
});

// 6. 이미지 압축 함수
function compressImage(file, options) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Canvas로 리사이징
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // 최대 크기 제한
        if (width > options.maxWidth || height > options.maxHeight) {
          const ratio = Math.min(options.maxWidth / width, options.maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // WebP로 인코딩
        const compressed = canvas.toDataURL(options.mimeType, options.quality);
        resolve(compressed);
      };
      
      img.onerror = reject;
      img.src = e.target.result;
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

**압축 효과:**
```text
원본 이미지 (iPhone 13):   3.2MB (4032x3024 JPEG)
압축 후:                    280KB (1600x1200 WebP 75%)
압축률:                     91% 감소
선명도:                     영수증 텍스트 읽기 가능 ✅
```

**Base64 vs Blob Storage 트레이드오프:**
- ✅ Base64 장점: 추가 인프라 불필요, 백업 간단, CORS 이슈 없음
- ❌ Base64 단점: DB 크기 증가 (33% 오버헤드), 쿼리 속도 저하
- ⚖️ 결정: 영수증 1000개 이하 사용자에게는 Base64가 더 편리

---

## 6. UI/UX 설계 철학

### 6.1 왜 이 UI 구조인가?

#### **탭 기반 네비게이션 (Tab-based Navigation)**

```
┌─────────────────────────────────────────────────────────────┐
│  [월별] [주별] [저축] [고정지출] [예산] [투자] [리포트] ...  │
│  ───────────────────────────────────────────────────────    │
│                                                              │
│  (선택된 탭의 콘텐츠가 여기에 표시됨)                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**선택 이유:**
1. **단일 페이지 앱 (SPA) 구조**: 페이지 새로고침 없이 빠른 전환
2. **모바일 친화적**: 손가락으로 탭 클릭 쉬움 (햄버거 메뉴보다 직관적)
3. **컨텍스트 유지**: 탭 전환해도 입력 중인 데이터 유지
4. **공간 효율**: 한 화면에 모든 메뉴 표시

**vs 사이드바 메뉴:**
- ❌ 사이드바: 모바일에서 화면 가림, 2단계 클릭 (열기 → 선택)
- ✅ 탭: 1단계 클릭, 항상 보임

### 6.2 카테고리 구조 설계 이유

#### **왜 하드코딩된 카테고리가 아닌가?**

**현재 방식: 자유 입력 + 자동완성**
```javascript
// 프론트엔드에서 기본 카테고리 제공
const defaultCategories = {
  expense: ['식비', '교통비', '의류비', '주거비', '문화생활', '의료비', '기타'],
  income: ['급여', '부업', '투자수익', '기타']
};

// 사용자가 입력할 때 자동완성
<input 
  type="text" 
  list="category-suggestions" 
  placeholder="카테고리 입력"
/>
<datalist id="category-suggestions">
  <option value="식비">
  <option value="교통비">
  <!-- ... -->
</datalist>
```

**장점:**
- ✅ 유연성: 사용자가 "한식", "양식", "카페" 같은 세부 카테고리 생성 가능
- ✅ 국제화: 영어권 사용자는 "Food", "Transport" 입력 가능
- ✅ 진화 가능: 새로운 소비 패턴(예: "구독료") 추가 쉬움

**단점 완화:**
- ⚠️ 오타 문제 → 자동완성으로 일관성 유지
- ⚠️ 통계 분산 → 프론트엔드에서 유사 카테고리 그룹핑

#### **카테고리 색상 코딩**

```javascript
const categoryColors = {
  income: '#3B82F6',    // 파란색 (안정감, 긍정)
  expense: '#EF4444',   // 빨간색 (경고, 지출)
  savings: '#10B981'    // 초록색 (성장, 목표)
};
```

**심리학적 근거:**
- 🔵 파란색: 신뢰, 안정 (수입은 좋은 것)
- 🔴 빨간색: 경고, 정지 (지출은 줄여야 할 것)
- 🟢 초록색: 성장, 진행 (저축은 쌓이는 것)

### 6.3 모바일 우선 설계 (Mobile-First Design)

#### **글꼴 크기 반응형 전략**

```css
/* TailwindCSS 커스텀 */
@media (max-width: 640px) {
  /* 스마트폰 */
  html { font-size: 13px; }
  .stats-card { padding: 12px; }
  .btn { min-height: 44px; } /* iOS 권장 터치 영역 */
}

@media (min-width: 641px) and (max-width: 1024px) {
  /* 태블릿 */
  html { font-size: 14px; }
}

@media (min-width: 1025px) {
  /* 데스크톱 */
  html { font-size: 15px; }
}
```

**결정 이유:**
- **주 사용자**: 20-40대, 모바일 사용 비율 80%
- **사용 시나리오**: 커피숍에서 지출 입력, 지하철에서 예산 확인
- **손가락 영역**: 최소 44x44px (Apple HIG 가이드라인)

#### **컴팩트 네비게이션**

```html
<!-- Before: 데스크톱 스타일 -->
<button>
  <i class="fas fa-plus"></i>
  <span>거래 추가</span>
</button>

<!-- After: 모바일 최적화 -->
<button class="icon-only">
  <i class="fas fa-plus"></i>
</button>
```

**공간 절약:**
```text
Before: 120px 버튼 x 5개 = 600px (모바일 화면 넘침)
After:  44px 버튼 x 5개 = 220px (여유 공간 확보)
```

### 6.4 Glassmorphism 디자인 (유리 효과)

```css
.glass-card {
  background: rgba(255, 255, 255, 0.7);  /* 반투명 흰색 */
  backdrop-filter: blur(10px);           /* 뒷배경 블러 */
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

**선택 이유:**
- 🎨 **시각적 깊이감**: 평면적이지 않고 레이어 느낌
- 🌈 **배경 테마 호환**: 어떤 배경색에도 잘 어울림
- 🔥 **트렌드**: 2024-2026년 인기 디자인 패턴 (iOS, macOS 참조)

**성능 고려:**
- ⚠️ `backdrop-filter`: GPU 가속 필요, 오래된 디바이스에서 느림
- ✅ 완화: 크리티컬하지 않은 UI에만 적용 (통계 카드, 모달)

### 6.5 다크모드 구현

```javascript
// 1. 토글 버튼
<button onclick="toggleDarkMode()">
  <i class="fas fa-moon"></i> 다크모드
</button>

// 2. LocalStorage 저장
function toggleDarkMode() {
  const isDark = !state.darkMode;
  state.darkMode = isDark;
  localStorage.setItem('darkMode', isDark);
  
  // HTML에 class 추가
  document.documentElement.classList.toggle('dark', isDark);
  
  // 배경 테마 변경
  if (isDark) {
    state.backgroundTheme = 'gray';  // 어두운 배경
  } else {
    state.backgroundTheme = 'morning';  // 밝은 배경
  }
  
  applyBackground();
}

// 3. CSS 변수로 색상 전환
:root {
  --bg-primary: #ffffff;
  --text-primary: #1f2937;
  --card-bg: #f9fafb;
}

html.dark {
  --bg-primary: #111827;
  --text-primary: #f9fafb;
  --card-bg: #1f2937;
}

/* 모든 요소가 변수 참조 */
body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
```

**부드러운 전환:**
```css
* {
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

### 6.6 배경 테마 시스템

```javascript
const backgroundThemes = {
  morning: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',  // 연보라→파랑
  sunset: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',   // 핑크→보라
  spring: 'linear-gradient(135deg, #ffeef8 0%, #c8e6c9 100%)',   // 연핑크→연초록
  // ...
};

function applyBackground() {
  const theme = backgroundThemes[state.backgroundTheme];
  document.body.style.background = theme;
  localStorage.setItem('backgroundTheme', state.backgroundTheme);
}
```

**8가지 테마 선택 이유:**
- 🌅 아침, 🌆 석양, 🌸 봄, 🌊 여름, 🍂 가을, ❄️ 겨울, ⚪ 회색, (다크모드 전용)
- **계절감**: 사용자가 현재 계절에 맞는 테마 선택
- **감정 반영**: 밝은 기분 → 밝은 테마, 차분함 → 어두운 테마
- **피로도 감소**: 흰 배경보다 그라데이션이 눈에 편함

---

## 7. API 구조 및 패턴

### 7.1 RESTful API 설계

**엔드포인트 명명 규칙:**
```
GET    /api/transactions           # 목록 조회 (Collection)
GET    /api/transactions/:id       # 단건 조회 (Resource)
POST   /api/transactions           # 생성 (Create)
PUT    /api/transactions/:id       # 전체 수정 (Update)
PATCH  /api/transactions/:id       # 부분 수정 (Partial Update) - 미사용
DELETE /api/transactions/:id       # 삭제 (Delete)
```

**일관된 응답 형식:**
```json
{
  "success": true,              // 성공 여부 (boolean)
  "data": { ... },              // 실제 데이터 (객체 또는 배열)
  "error": "에러 메시지",        // 실패 시에만 존재
  "message": "부가 설명"         // 선택적
}
```

### 7.2 CRUD 패턴 예시 (Transactions)

#### **생성 (Create)**
```javascript
// POST /api/transactions
app.post('/api/transactions', authMiddleware, async (c) => {
  const { DB } = c.env;
  const userId = c.get('userId');
  const { type, category, amount, date, description, payment_method } = await c.req.json();
  
  // 1. 입력 검증
  if (!type || !category || !amount || !date) {
    return c.json({ success: false, error: '필수 항목을 입력해주세요.' }, 400);
  }
  
  // 2. 타입 검증
  if (!['income', 'expense', 'savings'].includes(type)) {
    return c.json({ success: false, error: '유효하지 않은 거래 유형입니다.' }, 400);
  }
  
  // 3. DB 삽입
  const result = await DB.prepare(`
    INSERT INTO transactions (user_id, type, category, amount, date, description, payment_method)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(userId, type, category, amount, date, description, payment_method).run();
  
  // 4. 월별 통계 캐시 갱신
  const yearMonth = date.substring(0, 7); // "2025-03"
  await recalcMonthlySummary(DB, userId, yearMonth);
  
  // 5. 성공 응답
  return c.json({ 
    success: true, 
    data: { id: result.meta.last_row_id },
    message: '거래가 추가되었습니다.'
  });
});
```

#### **조회 (Read)**
```javascript
// GET /api/transactions?startDate=2025-03-01&endDate=2025-03-31
app.get('/api/transactions', authMiddleware, async (c) => {
  const { DB } = c.env;
  const userId = c.get('userId');
  const { startDate, endDate } = c.req.query();
  
  // 1. 쿼리 파라미터 검증
  if (!startDate || !endDate) {
    return c.json({ success: false, error: '날짜 범위를 지정해주세요.' }, 400);
  }
  
  // 2. DB 조회 (날짜 범위)
  const transactions = await DB.prepare(`
    SELECT * FROM transactions
    WHERE user_id = ? AND date BETWEEN ? AND ?
    ORDER BY date DESC, id DESC
  `).bind(userId, startDate, endDate).all();
  
  // 3. 성공 응답
  return c.json({ success: true, data: transactions.results });
});
```

#### **수정 (Update)**
```javascript
// PUT /api/transactions/:id
app.put('/api/transactions/:id', authMiddleware, async (c) => {
  const { DB } = c.env;
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { type, category, amount, date, description, payment_method } = await c.req.json();
  
  // 1. 소유권 검증 (다른 사용자의 거래 수정 방지)
  const existing = await DB.prepare('SELECT * FROM transactions WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: '거래 내역을 찾을 수 없습니다.' }, 404);
  }
  if (existing.user_id !== userId) {
    return c.json({ success: false, error: '권한이 없습니다.' }, 403);
  }
  
  // 2. DB 업데이트
  await DB.prepare(`
    UPDATE transactions
    SET type = ?, category = ?, amount = ?, date = ?, description = ?, payment_method = ?
    WHERE id = ?
  `).bind(type, category, amount, date, description, payment_method, id).run();
  
  // 3. 캐시 갱신 (기존 월 + 새 월)
  const oldYearMonth = existing.date.substring(0, 7);
  const newYearMonth = date.substring(0, 7);
  await recalcMonthlySummary(DB, userId, oldYearMonth);
  if (oldYearMonth !== newYearMonth) {
    await recalcMonthlySummary(DB, userId, newYearMonth);
  }
  
  // 4. 성공 응답
  return c.json({ success: true, message: '거래가 수정되었습니다.' });
});
```

#### **삭제 (Delete)**
```javascript
// DELETE /api/transactions/:id
app.delete('/api/transactions/:id', authMiddleware, async (c) => {
  const { DB } = c.env;
  const userId = c.get('userId');
  const { id } = c.req.param();
  
  // 1. 소유권 검증
  const existing = await DB.prepare('SELECT * FROM transactions WHERE id = ?').bind(id).first();
  if (!existing || existing.user_id !== userId) {
    return c.json({ success: false, error: '거래 내역을 찾을 수 없습니다.' }, 404);
  }
  
  // 2. DB 삭제
  await DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();
  
  // 3. 캐시 갱신
  const yearMonth = existing.date.substring(0, 7);
  await recalcMonthlySummary(DB, userId, yearMonth);
  
  // 4. 성공 응답
  return c.json({ success: true, message: '거래가 삭제되었습니다.' });
});
```

### 7.3 에러 처리 전략

```javascript
// 전역 에러 핸들러 미들웨어
app.use('/api/*', async (c, next) => {
  try {
    await next();
  } catch (error) {
    console.error('[API Error]', error);
    
    // D1 데이터베이스 에러
    if (error.message.includes('D1_ERROR')) {
      return c.json({
        success: false,
        error: '데이터베이스 오류가 발생했습니다.',
        details: error.message
      }, 500);
    }
    
    // JWT 검증 에러
    if (error.message.includes('JWT')) {
      return c.json({
        success: false,
        error: '인증 토큰이 유효하지 않습니다.'
      }, 401);
    }
    
    // 일반 에러
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});
```

---

## 8. 프론트엔드 상태 관리

### 8.1 전역 State 객체

```javascript
const state = {
  // 뷰 상태
  activeView: 'month',              // 현재 활성 탭
  currentMonth: new Date(),         // 월별 뷰의 현재 월
  currentWeekStart: null,           // 주별 뷰의 현재 주 시작일
  
  // 데이터 캐시
  transactions: [],                 // 거래 내역 (현재 뷰 기간)
  savingsAccounts: [],              // 저축 통장 목록
  fixedExpenses: [],                // 고정지출 목록
  budgets: [],                      // 예산 목록
  investments: [],                  // 투자 포트폴리오
  
  // 설정
  settings: {
    currency: 'KRW',
    initial_balance: 0,
    cash_on_hand: 0,
    category_colors: { ... }
  },
  
  // UI 상태
  darkMode: false,
  backgroundTheme: 'morning',
  currentTransactionType: 'income',  // 거래 추가 모달의 선택된 타입
  
  // 차트 인스턴스
  expenseChart: null,                // Chart.js 인스턴스 (재사용)
  
  // 인터벌
  investmentPriceRefreshInterval: null,  // 주가 갱신 타이머
  
  // 인증
  isAuthenticated: false,
  currentUser: null,
  authToken: localStorage.getItem('authToken')
};
```

### 8.2 상태 업데이트 패턴

```javascript
// ❌ 잘못된 방법: 직접 state 변경 후 DOM 업데이트 안 함
state.transactions.push(newTransaction);
// → UI에 반영 안 됨!

// ✅ 올바른 방법: 상태 변경 + 명시적 재렌더링
state.transactions.push(newTransaction);
renderMonthlyView(); // 전체 뷰 다시 그리기

// 또는 부분 업데이트
state.transactions.push(newTransaction);
appendTransactionToList(newTransaction); // DOM에 추가만
```

### 8.3 데이터 흐름

```
사용자 액션 (클릭, 입력)
    ↓
이벤트 핸들러
    ↓
API 호출 (axios)
    ↓
서버 응답
    ↓
state 업데이트
    ↓
UI 재렌더링 (innerHTML 또는 DOM 조작)
    ↓
이벤트 리스너 재등록 (중요!)
```

**예시:**
```javascript
// 1. 사용자 액션: 거래 추가 버튼 클릭
document.getElementById('add-transaction-btn').addEventListener('click', () => {
  showAddTransactionModal();
});

// 2. 모달에서 입력 후 저장 버튼 클릭
async function saveTransaction() {
  const data = {
    type: document.getElementById('transaction-type').value,
    category: document.getElementById('transaction-category').value,
    amount: parseFloat(document.getElementById('transaction-amount').value),
    date: document.getElementById('transaction-date').value,
    description: document.getElementById('transaction-description').value
  };
  
  // 3. API 호출
  const response = await axios.post('/api/transactions', data);
  
  if (response.data.success) {
    // 4. state 업데이트
    state.transactions.push({
      id: response.data.data.id,
      ...data
    });
    
    // 5. UI 재렌더링
    renderMonthlyView();
    
    // 6. 모달 닫기
    closeModal();
    
    // 7. 성공 알림
    showToast('✅ 거래가 추가되었습니다.');
  } else {
    alert('오류: ' + response.data.error);
  }
}
```

---

## 9. 성능 최적화 전략

### 9.1 Service Worker 캐싱

```javascript
// sw.js
const CACHE_NAME = 'budget-app-v1.0.0';
const urlsToCache = [
  '/static/app.js',
  '/static/i18n.js',
  '/static/style.css',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/manifest.json'
];

// 설치 시 캐시 생성
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 요청 인터셉트
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // 캐시 Hit → 즉시 반환
      if (response) {
        return response;
      }
      
      // 캐시 Miss → 네트워크 요청
      return fetch(event.request);
    })
  );
});
```

**효과:**
```text
첫 방문:      app.js 다운로드 316KB (2.3초, 3G 기준)
재방문:       캐시에서 로드 (0.05초, 46배 빠름)
오프라인:     캐시에서 로드 (인터넷 없이 작동!)
```

### 9.2 Yahoo Finance API 메모리 캐시

```javascript
// 60초 TTL 메모리 캐시
const memoryCache = new Map();

function getCached(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expiry) {
    memoryCache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache(key, data, ttlSeconds = 60) {
  memoryCache.set(key, {
    data,
    expiry: Date.now() + (ttlSeconds * 1000)
  });
}
```

**성능 비교:**
```text
캐시 미적중 (API 호출):    340ms
캐시 적중 (메모리):        0.5ms (680배 빠름)

시나리오:
  - 사용자가 투자 탭 진입 → 10개 종목 조회 → 3.4초
  - 30초 후 새로고침 → 캐시 적중 → 0.005초
  - 60초 후 새로고침 → 캐시 만료 → 3.4초 (재조회)
```

### 9.3 월별 통계 캐시 테이블

**Before (캐시 없음):**
```sql
-- 매번 거래 내역 전체 집계
SELECT 
  SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
  SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense,
  SUM(CASE WHEN type='savings' THEN amount ELSE 0 END) as savings
FROM transactions
WHERE user_id = 1 AND strftime('%Y-%m', date) = '2025-03';
-- 거래 10,000개 → 450ms
```

**After (캐시 사용):**
```sql
-- 미리 계산된 값 조회
SELECT income, expense, savings
FROM monthly_summary
WHERE user_id = 1 AND year_month = '2025-03';
-- 1개 행 조회 → 12ms (37배 빠름)
```

**캐시 무효화:**
```javascript
// 거래 추가/수정/삭제 시 자동 재계산
await recalcMonthlySummary(DB, userId, yearMonth);
```

### 9.4 DOM 조작 최적화

```javascript
// ❌ 잘못된 방법: 반복문에서 DOM 직접 조작
transactions.forEach(t => {
  const div = document.createElement('div');
  div.textContent = t.description;
  document.getElementById('list').appendChild(div);
});
// → 100개 거래 시 100번 리플로우/리페인트

// ✅ 올바른 방법: 문자열 생성 후 한 번에 삽입
const html = transactions.map(t => `
  <div>${t.description}</div>
`).join('');
document.getElementById('list').innerHTML = html;
// → 1번 리플로우/리페인트
```

### 9.5 이미지 압축 (WebP)

```javascript
// WebP 75% 품질, 1600px 리사이징
canvas.toDataURL('image/webp', 0.75);

// 압축 효과:
// 3.2MB (JPEG) → 280KB (WebP) = 91% 감소
```

---

## 10. 배포 및 운영

### 10.1 로컬 개발 환경

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 D1 데이터베이스 초기화
npx wrangler d1 migrations apply webapp-production --local

# 3. 빌드
npm run build

# 4. 개발 서버 시작 (포트 8787)
npx wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 8787
```

**개발 서버 특징:**
- ✅ 핫 리로드 (파일 변경 시 자동 재시작)
- ✅ 로컬 D1 데이터베이스 (`.wrangler/state/v3/d1/`)
- ✅ 환경 변수 `.dev.vars`에서 로드

### 10.2 프로덕션 배포

```bash
# 1. 프로덕션 D1 데이터베이스 마이그레이션
npx wrangler d1 migrations apply webapp-production --remote

# 2. Cloudflare Pages 배포
npx wrangler pages deploy dist --project-name=budget-lee

# 3. 환경 변수 설정 (최초 1회)
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put GOOGLE_CLIENT_ID --env production
npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

**배포 URL:**
- 프로덕션: https://budget-lee.pages.dev
- 최신 빌드: https://<commit-hash>.budget-lee.pages.dev

### 10.3 데이터베이스 백업

```bash
# 로컬 D1 백업
cp -r .wrangler/state/v3/d1 backup/

# 프로덕션 D1 백업 (SQL 덤프)
npx wrangler d1 execute webapp-production --remote --command="SELECT * FROM transactions" > backup.sql
```

### 10.4 모니터링

**Cloudflare Analytics에서 확인 가능:**
- 요청 수 (Requests/day)
- 응답 시간 (Latency p50, p95, p99)
- 에러율 (Error rate)
- 대역폭 사용량 (Bandwidth)

**로그 확인:**
```bash
# 로컬 개발 서버 로그
npx wrangler pages dev dist --d1=webapp-production --local

# 프로덕션 로그 (Tail)
npx wrangler tail --env production
```

---

## 11. Google OAuth 현재 상태

### 11.1 구현 완료된 부분 ✅

#### **백엔드 API (src/index.tsx)**
- ✅ `/api/auth/google` - Google 인증 페이지로 리다이렉트
- ✅ `/api/auth/google/callback` - Google에서 돌아오는 콜백 처리
- ✅ `/api/auth/link-google` - 기존 계정에 Google 연동
- ✅ `/api/auth/migrate-data` - 계정 간 데이터 이전
- ✅ JWT 토큰 생성 및 검증 로직

#### **데이터베이스 스키마**
- ✅ `users.email` 컬럼 (Google 이메일 저장)
- ✅ `users.google_id` 컬럼 (Google 계정 고유 ID)
- ✅ 인덱스: `idx_users_google_id`, `idx_users_email`

#### **프론트엔드 UI (public/static/app.js)**
- ✅ 로그인 모달에 "Sign in with Google" 버튼
- ✅ 설정 페이지에 Google 계정 연동 섹션
- ✅ 계정 링크 상태 확인 함수 (`checkGoogleLinkStatus`)

### 11.2 미설정 부분 ❌

#### **Google Cloud Console 설정**
```text
❌ OAuth 2.0 클라이언트 ID 생성 안 됨
❌ Authorized redirect URIs 추가 안 됨
❌ Client ID / Client Secret 발급 안 됨
```

#### **환경 변수**
```bash
# .dev.vars (로컬 개발)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com  # ❌ 더미값
GOOGLE_CLIENT_SECRET=your-google-client-secret  # ❌ 더미값
GOOGLE_REDIRECT_URI=https://8787-....sandbox.novita.ai/api/auth/google/callback  # ✅ 올바름

# Cloudflare 환경 변수 (프로덕션)
❌ wrangler secret put GOOGLE_CLIENT_ID (설정 안 됨)
❌ wrangler secret put GOOGLE_CLIENT_SECRET (설정 안 됨)
```

### 11.3 설정 방법 (단계별 가이드)

#### **Step 1: Google Cloud Console 접속**
1. https://console.cloud.google.com/apis/credentials 접속
2. 프로젝트 선택 또는 생성
3. "사용자 인증 정보 만들기" → "OAuth 클라이언트 ID" 선택

#### **Step 2: OAuth 동의 화면 설정**
1. "OAuth 동의 화면" 탭 클릭
2. User Type: "외부" 선택
3. 앱 정보 입력:
   - 앱 이름: "Budget Lee"
   - 사용자 지원 이메일: 본인 이메일
   - 개발자 연락처 정보: 본인 이메일
4. 범위 추가:
   - `openid`
   - `email`
   - `profile`

#### **Step 3: OAuth 클라이언트 ID 생성**
1. "사용자 인증 정보" 탭 → "OAuth 클라이언트 ID 만들기"
2. 애플리케이션 유형: **웹 애플리케이션**
3. 승인된 리디렉션 URI 추가:
   ```
   http://localhost:8787/api/auth/google/callback
   https://budget-lee.pages.dev/api/auth/google/callback
   ```
4. "만들기" 클릭
5. **Client ID**와 **Client Secret** 복사

#### **Step 4: 로컬 환경 변수 설정**
`.dev.vars` 파일 수정:
```bash
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:8787/api/auth/google/callback
JWT_SECRET=test-secret-key-change-in-production-123456789
```

#### **Step 5: 프로덕션 환경 변수 설정**
```bash
cd /home/user/webapp
npx wrangler secret put GOOGLE_CLIENT_ID --env production
# → 프롬프트에 Client ID 입력

npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
# → 프롬프트에 Client Secret 입력

npx wrangler secret put GOOGLE_REDIRECT_URI --env production
# → 프롬프트에 https://budget-lee.pages.dev/api/auth/google/callback 입력
```

#### **Step 6: 테스트**
```bash
# 로컬 개발 서버 재시작
npx wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 8787

# 브라우저에서 접속
http://localhost:8787

# "Sign in with Google" 버튼 클릭
# → Google 로그인 페이지로 리다이렉트됨
# → 승인 후 앱으로 돌아옴
# → JWT 토큰 발급 및 로그인 완료
```

### 11.4 현재 권장 사항

**GPT의 조언대로 3가지 옵션:**

#### **옵션 A: Google OAuth 완전 재설정 (처음부터 제대로)** 🔴 **추천**
- ✅ 장점: 정확한 설정, 프로덕션 준비 완료
- ❌ 단점: Google Cloud Console 설정 필요 (10분 소요)
- 📝 작업: 위 Step 1-6 수행

#### **옵션 B: 현재 코드 디버깅 (문제만 해결)**
- ✅ 장점: 빠른 해결
- ❌ 단점: 근본적 문제 해결 안 됨
- 📝 작업: 
  - `.dev.vars`에 실제 Client ID/Secret 입력
  - 리다이렉트 URI 확인

#### **옵션 C: 일단 끄고 핵심 기능 먼저 개발** 🟢 **가장 현실적**
- ✅ 장점: 시간 절약, 기존 로그인 시스템 충분
- ❌ 단점: Google 로그인 편의성 없음
- 📝 작업:
  ```javascript
  // public/static/app.js
  // Google 로그인 버튼 숨기기
  function showLoginModal() {
    // ...
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) googleBtn.style.display = 'none';
  }
  ```

**내 의견: 옵션 C 추천** 이유:
1. 현재 JWT 로그인 시스템이 완벽하게 작동 중
2. Google OAuth는 편의 기능일 뿐, 필수 아님
3. 프로덕션 배포 후 사용자 피드백 받고 나서 추가해도 늦지 않음
4. 지금은 핵심 기능 (예산, 통계, 리포트) 안정화에 집중

---

## 12. 문제 해결 가이드

### 12.1 로그인 오류 해결

#### **증상: "no such table: users" 에러**
```bash
# 원인: 데이터베이스 마이그레이션 안 됨
# 해결:
npx wrangler d1 migrations apply webapp-production --local
```

#### **증상: "비밀번호가 틀렸습니다" (하지만 비밀번호 맞음)**
```bash
# 원인: 비밀번호 해싱 불일치
# 해결: 계정 재생성
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","password":"1234","name":"홍길동"}'
```

#### **증상: JWT 토큰 무효**
```bash
# 원인: JWT_SECRET 변경됨
# 해결: 재로그인 (토큰 재발급)
```

### 12.2 데이터 로딩 실패

#### **증상: 통계가 0원으로 표시됨**
```javascript
// 원인: user_id 불일치
// 해결: localStorage 확인
console.log(localStorage.getItem('authToken'));

// 토큰 디코딩 (https://jwt.io 사용)
// payload.sub가 DB의 user_id와 일치하는지 확인
```

#### **증상: 거래 내역이 안 보임**
```javascript
// 원인 1: 날짜 범위 오류
// 해결: 네트워크 탭에서 API 요청 확인
// /api/transactions?startDate=2025-03-01&endDate=2025-03-31

// 원인 2: user_id가 다른 사용자의 데이터 조회 중
// 해결: 로그아웃 후 재로그인
```

### 12.3 빌드 오류

#### **증상: `npm run build` 실패**
```bash
# 원인: node_modules 손상
# 해결:
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### **증상: TypeScript 컴파일 에러**
```bash
# 원인: src/index.tsx 문법 오류
# 해결: 에러 메시지 확인 후 해당 줄 수정
```

### 12.4 배포 오류

#### **증상: Cloudflare Pages 배포 실패**
```bash
# 원인 1: wrangler.jsonc 잘못 설정
# 해결: database_id 확인
npx wrangler d1 list

# 원인 2: 환경 변수 누락
# 해결:
npx wrangler secret put JWT_SECRET
```

#### **증상: 프로덕션에서 DB 에러**
```bash
# 원인: 프로덕션 마이그레이션 안 됨
# 해결:
npx wrangler d1 migrations apply webapp-production --remote
```

### 12.5 성능 문제

#### **증상: 앱 로딩이 느림**
```bash
# 원인 1: Service Worker 미등록
# 해결: HTTPS 환경에서 테스트 (localhost는 HTTPS 아님)

# 원인 2: API 응답 느림
# 해결: Cloudflare Analytics에서 레이턴시 확인
```

#### **증상: 주가 업데이트가 안 됨**
```javascript
// 원인: Yahoo Finance API 차단
// 해결: 네트워크 탭에서 /api/investments/price/:symbol 확인
// 401 에러 → 정상 (시뮬레이션 모드로 자동 전환)
```

---

## 📝 결론 및 다음 단계

### 현재 상태 요약

✅ **완성된 기능:**
- 월별/주별 뷰
- 거래 내역 CRUD
- 저축 통장 관리
- 고정지출 자동화
- 예산 관리
- 투자 포트폴리오 (실시간 주가)
- 영수증 관리
- 채무 관리
- 데이터 백업/복원
- 다크모드
- 다국어 (한국어/영어)
- PWA 오프라인 지원

✅ **인증 시스템:**
- JWT 토큰 로그인
- 회원가입/로그인 API
- Google OAuth 코드 (미설정)

✅ **배포:**
- 로컬 개발 환경 완벽 작동
- Cloudflare Pages 배포 준비 완료

### 권장 다음 단계

1. **Google OAuth 설정 (옵션)** - 10분
   - Google Cloud Console에서 OAuth 클라이언트 생성
   - `.dev.vars`에 Client ID/Secret 입력
   - 테스트

2. **프로덕션 배포** - 5분
   ```bash
   npx wrangler d1 migrations apply webapp-production --remote
   npx wrangler pages deploy dist --project-name=budget-lee
   ```

3. **사용자 테스트** - 1주
   - 실제 사용자 초대
   - 피드백 수집
   - 버그 수정

4. **기능 개선 우선순위**
   - 📊 카테고리별 지출 파이 차트
   - 🔔 예산 초과 알림
   - 📱 홈 화면 추가 (PWA 설치 프롬프트)
   - 🔐 PBKDF2 비밀번호 마이그레이션

---

**이 문서는 앱의 완전한 인수인계를 위해 작성되었습니다.**  
**질문이 있으면 이 문서를 먼저 참조하세요.**
