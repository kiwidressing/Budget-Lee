import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 활성화
app.use('/api/*', cors())

// 정적 파일 서빙
app.use('/static/*', serveStatic({ root: './public' }))

// =============================================================================
// API 엔드포인트
// =============================================================================

// -----------------------------------------------------------------------------
// 그룹 1: 저축 통장 API (3개)
// -----------------------------------------------------------------------------

// 1.1 저축 통장 목록 조회
app.get('/api/savings-accounts', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT 
      sa.*,
      COALESCE(SUM(CASE WHEN t.type = 'savings' THEN t.amount ELSE 0 END), 0) as total_savings
    FROM savings_accounts sa
    LEFT JOIN transactions t ON t.savings_account_id = sa.id
    GROUP BY sa.id
    ORDER BY sa.created_at ASC
  `).all()
  
  return c.json({ success: true, data: result.results })
})

// 1.2 저축 통장 생성
app.post('/api/savings-accounts', async (c) => {
  const { DB } = c.env
  const { name } = await c.req.json()
  
  if (!name) {
    return c.json({ success: false, error: '통장 이름을 입력해주세요.' }, 400)
  }
  
  const result = await DB.prepare(`
    INSERT INTO savings_accounts (name, balance) VALUES (?, 0)
  `).bind(name).run()
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// 1.3 저축 통장 삭제
app.delete('/api/savings-accounts/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare(`DELETE FROM savings_accounts WHERE id = ?`).bind(id).run()
  
  return c.json({ success: true })
})

// -----------------------------------------------------------------------------
// 그룹 2: 거래 내역 API (5개)
// -----------------------------------------------------------------------------

// 2.1 거래 내역 조회 (날짜 범위)
app.get('/api/transactions', async (c) => {
  const { DB } = c.env
  const startDate = c.req.query('start_date')
  const endDate = c.req.query('end_date')
  const type = c.req.query('type')
  
  let query = `
    SELECT 
      t.*,
      sa.name as savings_account_name
    FROM transactions t
    LEFT JOIN savings_accounts sa ON t.savings_account_id = sa.id
    WHERE 1=1
  `
  const params: any[] = []
  
  if (startDate) {
    query += ` AND t.date >= ?`
    params.push(startDate)
  }
  if (endDate) {
    query += ` AND t.date <= ?`
    params.push(endDate)
  }
  if (type) {
    query += ` AND t.type = ?`
    params.push(type)
  }
  
  query += ` ORDER BY t.date DESC, t.created_at DESC`
  
  const result = await DB.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 2.2 특정 날짜 거래 조회
app.get('/api/transactions/date/:date', async (c) => {
  const { DB } = c.env
  const date = c.req.param('date')
  
  const result = await DB.prepare(`
    SELECT 
      t.*,
      sa.name as savings_account_name
    FROM transactions t
    LEFT JOIN savings_accounts sa ON t.savings_account_id = sa.id
    WHERE t.date = ?
    ORDER BY t.created_at DESC
  `).bind(date).all()
  
  return c.json({ success: true, data: result.results })
})

// 2.3 거래 생성
app.post('/api/transactions', async (c) => {
  const { DB } = c.env
  const { type, category, amount, description, date, savings_account_id } = await c.req.json()
  
  if (!type || !category || !amount || !date) {
    return c.json({ success: false, error: '필수 항목을 입력해주세요.' }, 400)
  }
  
  if (!['income', 'expense', 'savings'].includes(type)) {
    return c.json({ success: false, error: '유효하지 않은 거래 유형입니다.' }, 400)
  }
  
  if (type === 'savings' && !savings_account_id) {
    return c.json({ success: false, error: '저축 통장을 선택해주세요.' }, 400)
  }
  
  const result = await DB.prepare(`
    INSERT INTO transactions (type, category, amount, description, date, savings_account_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(type, category, amount, description || null, date, savings_account_id || null).run()
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// 2.4 거래 수정
app.put('/api/transactions/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { type, category, amount, description, date, savings_account_id } = await c.req.json()
  
  if (!type || !category || !amount || !date) {
    return c.json({ success: false, error: '필수 항목을 입력해주세요.' }, 400)
  }
  
  await DB.prepare(`
    UPDATE transactions 
    SET type = ?, category = ?, amount = ?, description = ?, date = ?, savings_account_id = ?
    WHERE id = ?
  `).bind(type, category, amount, description || null, date, savings_account_id || null, id).run()
  
  return c.json({ success: true })
})

// 2.5 거래 삭제
app.delete('/api/transactions/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare(`DELETE FROM transactions WHERE id = ?`).bind(id).run()
  
  return c.json({ success: true })
})

// -----------------------------------------------------------------------------
// 그룹 3: 통계 API (3개)
// -----------------------------------------------------------------------------

