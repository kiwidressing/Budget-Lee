# 핵심 코드 스니펫 (Core Code Snippets)

이 문서는 Budget Lee 앱의 핵심 코드만 발췌한 것입니다. 다른 AI에게 구체적인 구현을 설명할 때 사용하세요.

---

## 1️⃣ Backend: 인증 시스템 (src/index.tsx)

### 비밀번호 해싱
```typescript
// SHA-256 해싱 (Web Crypto API)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// 비밀번호 검증
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  return passwordHash === hash
}
```

### JWT 토큰 생성
```typescript
import { sign, verify } from 'hono/jwt'

async function createToken(userId: number, username: string, secret: string): Promise<string> {
  const payload = {
    sub: userId.toString(),
    username: username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) // 30일
  }
  return await sign(payload, secret)
}
```

### 인증 미들웨어
```typescript
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
  }
  
  const token = authHeader.substring(7)
  const secret = c.env.JWT_SECRET || 'default-secret-key-change-in-production'
  
  try {
    const payload = await verify(token, secret)
    c.set('userId', parseInt(payload.sub as string))
    c.set('username', payload.username as string)
    await next()
  } catch (error) {
    return c.json({ success: false, error: '유효하지 않은 토큰입니다.' }, 401)
  }
}
```

### 회원가입 API
```typescript
app.post('/api/auth/register', async (c) => {
  const { DB } = c.env
  const { username, password, name } = await c.req.json()
  
  // 입력 검증
  if (!username || !password || !name) {
    return c.json({ success: false, error: '모든 필드를 입력해주세요.' }, 400)
  }
  
  if (password.length !== 4) {
    return c.json({ success: false, error: '비밀번호는 4자리여야 합니다.' }, 400)
  }
  
  // 중복 확인
  const existing = await DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username).first()
  
  if (existing) {
    return c.json({ success: false, error: '이미 존재하는 사용자입니다.' }, 400)
  }
  
  // 비밀번호 해싱 및 저장
  const passwordHash = await hashPassword(password)
  
  const result = await DB.prepare(`
    INSERT INTO users (username, password_hash, name) 
    VALUES (?, ?, ?)
  `).bind(username, passwordHash, name).run()
  
  return c.json({ 
    success: true, 
    message: '회원가입이 완료되었습니다.',
    userId: result.meta.last_row_id
  })
})
```

### 로그인 API
```typescript
app.post('/api/auth/login', async (c) => {
  const { DB } = c.env
  const { username, password } = await c.req.json()
  
  // 사용자 조회
  const user = await DB.prepare('SELECT * FROM users WHERE username = ?')
    .bind(username).first() as any
  
  if (!user) {
    return c.json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401)
  }
  
  // 비밀번호 검증
  const isValid = await verifyPassword(password, user.password_hash)
  
  if (!isValid) {
    return c.json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401)
  }
  
  // 마지막 로그인 시간 업데이트
  await DB.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(user.id).run()
  
  // JWT 토큰 생성
  const secret = c.env.JWT_SECRET || 'default-secret-key-change-in-production'
  const token = await createToken(user.id, user.username, secret)
  
  return c.json({
    success: true,
    token: token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name
    }
  })
})
```

---

## 2️⃣ Backend: 거래 내역 API (src/index.tsx)

### 거래 조회 (날짜 범위)
```typescript
app.get('/api/transactions', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const startDate = c.req.query('start_date')
  const endDate = c.req.query('end_date')
  const type = c.req.query('type')
  
  let query = `
    SELECT * FROM transactions 
    WHERE user_id = ? AND date BETWEEN ? AND ?
  `
  const params = [userId?.toString(), startDate, endDate]
  
  if (type) {
    query += ' AND type = ?'
    params.push(type)
  }
  
  query += ' ORDER BY date DESC, created_at DESC'
  
  const stmt = DB.prepare(query)
  const result = await stmt.bind(...params).all()
  
  return c.json({ success: true, data: result.results })
})
```

