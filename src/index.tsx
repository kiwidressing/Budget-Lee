import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { sign, verify } from 'hono/jwt'

type Bindings = {
  DB: D1Database;
  JWT_SECRET?: string;
  GOOGLE_VISION_API_KEY?: string;
}

type Variables = {
  userId?: number;
  userEmail?: string;
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 메모리 캐시 (Yahoo Finance 주가용 - 60초)
interface CacheEntry {
  data: any;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry>()

function getCached(key: string): any | null {
  const entry = memoryCache.get(key)
  if (!entry) return null
  
  if (Date.now() > entry.expiry) {
    memoryCache.delete(key)
    return null
  }
  
  return entry.data
}

function setCache(key: string, data: any, ttlSeconds: number = 60): void {
  memoryCache.set(key, {
    data,
    expiry: Date.now() + (ttlSeconds * 1000)
  })
}

// 월별 통계 요약 재계산 (성능 최적화)
async function recalcMonthlySummary(DB: D1Database, userId: number, yearMonth: string): Promise<void> {
  const [year, month] = yearMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `${yearMonth}-01`
  const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
  
  // 해당 월의 거래 내역 집계
  const summary = await DB.prepare(`
    SELECT 
      SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense,
      SUM(CASE WHEN type='savings' THEN amount ELSE 0 END) as savings,
      COUNT(*) as transaction_count
    FROM transactions
    WHERE user_id = ? AND date BETWEEN ? AND ?
  `).bind(String(userId), startDate, endDate).first() as any
  
  const income = summary?.income || 0
  const expense = summary?.expense || 0
  const savings = summary?.savings || 0
  const count = summary?.transaction_count || 0
  
  // UPSERT (있으면 업데이트, 없으면 삽입)
  await DB.prepare(`
    INSERT INTO monthly_summary (year_month, user_id, income, expense, savings, transaction_count, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(year_month, user_id) DO UPDATE SET
      income = excluded.income,
      expense = excluded.expense,
      savings = excluded.savings,
      transaction_count = excluded.transaction_count,
      updated_at = CURRENT_TIMESTAMP
  `).bind(yearMonth, String(userId), income, expense, savings, count).run()
  
  console.log(`[Cache] Monthly summary updated: ${yearMonth} for user ${userId}`)
}

// CORS 활성화
app.use('/api/*', cors())

// 에러 핸들링 미들웨어
app.use('/api/*', async (c, next) => {
  try {
    await next()
  } catch (error: any) {
    console.error('API Error:', error)
    return c.json({ 
      success: false, 
      error: error.message || 'Internal server error',
      message: 'Database not configured or connection failed.'
    }, 500)
  }
})

// 정적 파일 서빙
app.use('/static/*', serveStatic({ root: './' }))

// ========== 인증 유틸리티 함수 ==========

// SHA-256 비밀번호 해싱
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// JWT 토큰 생성
async function createToken(userId: number, username: string, secret: string): Promise<string> {
  const payload = {
    sub: userId.toString(),
    username: username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24시간
  }
  return await sign(payload, secret)
}

// 인증 미들웨어 (JWT 토큰 + 세션 ID 혼합 지원)
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 헤더가 없으면 기본 사용자 (게스트 모드)
    c.set('userId', 1)
    c.set('username', 'guest')
    await next()
    return
  }
  
  const token = authHeader.substring(7)
  const secret = c.env.JWT_SECRET || 'default-secret-key-change-in-production'
  
  // 1. JWT 토큰인지 확인 (JWT는 'eyJ'로 시작)
  if (token.startsWith('eyJ')) {
    try {
      const payload = await verify(token, secret)
      c.set('userId', parseInt(payload.sub as string))
      c.set('username', payload.username as string)
      await next()
      return
    } catch (error) {
      // JWT 검증 실패 → 세션 ID로 fallback
      console.log('[Auth] JWT verification failed, trying session ID')
    }
  }
  
  // 2. 세션 ID로 처리 (JWT가 아니거나 검증 실패한 경우)
  // 세션 ID를 해싱해서 user_id로 사용 (1~999999 범위)
  let hash = 0
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) - hash) + token.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  const userId = Math.abs(hash % 999999) + 1
  
  c.set('userId', userId)
  c.set('username', `session_${userId}`)
  await next()
}

// ========== 정적 파일 라우트 (루트 레벨) ==========
// PWA 아이콘, 매니페스트, favicon 등을 서빙
app.get('/*.png', serveStatic({ root: './' }))
app.get('/*.ico', serveStatic({ root: './' }))
app.get('/*.svg', serveStatic({ root: './' }))
app.get('/manifest.json', serveStatic({ root: './' }))
app.get('/sw.js', serveStatic({ root: './' }))

// ========== 인증 API ==========

// 회원가입
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
  
  // 숫자만 허용
  if (!/^\d{4}$/.test(password)) {
    return c.json({ success: false, error: '비밀번호는 숫자 4자리여야 합니다.' }, 400)
  }
  
  // 아이디 중복 확인
  const existing = await DB.prepare(`
    SELECT id FROM users WHERE username = ?
  `).bind(username).first()
  
  if (existing) {
    return c.json({ success: false, error: '이미 사용 중인 아이디입니다.' }, 400)
  }
  
  // SHA-256 비밀번호 해싱
  const passwordHash = await hashPassword(password)
  
  // 사용자 생성
  const result = await DB.prepare(`
    INSERT INTO users (username, password_hash, name)
    VALUES (?, ?, ?)
  `).bind(username, passwordHash, name).run()
  
  const userId = result.meta.last_row_id as number
  const secret = c.env.JWT_SECRET || 'default-secret-key-change-in-production'
  
  // JWT 토큰 발급
  const token = await createToken(userId, username, secret)
  
  return c.json({ 
    success: true, 
    token: token,
    user: {
      id: userId,
      username,
      name
    }
  })
})

