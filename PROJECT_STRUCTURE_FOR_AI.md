# 가계부 앱 (Budget Lee) - AI를 위한 프로젝트 구조 설명

## 📋 프로젝트 개요

**이름**: Budget Lee (가계부 앱)  
**타입**: 웹 기반 개인 재무 관리 애플리케이션  
**배포**: Cloudflare Pages + D1 Database  
**프로덕션 URL**: https://budget-lee.pages.dev  
**GitHub**: https://github.com/kiwidressing/Budget-Lee

## 🏗️ 아키텍처

### 기술 스택
- **Backend**: Hono (TypeScript) - Cloudflare Workers 런타임
- **Database**: Cloudflare D1 (Distributed SQLite)
- **Frontend**: Vanilla JavaScript (3,500+ lines)
- **Styling**: TailwindCSS (CDN)
- **Charts**: Chart.js
- **Deployment**: Cloudflare Pages (자동 배포)

### 핵심 특징
1. **멀티유저 지원**: JWT 기반 인증 시스템
2. **완전한 데이터 격리**: 모든 데이터는 user_id로 필터링
3. **반응형 디자인**: 모바일/태블릿/데스크톱 최적화
4. **다크모드**: LocalStorage 기반 테마 시스템
5. **PWA 지원**: 설치 가능한 웹앱

---

## 📁 프로젝트 구조

```
webapp/
├── src/
│   └── index.tsx                  # Hono 백엔드 (1,100+ 줄, 40+ API 엔드포인트)
├── public/
│   └── static/
│       ├── app.js                 # 프론트엔드 로직 (3,500+ 줄)
│       └── style.css              # 커스텀 CSS + 반응형
├── migrations/                    # D1 데이터베이스 마이그레이션
│   ├── 0001_initial_schema.sql
│   ├── 0012_add_users_table.sql   # 인증 시스템
│   ├── 0013_update_auth_to_username.sql
│   └── 0014_update_settings_for_multi_user.sql
├── wrangler.jsonc                 # Cloudflare 설정
├── vite.config.ts                 # Vite 빌드 설정
├── ecosystem.config.cjs           # PM2 (로컬 개발용)
└── package.json
```

---

## 🗄️ 데이터베이스 스키마

