# 🚀 Google OAuth 활성화 가이드 (완전판)

> **현재 상태**: ✅ 구현 완료, ⏸️ 비활성화 (기본값)  
> **활성화 시간**: 5-10분 (Google Cloud Console 설정 포함)  
> **난이도**: ⭐⭐ (중간)

---

## 📋 목차

1. [현재 상태 확인](#1-현재-상태-확인)
2. [Google Cloud Console 설정](#2-google-cloud-console-설정)
3. [로컬 환경 활성화](#3-로컬-환경-활성화)
4. [프로덕션 환경 활성화](#4-프로덕션-환경-활성화)
5. [테스트 방법](#5-테스트-방법)
6. [문제 해결](#6-문제-해결)

---

## 1. 현재 상태 확인

### ✅ 구현 완료된 기능

#### 백엔드 (src/index.tsx)
```typescript
✅ 기능 플래그 시스템 (GOOGLE_OAUTH_ENABLED)
✅ GET  /api/auth/google - Google 로그인 시작
✅ GET  /api/auth/google/callback - OAuth 콜백 처리
✅ POST /api/auth/link-google - 계정 연동
✅ POST /api/auth/migrate-data - 데이터 마이그레이션
✅ 에러 처리 및 사용자 친화적 메시지
✅ 보안 강화 (google_id 저장, XSS 방지)
```

#### 프론트엔드 (public/static/app.js)
```javascript
✅ 기능 플래그 체크 (자동)
✅ 조건부 버튼 표시/숨김
✅ 로그인 성공 페이지 개선
✅ 에러 핸들링
```

#### 데이터베이스
```sql
✅ users.email (TEXT, NULL 허용)
✅ users.google_id (TEXT, NULL 허용)
✅ INDEX idx_users_google_id
✅ INDEX idx_users_email
```

### ⏸️ 현재 비활성화 상태

`.dev.vars` 파일:
```bash
GOOGLE_OAUTH_ENABLED=false  ← 현재 설정
```

브라우저 콘솔 로그:
```
[OAuth] Google OAuth enabled: false
[UI] Google login button hidden (disabled)
```

---

## 2. Google Cloud Console 설정

### Step 1: 프로젝트 생성 또는 선택

1. https://console.cloud.google.com 접속
2. 상단 프로젝트 선택 드롭다운 클릭
3. **"새 프로젝트"** 클릭 또는 기존 프로젝트 선택
   - 프로젝트 이름: `Budget Lee` (원하는 이름)
   - 위치: 조직 없음 (개인용)

### Step 2: OAuth 동의 화면 설정

1. 좌측 메뉴 → **APIs & Services** → **OAuth consent screen**
2. User Type: **외부 (External)** 선택 → "만들기" 클릭

#### 앱 정보 입력
```
앱 이름: Budget Lee
사용자 지원 이메일: [본인 Gmail 주소]
앱 로고: (선택사항 - 192x192px PNG)
앱 도메인:
  - 애플리케이션 홈페이지: https://budget-lee.pages.dev
  - 개인정보처리방침: (선택사항)
  - 서비스 약관: (선택사항)
승인된 도메인:
  - budget-lee.pages.dev (선택사항)
개발자 연락처 정보: [본인 이메일]
```

3. **"저장 후 계속"** 클릭

#### 범위 (Scopes) 추가
1. **"범위 추가 또는 삭제"** 버튼 클릭
2. 다음 범위 선택:
   ```
   ✅ .../auth/userinfo.email
   ✅ .../auth/userinfo.profile
   ✅ openid
   ```
3. **"업데이트"** → **"저장 후 계속"**

#### 테스트 사용자 (선택사항)
- 개발 중에는 본인 Gmail 추가
- 프로덕션 배포 시 "앱 게시" 필요

4. **"저장 후 계속"** → **"대시보드로 돌아가기"**

### Step 3: OAuth 클라이언트 ID 생성

1. 좌측 메뉴 → **Credentials** (사용자 인증 정보)
2. 상단 **"+ CREATE CREDENTIALS"** → **"OAuth client ID"** 선택
3. 설정 입력:
   ```
   Application type: Web application
   Name: Budget Lee Web Client
   ```

#### 승인된 리디렉션 URI 추가 (중요!)
```
http://localhost:8787/api/auth/google/callback
https://budget-lee.pages.dev/api/auth/google/callback
```

⚠️ **주의사항:**
- URI는 **정확히 일치**해야 함 (슬래시, 대소문자 포함)
- 로컬 개발용과 프로덕션용 모두 추가
- 포트 번호 확인 (8787)

4. **"만들기"** 클릭

### Step 4: 인증 정보 복사

팝업 창이 나타나면:

```
클라이언트 ID: 
123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com

클라이언트 보안 비밀:
GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **이 정보를 안전하게 보관하세요!**

---

## 3. 로컬 환경 활성화

### Step 1: `.dev.vars` 파일 수정

프로젝트 루트의 `.dev.vars` 파일 열기:

```bash
cd /home/user/webapp
nano .dev.vars  # 또는 원하는 에디터
```

다음과 같이 수정:

```bash
# ========== Google OAuth Configuration ==========
# Feature Flag: Enable/Disable Google OAuth
GOOGLE_OAUTH_ENABLED=true  ← false에서 true로 변경!

# Google Cloud Console Credentials
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx

# Redirect URI
GOOGLE_REDIRECT_URI=http://localhost:8787/api/auth/google/callback

# ========== JWT Configuration ==========
JWT_SECRET=test-secret-key-change-in-production-123456789
```

### Step 2: 빌드 및 서버 재시작

```bash
# 1. 빌드
npm run build

# 2. 기존 서버 종료
pkill -f "wrangler.*8787"

# 3. 개발 서버 시작
npx wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 8787
```

### Step 3: 확인

브라우저 콘솔에서:
```
[OAuth] Google OAuth enabled: true  ✅
[UI] Google login button shown  ✅
```

로그인 모달을 열면 **"Sign in with Google"** 버튼이 보여야 합니다!

---

## 4. 프로덕션 환경 활성화

### Step 1: Cloudflare 환경 변수 설정

```bash
cd /home/user/webapp

# 1. Google OAuth 활성화
npx wrangler secret put GOOGLE_OAUTH_ENABLED
# → 입력: true

# 2. Google Client ID
npx wrangler secret put GOOGLE_CLIENT_ID
# → 입력: 123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com

# 3. Google Client Secret
npx wrangler secret put GOOGLE_CLIENT_SECRET
# → 입력: GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx

# 4. Redirect URI (프로덕션)
npx wrangler secret put GOOGLE_REDIRECT_URI
# → 입력: https://budget-lee.pages.dev/api/auth/google/callback

# 5. JWT Secret (프로덕션용으로 변경!)
npx wrangler secret put JWT_SECRET
# → 입력: [강력한 랜덤 문자열 64자 이상]
#    예: openssl rand -base64 64
```

### Step 2: 프로덕션 배포

```bash
# 1. 데이터베이스 마이그레이션 (최초 1회)
npx wrangler d1 migrations apply webapp-production --remote

# 2. 빌드
npm run build

# 3. 배포
npx wrangler pages deploy dist --project-name=budget-lee
```

### Step 3: Google Cloud Console 확인

1. Google Cloud Console → Credentials
2. 생성한 OAuth Client ID 클릭
3. **Authorized redirect URIs**에 다음이 있는지 확인:
   ```
   https://budget-lee.pages.dev/api/auth/google/callback
   ```

---

## 5. 테스트 방법

### 테스트 시나리오 1: 신규 사용자 (Google로만 가입)

1. 브라우저에서 http://localhost:8787 접속
2. 로그인 모달 열기
3. **"Sign in with Google"** 버튼 클릭
4. Google 로그인 페이지로 리다이렉트 확인
5. Gmail 계정 선택
6. 권한 승인 (email, profile 접근)
7. 앱으로 리다이렉트 확인
8. 로그인 성공 메시지 확인
9. 자동으로 홈으로 이동

**예상 결과:**
```
✅ 새 사용자 생성됨 (users 테이블)
✅ username = 이메일 앞부분 (예: john.doe)
✅ email = john.doe@gmail.com
✅ google_id = Google 계정 고유 ID
✅ password_hash = 'GOOGLE_OAUTH' (비밀번호 없음)
✅ JWT 토큰 발급됨
✅ localStorage에 auth_token 저장됨
```

### 테스트 시나리오 2: 기존 사용자 (같은 이메일)

**전제조건:** 이미 john.doe@gmail.com으로 회원가입됨

1. Google 로그인 시도
2. 같은 이메일 확인
3. 기존 계정에 Google 연동

**예상 결과:**
```
✅ 신규 계정 생성 안 함
✅ 기존 users.id 유지
✅ users.google_id 업데이트됨
✅ 로그인 성공
```

### 테스트 시나리오 3: 에러 처리

#### 사용자가 권한 거부
```
Google 로그인 페이지에서 "취소" 클릭
→ 앱으로 리다이렉트
→ "Login Failed" 페이지 표시
→ "← Back to App" 링크 제공
```

#### Google Cloud Console 미설정
```
GOOGLE_CLIENT_ID 없음
→ "Google OAuth Not Configured" 페이지
→ 설정 가이드 표시
```

#### 기능 비활성화 상태
```
GOOGLE_OAUTH_ENABLED=false
→ "Google 로그인 비활성화됨" 페이지
→ 활성화 방법 안내
```

---

## 6. 문제 해결

### 문제 1: `redirect_uri_mismatch` 에러

**증상:**
```
Error 400: redirect_uri_mismatch
The redirect URI in the request: http://localhost:8787/api/auth/google/callback
does not match the ones authorized for the OAuth client.
```

**원인:** Google Cloud Console에 등록된 URI와 실제 요청 URI 불일치

**해결:**
1. Google Cloud Console → Credentials
2. OAuth Client ID 클릭
3. **Authorized redirect URIs** 확인:
   ```
   ✅ http://localhost:8787/api/auth/google/callback (정확히 일치)
   ❌ http://localhost:3000/api/auth/google/callback (다른 포트)
   ❌ http://localhost:8787/api/auth/google (슬래시 누락)
   ```
4. 정확히 일치하도록 수정 → "저장"

### 문제 2: `invalid_client` 에러

**증상:**
```
Error 401: invalid_client
The OAuth client was not found.
```

**원인:** GOOGLE_CLIENT_ID 또는 GOOGLE_CLIENT_SECRET 틀림

**해결:**
1. Google Cloud Console → Credentials
2. OAuth Client ID 다시 확인
3. `.dev.vars` 파일에 정확히 복사했는지 확인
   - 앞뒤 공백 없음
   - 따옴표 없음
   - 전체 문자열 복사 (짤림 없음)

### 문제 3: 버튼이 안 보임

**증상:** 로그인 모달에 Google 버튼이 안 나타남

**원인:** 기능 플래그 비활성화 또는 체크 실패

**해결:**
```bash
# 1. .dev.vars 확인
cat .dev.vars | grep GOOGLE_OAUTH_ENABLED
# → GOOGLE_OAUTH_ENABLED=true 인지 확인

# 2. 서버 재시작
pkill -f "wrangler.*8787"
npx wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 8787

# 3. 브라우저 콘솔 확인
# → [OAuth] Google OAuth enabled: true 확인
```

### 문제 4: 로그인 후 토큰이 저장 안 됨

**증상:** 로그인 성공 페이지는 나타나지만 홈에서 로그아웃 상태

**원인:** localStorage 저장 실패 (시크릿 모드 등)

**해결:**
```javascript
// 브라우저 콘솔에서 확인
localStorage.getItem('auth_token')
// → null이면 저장 실패

// 시크릿 모드가 아닌지 확인
// 쿠키/저장소 차단 설정 확인
```

### 문제 5: `D1_ERROR: no such column: google_id`

**증상:**
```
Error: D1_ERROR: no such column: google_id: SQLITE_ERROR
```

**원인:** 데이터베이스 마이그레이션 0024 미실행

**해결:**
```bash
# 로컬
npx wrangler d1 migrations apply webapp-production --local

# 프로덕션
npx wrangler d1 migrations apply webapp-production --remote

# 확인
npx wrangler d1 execute webapp-production --local --command="PRAGMA table_info(users);"
# → google_id 컬럼 확인
```

---

## 7. 보안 고려사항

### 환경 변수 관리

⚠️ **절대 Git에 커밋하지 마세요:**
```bash
# .gitignore에 포함되어 있는지 확인
cat .gitignore | grep .dev.vars
# → .dev.vars 있어야 함
```

### JWT_SECRET 프로덕션 설정

❌ **나쁜 예:**
```bash
JWT_SECRET=test-secret-key-change-in-production-123456789
```

✅ **좋은 예:**
```bash
# 강력한 랜덤 키 생성
openssl rand -base64 64

# 출력 예:
# vK3n8F2mP9xQ7wR5tY6uZ1aB4cD8eF0gH2iJ3kL4mN5oP6qR7sT8uV9wX0yA1bC2dE3fG4hI5jK6lM7nO8pQ9rS0tU==

# Cloudflare에 저장
npx wrangler secret put JWT_SECRET
# → 위 랜덤 키 입력
```

### HTTPS 필수

- **로컬 개발:** `http://localhost:8787` OK
- **프로덕션:** `https://budget-lee.pages.dev` 필수
- Google OAuth는 HTTPS 아니면 작동 안 함 (localhost 제외)

---

## 8. 모니터링

### 로그 확인

**로컬 개발:**
```bash
# 서버 로그 보기
npx wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 8787

# 주요 로그 메시지:
# [OAuth] Created new user: john.doe (Google ID: 123456789)
# [OAuth] Updated Google info for user: jane.smith
# [OAuth] Login successful, redirecting...
```

**프로덕션:**
```bash
# 실시간 로그 확인
npx wrangler tail --env production

# Google OAuth 관련 로그 필터
npx wrangler tail --env production | grep OAuth
```

### 사용자 통계

```sql
-- Google OAuth 사용자 수
SELECT COUNT(*) FROM users WHERE google_id IS NOT NULL;

-- 전체 vs OAuth 사용자 비율
SELECT 
  COUNT(*) as total_users,
  SUM(CASE WHEN google_id IS NOT NULL THEN 1 ELSE 0 END) as oauth_users,
  ROUND(SUM(CASE WHEN google_id IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as oauth_percentage
FROM users;
```

---

## 9. 빠른 활성화 체크리스트

- [ ] Google Cloud Console 프로젝트 생성
- [ ] OAuth 동의 화면 설정 (외부, email/profile/openid 범위)
- [ ] OAuth Client ID 생성 (웹 애플리케이션)
- [ ] Redirect URI 추가 (로컬 + 프로덕션)
- [ ] Client ID와 Secret 복사
- [ ] `.dev.vars`에 `GOOGLE_OAUTH_ENABLED=true` 설정
- [ ] Client ID/Secret 입력
- [ ] Redirect URI 입력
- [ ] 빌드 및 서버 재시작
- [ ] 브라우저 콘솔에서 활성화 확인
- [ ] 로그인 버튼 표시 확인
- [ ] 테스트 로그인 성공 확인
- [ ] 프로덕션 환경 변수 설정 (wrangler secret)
- [ ] 프로덕션 배포
- [ ] 프로덕션 테스트

---

## 10. FAQ

### Q1: Google 로그인 없이 회원가입한 사용자도 나중에 Google 연동 가능한가요?
**A:** 네! `/api/auth/link-google` 엔드포인트가 준비되어 있습니다. 설정 페이지에서 구현 예정.

### Q2: Google 계정으로만 가입한 사용자가 비밀번호를 설정할 수 있나요?
**A:** 현재는 불가능하지만, 향후 "비밀번호 추가" 기능 구현 가능.

### Q3: 한 Google 계정으로 여러 앱 계정 연동 가능한가요?
**A:** 아니요. `google_id`가 UNIQUE이므로 1:1 매칭만 가능.

### Q4: 테스트 단계에서 사용자 수 제한이 있나요?
**A:** 네. OAuth 동의 화면이 "테스트" 상태면 100명까지만. "게시" 하면 무제한.

### Q5: Google 로그인 활성화 후 다시 비활성화하면 어떻게 되나요?
**A:** 
```bash
GOOGLE_OAUTH_ENABLED=false로 변경
→ 버튼 숨겨짐
→ 기존 OAuth 사용자는 로그인 불가 (JWT 토큰 만료 시)
→ 해결: 다시 활성화 OR 비밀번호 설정 기능 추가
```

---

**문서 작성일:** 2026-03-27  
**버전:** 2.0  
**상태:** ✅ 최종 검증 완료