// 로그인
app.post('/api/auth/login', async (c) => {
  const { DB } = c.env
  const { username, password } = await c.req.json()
  
  // 입력 검증
  if (!username || !password) {
    return c.json({ success: false, error: '아이디와 비밀번호를 입력해주세요.' }, 400)
  }
  
  // 사용자 조회
  const user = await DB.prepare(`
    SELECT id, username, password_hash, name FROM users WHERE username = ?
  `).bind(username).first() as any
  
  if (!user) {
    return c.json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401)
  }
  
  // 비밀번호 검증
  const passwordHash = await hashPassword(password)
  if (passwordHash !== user.password_hash) {
    return c.json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401)
  }
  
  // 마지막 로그인 시간 업데이트
  await DB.prepare(`
    UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(user.id).run()
  
  // JWT 토큰 발급
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

// Token Refresh (Access Token 갱신)
app.post('/api/auth/refresh', async (c) => {
  const { DB } = c.env
  const { refreshToken } = await c.req.json()
  
  if (!refreshToken) {
    return c.json({ success: false, error: 'Refresh token이 필요합니다.' }, 400)
  }
  
  // Refresh Token 검증
  const session = await verifyRefreshToken(DB, refreshToken)
  
  if (!session) {
    return c.json({ success: false, error: '유효하지 않거나 만료된 refresh token입니다.' }, 401)
  }
  
  // 새로운 Access Token 생성
  const secret = c.env.JWT_SECRET || 'default-secret-key-change-in-production'
  const accessToken = await createAccessToken(session.user_id, session.username, secret)
  
  return c.json({
    success: true,
    access: accessToken    // 통일: access
  })
})

// 로그아웃 (Refresh Token 삭제)
app.post('/api/auth/logout', async (c) => {
  const { DB } = c.env
  const { refreshToken } = await c.req.json()
  
  if (refreshToken) {
    await deleteRefreshToken(DB, refreshToken)
  }
  
  return c.json({ success: true, message: '로그아웃되었습니다.' })
})

// 현재 사용자 정보 조회
app.get('/api/auth/me', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  
  const user = await DB.prepare(`
    SELECT id, username, name, created_at, last_login FROM users WHERE id = ?
  `).bind(userId).first() as any
  
  if (!user) {
    return c.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, 404)
  }
  
  return c.json({ 
    success: true, 
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      createdAt: user.created_at,
      lastLogin: user.last_login
    }
  })
})

// API 엔드포인트 - 저축 통장

// 1.1 저축 통장 목록 조회
app.get('/api/savings-accounts', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  
  if (!DB) {
    return c.json({ success: true, data: [] })
  }
  
  const result = await DB.prepare(`
    SELECT 
      sa.*,
      COALESCE(SUM(CASE WHEN t.type = 'savings' THEN t.amount ELSE 0 END), 0) as total_savings
    FROM savings_accounts sa
    LEFT JOIN transactions t ON t.savings_account_id = sa.id AND t.user_id = ?
    WHERE sa.user_id = ?
    GROUP BY sa.id
    ORDER BY sa.created_at ASC
  `).bind(userId?.toString(), userId?.toString()).all()
  
  return c.json({ success: true, data: result.results })
})

// 1.2 저축 통장 생성
app.post('/api/savings-accounts', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const { name } = await c.req.json()
  
  if (!name) {
    return c.json({ success: false, error: '통장 이름을 입력해주세요.' }, 400)
  }
  
  const result = await DB.prepare(`
    INSERT INTO savings_accounts (name, balance, user_id) VALUES (?, 0, ?)
  `).bind(name, userId?.toString()).run()
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// 1.3 저축 통장 이름 수정
app.put('/api/savings-accounts/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { name } = await c.req.json()
  
  if (!name || name.trim() === '') {
    return c.json({ success: false, error: '통장 이름을 입력해주세요.' }, 400)
  }
  
  await DB.prepare(`
    UPDATE savings_accounts 
    SET name = ?
    WHERE id = ? AND user_id = ?
  `).bind(name.trim(), id, userId?.toString()).run()
  
  return c.json({ success: true })
})

// 1.4 저축 통장 삭제
app.delete('/api/savings-accounts/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const id = c.req.param('id')
  
  await DB.prepare(`DELETE FROM savings_accounts WHERE id = ? AND user_id = ?`).bind(id, userId?.toString()).run()
  
  return c.json({ success: true })
})

// 1.5 저축 목표 설정
app.put('/api/savings-accounts/:id/goal', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { savings_goal } = await c.req.json()
  
  if (savings_goal === undefined || savings_goal < 0) {
    return c.json({ success: false, error: '유효한 목표 금액을 입력해주세요.' }, 400)
  }
  
  await DB.prepare(`
    UPDATE savings_accounts 
    SET savings_goal = ?
    WHERE id = ?
  `).bind(savings_goal, id).run()
  
  return c.json({ success: true })
})

// 거래 내역 API

// 2.1 거래 내역 조회 (날짜 범위)
app.get('/api/transactions', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const startDate = c.req.query('start_date')
  const endDate = c.req.query('end_date')
  const type = c.req.query('type')
  
  let query = `
    SELECT 
      t.*,
      sa.name as savings_account_name
    FROM transactions t
    LEFT JOIN savings_accounts sa ON t.savings_account_id = sa.id
    WHERE t.user_id = ?
  `
  const params: any[] = [userId?.toString()]
  
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
app.get('/api/transactions/date/:date', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const date = c.req.param('date')
  
  const result = await DB.prepare(`
    SELECT 
      t.*,
      sa.name as savings_account_name
    FROM transactions t
    LEFT JOIN savings_accounts sa ON t.savings_account_id = sa.id
    WHERE t.date = ? AND t.user_id = ?
    ORDER BY t.created_at DESC
  `).bind(date, userId?.toString()).all()
  
  return c.json({ success: true, data: result.results })
})

// 2.3 거래 생성
app.post('/api/transactions', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const { type, category, amount, description, date, payment_method, savings_account_id } = await c.req.json()
  
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
    INSERT INTO transactions (type, category, amount, description, date, payment_method, savings_account_id, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(type, category, amount, description || null, date, payment_method || 'card', savings_account_id || null, userId?.toString()).run()
  
  // 월별 통계 캐시 업데이트
  const yearMonth = date.substring(0, 7) // 'YYYY-MM'
  await recalcMonthlySummary(DB, userId as number, yearMonth)
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// 2.4 거래 수정
app.put('/api/transactions/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { type, category, amount, description, date, payment_method, savings_account_id } = await c.req.json()
  
  if (!type || !category || !amount || !date) {
    return c.json({ success: false, error: '필수 항목을 입력해주세요.' }, 400)
  }
  
  // 기존 거래 조회 (날짜 변경 감지용)
  const oldTransaction = await DB.prepare(`
    SELECT date FROM transactions WHERE id = ? AND user_id = ?
  `).bind(id, userId?.toString()).first() as any
  
  await DB.prepare(`
    UPDATE transactions 
    SET type = ?, category = ?, amount = ?, description = ?, date = ?, payment_method = ?, savings_account_id = ?
    WHERE id = ? AND user_id = ?
  `).bind(type, category, amount, description || null, date, payment_method || 'card', savings_account_id || null, id, userId?.toString()).run()
  
  // 월별 통계 캐시 업데이트 (기존 월 + 새 월)
  const yearMonth = date.substring(0, 7)
  await recalcMonthlySummary(DB, userId as number, yearMonth)
  
  if (oldTransaction?.date) {
    const oldYearMonth = oldTransaction.date.substring(0, 7)
    if (oldYearMonth !== yearMonth) {
      await recalcMonthlySummary(DB, userId as number, oldYearMonth)
    }
  }
  
  return c.json({ success: true })
})

// 2.5 거래 삭제
app.delete('/api/transactions/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const id = c.req.param('id')
  
  // 삭제 전 날짜 조회 (캐시 업데이트용)
  const transaction = await DB.prepare(`
    SELECT date FROM transactions WHERE id = ? AND user_id = ?
  `).bind(id, userId?.toString()).first() as any
  
  await DB.prepare(`DELETE FROM transactions WHERE id = ? AND user_id = ?`).bind(id, userId?.toString()).run()
  
  // 월별 통계 캐시 업데이트
  if (transaction?.date) {
    const yearMonth = transaction.date.substring(0, 7)
    await recalcMonthlySummary(DB, userId as number, yearMonth)
  }
  
  return c.json({ success: true })
})

// 통계 API

// 3.1 월별 통계 (캐시 최적화)
app.get('/api/statistics/monthly/:yearMonth', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const yearMonth = c.req.param('yearMonth')
  
  // 캐시된 월별 요약 확인
  const cachedSummary = await DB.prepare(`
    SELECT * FROM monthly_summary 
    WHERE year_month = ? AND user_id = ?
  `).bind(yearMonth, userId?.toString()).first() as any
  
  // 캐시가 없으면 생성
  if (!cachedSummary) {
    await recalcMonthlySummary(DB, userId as number, yearMonth)
  }
  
  // 기존 방식으로 요약 반환 (API 응답 구조 유지)
  const summary = await DB.prepare(`
    SELECT 
      type,
      SUM(amount) as total
    FROM transactions
    WHERE strftime('%Y-%m', date) = ? AND user_id = ?
    GROUP BY type
  `).bind(yearMonth, userId?.toString()).all()
  
  const expenseByCategory = await DB.prepare(`
    SELECT 
      category,
      SUM(amount) as total,
      COUNT(*) as count
    FROM transactions
    WHERE type = 'expense' AND strftime('%Y-%m', date) = ? AND user_id = ?
    GROUP BY category
    ORDER BY total DESC
  `).bind(yearMonth, userId?.toString()).all()
  
  return c.json({ 
    success: true, 
    summary: summary.results,
    expenseByCategory: expenseByCategory.results,
    cached: !!cachedSummary
  })
})

// 3.2 주별 통계
app.get('/api/statistics/weekly/:startDate', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const startDate = c.req.param('startDate')
  
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 6)
  const endDateStr = endDate.toISOString().split('T')[0]
  
  const summary = await DB.prepare(`
    SELECT 
      type,
      SUM(amount) as total
    FROM transactions
    WHERE date >= ? AND date <= ? AND user_id = ?
    GROUP BY type
  `).bind(startDate, endDateStr, userId?.toString()).all()
  
  const expenseByCategory = await DB.prepare(`
    SELECT 
      category,
      SUM(amount) as total,
      COUNT(*) as count
    FROM transactions
    WHERE type = 'expense' AND date >= ? AND date <= ? AND user_id = ?
    GROUP BY category
    ORDER BY total DESC
  `).bind(startDate, endDateStr, userId?.toString()).all()
  
  return c.json({ 
    success: true, 
    summary: summary.results,
    expenseByCategory: expenseByCategory.results
  })
})

// 3.3 달력 데이터
app.get('/api/calendar/:yearMonth', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const yearMonth = c.req.param('yearMonth')
  
  const result = await DB.prepare(`
    SELECT 
      date,
      type,
      SUM(amount) as total,
      COUNT(*) as count
    FROM transactions
    WHERE strftime('%Y-%m', date) = ? AND user_id = ?
    GROUP BY date, type
    ORDER BY date ASC
  `).bind(yearMonth, userId?.toString()).all()
  
  return c.json({ success: true, data: result.results })
})

// 설정 API

// 4.1 설정 조회
app.get('/api/settings', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  
  let result = await DB.prepare(`
    SELECT * FROM settings WHERE user_id = ?
  `).bind(userId?.toString()).first()
  
  // 사용자의 설정이 없으면 기본 설정 생성
  if (!result) {
    await DB.prepare(`
      INSERT INTO settings (currency, initial_balance, initial_savings, category_colors, user_id)
      VALUES ('KRW', 0, 0, NULL, ?)
    `).bind(userId?.toString()).run()
    
    result = await DB.prepare(`
      SELECT * FROM settings WHERE user_id = ?
    `).bind(userId?.toString()).first()
  }
  
  return c.json({ success: true, data: result })
})

// 4.2 설정 수정
app.put('/api/settings', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const { currency, initial_balance, cash_on_hand, category_colors } = await c.req.json()
  
  // 설정이 없으면 생성
  const existing = await DB.prepare(`SELECT id FROM settings WHERE user_id = ?`).bind(userId?.toString()).first()
  
  if (!existing) {
    await DB.prepare(`
      INSERT INTO settings (currency, initial_balance, cash_on_hand, category_colors, user_id)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      currency, 
      initial_balance || 0, 
      cash_on_hand || 0, 
      category_colors ? JSON.stringify(category_colors) : null,
      userId?.toString()
    ).run()
  } else {
    await DB.prepare(`
      UPDATE settings 
      SET currency = ?, initial_balance = ?, cash_on_hand = ?, category_colors = ?
      WHERE user_id = ?
    `).bind(
      currency, 
      initial_balance || 0, 
      cash_on_hand || 0, 
      category_colors ? JSON.stringify(category_colors) : null,
      userId?.toString()
    ).run()
  }
  
  return c.json({ success: true })
})