### 1. **users** (사용자 인증)
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,          -- 사용자 아이디
  password_hash TEXT NOT NULL,            -- SHA-256 해시
  name TEXT NOT NULL,                     -- 표시 이름
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);
```

### 2. **sessions** (JWT 토큰 관리)
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 3. **transactions** (거래 내역)
```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,                     -- 'income', 'expense', 'savings'
  category TEXT NOT NULL,                 -- '급여', '식비', '교통비' 등
  amount INTEGER NOT NULL,
  description TEXT,
  date TEXT NOT NULL,                     -- YYYY-MM-DD
  payment_method TEXT,                    -- 'card', 'cash', 'transfer'
  savings_account_id INTEGER,             -- 저축 통장 연결
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT,                           -- 사용자 격리
  FOREIGN KEY (savings_account_id) REFERENCES savings_accounts(id)
);
```

### 4. **savings_accounts** (저축 통장)
```sql
CREATE TABLE savings_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                     -- 통장 이름
  balance INTEGER DEFAULT 0,              -- 현재 잔액
  goal INTEGER DEFAULT 0,                 -- 목표 금액
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT
);
```

### 5. **fixed_expenses** (고정지출)
```sql
CREATE TABLE fixed_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                     -- 지출 항목명
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  frequency TEXT NOT NULL,                -- 'weekly', 'monthly', 'monthly_date'
  day_of_week INTEGER,                    -- 0-6 (일요일-토요일)
  week_of_month INTEGER,                  -- 1-4 (첫째주-넷째주)
  day_of_month INTEGER,                   -- 1-31 (매월 특정 일자)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT
);
```

### 6. **fixed_expense_payments** (고정지출 지불 기록)
```sql
CREATE TABLE fixed_expense_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fixed_expense_id INTEGER NOT NULL,
  payment_date TEXT NOT NULL,             -- YYYY-MM-DD
  transaction_id INTEGER,                 -- 연결된 거래 내역
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fixed_expense_id) REFERENCES fixed_expenses(id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);
```

### 7. **category_budgets** (예산)
```sql
CREATE TABLE category_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  monthly_budget INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT,
  UNIQUE(category, user_id)
);
```

### 8. **settings** (사용자 설정)
```sql
CREATE TABLE settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency TEXT DEFAULT 'KRW',            -- 통화 (KRW, USD, EUR 등)
  initial_balance INTEGER DEFAULT 0,      -- 초기 잔액
  cash_on_hand INTEGER DEFAULT 0,         -- 현금 보유액
  category_colors TEXT,                   -- JSON 형식의 색상 설정
  user_id TEXT
);
```

### 9. **investments** (투자 종목)
```sql
CREATE TABLE investments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,                   -- 'AAPL', '005930.KS' 등
  quantity INTEGER NOT NULL,
  average_price INTEGER NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT
);
```

### 10. **receipts** (영수증)
```sql
CREATE TABLE receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_data TEXT,                        -- Base64 인코딩된 이미지
  merchant TEXT,                          -- 구매처
  purchase_date TEXT,                     -- 구매일
  amount INTEGER,
  category TEXT,
  payment_method TEXT,
  notes TEXT,
  is_tax_deductible INTEGER DEFAULT 0,   -- 세금공제 여부
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT
);
```

---

## 🔌 주요 API 엔드포인트 (40+)

### 인증 API
```typescript
POST   /api/auth/register         // 회원가입 (username, password, name)
POST   /api/auth/login            // 로그인 → JWT 토큰 반환
POST   /api/auth/check            // 토큰 유효성 확인
```

### 거래 내역 API (authMiddleware 적용)
```typescript
GET    /api/transactions          // 날짜 범위로 조회
POST   /api/transactions          // 새 거래 추가
PUT    /api/transactions/:id      // 거래 수정
DELETE /api/transactions/:id      // 거래 삭제
GET    /api/transactions/date/:date  // 특정 날짜 거래
```

### 저축 통장 API
```typescript
GET    /api/savings-accounts      // 통장 목록
POST   /api/savings-accounts      // 통장 생성
DELETE /api/savings-accounts/:id  // 통장 삭제
PUT    /api/savings-accounts/:id/goal  // 목표 금액 설정
```

### 고정지출 API
```typescript
GET    /api/fixed-expenses                    // 목록
POST   /api/fixed-expenses                    // 생성
DELETE /api/fixed-expenses/:id                // 삭제
GET    /api/fixed-expenses/instances/:yearMonth  // 반복 인스턴스
POST   /api/fixed-expenses/:id/pay            // 지불 처리
```

### 예산 API
```typescript
GET    /api/budgets                           // 예산 목록
PUT    /api/budgets/:category                 // 예산 설정 (UPSERT)
DELETE /api/budgets/:category                 // 예산 삭제
GET    /api/budgets/vs-spending/:yearMonth    // 예산 vs 지출
```

### 통계 API
```typescript
GET    /api/statistics/monthly/:yearMonth     // 월별 통계
GET    /api/statistics/weekly/:startDate      // 주별 통계
GET    /api/calendar/:yearMonth               // 달력 데이터
```

### 투자 API
```typescript
GET    /api/investments                       // 보유 종목
POST   /api/investments                       // 종목 추가
PUT    /api/investments/:id                   // 종목 수정
DELETE /api/investments/:id                   // 종목 삭제
GET    /api/investments/price/:symbol         // 실시간 주가 (Yahoo Finance)
```

### 설정 API
```typescript
GET    /api/settings                          // 설정 조회
PUT    /api/settings                          // 설정 수정
```

---

## 🔐 인증 시스템

### 1. JWT 토큰 기반 인증
```typescript
// 토큰 생성 (로그인 시)
const payload = {
  sub: userId.toString(),
  username: username,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30)  // 30일
}
const token = await sign(payload, secret)
```

### 2. 인증 미들웨어
```typescript
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
  }
  
  const token = authHeader.substring(7)
  const payload = await verify(token, secret)
  c.set('userId', parseInt(payload.sub as string))
  c.set('username', payload.username as string)
  await next()
}
```

### 3. 비밀번호 해싱
```typescript
// SHA-256 해싱 (Web Crypto API)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
```

---

## 🎨 프론트엔드 구조

### 전역 상태 (state 객체)
```javascript
const state = {
  currentMonth: new Date(),
  currentWeekStart: null,
  transactions: [],
  savingsAccounts: [],
  fixedExpenses: [],
  budgets: [],
  investments: [],
  settings: {
    currency: 'KRW',
    initial_balance: 0,
    cash_on_hand: 0,
    category_colors: {}
  },
  activeView: 'home',
  darkMode: localStorage.getItem('darkMode') === 'true',
  isAuthenticated: false,
  currentUser: null,
  authToken: localStorage.getItem('authToken') || null
}
```

### 주요 뷰 (Views)
1. **홈 대시보드** (`renderHomeView`)
   - 환영 메시지
   - 총 자산/수입/지출/저축 카드
   - 저축률 진행 바
   - 카테고리별 지출 차트
   - 수입/지출/저축 비교 차트

2. **월별 뷰** (`renderMonthView`)
   - 달력 인터페이스
   - 월간 통계 카드
   - 거래 내역 리스트
   - 예산 vs 지출 그래프

3. **주별 뷰** (`renderWeekView`)
   - 주간 통계
   - 주간 거래 내역

4. **저축 관리** (`renderSavingsView`)
   - 저축 통장 목록
   - 목표 설정 및 진행률

5. **고정지출** (`renderFixedExpensesView`)
   - 반복 지출 관리
   - 체크박스로 지불 처리

6. **예산 관리** (`renderBudgetsView`)
   - 카테고리별 예산 설정
   - 진행률 시각화

7. **투자 관리** (`renderInvestmentsView`)
   - 포트폴리오 대시보드
   - 실시간 주가 업데이트

8. **리포트** (`renderReportsView`)
   - 3단계 드릴다운 리포트
   - 연간 → 월별 → 카테고리 → 거래

9. **설정** (`renderSettingsView`)
   - 통화 변경
   - 다크모드 토글
   - 데이터 백업/복원

### 핵심 기능 함수

#### 인증 처리
```javascript
async function handleLogin(event) {
  event.preventDefault()
  const formData = new FormData(event.target)
  const username = formData.get('username')
  const password = formData.get('password')
  
  const response = await axios.post('/api/auth/login', { username, password })
  
  if (response.data.success) {
    setAuthToken(response.data.token)
    state.isAuthenticated = true
    state.currentUser = response.data.user
    renderApp()
  }
}