// 3.1 월별 통계
app.get('/api/statistics/monthly/:yearMonth', async (c) => {
  const { DB } = c.env
  const yearMonth = c.req.param('yearMonth')
  
  const summary = await DB.prepare(`
    SELECT 
      type,
      SUM(amount) as total
    FROM transactions
    WHERE strftime('%Y-%m', date) = ?
    GROUP BY type
  `).bind(yearMonth).all()
  
  const expenseByCategory = await DB.prepare(`
    SELECT 
      category,
      SUM(amount) as total,
      COUNT(*) as count
    FROM transactions
    WHERE type = 'expense' AND strftime('%Y-%m', date) = ?
    GROUP BY category
    ORDER BY total DESC
  `).bind(yearMonth).all()
  
  return c.json({ 
    success: true, 
    summary: summary.results,
    expenseByCategory: expenseByCategory.results
  })
})

// 3.2 주별 통계
app.get('/api/statistics/weekly/:startDate', async (c) => {
  const { DB } = c.env
  const startDate = c.req.param('startDate')
  
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 6)
  const endDateStr = endDate.toISOString().split('T')[0]
  
  const summary = await DB.prepare(`
    SELECT 
      type,
      SUM(amount) as total
    FROM transactions
    WHERE date >= ? AND date <= ?
    GROUP BY type
  `).bind(startDate, endDateStr).all()
  
  const expenseByCategory = await DB.prepare(`
    SELECT 
      category,
      SUM(amount) as total,
      COUNT(*) as count
    FROM transactions
    WHERE type = 'expense' AND date >= ? AND date <= ?
    GROUP BY category
    ORDER BY total DESC
  `).bind(startDate, endDateStr).all()
  
  return c.json({ 
    success: true, 
    summary: summary.results,
    expenseByCategory: expenseByCategory.results
  })
})

// 3.3 달력 데이터
app.get('/api/calendar/:yearMonth', async (c) => {
  const { DB } = c.env
  const yearMonth = c.req.param('yearMonth')
  
  const result = await DB.prepare(`
    SELECT 
      date,
      type,
      SUM(amount) as total,
      COUNT(*) as count
    FROM transactions
    WHERE strftime('%Y-%m', date) = ?
    GROUP BY date, type
    ORDER BY date ASC
  `).bind(yearMonth).all()
  
  return c.json({ success: true, data: result.results })
})

// -----------------------------------------------------------------------------
// 그룹 4: 설정 API (2개)
// -----------------------------------------------------------------------------

// 4.1 설정 조회
app.get('/api/settings', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT * FROM settings WHERE id = 1
  `).first()
  
  return c.json({ success: true, data: result })
})

// 4.2 설정 수정
app.put('/api/settings', async (c) => {
  const { DB } = c.env
  const { currency, initial_balance, initial_savings, category_colors } = await c.req.json()
  
  await DB.prepare(`
    UPDATE settings 
    SET currency = ?, initial_balance = ?, initial_savings = ?, category_colors = ?
    WHERE id = 1
  `).bind(
    currency, 
    initial_balance, 
    initial_savings, 
    category_colors ? JSON.stringify(category_colors) : null
  ).run()
  
  return c.json({ success: true })
})

// -----------------------------------------------------------------------------
// 그룹 5: 고정지출 API (5개)
// -----------------------------------------------------------------------------

// 5.1 고정지출 목록 조회
app.get('/api/fixed-expenses', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT * FROM fixed_expenses 
    WHERE is_active = 1
    ORDER BY created_at DESC
  `).all()
  
  return c.json({ success: true, data: result.results })
})