// 고정지출 API

// 5.1 고정지출 목록 조회
app.get('/api/fixed-expenses', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  
  const result = await DB.prepare(`
    SELECT * FROM fixed_expenses 
    WHERE is_active = 1 AND user_id = ?
    ORDER BY created_at DESC
  `).bind(userId?.toString()).all()
  
  return c.json({ success: true, data: result.results })
})

// 5.2 고정지출 생성
app.post('/api/fixed-expenses', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const { name, category, amount, frequency, week_of_month, day_of_week, payment_day } = await c.req.json()
  
  if (!name || !category || !amount || !frequency) {
    return c.json({ success: false, error: '필수 항목을 입력해주세요.' }, 400)
  }
  
  if (!['monthly', 'weekly', 'monthly_day'].includes(frequency)) {
    return c.json({ success: false, error: '유효하지 않은 주기입니다.' }, 400)
  }
  
  // 'monthly' = 매월 특정 주/요일 (예: 매월 첫째 주 월요일)
  if (frequency === 'monthly') {
    if (!week_of_month) {
      return c.json({ success: false, error: '주차를 선택해주세요.' }, 400)
    }
    if (day_of_week === undefined) {
      return c.json({ success: false, error: '요일을 선택해주세요.' }, 400)
    }
  }
  
  // 'monthly_day' = 매월 특정 일자 (예: 매월 5일)
  if (frequency === 'monthly_day' && !payment_day) {
    return c.json({ success: false, error: '일자를 선택해주세요.' }, 400)
  }
  
  // 'weekly' = 매주 특정 요일 (예: 매주 금요일)
  if (frequency === 'weekly' && day_of_week === undefined) {
    return c.json({ success: false, error: '요일을 선택해주세요.' }, 400)
  }
  
  const result = await DB.prepare(`
    INSERT INTO fixed_expenses 
    (name, category, amount, frequency, week_of_month, day_of_week, payment_day, is_active, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).bind(name, category, amount, frequency, week_of_month || null, day_of_week ?? null, payment_day || null, userId?.toString()).run()
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// 5.3 고정지출 수정
app.put('/api/fixed-expenses/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { name, category, amount, frequency, week_of_month, day_of_week, payment_day } = await c.req.json()
  
  if (!name || !category || !amount || !frequency) {
    return c.json({ success: false, error: '필수 항목을 입력해주세요.' }, 400)
  }
  
  if (!['monthly', 'weekly', 'monthly_day'].includes(frequency)) {
    return c.json({ success: false, error: '유효하지 않은 주기입니다.' }, 400)
  }
  
  // 'monthly' = 매월 특정 주/요일 (예: 매월 첫째 주 월요일)
  if (frequency === 'monthly') {
    if (!week_of_month) {
      return c.json({ success: false, error: '주차를 선택해주세요.' }, 400)
    }
    if (day_of_week === undefined) {
      return c.json({ success: false, error: '요일을 선택해주세요.' }, 400)
    }
  }
  
  // 'monthly_day' = 매월 특정 일자 (예: 매월 5일)
  if (frequency === 'monthly_day' && !payment_day) {
    return c.json({ success: false, error: '일자를 선택해주세요.' }, 400)
  }
  
  // 'weekly' = 매주 특정 요일 (예: 매주 금요일)
  if (frequency === 'weekly' && day_of_week === undefined) {
    return c.json({ success: false, error: '요일을 선택해주세요.' }, 400)
  }
  
  await DB.prepare(`
    UPDATE fixed_expenses 
    SET name = ?, category = ?, amount = ?, frequency = ?, 
        week_of_month = ?, day_of_week = ?, payment_day = ?
    WHERE id = ? AND user_id = ?
  `).bind(name, category, amount, frequency, week_of_month || null, day_of_week ?? null, payment_day || null, id, userId?.toString()).run()
  
  return c.json({ success: true })
})

// 5.4 고정지출 삭제 (소프트 삭제)
app.delete('/api/fixed-expenses/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const id = c.req.param('id')
  
  await DB.prepare(`
    UPDATE fixed_expenses SET is_active = 0 WHERE id = ? AND user_id = ?
  `).bind(id, userId?.toString()).run()
  
  return c.json({ success: true })
})

// 고정지출 지불 표시
app.post('/api/fixed-expenses/:id/mark-paid', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { date } = await c.req.json()
  
  if (!date) {
    return c.json({ success: false, error: '날짜를 입력해주세요.' }, 400)
  }
  
  const existingPayment = await DB.prepare(`
    SELECT id FROM fixed_expense_payments 
    WHERE fixed_expense_id = ? AND payment_date = ?
  `).bind(id, date).first()
  
  if (existingPayment) {
    return c.json({ success: true }) // 이미 표시된 경우
  }
  
  // 지불 표시만 저장 (transaction_id는 null)
  await DB.prepare(`
    INSERT INTO fixed_expense_payments (fixed_expense_id, transaction_id, payment_date)
    VALUES (?, NULL, ?)
  `).bind(id, date).run()
  
  return c.json({ success: true })
})

// 5.5 고정지출 지불 표시 제거
app.delete('/api/fixed-expenses/:id/mark-paid/:date', authMiddleware, async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const date = c.req.param('date')
  
  await DB.prepare(`
    DELETE FROM fixed_expense_payments 
    WHERE fixed_expense_id = ? AND payment_date = ?
  `).bind(id, date).run()
  
  return c.json({ success: true })
})

// 고정지출 반복 인스턴스 조회
app.get('/api/fixed-expenses/instances/:yearMonth', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const yearMonth = c.req.param('yearMonth')
  
  // 모든 활성화된 고정지출 가져오기
  const fixedExpenses = await DB.prepare(`
    SELECT * FROM fixed_expenses WHERE is_active = 1 AND user_id = ?
  `).bind(userId?.toString()).all()
  
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
    } else if (expense.frequency === 'monthly_day') {
      // 매월 특정 일자
      const day = expense.payment_day
      const lastDay = new Date(year, month, 0).getDate()
      const actualDay = Math.min(day, lastDay) // 31일이 없는 달 처리
      const date = new Date(year, month - 1, actualDay)
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
    } else if (expense.frequency === 'weekly') {
      // 주별: 해당 월의 첫 번째 해당 요일만 표시
      const date = getFirstDayOfWeekInMonth(year, month - 1, expense.day_of_week)
      
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
    }
  }
  
  // 날짜순 정렬
  instances.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  
  return c.json({ success: true, data: instances })
})
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

function getFirstDayOfWeekInMonth(year: number, month: number, dayOfWeek: number): Date | null {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  
  // 첫 번째 해당 요일 찾기
  let current = new Date(firstDay)
  while (current.getDay() !== dayOfWeek && current <= lastDay) {
    current.setDate(current.getDate() + 1)
  }
  
  // 해당 월에 존재하는지 확인
  if (current > lastDay) {
    return null
  }
  
  return current
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 예산 API

// 6.1 예산 목록 조회
app.get('/api/budgets', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  
  const result = await DB.prepare(`
    SELECT * FROM category_budgets WHERE user_id = ? ORDER BY category ASC
  `).bind(userId?.toString()).all()
  
  return c.json({ success: true, data: result.results })
})

// 6.2 예산 설정/수정 (UPSERT)
app.put('/api/budgets/:category', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const category = c.req.param('category')
  const { monthly_budget } = await c.req.json()
  
  if (!monthly_budget || monthly_budget < 0) {
    return c.json({ success: false, error: '유효한 예산 금액을 입력해주세요.' }, 400)
  }
  
  await DB.prepare(`
    INSERT INTO category_budgets (category, monthly_budget, user_id, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(category, user_id) DO UPDATE SET 
      monthly_budget = excluded.monthly_budget,
      updated_at = CURRENT_TIMESTAMP
  `).bind(category, monthly_budget, userId?.toString()).run()
  
  return c.json({ success: true })
})

// 6.3 예산 삭제
app.delete('/api/budgets/:category', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const category = c.req.param('category')
  
  await DB.prepare(`
    DELETE FROM category_budgets WHERE category = ? AND user_id = ?
  `).bind(category, userId?.toString()).run()
  
  return c.json({ success: true })
})

// 6.4 예산 vs 실제 지출 현황
app.get('/api/budgets/vs-spending/:yearMonth', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
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
      AND t.user_id = ?
      AND strftime('%Y-%m', t.date) = ?
    WHERE cb.user_id = ?
    GROUP BY cb.category, cb.monthly_budget
    ORDER BY cb.category ASC
  `).bind(userId?.toString(), yearMonth, userId?.toString()).all()
  
  return c.json({ success: true, data: result.results })
})