function setAuthToken(token) {
  localStorage.setItem('authToken', token)
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
}
```

#### 데이터 로딩
```javascript
async function fetchTransactions(startDate, endDate, type = null) {
  let url = `/api/transactions?start_date=${startDate}&end_date=${endDate}`
  if (type) url += `&type=${type}`
  
  const response = await axios.get(url)
  if (response.data.success) {
    state.transactions = response.data.data
  }
}
```

#### 차트 렌더링
```javascript
function drawHomeCategoryChart(expenseByCategory, categoryBudgetMap, hasBudgets) {
  const canvas = document.getElementById('home-category-chart')
  const ctx = canvas.getContext('2d')
  
  const categories = Object.keys(expenseByCategory).sort((a, b) => 
    expenseByCategory[b] - expenseByCategory[a]
  )
  
  const datasets = [{
    label: '실제 지출',
    data: categories.map(cat => expenseByCategory[cat]),
    backgroundColor: 'rgba(239, 68, 68, 0.7)'
  }]
  
  if (hasBudgets) {
    datasets.push({
      label: '예산',
      data: categories.map(cat => categoryBudgetMap[cat] || 0),
      backgroundColor: 'rgba(59, 130, 246, 0.7)'
    })
  }
  
  new Chart(ctx, {
    type: 'bar',
    data: { labels: categories, datasets: datasets },
    options: { /* ... */ }
  })
}
```

---

## 🎯 핵심 알고리즘

### 1. 고정지출 날짜 계산
```javascript
// N번째 특정 요일 찾기 (예: 매월 첫째 주 목요일)
function getNthDayOfMonth(year, month, nth, dayOfWeek) {
  let date = new Date(year, month, 1)
  let count = 0
  
  while (date.getMonth() === month) {
    if (date.getDay() === dayOfWeek) {
      count++
      if (count === nth) return new Date(date)
    }
    date.setDate(date.getDate() + 1)
  }
  return null
}