### 거래 추가
```typescript
app.post('/api/transactions', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const { type, category, amount, description, date, payment_method, savings_account_id } = 
    await c.req.json()
  
  // 입력 검증
  if (!type || !category || !amount || !date) {
    return c.json({ success: false, error: '필수 항목을 입력해주세요.' }, 400)
  }
  
  // 거래 추가
  const result = await DB.prepare(`
    INSERT INTO transactions 
    (type, category, amount, description, date, payment_method, savings_account_id, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(type, category, amount, description, date, payment_method, savings_account_id, userId?.toString())
    .run()
  
  // 저축 거래인 경우 저축 통장 잔액 업데이트
  if (type === 'savings' && savings_account_id) {
    await DB.prepare(`
      UPDATE savings_accounts 
      SET balance = balance + ? 
      WHERE id = ? AND user_id = ?
    `).bind(amount, savings_account_id, userId?.toString()).run()
  }
  
  return c.json({ 
    success: true, 
    id: result.meta.last_row_id 
  })
})
```

### 거래 수정
```typescript
app.put('/api/transactions/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { type, category, amount, description, date, payment_method, savings_account_id } = 
    await c.req.json()
  
  // 기존 거래 조회 (권한 확인)
  const existing = await DB.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?')
    .bind(id, userId?.toString()).first() as any
  
  if (!existing) {
    return c.json({ success: false, error: '거래를 찾을 수 없습니다.' }, 404)
  }
  
  // 저축 통장 잔액 롤백 (이전)
  if (existing.type === 'savings' && existing.savings_account_id) {
    await DB.prepare(`
      UPDATE savings_accounts 
      SET balance = balance - ? 
      WHERE id = ? AND user_id = ?
    `).bind(existing.amount, existing.savings_account_id, userId?.toString()).run()
  }
  
  // 거래 수정
  await DB.prepare(`
    UPDATE transactions 
    SET type = ?, category = ?, amount = ?, description = ?, 
        date = ?, payment_method = ?, savings_account_id = ?
    WHERE id = ? AND user_id = ?
  `).bind(type, category, amount, description, date, payment_method, savings_account_id, id, userId?.toString())
    .run()
  
  // 저축 통장 잔액 업데이트 (새로운)
  if (type === 'savings' && savings_account_id) {
    await DB.prepare(`
      UPDATE savings_accounts 
      SET balance = balance + ? 
      WHERE id = ? AND user_id = ?
    `).bind(amount, savings_account_id, userId?.toString()).run()
  }
  
  return c.json({ success: true })
})
```

---

## 3️⃣ Backend: 고정지출 API (src/index.tsx)

### 고정지출 반복 인스턴스 생성
```typescript
app.get('/api/fixed-expenses/instances/:yearMonth', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const yearMonth = c.req.param('yearMonth')
  const [year, month] = yearMonth.split('-').map(Number)
  
  // 모든 고정지출 가져오기
  const fixedExpenses = await DB.prepare(`
    SELECT * FROM fixed_expenses WHERE user_id = ?
  `).bind(userId?.toString()).all()
  
  const instances: any[] = []
  
  for (const expense of fixedExpenses.results) {
    const exp = expense as any
    
    if (exp.frequency === 'weekly') {
      // 주별: 해당 월의 모든 해당 요일
      const dates = getAllDayOccurrences(year, month - 1, exp.day_of_week)
      dates.forEach(date => {
        instances.push({
          ...exp,
          instance_date: formatDate(date)
        })
      })
      
    } else if (exp.frequency === 'monthly') {
      // 월별 (특정 주/요일): N번째 특정 요일
      const date = getNthDayOfMonth(year, month - 1, exp.week_of_month, exp.day_of_week)
      if (date) {
        instances.push({
          ...exp,
          instance_date: formatDate(date)
        })
      }
      
    } else if (exp.frequency === 'monthly_date') {
      // 매월 특정 일자
      const lastDay = new Date(year, month, 0).getDate()
      const actualDay = Math.min(exp.day_of_month, lastDay)
      const date = new Date(year, month - 1, actualDay)
      
      instances.push({
        ...exp,
        instance_date: formatDate(date)
      })
    }
  }
  
  return c.json({ success: true, data: instances })
})