// 투자 관리 API

// 7.1 투자 목록 조회
app.get('/api/investments', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  
  const result = await DB.prepare(`
    SELECT * FROM investments 
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).bind(userId?.toString()).all()
  
  return c.json({ success: true, data: result.results })
})

// 7.2 투자 생성
app.post('/api/investments', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const { symbol, name, quantity, purchase_price, purchase_date, notes } = await c.req.json()
  
  if (!symbol || !name || !quantity || !purchase_price || !purchase_date) {
    return c.json({ success: false, error: '필수 항목을 입력해주세요.' }, 400)
  }
  
  const result = await DB.prepare(`
    INSERT INTO investments (symbol, name, quantity, purchase_price, purchase_date, notes, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(symbol.toUpperCase(), name, quantity, purchase_price, purchase_date, notes || null, userId?.toString()).run()
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// 7.3 투자 수정
app.put('/api/investments/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { symbol, name, quantity, purchase_price, purchase_date, notes } = await c.req.json()
  
  await DB.prepare(`
    UPDATE investments 
    SET symbol = ?, name = ?, quantity = ?, purchase_price = ?, purchase_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).bind(symbol.toUpperCase(), name, quantity, purchase_price, purchase_date, notes || null, id, userId?.toString()).run()
  
  return c.json({ success: true })
})

// 7.4 투자 삭제
app.delete('/api/investments/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const id = c.req.param('id')
  
  await DB.prepare(`DELETE FROM investments WHERE id = ? AND user_id = ?`).bind(id, userId?.toString()).run()
  
  return c.json({ success: true })
})

// 7.5 실시간 주가 조회 (외부 API 프록시) - 인증 불필요 (공개 데이터)
app.get('/api/investments/price/:symbol', async (c) => {
  const symbol = c.req.param('symbol')
  
  // 캐시 확인
  const cacheKey = `yf:${symbol}`
  const cached = getCached(cacheKey)
  
  if (cached) {
    return c.json({ 
      success: true, 
      data: cached, 
      cached: true 
    })
  }
  
  try {
    // Yahoo Finance API 호출
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BudgetLee/1.0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API returned ${response.status}`)
    }
    
    const json = await response.json() as any
    const quote = json?.quoteResponse?.result?.[0]
    
    if (!quote) {
      throw new Error('No quote data found')
    }
    
    // 데이터 가공
    const priceData = {
      symbol: quote.symbol,
      price: quote.regularMarketPrice || 0,
      previousClose: quote.regularMarketPreviousClose || 0,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      currency: quote.currency || 'USD',
      marketState: quote.marketState || 'REGULAR',
      simulated: false
    }
    
    // 60초 캐시
    setCache(cacheKey, priceData, 60)
    
    return c.json({
      success: true,
      data: priceData,
      cached: false
    })
    
  } catch (error: any) {
    console.warn(`[Yahoo Finance] API failed for ${symbol}, using simulated data:`, error.message)
    
    // 실패 시 시뮬레이션 데이터 사용
    const simulatedPrice = generateSimulatedPrice(symbol)
    
    return c.json({
      success: true,
      data: {
        symbol: symbol,
        price: simulatedPrice.current,
        previousClose: simulatedPrice.previous,
        change: simulatedPrice.current - simulatedPrice.previous,
        changePercent: ((simulatedPrice.current - simulatedPrice.previous) / simulatedPrice.previous * 100),
        currency: simulatedPrice.currency,
        marketState: 'CLOSED',
        simulated: true
      },
      fallback: true,
      error: error.message
    })
  }
})
function generateSimulatedPrice(symbol: string) {
  // 심볼별 기준 가격 (실제와 유사한 범위)
  const basePrices: { [key: string]: number } = {
    // 미국 주식
    'AAPL': 180,
    'GOOGL': 140,
    'MSFT': 370,
    'TSLA': 180,
    'AMZN': 170,
    'META': 480,
    'NVDA': 870,
    'AMD': 165,
    'NFLX': 600,
    
    // 한국 주식
    '005930.KS': 70000, // 삼성전자
    '000660.KS': 120000, // SK하이닉스
    
    // 암호화폐 (USD 기준)
    'BTC': 65000,  // 비트코인
    'ETH': 3200,   // 이더리움
    'BNB': 580,    // 바이낸스코인
    'XRP': 0.60,   // 리플
    'SOL': 140,    // 솔라나
    'ADA': 0.45,   // 카르다노
    'DOGE': 0.08,  // 도지코인
    'DOT': 6.5,    // 폴카닷
    'MATIC': 0.85, // 폴리곤
    'AVAX': 35,    // 아발란체
  }
  
  const basePrice = basePrices[symbol] || 100
  
  // 한국 주식 여부 확인
  const isKoreanStock = symbol.endsWith('.KS') || symbol.endsWith('.KQ')
  
  // 암호화폐 여부 확인 (주요 코인 심볼)
  const cryptoSymbols = ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'ADA', 'DOGE', 'DOT', 'MATIC', 'AVAX']
  const isCrypto = cryptoSymbols.includes(symbol)
  
  // 통화 결정
  let currency = 'USD'
  if (isKoreanStock) {
    currency = 'KRW'
  } else if (isCrypto) {
    currency = 'USD' // 암호화폐는 USD 기준
  }
  
  // 랜덤 변동 (암호화폐는 변동성이 더 큼)
  const volatility = isCrypto ? 0.15 : 0.1 // 암호화폐 -7.5% ~ +7.5%, 주식 -5% ~ +5%
  const randomVariation = (Math.random() - 0.5) * volatility
  const currentPrice = basePrice * (1 + randomVariation)
  const previousPrice = basePrice * (1 + (randomVariation * 0.5))
  
  return {
    current: Math.round(currentPrice * 100) / 100,
    previous: Math.round(previousPrice * 100) / 100,
    currency: currency
  }
}