// 매월 특정 일자 (31일 자동 처리)
function getSpecificDayOfMonth(year, month, dayOfMonth) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const actualDay = Math.min(dayOfMonth, lastDay)
  return new Date(year, month, actualDay)
}
```

### 2. 잔액 계산
```javascript
const income = transactions.filter(t => t.type === 'income')
  .reduce((sum, t) => sum + t.amount, 0)

const expense = transactions.filter(t => t.type === 'expense')
  .reduce((sum, t) => sum + t.amount, 0)

const savings = transactions.filter(t => t.type === 'savings')
  .reduce((sum, t) => sum + t.amount, 0)

const balance = settings.initial_balance + income - expense - savings
```

### 3. 저축률 계산
```javascript
const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0
```

### 4. 예산 진행률 색상
```javascript
function getBudgetColor(percentage) {
  if (percentage < 50) return '#10B981'   // 초록 (안전)
  if (percentage < 80) return '#F59E0B'   // 노랑 (양호)
  if (percentage <= 100) return '#F97316' // 주황 (주의)
  return '#EF4444'                        // 빨강 (초과)
}
```

---

## 📱 반응형 디자인

### 브레이크포인트
- **모바일**: 640px 이하
- **태블릿**: 641px ~ 1024px
- **데스크톱**: 1025px 이상

### 모바일 최적화 CSS
```css
@media (max-width: 640px) {
  /* 컴팩트한 레이아웃 */
  .container { padding: 0.5rem !important; }
  
  /* 텍스트 크기 조정 */
  .text-3xl { font-size: 1.5rem !important; }
  
  /* 입력 필드 (iOS 줌 방지) */
  input, select, textarea { font-size: 16px !important; }
  
  /* 터치 타겟 최소 크기 */
  button { min-height: 44px; min-width: 44px; }
  
  /* 탭 스크롤 */
  nav.flex {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}

/* iPhone 노치 대응 */
@supports (padding: max(0px)) {
  body {
    padding-left: max(0px, env(safe-area-inset-left));
    padding-right: max(0px, env(safe-area-inset-right));
    padding-bottom: max(0px, env(safe-area-inset-bottom));
  }
}
```

---

## 🌙 다크모드

### CSS 변수 기반 테마
```css
:root {
  --bg-primary: #F3F4F6;
  --bg-secondary: #FFFFFF;
  --text-primary: #111827;
}

.dark {
  --bg-primary: #111827;
  --bg-secondary: #1F2937;
  --text-primary: #F9FAFB;
}
```

### JavaScript 토글
```javascript
function toggleDarkMode() {
  state.darkMode = !state.darkMode
  localStorage.setItem('darkMode', state.darkMode)
  applyDarkMode()
}

function applyDarkMode() {
  if (state.darkMode) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}
```

---

## 🚀 배포 프로세스

### 1. GitHub Actions 자동 배포
```yaml
# .github/workflows/deploy.yml (자동 생성)
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: cloudflare/wrangler-action@2.0.0
```

### 2. 로컬 빌드 및 배포
```bash
# 빌드
npm run build

# Cloudflare Pages에 배포
npx wrangler pages deploy dist --project-name budgetlee
```

### 3. 데이터베이스 마이그레이션
```bash
# 로컬 개발
npx wrangler d1 migrations apply webapp-production --local

# 프로덕션
npx wrangler d1 migrations apply webapp-production
```

---

## 💡 주요 사용자 플로우

### 1. 회원가입 및 로그인
```
1. 사용자가 회원가입 폼 작성 (username, password, name)
2. POST /api/auth/register → 비밀번호 SHA-256 해싱 후 저장
3. 로그인 시 POST /api/auth/login → JWT 토큰 반환
4. 토큰을 LocalStorage에 저장
5. axios 기본 헤더에 Authorization: Bearer {token} 설정
6. 모든 API 요청에 자동으로 토큰 포함
```

### 2. 거래 입력
```
1. 달력에서 날짜 클릭 또는 "+" 버튼 클릭
2. 모달 폼에서 유형(수입/지출/저축), 카테고리, 금액 등 입력
3. POST /api/transactions → D1에 저장 (user_id 자동 포함)
4. 현재 뷰 자동 새로고침
5. 통계 카드 실시간 업데이트
```

### 3. 고정지출 관리
```
1. 고정지출 탭에서 새 항목 추가 (월세, 통신비 등)
2. 주기 선택 (매월 첫째 주 월요일, 매월 5일, 매주 금요일)
3. 해당 월의 반복 인스턴스 자동 생성
4. 체크박스 클릭으로 지불 완료 처리
5. 자동으로 거래 내역 생성 (transactions 테이블에 추가)
```

---

## 🔧 개발 환경 설정

### 필수 요구사항
- Node.js 18+
- npm 또는 yarn
- Cloudflare 계정 (배포 시)

### 로컬 개발
```bash
# 1. 의존성 설치
npm install

# 2. 로컬 D1 데이터베이스 초기화
npx wrangler d1 migrations apply webapp-production --local

# 3. 빌드
npm run build

# 4. 개발 서버 시작
pm2 start ecosystem.config.cjs

# 5. 브라우저에서 접속
http://localhost:3000
```

---

## 📊 성능 최적화

### 1. 번들 크기
- **_worker.js**: ~60KB (압축)
- CDN 라이브러리 사용으로 번들 최소화

### 2. 데이터베이스 쿼리
- 인덱스 활용: `user_id`, `date`, `category`
- 날짜 범위 쿼리 최적화

### 3. 프론트엔드
- 차트는 필요할 때만 렌더링 (`setTimeout` 사용)
- LocalStorage 캐싱 (authToken, darkMode)
- 실시간 주가는 30초마다 갱신

---

## 🔒 보안

### 1. 인증
- JWT 토큰 (30일 만료)
- SHA-256 비밀번호 해싱

### 2. 데이터 격리
- 모든 쿼리에 `WHERE user_id = ?` 필터
- 미들웨어에서 userId 자동 주입

### 3. XSS 방어
- 입력 검증 함수 (validateString, validateNumber)
- HTML 태그 제거

---

## 📝 주요 카테고리

### 수입 (Income)
```javascript
['급여', '상여금', '부수입', '기타수입']
```

### 지출 (Expense)
```javascript
[
  '의복비', '식비', '주거비', '교통비',
  '문화생활', '쇼핑', '의료비', '교육비',
  '통신비', '보험', '기타지출'
]
```

### 저축 (Savings)
```javascript
['저축']
```

---

## 🎯 이 문서의 활용

다른 AI에게 이 앱을 설명할 때:

1. **전체 구조**: "Hono + Cloudflare D1 기반의 멀티유저 가계부 앱"
2. **인증**: "JWT 기반, SHA-256 해싱, 4자리 숫자 비밀번호"
3. **데이터**: "10개 테이블, user_id로 완전 격리"
4. **UI**: "바닐라 JS 3,500줄, Chart.js 차트, 반응형 디자인"
5. **주요 기능**: "거래/저축/고정지출/예산/투자/리포트/영수증 관리"

이 문서를 복사해서 다른 AI에게 전달하면 앱의 전체 구조를 이해하고 수정/확장 작업을 수행할 수 있습니다.
