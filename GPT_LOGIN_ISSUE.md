# 로그인 문제 해결 요청

## 🔴 현재 문제 상황

**로그인이 되지 않습니다.**

- 회원가입/로그인 화면은 정상적으로 표시됨
- 로그인을 시도하면 실패함
- 서버 API는 정상 작동 (curl 테스트 통과)

## 📋 시스템 구성

### 기술 스택
- **백엔드**: Hono (Cloudflare Workers)
- **프론트엔드**: Vanilla JavaScript
- **데이터베이스**: Cloudflare D1 (SQLite)
- **인증**: PBKDF2 + JWT Access/Refresh Token
- **배포**: Cloudflare Pages (local dev mode)

### 프로젝트 구조
```
webapp/
├── src/
│   └── index.tsx          # Hono 백엔드
├── public/
│   └── static/
│       ├── app.js         # 프론트엔드 JavaScript
│       └── style.css
├── dist/                  # 빌드 결과물
├── migrations/            # DB 마이그레이션
└── ecosystem.config.cjs   # PM2 설정
```

## 🧪 서버 API 테스트 (성공)

### 1. 회원가입 (성공 ✅)
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"1234","name":"테스트사용자"}'

# 결과:
{
  "success": true,
  "accessToken": "eyJhbGci...",
  "refreshToken": "eab1b3c...",
  "user": {
    "id": 1,
    "username": "testuser",
    "name": "테스트사용자"
  }
}
```

### 2. 로그인 (성공 ✅)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"1234"}'

# 결과:
{
  "success": true,
  "accessToken": "eyJhbGci...",
  "refreshToken": "60997528...",
  "user": {
    "id": 1,
    "username": "testuser",
    "name": "테스트사용자"
  }
}
```

### 3. 인증 필요 API (정상 ✅)
```bash
# 인증 없이 요청 (실패 - 정상)
curl http://localhost:3000/api/settings
→ {"success":false,"error":"인증이 필요합니다."}

# 토큰과 함께 요청 (성공)
curl -H "Authorization: Bearer eyJhbGci..." http://localhost:3000/api/settings
→ {"success":true,"data":{...}}
```

## 🌐 브라우저에서의 문제

### 증상
1. 브라우저에서 앱 접속 → 로그인 화면 표시됨 ✅
2. 회원가입 시도 → **실패** ❌
3. 로그인 시도 → **실패** ❌
4. 콘솔 에러 확인 필요

### 공개 URL
https://3000-ilfxg66dle2ykyvgdbe6r-c07dda5e.sandbox.novita.ai

## 📂 핵심 코드

### 백엔드: 로그인 API (src/index.tsx)
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

### 프론트엔드: 로그인 함수 (public/static/app.js)
async function handleLogin(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const username = formData.get('username');
  const password = formData.get('password');
  
  console.log('[Login] Attempting login for user:', username);
  
  if (!username || !password) {
    alert('아이디와 비밀번호를 입력해주세요.');
    return;
  }
  
  try {
    const response = await axios.post('/api/auth/login', { username, password });
    console.log('[Login] Response:', response.data);
    
    if (response.data.success) {
      console.log('[Login] Setting tokens...');
      setAuthToken(response.data.accessToken, response.data.refreshToken);
      state.isAuthenticated = true;
      state.currentUser = response.data.user;
      console.log('[Login] State updated:', state);
      console.log('[Login] Rendering app...');
      renderApp();
    }
  } catch (error) {
    console.error('[Login] Error:', error);
    alert(error.response?.data?.error || '로그인에 실패했습니다.');
  }

### 프론트엔드: renderLoginScreen (public/static/app.js)
546:function renderLoginScreen() {

## 🔍 의심되는 원인

1. **프론트엔드 로직 문제**
   - handleLogin 함수가 제대로 호출되지 않는가?
   - axios 요청이 올바르게 전송되는가?
   - 응답 처리가 올바른가?

2. **CORS 문제**
   - 브라우저에서 API 요청이 차단되는가?
   - preflight 요청이 실패하는가?

3. **경로 문제**
   - 프론트엔드에서 `/api/auth/login`으로 요청하는가?
   - 상대 경로 vs 절대 경로 문제?

4. **캐시 문제**
   - 브라우저가 오래된 app.js를 로드하는가?
   - Service Worker가 캐시하고 있는가?

5. **에러 처리 문제**
   - 에러가 발생했지만 사용자에게 표시되지 않는가?
   - console.error는 출력되는가?

## 📝 시도한 해결 방법

1. ✅ 서버 재시작
2. ✅ 빌드 재실행 (npm run build)
3. ✅ 캐시 삭제 스크립트 추가
4. ✅ Service Worker 비활성화
5. ✅ 하드 리프레시 (Ctrl+Shift+R)
6. ✅ 시크릿 모드 테스트
7. ✅ Git 커밋으로 인증 시스템 복구

## ❓ 질문

1. **브라우저 콘솔에 어떤 에러가 표시되나요?**
   - Network 탭에서 `/api/auth/login` 요청이 보이나요?
   - 요청이 실패한다면 상태 코드는 무엇인가요?
   - Console 탭에 JavaScript 에러가 있나요?

2. **로그인 버튼을 클릭했을 때 무슨 일이 일어나나요?**
   - 아무 반응이 없나요?
   - 에러 메시지가 표시되나요?
   - 페이지가 새로고침되나요?

3. **어떻게 디버깅해야 하나요?**
   - 브라우저 개발자 도구에서 확인해야 할 것은?
   - 프론트엔드 코드를 어떻게 수정해야 하나요?

## 🎯 해결하고 싶은 것

**브라우저에서 로그인/회원가입이 정상 작동하도록 만들어주세요.**

- 서버 API는 정상 작동합니다 (curl 테스트 통과)
- 브라우저에서만 문제가 발생합니다
- 프론트엔드 코드나 설정에 문제가 있는 것 같습니다

## 📎 참고 정보

### Git 리포지토리
https://github.com/kiwidressing/Budget-Lee

### 현재 커밋
```bash
$ git log --oneline -5
e13d71f docs: Add restoration document for multi-user authentication system
a5435e2 fix: Remove CHECK(id=1) constraint from settings table
6af5de3 docs: Update README with cleanup status
5be9acf cleanup: Remove test files and reset database
5cdc48d fix: Update Service Worker cache version to v2
```

### PM2 상태
```bash
$ pm2 list
┌────┬────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │
├────┼────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ webapp │ N/A     │ fork    │ 35022    │ online │ 4    │ online    │ 0%       │ 62.9mb   │
└────┴────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┘
```

---

**작성일**: 2025-10-29  
**작성자**: AI Assistant  
**우선순위**: 🔴 긴급