// 7.6 투자 거래 내역 조회
app.get('/api/investments/:id/transactions', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')
  const id = c.req.param('id')
  
  const result = await DB.prepare(`
    SELECT * FROM investment_transactions 
    WHERE investment_id = ? AND user_id = ?
    ORDER BY transaction_date DESC
  `).bind(id, userId?.toString()).all()
  
  return c.json({ success: true, data: result.results })
})

// 메인 페이지

app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover">
    <meta name="description" content="개인 재무 관리 애플리케이션">
    <meta name="theme-color" content="#3B82F6">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="가계부">
    <title>가계부 앱</title>
    <link rel="manifest" href="/manifest.json">
    
    <!-- PWA 아이콘 -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png">
    <link rel="icon" type="image/png" sizes="512x512" href="/icon-512x512.png">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <link href="/static/style.css" rel="stylesheet">
    
    <style>
        /* 배경 - 바운스 시에도 배경 확장 */
        html {
            min-height: 100%;
        }
        body {
            min-height: 100vh;
            padding-bottom: 150vh;
        }
        body::before {
            content: '';
            position: fixed;
            top: -150vh;
            left: 0;
            right: 0;
            height: 150vh;
            z-index: -1;
        }
        body::after {
            content: '';
            position: fixed;
            bottom: -150vh;
            left: 0;
            right: 0;
            height: 150vh;
            z-index: -1;
        }
    </style>
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
                    <button id="tab-home" class="tab-button border-b-2 border-blue-600 text-blue-600 py-4 px-6 font-medium">
                        <i class="fas fa-home mr-2"></i>홈
                    </button>
                    <button id="tab-month" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-calendar-alt mr-2"></i>월별
                    </button>
                    <button id="tab-week" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-calendar-week mr-2"></i>주별
                    </button>
                    <button id="tab-savings" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-piggy-bank mr-2"></i>저축
                    </button>
                    <button id="tab-debts" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-hand-holding-usd mr-2"></i>채무
                    </button>
                    <button id="tab-investments" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-chart-line mr-2"></i>투자
                    </button>
                    <button id="tab-fixed-expenses" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-redo mr-2"></i>고정지출
                    </button>
                    <button id="tab-budgets" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-chart-pie mr-2"></i>예산
                    </button>
                    <button id="tab-reports" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-chart-bar mr-2"></i>리포트
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
    <script src="/static/i18n.js"></script>
    <script src="/static/app.js?v=2025-11-04-i18n"></script>
    <script>
      // PWA Service Worker 등록 (오프라인 지원)
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
              console.log('[PWA] Service Worker registered successfully');
              
              // 업데이트 확인
              registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // 새 버전 감지 - 사용자에게 알림
                    if (confirm('새로운 버전이 있습니다. 지금 업데이트 하시겠습니까?')) {
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                      window.location.reload();
                    }
                  }
                });
              });
            })
            .catch((err) => {
              console.warn('[PWA] Service Worker registration failed:', err);
            });
          
          // 컨트롤러 변경 시 자동 새로고침
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
          });
        });
      }
    </script>
</body>
</html>`)
})

// ========== 계좌(Accounts) API ==========

// 계좌 생성
app.post('/api/accounts', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')!
  const { name, type, balance = 0, currency = 'KRW' } = await c.req.json()
  
  // 입력 검증
  if (!name || !type) {
    return c.json({ success: false, error: '계좌명과 유형을 입력해주세요.' }, 400)
  }
  
  // 유효한 계좌 유형 확인
  const validTypes = ['checking', 'savings', 'credit_card', 'cash']
  if (!validTypes.includes(type)) {
    return c.json({ success: false, error: '유효하지 않은 계좌 유형입니다.' }, 400)
  }
  
  try {
    const result = await DB.prepare(`
      INSERT INTO accounts (user_id, name, type, balance, currency)
      VALUES (?, ?, ?, ?, ?)
    `).bind(userId, name, type, balance, currency).run()
    
    const accountId = result.meta.last_row_id
    
    return c.json({
      success: true,
      account: {
        id: accountId,
        user_id: userId,
        name,
        type,
        balance,
        currency,
        is_active: 1
      }
    })
  } catch (error: any) {
    console.error('[Accounts] Create error:', error)
    return c.json({ success: false, error: '계좌 생성 실패' }, 500)
  }
})

// 사용자의 모든 계좌 조회
app.get('/api/accounts', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')!
  const includeInactive = c.req.query('include_inactive') === 'true'
  
  try {
    let query = `
      SELECT id, user_id, name, type, balance, currency, is_active, 
             created_at, updated_at
      FROM accounts
      WHERE user_id = ?
    `
    
    if (!includeInactive) {
      query += ' AND is_active = 1'
    }
    
    query += ' ORDER BY created_at DESC'
    
    const result = await DB.prepare(query).bind(userId).all()
    
    return c.json({
      success: true,
      accounts: result.results || []
    })
  } catch (error: any) {
    console.error('[Accounts] List error:', error)
    return c.json({ success: false, error: '계좌 조회 실패' }, 500)
  }
})

// 특정 계좌 상세 조회
app.get('/api/accounts/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')!
  const accountId = parseInt(c.req.param('id'))
  
  try {
    const account = await DB.prepare(`
      SELECT id, user_id, name, type, balance, currency, is_active,
             created_at, updated_at
      FROM accounts
      WHERE id = ? AND user_id = ?
    `).bind(accountId, userId).first()
    
    if (!account) {
      return c.json({ success: false, error: '계좌를 찾을 수 없습니다.' }, 404)
    }
    
    return c.json({
      success: true,
      account
    })
  } catch (error: any) {
    console.error('[Accounts] Get error:', error)
    return c.json({ success: false, error: '계좌 조회 실패' }, 500)
  }
})

// 계좌 정보 수정
app.put('/api/accounts/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')!
  const accountId = parseInt(c.req.param('id'))
  const { name, type, balance, currency, is_active } = await c.req.json()
  
  try {
    // 계좌 소유권 확인
    const account = await DB.prepare(`
      SELECT id FROM accounts WHERE id = ? AND user_id = ?
    `).bind(accountId, userId).first()
    
    if (!account) {
      return c.json({ success: false, error: '계좌를 찾을 수 없습니다.' }, 404)
    }
    
    // 업데이트할 필드 동적 생성
    const updates: string[] = []
    const values: any[] = []
    
    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name)
    }
    if (type !== undefined) {
      const validTypes = ['checking', 'savings', 'credit_card', 'cash']
      if (!validTypes.includes(type)) {
        return c.json({ success: false, error: '유효하지 않은 계좌 유형입니다.' }, 400)
      }
      updates.push('type = ?')
      values.push(type)
    }
    if (balance !== undefined) {
      updates.push('balance = ?')
      values.push(balance)
    }
    if (currency !== undefined) {
      updates.push('currency = ?')
      values.push(currency)
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?')
      values.push(is_active ? 1 : 0)
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '업데이트할 필드가 없습니다.' }, 400)
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(accountId, userId)
    
    await DB.prepare(`
      UPDATE accounts
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `).bind(...values).run()
    
    return c.json({ success: true, message: '계좌가 수정되었습니다.' })
  } catch (error: any) {
    console.error('[Accounts] Update error:', error)
    return c.json({ success: false, error: '계좌 수정 실패' }, 500)
  }
})

// 계좌 삭제 (소프트 삭제 - 비활성화)
app.delete('/api/accounts/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')!
  const accountId = parseInt(c.req.param('id'))
  
  try {
    const result = await DB.prepare(`
      UPDATE accounts
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(accountId, userId).run()
    
    if (result.meta.changes === 0) {
      return c.json({ success: false, error: '계좌를 찾을 수 없습니다.' }, 404)
    }
    
    return c.json({ success: true, message: '계좌가 비활성화되었습니다.' })
  } catch (error: any) {
    console.error('[Accounts] Delete error:', error)
    return c.json({ success: false, error: '계좌 삭제 실패' }, 500)
  }
})