// 5.2 고정지출 생성
app.post('/api/fixed-expenses', async (c) => {
  const { DB } = c.env
  const { name, category, amount, frequency, week_of_month, day_of_week } = await c.req.json()
  
  if (!name || !category || !amount || !frequency || day_of_week === undefined) {
    return c.json({ success: false, error: '필수 항목을 입력해주세요.' }, 400)
  }
  
  if (!['monthly', 'weekly'].includes(frequency)) {
    return c.json({ success: false, error: '유효하지 않은 주기입니다.' }, 400)
  }
  
  if (frequency === 'monthly' && !week_of_month) {
    return c.json({ success: false, error: '주차를 선택해주세요.' }, 400)
  }
  
  const result = await DB.prepare(`
    INSERT INTO fixed_expenses 
    (name, category, amount, frequency, week_of_month, day_of_week, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).bind(name, category, amount, frequency, week_of_month || null, day_of_week).run()
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// 5.3 고정지출 삭제 (소프트 삭제)
app.delete('/api/fixed-expenses/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare(`
    UPDATE fixed_expenses SET is_active = 0 WHERE id = ?
  `).bind(id).run()
  
  return c.json({ success: true })
})

// 5.4 고정지출 지불
app.post('/api/fixed-expenses/:id/pay', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { date } = await c.req.json()
  
  if (!date) {
    return c.json({ success: false, error: '날짜를 입력해주세요.' }, 400)
  }
  
  const fixedExpense = await DB.prepare(`
    SELECT * FROM fixed_expenses WHERE id = ?
  `).bind(id).first() as any
  
  if (!fixedExpense) {
    return c.json({ success: false, error: '고정지출을 찾을 수 없습니다.' }, 404)
  }
  
  const existingPayment = await DB.prepare(`
    SELECT id FROM fixed_expense_payments 
    WHERE fixed_expense_id = ? AND payment_date = ?
  `).bind(id, date).first()
  
  if (existingPayment) {
    return c.json({ success: false, error: '이미 지불된 항목입니다.' }, 400)
  }
  
  const transactionResult = await DB.prepare(`
    INSERT INTO transactions (type, category, amount, description, date)
    VALUES ('expense', ?, ?, ?, ?)
  `).bind(
    fixedExpense.category, 
    fixedExpense.amount, 
    `[고정지출] ${fixedExpense.name}`, 
    date
  ).run()
  
  await DB.prepare(`
    INSERT INTO fixed_expense_payments (fixed_expense_id, transaction_id, payment_date)
    VALUES (?, ?, ?)
  `).bind(id, transactionResult.meta.last_row_id, date).run()
  
  return c.json({ success: true, transaction_id: transactionResult.meta.last_row_id })
})

// 5.5 지불 내역 조회
app.get('/api/fixed-expenses/:id/payments/:yearMonth', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const yearMonth = c.req.param('yearMonth')
  
  const result = await DB.prepare(`
    SELECT 
      fep.*,
      t.date as transaction_date,
      t.amount as transaction_amount
    FROM fixed_expense_payments fep
    JOIN transactions t ON fep.transaction_id = t.id
    WHERE fep.fixed_expense_id = ? AND strftime('%Y-%m', fep.payment_date) = ?
    ORDER BY fep.payment_date DESC
  `).bind(id, yearMonth).all()
  
  return c.json({ success: true, data: result.results })
})

// 5.6 고정지출 반복 인스턴스 조회 (월별/주별)
app.get('/api/fixed-expenses/instances/:yearMonth', async (c) => {
  const { DB } = c.env
  const yearMonth = c.req.param('yearMonth')
  
  // 모든 활성화된 고정지출 가져오기
  const fixedExpenses = await DB.prepare(`
    SELECT * FROM fixed_expenses WHERE is_active = 1
  `).all()
  
  // 해당 월의 모든 지불 내역 가져오기
  const payments = await DB.prepare(`
    SELECT 
      fep.fixed_expense_id,
      fep.payment_date,
      fep.transaction_id
    FROM fixed_expense_payments fep
    WHERE strftime('%Y-%m', fep.payment_date) = ?
  `).bind(yearMonth).all()
  
  const instances: any[] = []
  const [year, month] = yearMonth.split('-').map(Number)
  
  for (const expense of fixedExpenses.results as any[]) {
    if (expense.frequency === 'monthly') {
      // 월별: 해당 월의 n번째 요일 계산
      const date = getNthDayOfMonth(year, month - 1, expense.week_of_month, expense.day_of_week)
      if (date) {
        const dateStr = formatDate(date)
        const payment = (payments.results as any[]).find(
          p => p.fixed_expense_id === expense.id && p.payment_date === dateStr
        )
        
        instances.push({
          ...expense,
          scheduled_date: dateStr,
          is_paid: !!payment,
          transaction_id: payment?.transaction_id || null
        })
      }
    } else if (expense.frequency === 'weekly') {
      // 주별: 해당 월의 모든 해당 요일 찾기
      const dates = getAllDaysOfWeekInMonth(year, month - 1, expense.day_of_week)
      
      for (const date of dates) {
        const dateStr = formatDate(date)
        const payment = (payments.results as any[]).find(
          p => p.fixed_expense_id === expense.id && p.payment_date === dateStr
        )
        
        instances.push({
          ...expense,
          scheduled_date: dateStr,
          is_paid: !!payment,
          transaction_id: payment?.transaction_id || null
        })
      }
    }
  }
  
  // 날짜순 정렬
  instances.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  
  return c.json({ success: true, data: instances })
})

// 헬퍼 함수들
function getNthDayOfMonth(year: number, month: number, weekOfMonth: number, dayOfWeek: number): Date | null {
  const firstDay = new Date(year, month, 1)
  const firstDayOfWeek = firstDay.getDay()
  
  // 첫 번째 해당 요일 찾기
  let daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7
  const firstOccurrence = 1 + daysToAdd
  
  // n번째 해당 요일 계산
  const targetDay = firstOccurrence + (weekOfMonth - 1) * 7
  
  // 해당 월에 존재하는지 확인
  const targetDate = new Date(year, month, targetDay)
  if (targetDate.getMonth() !== month) {
    return null
  }
  
  return targetDate
}

function getAllDaysOfWeekInMonth(year: number, month: number, dayOfWeek: number): Date[] {
  const dates: Date[] = []
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  
  // 첫 번째 해당 요일 찾기
  let current = new Date(firstDay)
  while (current.getDay() !== dayOfWeek) {
    current.setDate(current.getDate() + 1)
  }
  
  // 모든 해당 요일 수집
  while (current <= lastDay) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 7)
  }
  
  return dates
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// -----------------------------------------------------------------------------
// 그룹 6: 예산 API (4개)
// -----------------------------------------------------------------------------

// 6.1 예산 목록 조회
app.get('/api/budgets', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT * FROM category_budgets ORDER BY category ASC
  `).all()
  
  return c.json({ success: true, data: result.results })
})