// 헬퍼 함수
function getNthDayOfMonth(year: number, month: number, nth: number, dayOfWeek: number) {
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

function getAllDayOccurrences(year: number, month: number, dayOfWeek: number) {
  const dates: Date[] = []
  let date = new Date(year, month, 1)
  
  while (date.getMonth() === month) {
    if (date.getDay() === dayOfWeek) {
      dates.push(new Date(date))
    }
    date.setDate(date.getDate() + 1)
  }
  return dates
}
```

### 고정지출 지불 처리
```typescript
app.post('/api/fixed-expenses/:id/pay', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { payment_date } = await c.req.json()
  
  // 고정지출 조회
  const expense = await DB.prepare(`
    SELECT * FROM fixed_expenses WHERE id = ? AND user_id = ?
  `).bind(id, userId?.toString()).first() as any
  
  if (!expense) {
    return c.json({ success: false, error: '고정지출을 찾을 수 없습니다.' }, 404)
  }
  
  // 거래 내역 생성
  const transactionResult = await DB.prepare(`
    INSERT INTO transactions 
    (type, category, amount, description, date, payment_method, user_id)
    VALUES ('expense', ?, ?, ?, ?, 'card', ?)
  `).bind(
    expense.category,
    expense.amount,
    `${expense.name} (고정지출)`,
    payment_date,
    userId?.toString()
  ).run()
  
  // 지불 기록 생성
  await DB.prepare(`
    INSERT INTO fixed_expense_payments 
    (fixed_expense_id, payment_date, transaction_id)
    VALUES (?, ?, ?)
  `).bind(id, payment_date, transactionResult.meta.last_row_id).run()
  
  return c.json({ 
    success: true,
    transaction_id: transactionResult.meta.last_row_id
  })
})
```

---

## 4️⃣ Frontend: 인증 처리 (public/static/app.js)

### 로그인 처리
```javascript
async function handleLogin(event) {
  event.preventDefault()
  
  const formData = new FormData(event.target)
  const username = formData.get('username')
  const password = formData.get('password')
  
  if (!username || !password) {
    alert('아이디와 비밀번호를 입력해주세요.')
    return
  }
  
  try {
    const response = await axios.post('/api/auth/login', { username, password })
    
    if (response.data.success) {
      setAuthToken(response.data.token)
      state.isAuthenticated = true
      state.currentUser = response.data.user
      renderApp()
    }
  } catch (error) {
    alert(error.response?.data?.error || '로그인에 실패했습니다.')
  }
}