// ========== 이체(Transfers) API ==========

// 계좌 간 이체 실행
app.post('/api/transfers', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')!
  const { from_account_id, to_account_id, amount, description, transfer_date } = await c.req.json()
  
  // 입력 검증
  if (!from_account_id || !to_account_id || !amount || !transfer_date) {
    return c.json({ success: false, error: '모든 필드를 입력해주세요.' }, 400)
  }
  
  if (from_account_id === to_account_id) {
    return c.json({ success: false, error: '동일한 계좌 간 이체는 불가능합니다.' }, 400)
  }
  
  if (amount <= 0) {
    return c.json({ success: false, error: '이체 금액은 0보다 커야 합니다.' }, 400)
  }
  
  try {
    // 출금 계좌 확인
    const fromAccount = await DB.prepare(`
      SELECT id, balance FROM accounts WHERE id = ? AND user_id = ? AND is_active = 1
    `).bind(from_account_id, userId).first() as any
    
    if (!fromAccount) {
      return c.json({ success: false, error: '출금 계좌를 찾을 수 없습니다.' }, 404)
    }
    
    // 입금 계좌 확인
    const toAccount = await DB.prepare(`
      SELECT id FROM accounts WHERE id = ? AND user_id = ? AND is_active = 1
    `).bind(to_account_id, userId).first()
    
    if (!toAccount) {
      return c.json({ success: false, error: '입금 계좌를 찾을 수 없습니다.' }, 404)
    }
    
    // 잔액 확인
    if (fromAccount.balance < amount) {
      return c.json({ success: false, error: '출금 계좌의 잔액이 부족합니다.' }, 400)
    }
    
    // 트랜잭션 시작 (배치 실행)
    const batch = [
      // 이체 기록 삽입
      DB.prepare(`
        INSERT INTO transfers (user_id, from_account_id, to_account_id, amount, description, transfer_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(userId, from_account_id, to_account_id, amount, description || null, transfer_date),
      
      // 출금 계좌 잔액 감소
      DB.prepare(`
        UPDATE accounts
        SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).bind(amount, from_account_id, userId),
      
      // 입금 계좌 잔액 증가
      DB.prepare(`
        UPDATE accounts
        SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).bind(amount, to_account_id, userId)
    ]
    
    const results = await DB.batch(batch)
    const transferId = results[0].meta.last_row_id
    
    return c.json({
      success: true,
      transfer: {
        id: transferId,
        user_id: userId,
        from_account_id,
        to_account_id,
        amount,
        description,
        transfer_date
      }
    })
  } catch (error: any) {
    console.error('[Transfers] Create error:', error)
    return c.json({ success: false, error: '이체 실행 실패' }, 500)
  }
})

// 이체 내역 조회
app.get('/api/transfers', authMiddleware, async (c) => {
  const { DB } = c.env
  const userId = c.get('userId')!
  const accountId = c.req.query('account_id')
  const startDate = c.req.query('start_date')
  const endDate = c.req.query('end_date')
  
  try {
    let query = `
      SELECT t.id, t.user_id, t.from_account_id, t.to_account_id, t.amount,
             t.description, t.transfer_date, t.created_at,
             fa.name as from_account_name, ta.name as to_account_name
      FROM transfers t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      WHERE t.user_id = ?
    `
    const params: any[] = [userId]
    
    // 특정 계좌 필터링
    if (accountId) {
      query += ' AND (t.from_account_id = ? OR t.to_account_id = ?)'
      params.push(parseInt(accountId), parseInt(accountId))
    }
    
    // 날짜 범위 필터링
    if (startDate) {
      query += ' AND t.transfer_date >= ?'
      params.push(startDate)
    }
    if (endDate) {
      query += ' AND t.transfer_date <= ?'
      params.push(endDate)
    }
    
    query += ' ORDER BY t.transfer_date DESC, t.created_at DESC'
    
    const result = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      transfers: result.results || []
    })
  } catch (error: any) {
    console.error('[Transfers] List error:', error)
    return c.json({ success: false, error: '이체 내역 조회 실패' }, 500)
  }
})

// ========== 영수증 API (R2 + D1) ==========

// 카테고리 매핑 유틸(의/식/주 같은 1차 분류 → 기존 앱 카테고리로)
function mapKoreanPrimaryCategory(input: string): string {
  const norm = (input||'').trim();
  if (['의','의복','의복비','옷','패션'].includes(norm)) return '의복비';
  if (['식','식비','음식','외식','식료품'].includes(norm)) return '식비';
  if (['주','주거','월세','렌트','집'].includes(norm)) return '주거비';
  if (['교통','대중교통','택시','주유'].includes(norm)) return '교통비';
  if (['통신','폰','인터넷'].includes(norm)) return '통신비';
  if (['병원','의료','약','의약'].includes(norm)) return '의료비';
  if (['교육','수업료','학원'].includes(norm)) return '교육비';
  if (['보험'].includes(norm)) return '보험';
  if (['문화','취미','영화'].includes(norm)) return '문화생활';
  if (['쇼핑'].includes(norm)) return '쇼핑';
  return norm || '기타지출';
}

// 파일 업로드 엔드포인트는 제거 (클라이언트에서 IndexedDB에 직접 저장)

// 2) 영수증 저장 (Base64 이미지 포함)
app.post('/api/receipts', authMiddleware, async (c) => {
  const { DB } = c.env;
  const userId = c.get('userId');
  const body = await c.req.json();

  const required = ['purchase_date','amount','category'];
  for (const k of required) {
    if (!body[k]) {
      return c.json({ success: false, error: `${k} is required` }, 400);
    }
  }

  // 카테고리 매핑(의/식/주 → 내부 카테고리)
  const mappedCategory = mapKoreanPrimaryCategory(body.category);

  try {
    // 1) receipts 저장 (Base64 이미지 데이터 포함)
    const receiptResult = await DB.prepare(`
      INSERT INTO receipts
        (store_name, purchase_date, amount, category,
         payment_method, notes, 
         image_data, image_type,
         merchant, is_tax_deductible,
         user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      body.merchant || '미지정',  // store_name은 NOT NULL이므로 기본값 제공
      body.purchase_date,
      body.amount,
      mappedCategory,
      body.payment_method || null,
      body.notes || null,
      body.image_data || null,  // Base64 이미지 데이터
      body.image_type || null,   // image/webp, image/jpeg 등
      body.merchant || '미지정',  // merchant도 동일하게
      body.is_tax_deductible ? 1 : 0,
      String(userId)
    ).run();

    const receiptId = receiptResult.meta.last_row_id;

    // 2) 거래 자동 생성 (expense)
    const tx = await DB.prepare(`
      INSERT INTO transactions
        (type, category, amount, description, date, payment_method, user_id)
      VALUES ('expense', ?, ?, ?, ?, ?, ?)
    `).bind(
      mappedCategory,
      body.amount,
      `${body.merchant || '영수증'} 결제`,
      body.purchase_date,
      body.payment_method || 'card',
      String(userId)
    ).run();

    const transactionId = tx.meta.last_row_id;

    return c.json({ 
      success: true, 
      receipt_id: receiptId, 
      transaction_id: transactionId 
    });
  } catch (error: any) {
    console.error('[Receipts] Save error:', error);
    return c.json({ success: false, error: '영수증 저장 실패: ' + error.message }, 500);
  }
});

// 2.5) 영수증 OCR 분석 (Google Vision API)
app.post('/api/receipts/ocr', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { image_data } = body;
    
    if (!image_data) {
      return c.json({ success: false, error: 'No image data' }, 400);
    }
    
    const { GOOGLE_VISION_API_KEY } = c.env;
    
    console.log('[OCR] API Key status:', GOOGLE_VISION_API_KEY ? 'Present' : 'Missing');
    
    // Google Vision API 키가 없으면 폴백 (데모 모드)
    if (!GOOGLE_VISION_API_KEY || GOOGLE_VISION_API_KEY === 'your-google-vision-api-key-here') {
      console.log('[OCR] Google Vision API key not configured, using demo mode');
      
      // 데모 데이터 반환
      const merchants = ['스타벅스', 'GS25', '이마트', '올리브영', 'CU편의점', '맥도날드', '버거킹'];
      const amounts = [5000, 12000, 25000, 38000, 15000, 8500, 42000];
      
      const today = new Date();
      const daysAgo = Math.floor(Math.random() * 7);
      today.setDate(today.getDate() - daysAgo);
      
      return c.json({
        success: true,
        data: {
          merchant: merchants[Math.floor(Math.random() * merchants.length)],
          date: today.toISOString().split('T')[0],
          amount: amounts[Math.floor(Math.random() * amounts.length)]
        },
        message: '데모 모드: 랜덤 데이터가 생성되었습니다. Google Vision API 키를 설정하면 실제 OCR이 작동합니다.'
      });
    }
    
    // Base64에서 이미지 데이터만 추출 (data:image/png;base64, 제거)
    const base64Image = image_data.replace(/^data:image\/\w+;base64,/, '');
    
    // Google Vision API 호출
    const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;
    
    const visionResponse = await fetch(visionApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          image: {
            content: base64Image
          },
          features: [{
            type: 'TEXT_DETECTION',
            maxResults: 1
          }]
        }]
      })
    });
    
    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('[OCR] Vision API error:', visionResponse.status, errorText);
      throw new Error(`Vision API error: ${visionResponse.status} - ${errorText}`);
    }
    
    const visionData = await visionResponse.json() as any;
    console.log('[OCR] Vision API response:', JSON.stringify(visionData).substring(0, 200));
    
    // 텍스트 추출
    const textAnnotations = visionData.responses[0]?.textAnnotations;
    if (!textAnnotations || textAnnotations.length === 0) {
      return c.json({
        success: false,
        error: '영수증에서 텍스트를 찾을 수 없습니다.'
      });
    }
    
    // 전체 텍스트 (첫 번째 항목이 전체 텍스트)
    const fullText = textAnnotations[0].description;
    console.log('[OCR] Extracted text:', fullText);
    
    // 텍스트에서 정보 추출
    const extracted = extractReceiptInfo(fullText);
    
    return c.json({
      success: true,
      data: extracted,
      message: '영수증 정보가 추출되었습니다. 내용을 확인하고 수정하세요.'
    });
  } catch (error: any) {
    console.error('[OCR] Error:', error);
    return c.json({ 
      success: false, 
      error: 'OCR 처리 실패: ' + (error.message || '알 수 없는 오류')
    }, 500);
  }
});