// 6.2 예산 설정/수정 (UPSERT)
app.put('/api/budgets/:category', async (c) => {
  const { DB } = c.env
  const category = c.req.param('category')
  const { monthly_budget } = await c.req.json()
  
  if (!monthly_budget || monthly_budget < 0) {
    return c.json({ success: false, error: '유효한 예산 금액을 입력해주세요.' }, 400)
  }
  
  await DB.prepare(`
    INSERT INTO category_budgets (category, monthly_budget, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(category) DO UPDATE SET 
      monthly_budget = excluded.monthly_budget,
      updated_at = CURRENT_TIMESTAMP
  `).bind(category, monthly_budget).run()
  
  return c.json({ success: true })
})

// 6.3 예산 삭제
app.delete('/api/budgets/:category', async (c) => {
  const { DB } = c.env
  const category = c.req.param('category')
  
  await DB.prepare(`
    DELETE FROM category_budgets WHERE category = ?
  `).bind(category).run()
  
  return c.json({ success: true })
})

// 6.4 예산 vs 실제 지출 현황
app.get('/api/budgets/vs-spending/:yearMonth', async (c) => {
  const { DB } = c.env
  const yearMonth = c.req.param('yearMonth')
  
  const result = await DB.prepare(`
    SELECT 
      cb.category,
      cb.monthly_budget,
      COALESCE(SUM(t.amount), 0) as actual_spending,
      cb.monthly_budget - COALESCE(SUM(t.amount), 0) as remaining,
      CASE 
        WHEN cb.monthly_budget = 0 THEN 0
        ELSE ROUND(CAST(COALESCE(SUM(t.amount), 0) AS REAL) / cb.monthly_budget * 100, 1)
      END as percentage
    FROM category_budgets cb
    LEFT JOIN transactions t ON t.category = cb.category 
      AND t.type = 'expense' 
      AND strftime('%Y-%m', t.date) = ?
    GROUP BY cb.category, cb.monthly_budget
    ORDER BY cb.category ASC
  `).bind(yearMonth).all()
  
  return c.json({ success: true, data: result.results })
})

// =============================================================================
// 메인 페이지
// =============================================================================

app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>가계부 앱</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <link href="/static/style.css" rel="stylesheet">
</head>
<body class="bg-gray-100">
    <div id="app" class="container mx-auto max-w-7xl p-4">
        <div class="bg-white rounded-lg shadow-lg p-6">
            <h1 class="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                <i class="fas fa-wallet mr-3 text-blue-600"></i>
                가계부 앱
            </h1>
            
            <!-- 탭 네비게이션 -->
            <div class="border-b mb-6">
                <nav class="flex flex-wrap -mb-px">
                    <button id="tab-month" class="tab-button border-b-2 border-blue-600 text-blue-600 py-4 px-6 font-medium">
                        <i class="fas fa-calendar-alt mr-2"></i>월별
                    </button>
                    <button id="tab-week" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-calendar-week mr-2"></i>주별
                    </button>
                    <button id="tab-savings" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-piggy-bank mr-2"></i>저축
                    </button>
                    <button id="tab-fixed-expenses" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-redo mr-2"></i>고정지출
                    </button>
                    <button id="tab-budgets" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-chart-pie mr-2"></i>예산
                    </button>
                    <button id="tab-settings" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-cog mr-2"></i>설정
                    </button>
                </nav>
            </div>
            
            <!-- 콘텐츠 영역 -->
            <div id="content-area" class="min-h-screen">
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                    <p>로딩 중...</p>
                </div>
            </div>
        </div>
    </div>

    <!-- 모달들이 여기에 동적으로 추가됩니다 -->
    <div id="modal-container"></div>

    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="/static/app.js"></script>
</body>
</html>`)
})

export default app