function setAuthToken(token) {
  localStorage.setItem('authToken', token)
  state.authToken = token
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

function clearAuthToken() {
  localStorage.removeItem('authToken')
  state.authToken = null
  state.isAuthenticated = false
  state.currentUser = null
  delete axios.defaults.headers.common['Authorization']
}

async function checkAuth() {
  const token = localStorage.getItem('authToken')
  
  if (!token) {
    return false
  }
  
  try {
    setAuthToken(token)
    const response = await axios.post('/api/auth/check')
    
    if (response.data.success) {
      state.isAuthenticated = true
      state.currentUser = response.data.user
      return true
    }
  } catch (error) {
    clearAuthToken()
  }
  
  return false
}
```

### 로그아웃
```javascript
function handleLogout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    clearAuthToken()
    renderLoginScreen()
  }
}
```

---

## 5️⃣ Frontend: 홈 대시보드 (public/static/app.js)

### 홈 뷰 렌더링
```javascript
async function renderHomeView() {
  const contentArea = document.getElementById('content-area')
  const yearMonth = getYearMonth(new Date())
  const daysInMonth = getDaysInMonth(new Date())
  
  // 데이터 로드
  await Promise.all([
    fetchTransactions(`${yearMonth}-01`, `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`),
    fetchBudgets(),
    fetchSettings()
  ])
  
  // 통계 계산
  const income = state.transactions.filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  const expense = state.transactions.filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
  const savings = state.transactions.filter(t => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalAssets = state.settings.initial_balance + income - expense - savings
  
  // 저축률 계산
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0
  
  // HTML 렌더링
  contentArea.innerHTML = `
    <div class="space-y-6">
      <!-- 환영 메시지 -->
      <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
        <h2 class="text-2xl md:text-3xl font-bold mb-2">
          안녕하세요, ${state.currentUser?.name || '사용자'}님! 👋
        </h2>
        <p class="text-blue-100 text-sm md:text-base">
          ${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월의 재정 현황을 확인하세요
        </p>
      </div>
      
      <!-- 통계 카드 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-gradient-to-br from-purple-500 to-purple-700 text-white p-5 rounded-lg shadow-lg">
          <p class="text-purple-100 text-sm font-medium">
            <i class="fas fa-wallet mr-2"></i>총 자산
          </p>
          <p class="text-3xl font-bold mt-2">${formatCurrency(totalAssets)}</p>
        </div>
        
        <div class="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-5 rounded-lg shadow-lg">
          <p class="text-blue-100 text-sm font-medium">
            <i class="fas fa-arrow-up mr-2"></i>수입
          </p>
          <p class="text-3xl font-bold mt-2">${formatCurrency(income)}</p>
          <p class="text-blue-200 text-xs mt-2">이번 달</p>
        </div>
        
        <div class="bg-gradient-to-br from-red-500 to-red-700 text-white p-5 rounded-lg shadow-lg">
          <p class="text-red-100 text-sm font-medium">
            <i class="fas fa-arrow-down mr-2"></i>지출
          </p>
          <p class="text-3xl font-bold mt-2">${formatCurrency(expense)}</p>
          <p class="text-red-200 text-xs mt-2">이번 달</p>
        </div>
        
        <div class="bg-gradient-to-br from-green-500 to-green-700 text-white p-5 rounded-lg shadow-lg">
          <p class="text-green-100 text-sm font-medium">
            <i class="fas fa-piggy-bank mr-2"></i>저축
          </p>
          <p class="text-3xl font-bold mt-2">${formatCurrency(savings)}</p>
          <p class="text-green-200 text-xs mt-2">이번 달</p>
        </div>
      </div>
      
      <!-- 저축률 바 -->
      <div class="bg-white p-6 rounded-lg shadow-lg">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-lg font-bold text-gray-800">
            <i class="fas fa-chart-line mr-2 text-green-600"></i>저축률
          </h3>
          <span class="text-2xl font-bold text-green-600">${savingsRate}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
          <div class="bg-gradient-to-r from-green-400 to-green-600 h-8 flex items-center justify-center text-white font-bold text-sm transition-all duration-500" 
               style="width: ${Math.min(savingsRate, 100)}%; border-radius: ${savingsRate >= 100 ? '9999px' : '9999px 0 0 9999px'};">
            ${savingsRate > 10 ? `${savingsRate}%` : ''}
          </div>
        </div>
        <div class="flex justify-between text-xs text-gray-600 mt-2">
          <span>수입 대비 저축 비율</span>
          <span>${formatCurrency(savings)} / ${formatCurrency(income)}</span>
        </div>
      </div>
      
      <!-- 차트들 -->
      <div class="bg-white p-6 rounded-lg shadow-lg">
        <h3 class="text-lg font-bold mb-4 text-gray-800">카테고리별 지출</h3>
        <div class="h-80">
          <canvas id="home-category-chart"></canvas>
        </div>
      </div>
    </div>
  `
  
  // 차트 그리기
  setTimeout(() => {
    drawHomeCategoryChart(expenseByCategory, categoryBudgetMap, hasBudgets)
  }, 100)
}
```

### Chart.js 차트 그리기
```javascript
function drawHomeCategoryChart(expenseByCategory, categoryBudgetMap, hasBudgets) {
  const canvas = document.getElementById('home-category-chart')
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  const categories = Object.keys(expenseByCategory).sort((a, b) => 
    expenseByCategory[b] - expenseByCategory[a]
  )
  
  const datasets = [{
    label: '실제 지출',
    data: categories.map(cat => expenseByCategory[cat]),
    backgroundColor: 'rgba(239, 68, 68, 0.7)',
    borderColor: 'rgba(239, 68, 68, 1)',
    borderWidth: 1
  }]
  
  if (hasBudgets && Object.keys(categoryBudgetMap).length > 0) {
    datasets.push({
      label: '예산',
      data: categories.map(cat => categoryBudgetMap[cat] || 0),
      backgroundColor: 'rgba(59, 130, 246, 0.7)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 1
    })
  }
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + formatCurrency(context.parsed.y)
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatCurrencyShort(value)
            }
          }
        }
      }
    }
  })
}
```

---

## 6️⃣ 다크모드 구현

### CSS 변수
```css
/* style.css */
:root {
  --bg-primary: #F3F4F6;
  --bg-secondary: #FFFFFF;
  --bg-card: #FFFFFF;
  --text-primary: #111827;
  --text-secondary: #6B7280;
  --border-color: #E5E7EB;
}