// 영수증 텍스트에서 정보 추출하는 헬퍼 함수
function extractReceiptInfo(text: string) {
  const extracted: {
    merchant: string | null;
    date: string | null;
    amount: number | null;
  } = {
    merchant: null,
    date: null,
    amount: null
  };
  
  // 줄바꿈으로 분리
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // 1. 상점명 추출 (보통 첫 1-3줄에 있음)
  if (lines.length > 0) {
    // 회사명, 점포명 등의 키워드가 있는 줄 찾기
    const merchantKeywords = ['(주)', '주식회사', '상회', '마트', '편의점', 'STORE', 'SHOP', 'CAFE'];
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (merchantKeywords.some(keyword => line.includes(keyword)) || 
          (line.length > 2 && line.length < 30 && i < 3)) {
        extracted.merchant = line;
        break;
      }
    }
    
    // 상점명을 못 찾았으면 첫 줄 사용
    if (!extracted.merchant) {
      extracted.merchant = lines[0];
    }
  }
  
  // 2. 날짜 추출 (YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD 형식)
  const datePatterns = [
    /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/,  // 2024-11-03, 2024/11/03, 2024.11.03
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,  // 2024년 11월 03일
    /(\d{2})[-./](\d{1,2})[-./](\d{1,2})/    // 24-11-03
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      let year = match[1];
      let month = match[2].padStart(2, '0');
      let day = match[3].padStart(2, '0');
      
      // 2자리 연도를 4자리로 변환
      if (year.length === 2) {
        year = '20' + year;
      }
      
      extracted.date = `${year}-${month}-${day}`;
      break;
    }
  }
  
  // 날짜를 못 찾았으면 오늘 날짜
  if (!extracted.date) {
    extracted.date = new Date().toISOString().split('T')[0];
  }
  
  // 3. 금액 추출 (합계, 총액, 결제금액 등의 키워드 근처)
  const amountKeywords = ['합계', '총액', '결제금액', '합 계', 'TOTAL', 'Total', '카드승인금액', '받을금액'];
  const numberPattern = /[\d,]+/g;
  
  // 금액 키워드가 있는 줄 찾기
  for (const keyword of amountKeywords) {
    for (const line of lines) {
      if (line.includes(keyword)) {
        // 해당 줄과 다음 줄에서 숫자 찾기
        const numbers = line.match(numberPattern);
        if (numbers) {
          // 쉼표 제거하고 숫자로 변환
          const amounts = numbers.map(n => parseInt(n.replace(/,/g, '')));
          // 가장 큰 금액을 선택 (보통 합계가 가장 큼)
          const maxAmount = Math.max(...amounts.filter(a => !isNaN(a) && a > 0));
          if (maxAmount > 0 && maxAmount < 10000000) { // 1000만원 미만
            extracted.amount = maxAmount;
            break;
          }
        }
      }
    }
    if (extracted.amount) break;
  }
  
  // 금액을 못 찾았으면 가장 큰 숫자 사용
  if (!extracted.amount) {
    const allNumbers = text.match(numberPattern);
    if (allNumbers) {
      const amounts = allNumbers
        .map(n => parseInt(n.replace(/,/g, '')))
        .filter(a => !isNaN(a) && a > 100 && a < 10000000); // 100원 ~ 1000만원
      
      if (amounts.length > 0) {
        extracted.amount = Math.max(...amounts);
      }
    }
  }
  
  return extracted;
}

// 3) 영수증 목록 조회
app.get('/api/receipts', authMiddleware, async (c) => {
  const { DB } = c.env;
  const userId = c.get('userId');
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');

  let query = `
    SELECT 
      r.id, r.merchant, r.purchase_date, r.amount, r.category,
      r.payment_method, r.notes, r.is_tax_deductible,
      r.image_data, r.image_type,
      r.created_at
    FROM receipts r
    WHERE r.user_id = ?
  `;
  const params: any[] = [String(userId)];

  if (startDate) {
    query += ' AND r.purchase_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND r.purchase_date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY r.purchase_date DESC, r.created_at DESC';

  const result = await DB.prepare(query).bind(...params).all();

  return c.json({
    success: true,
    receipts: result.results || []
  });
});

// 4) 특정 영수증 조회
app.get('/api/receipts/:id', authMiddleware, async (c) => {
  const { DB } = c.env;
  const userId = c.get('userId');
  const id = c.req.param('id');

  const receipt = await DB.prepare(`
    SELECT * FROM receipts
    WHERE id = ? AND user_id = ?
  `).bind(id, String(userId)).first();

  if (!receipt) {
    return c.json({ success: false, error: 'Receipt not found' }, 404);
  }

  return c.json({ success: true, receipt });
});

// 다운로드 엔드포인트는 제거 (클라이언트에서 IndexedDB에서 직접 가져옴)

// 6) 영수증 삭제 (DB만, 이미지는 클라이언트에서 삭제)
app.delete('/api/receipts/:id', authMiddleware, async (c) => {
  const { DB } = c.env;
  const userId = c.get('userId');
  const id = c.req.param('id');

  try {
    // 영수증 정보 조회
    const rec = await DB.prepare(`
      SELECT id FROM receipts
      WHERE id = ? AND user_id = ?
    `).bind(id, String(userId)).first() as any;

    if (!rec) {
      return c.json({ success: false, error: 'Receipt not found' }, 404);
    }

    // DB에서 영수증 삭제 (이미지는 클라이언트 IndexedDB에서 삭제)
    await DB.prepare(`
      DELETE FROM receipts WHERE id = ? AND user_id = ?
    `).bind(id, String(userId)).run();

    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Receipts] Delete error:', error);
    return c.json({ success: false, error: '영수증 삭제 실패' }, 500);
  }
});

