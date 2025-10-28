import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { sign, verify } from 'hono/jwt'

type Bindings = {
  DB: D1Database;
  JWT_SECRET?: string;
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
app.use('/static/*', serveStatic({ root: './public' }))

// ========== 인증 유틸리티 함수 ==========

// ========== 비밀번호 해싱 ==========

// 레거시 SHA-256 해싱 (기존 사용자 지원용)
async function hashPasswordSHA256(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// PBKDF2 해싱 (새로운 보안 표준 - 150,000 iterations)
async function hashPasswordPBKDF2(password: string, salt: string, iterations: number = 150000): Promise<string> {
  const encoder = new TextEncoder()
  const passwordData = encoder.encode(password)
  const saltData = encoder.encode(salt)
  
  // PBKDF2 키 생성
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltData,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 256 bits = 32 bytes
  )
  
  const hashArray = Array.from(new Uint8Array(derivedBits))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// 랜덤 salt 생성 (16 bytes = 32 hex chars)
function generateSalt(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

// 비밀번호 검증 (SHA-256과 PBKDF2 모두 지원)
async function verifyPassword(
  password: string, 
  hash: string, 
  salt?: string | null, 
  iterations?: number | null
): Promise<boolean> {
  // PBKDF2 검증 (salt와 iterations가 있는 경우)
  if (salt && iterations) {
    const passwordHash = await hashPasswordPBKDF2(password, salt, iterations)
    return passwordHash === hash
  }
  
  // 레거시 SHA-256 검증 (salt가 없는 기존 사용자)
  const passwordHash = await hashPasswordSHA256(password)
  return passwordHash === hash
}

// ========== JWT 토큰 시스템 (Access + Refresh) ==========

// Access Token 생성 (45분)
async function createAccessToken(userId: number, username: string, secret: string): Promise<string> {
  const payload = {
    sub: userId.toString(),
    username: username,
    type: 'access',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 45) // 45분
  }
  return await sign(payload, secret)
}

// Refresh Token 생성 (30일)
function generateRefreshToken(): string {
  const array = new Uint8Array(32) // 32 bytes = 256 bits
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Refresh Token 저장
async function saveRefreshToken(
  DB: D1Database, 
  userId: number, 
  refreshToken: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + (60 * 60 * 24 * 30 * 1000)) // 30일
  const expiresAtStr = expiresAt.toISOString().replace('T', ' ').substring(0, 19)
  
  await DB.prepare(`
    INSERT INTO sessions (user_id, refresh_token, expires_at, user_agent, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).bind(userId, refreshToken, expiresAtStr, userAgent || null, ipAddress || null).run()
}

// Refresh Token 검증 및 조회
async function verifyRefreshToken(DB: D1Database, refreshToken: string): Promise<any | null> {
  const session = await DB.prepare(`
    SELECT s.*, u.username, u.name
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.refresh_token = ? AND s.expires_at > datetime('now')
  `).bind(refreshToken).first() as any
  
  if (!session) return null
  
  // 마지막 사용 시간 업데이트
  await DB.prepare(`
    UPDATE sessions SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(session.id).run()
  
  return session
}

// Refresh Token 삭제 (로그아웃)
async function deleteRefreshToken(DB: D1Database, refreshToken: string): Promise<void> {
  await DB.prepare(`
    DELETE FROM sessions WHERE refresh_token = ?
  `).bind(refreshToken).run()
}

// 만료된 세션 정리
async function cleanExpiredSessions(DB: D1Database): Promise<void> {
  await DB.prepare(`
    DELETE FROM sessions WHERE expires_at < datetime('now')
  `).run()
}

// 인증 미들웨어
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
  
  // PBKDF2 비밀번호 해싱 (새로운 표준)
  const salt = generateSalt()
  const iterations = 150000
  const passwordHash = await hashPasswordPBKDF2(password, salt, iterations)
  
  // 사용자 생성
  const result = await DB.prepare(`
    INSERT INTO users (username, password_hash, name, salt, iterations)
    VALUES (?, ?, ?, ?, ?)
  `).bind(username, passwordHash, name, salt, iterations).run()
  
  const userId = result.meta.last_row_id as number
  const secret = c.env.JWT_SECRET || 'default-secret-key-change-in-production'
  
  // Access Token + Refresh Token 발급
  const accessToken = await createAccessToken(userId, username, secret)
  const refreshToken = generateRefreshToken()
  
  // Refresh Token 저장
  const userAgent = c.req.header('user-agent')
  const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')
  await saveRefreshToken(DB, userId, refreshToken, userAgent, ipAddress)
  
  return c.json({ 
    success: true, 
    accessToken,
    refreshToken,
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
  
  // 사용자 조회 (salt, iterations 포함)
  const user = await DB.prepare(`
    SELECT id, username, password_hash, name, salt, iterations FROM users WHERE username = ?
  `).bind(username).first() as any
  
  if (!user) {
    return c.json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401)
  }
  
  // 비밀번호 검증 (PBKDF2 또는 레거시 SHA-256)
  const isValid = await verifyPassword(password, user.password_hash, user.salt, user.iterations)
  
  if (!isValid) {
    return c.json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401)
  }
  
  // 자동 마이그레이션: 레거시 SHA-256 사용자를 PBKDF2로 업그레이드
  if (!user.salt || !user.iterations) {
    const newSalt = generateSalt()
    const newIterations = 150000
    const newHash = await hashPasswordPBKDF2(password, newSalt, newIterations)
    
    await DB.prepare(`
      UPDATE users 
      SET password_hash = ?, salt = ?, iterations = ?
      WHERE id = ?
    `).bind(newHash, newSalt, newIterations, user.id).run()
    
    console.log(`[Security] User ${username} password upgraded to PBKDF2`)
  }
  
  // 마지막 로그인 시간 업데이트
  await DB.prepare(`
    UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(user.id).run()
  
  // Access Token + Refresh Token 발급
  const secret = c.env.JWT_SECRET || 'default-secret-key-change-in-production'
  const accessToken = await createAccessToken(user.id, user.username, secret)
  const refreshToken = generateRefreshToken()
  
  // Refresh Token 저장
  const userAgent = c.req.header('user-agent')
  const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')
  await saveRefreshToken(DB, user.id, refreshToken, userAgent, ipAddress)
  
  // 만료된 세션 정리 (비동기)
  cleanExpiredSessions(DB).catch(err => console.error('[Sessions] Cleanup error:', err))
  
  return c.json({ 
    success: true, 
    accessToken,
    refreshToken,
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
    accessToken
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
    <link rel="icon" type="image/png" href="/icon-192.png">
    <link rel="apple-touch-icon" href="/icon-192.png">
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
                    <button id="tab-investments" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
                        <i class="fas fa-chart-line mr-2"></i>투자
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
    <script src="/static/app.js"></script>
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

export default app