.dark {
  --bg-primary: #111827;
  --bg-secondary: #1F2937;
  --bg-card: #374151;
  --text-primary: #F9FAFB;
  --text-secondary: #D1D5DB;
  --border-color: #4B5563;
}

.dark body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.dark .bg-white {
  background-color: var(--bg-card) !important;
  color: var(--text-primary);
}

.dark input[type="text"],
.dark input[type="number"],
.dark select,
.dark textarea {
  color: #111827 !important;  /* 입력창은 검정색 텍스트 */
}
```

### JavaScript 토글
```javascript
// app.js
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

// 페이지 로드 시 적용
document.addEventListener('DOMContentLoaded', () => {
  const darkMode = localStorage.getItem('darkMode') === 'true'
  state.darkMode = darkMode
  applyDarkMode()
})
```

---

## 7️⃣ 반응형 디자인

### 모바일 최적화 CSS
```css
/* style.css */
@media (max-width: 640px) {
  /* 컴팩트 레이아웃 */
  .container {
    padding: 0.5rem !important;
  }
  
  /* 텍스트 크기 */
  .text-3xl { font-size: 1.5rem !important; }
  .text-2xl { font-size: 1.25rem !important; }
  
  /* 입력 필드 (iOS 줌 방지) */
  input, select, textarea {
    font-size: 16px !important;
  }
  
  /* 터치 타겟 */
  button {
    min-height: 44px;
    min-width: 44px;
  }
  
  /* 탭 스크롤 */
  nav.flex {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
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

## 8️⃣ 유틸리티 함수

### 날짜 관련
```javascript
function getYearMonth(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(date) {
  return date.toISOString().split('T')[0]
}
```

### 통화 포맷
```javascript
const CURRENCIES = {
  'KRW': { symbol: '₩', name: '원화 (KRW)' },
  'USD': { symbol: '$', name: '미국 달러 (USD)' },
  'EUR': { symbol: '€', name: '유로 (EUR)' },
  'JPY': { symbol: '¥', name: '일본 엔 (JPY)' },
  'AUD': { symbol: 'A$', name: '호주 달러 (AUD)' },
  'GBP': { symbol: '£', name: '영국 파운드 (GBP)' }
}

function formatCurrency(amount) {
  const currency = state.settings.currency || 'KRW'
  const symbol = CURRENCIES[currency]?.symbol || '₩'
  return `${symbol}${amount.toLocaleString()}`
}

function formatCurrencyShort(amount) {
  if (amount >= 10000) {
    return `${Math.floor(amount / 10000)}만`
  }
  return formatCurrency(amount)
}
```

---

이 코드 스니펫들을 다른 AI에게 전달하면, 앱의 핵심 로직을 이해하고 수정/확장할 수 있습니다!