// ============================================================
// Debts API (채무 관리)
// ============================================================

// Get all debts for user
app.get('/api/debts', authMiddleware, async (c) => {
  try {
    const { DB } = c.env as { DB: D1Database };
    const userId = c.get('userId');
    
    if (!userId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const debts = await DB.prepare(`
      SELECT * FROM debts 
      WHERE user_id = ?
      ORDER BY 
        CASE status 
          WHEN 'overdue' THEN 1 
          WHEN 'active' THEN 2 
          WHEN 'paid' THEN 3 
        END,
        due_date ASC
    `).bind(String(userId)).all();

    return c.json({ 
      success: true, 
      debts: debts.results || [] 
    });
  } catch (error: any) {
    console.error('[Debts] Get all error:', error);
    return c.json({ success: false, error: '채무 목록 조회 실패' }, 500);
  }
});

// Create new debt
app.post('/api/debts', authMiddleware, async (c) => {
  try {
    const { DB } = c.env as { DB: D1Database };
    const userId = c.get('userId');
    
    if (!userId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { creditor, amount, interest_rate, start_date, due_date, category, notes } = body;

    if (!creditor || !amount || !start_date) {
      return c.json({ 
        success: false, 
        error: '채권자, 금액, 시작일은 필수입니다' 
      }, 400);
    }

    const result = await DB.prepare(`
      INSERT INTO debts (
        creditor, amount, remaining_amount, interest_rate,
        start_date, due_date, category, notes, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      creditor,
      Number(amount),
      Number(amount), // 초기 remaining_amount는 전체 금액과 동일
      Number(interest_rate || 0),
      start_date,
      due_date || null,
      category || '개인',
      notes || null,
      String(userId)
    ).run();

    return c.json({ 
      success: true, 
      id: result.meta.last_row_id 
    });
  } catch (error: any) {
    console.error('[Debts] Create error:', error);
    return c.json({ success: false, error: '채무 생성 실패' }, 500);
  }
});

// Update debt
app.put('/api/debts/:id', authMiddleware, async (c) => {
  try {
    const { DB } = c.env as { DB: D1Database };
    const userId = c.get('userId');
    
    if (!userId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    const { creditor, amount, remaining_amount, interest_rate, start_date, due_date, status, category, notes } = body;

    // Verify debt belongs to user
    const debt = await DB.prepare(`
      SELECT * FROM debts WHERE id = ? AND user_id = ?
    `).bind(id, String(userId)).first();

    if (!debt) {
      return c.json({ success: false, error: 'Debt not found' }, 404);
    }

    await DB.prepare(`
      UPDATE debts 
      SET creditor = ?, amount = ?, remaining_amount = ?, 
          interest_rate = ?, start_date = ?, due_date = ?,
          status = ?, category = ?, notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(
      creditor,
      Number(amount),
      Number(remaining_amount),
      Number(interest_rate || 0),
      start_date,
      due_date || null,
      status || 'active',
      category || '개인',
      notes || null,
      id,
      String(userId)
    ).run();

    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Debts] Update error:', error);
    return c.json({ success: false, error: '채무 수정 실패' }, 500);
  }
});

// Delete debt
app.delete('/api/debts/:id', authMiddleware, async (c) => {
  try {
    const { DB } = c.env as { DB: D1Database };
    const userId = c.get('userId');
    
    if (!userId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');

    // Verify debt belongs to user
    const debt = await DB.prepare(`
      SELECT * FROM debts WHERE id = ? AND user_id = ?
    `).bind(id, String(userId)).first();

    if (!debt) {
      return c.json({ success: false, error: 'Debt not found' }, 404);
    }

    // Delete debt (cascade will delete payments)
    await DB.prepare(`
      DELETE FROM debts WHERE id = ? AND user_id = ?
    `).bind(id, String(userId)).run();

    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Debts] Delete error:', error);
    return c.json({ success: false, error: '채무 삭제 실패' }, 500);
  }
});

// Get payment history for a debt
app.get('/api/debts/:id/payments', authMiddleware, async (c) => {
  try {
    const { DB } = c.env as { DB: D1Database };
    const userId = c.get('userId');
    
    if (!userId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const debtId = c.req.param('id');

    // Verify debt belongs to user
    const debt = await DB.prepare(`
      SELECT * FROM debts WHERE id = ? AND user_id = ?
    `).bind(debtId, String(userId)).first();

    if (!debt) {
      return c.json({ success: false, error: 'Debt not found' }, 404);
    }

    const payments = await DB.prepare(`
      SELECT * FROM debt_payments 
      WHERE debt_id = ? AND user_id = ?
      ORDER BY payment_date DESC
    `).bind(debtId, String(userId)).all();

    return c.json({ 
      success: true, 
      payments: payments.results || [] 
    });
  } catch (error: any) {
    console.error('[Debts] Get payments error:', error);
    return c.json({ success: false, error: '상환 내역 조회 실패' }, 500);
  }
});

// Record a payment for a debt
app.post('/api/debts/:id/payments', authMiddleware, async (c) => {
  try {
    const { DB } = c.env as { DB: D1Database };
    const userId = c.get('userId');
    
    if (!userId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const debtId = c.req.param('id');
    const body = await c.req.json();
    const { amount, payment_date, notes } = body;

    if (!amount || !payment_date) {
      return c.json({ 
        success: false, 
        error: '금액과 날짜는 필수입니다' 
      }, 400);
    }

    // Verify debt belongs to user
    const debt = await DB.prepare(`
      SELECT * FROM debts WHERE id = ? AND user_id = ?
    `).bind(debtId, String(userId)).first() as any;

    if (!debt) {
      return c.json({ success: false, error: 'Debt not found' }, 404);
    }

    // Record payment
    await DB.prepare(`
      INSERT INTO debt_payments (debt_id, amount, payment_date, notes, user_id)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      debtId,
      Number(amount),
      payment_date,
      notes || null,
      String(userId)
    ).run();

    // Update remaining amount
    const newRemaining = Number(debt.remaining_amount) - Number(amount);
    const newStatus = newRemaining <= 0 ? 'paid' : 'active';

    await DB.prepare(`
      UPDATE debts 
      SET remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(
      Math.max(0, newRemaining),
      newStatus,
      debtId,
      String(userId)
    ).run();

    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Debts] Record payment error:', error);
    return c.json({ success: false, error: '상환 기록 실패' }, 500);
  }
});

// Delete a payment (refund/correction)
app.delete('/api/debts/:debtId/payments/:paymentId', authMiddleware, async (c) => {
  try {
    const { DB } = c.env as { DB: D1Database };
    const userId = c.get('userId');
    
    if (!userId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const debtId = c.req.param('debtId');
    const paymentId = c.req.param('paymentId');

    // Verify payment belongs to user
    const payment = await DB.prepare(`
      SELECT * FROM debt_payments WHERE id = ? AND debt_id = ? AND user_id = ?
    `).bind(paymentId, debtId, String(userId)).first() as any;

    if (!payment) {
      return c.json({ success: false, error: 'Payment not found' }, 404);
    }

    // Delete payment
    await DB.prepare(`
      DELETE FROM debt_payments WHERE id = ? AND user_id = ?
    `).bind(paymentId, String(userId)).run();

    // Update debt remaining amount (add back the payment)
    const debt = await DB.prepare(`
      SELECT * FROM debts WHERE id = ? AND user_id = ?
    `).bind(debtId, String(userId)).first() as any;

    if (debt) {
      const newRemaining = Number(debt.remaining_amount) + Number(payment.amount);
      const newStatus = newRemaining < Number(debt.amount) ? 'active' : 'active';

      await DB.prepare(`
        UPDATE debts 
        SET remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).bind(
        newRemaining,
        newStatus,
        debtId,
        String(userId)
      ).run();
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Debts] Delete payment error:', error);
    return c.json({ success: false, error: '상환 기록 삭제 실패' }, 500);
  }
});

export default app
