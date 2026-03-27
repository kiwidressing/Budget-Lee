# 🔐 Google OAuth 상태 진단 및 해결 방안

## 📊 현재 상태 진단

### ✅ 구현 완료 (80%)

#### 1. 백엔드 API (src/index.tsx)
```typescript
✅ GET  /api/auth/google                  - Google 로그인 시작
✅ GET  /api/auth/google/callback         - Google 콜백 처리
✅ POST /api/auth/link-google             - 기존 계정 연동
✅ POST /api/auth/migrate-data            - 데이터 마이그레이션
✅ GET  /api/auth/me                      - 사용자 정보 (Google 링크 상태 포함)
```

#### 2. 데이터베이스 스키마
```sql
✅ users.email        TEXT        - Google 이메일 저장
✅ users.google_id    TEXT        - Google 계정 고유 ID
✅ INDEX idx_users_google_id      - 빠른 검색
✅ INDEX idx_users_email          - 빠른 검색
```

#### 3. 프론트엔드 UI
```javascript
✅ 로그인 모달 "Sign in with Google" 버튼
✅ 설정 페이지 Google 계정 연동 섹션
✅ 계정 링크 상태 확인 함수
✅ 데이터 마이그레이션 모달
```

### ❌ 미설정 (20%)

#### 1. Google Cloud Console
```text
❌ OAuth 2.0 클라이언트 ID 생성 안 됨
❌ Authorized redirect URIs 추가 안 됨
❌ OAuth 동의 화면 설정 안 됨
```

#### 2. 환경 변수
```bash
# .dev.vars (로컬)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com  ❌ 더미값
GOOGLE_CLIENT_SECRET=your-google-client-secret                     ❌ 더미값
GOOGLE_REDIRECT_URI=https://8787-...sandbox.novita.ai/...          ✅ 올바름

# Cloudflare (프로덕션)
❌ wrangler secret put GOOGLE_CLIENT_ID
❌ wrangler secret put GOOGLE_CLIENT_SECRET
❌ wrangler secret put GOOGLE_REDIRECT_URI
```

---

## 🎯 해결 방안 3가지 (GPT 분석 기반)

### 옵션 A: Google OAuth 완전 설정 (정석) 🔴

**작업 시간:** 10-15분  
**난이도:** 중간  
**권장 대상:** 프로덕션 배포 전, Google 로그인 필수인 경우

#### **단계별 가이드**

##### Step 1: Google Cloud Console 접속
1. https://console.cloud.google.com/apis/credentials 접속
2. 기존 프로젝트 선택 또는 "새 프로젝트" 생성
   - 프로젝트 이름: `Budget Lee` 또는 원하는 이름

##### Step 2: OAuth 동의 화면 설정
1. 좌측 메뉴 → "OAuth 동의 화면" 클릭
2. User Type: **"외부"** 선택 → "만들기"
3. 앱 정보 입력:
   ```
   앱 이름: Budget Lee
   사용자 지원 이메일: [본인 Gmail]
   앱 로고: (선택사항)
   앱 도메인:
     - 홈페이지: https://budget-lee.pages.dev
     - 개인정보처리방침: (선택사항)
     - 서비스 약관: (선택사항)
   개발자 연락처 정보: [본인 이메일]
   ```
4. **"범위 추가 또는 삭제"** 클릭:
   - `../auth/userinfo.email` 선택
   - `../auth/userinfo.profile` 선택
   - `openid` 선택
5. "저장 후 계속" → "저장 후 계속" (테스트 사용자는 건너뛰기)

##### Step 3: OAuth 클라이언트 ID 생성
1. 좌측 메뉴 → "사용자 인증 정보" 클릭
2. 상단 "+ 사용자 인증 정보 만들기" → "OAuth 클라이언트 ID" 선택
3. 애플리케이션 유형: **"웹 애플리케이션"** 선택
4. 이름: `Budget Lee Web Client`
5. **승인된 리디렉션 URI** 추가:
   ```
   http://localhost:8787/api/auth/google/callback
   https://budget-lee.pages.dev/api/auth/google/callback
   ```
   ⚠️ **중요:** URI는 정확히 일치해야 함 (슬래시, 대소문자)
6. "만들기" 클릭
7. **팝업에서 Client ID와 Client Secret 복사** (중요!)
   ```
   클라이언트 ID: 123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
   클라이언트 보안 비밀: GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
   ```

##### Step 4: 로컬 환경 변수 설정
`.dev.vars` 파일 수정:
```bash
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:8787/api/auth/google/callback
JWT_SECRET=test-secret-key-change-in-production-123456789
```

##### Step 5: 로컬 테스트
```bash
# 개발 서버 재시작
cd /home/user/webapp
pkill -f "wrangler.*8787"
npx wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 8787

# 브라우저에서 테스트
# 1. http://localhost:8787 접속
# 2. "Sign in with Google" 버튼 클릭
# 3. Google 로그인 페이지로 리다이렉트
# 4. 계정 선택 및 권한 승인
# 5. 앱으로 돌아옴 → 로그인 완료!
```

##### Step 6: 프로덕션 배포
```bash
# Cloudflare 환경 변수 설정
npx wrangler secret put GOOGLE_CLIENT_ID
# → 입력: 123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com

npx wrangler secret put GOOGLE_CLIENT_SECRET
# → 입력: GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx

npx wrangler secret put GOOGLE_REDIRECT_URI
# → 입력: https://budget-lee.pages.dev/api/auth/google/callback

# 배포
npm run build
npx wrangler pages deploy dist --project-name=budget-lee
```

**예상 결과:**
- ✅ Google 로그인 완벽 작동
- ✅ 기존 계정에 Google 연동 가능
- ✅ 데이터 마이그레이션 작동

**장점:**
- 🟢 프로덕션 준비 완료
- 🟢 사용자 편의성 극대화 (비밀번호 불필요)
- 🟢 보안 강화 (Google OAuth 2.0)

**단점:**
- 🔴 Google Cloud Console 설정 필요 (10분)
- 🔴 프로덕션 환경 변수 추가 설정

---

### 옵션 B: 현재 코드 디버깅 (빠른 수정) 🟡

**작업 시간:** 2-3분  
**난이도:** 쉬움  
**권장 대상:** 빠르게 Google 로그인 테스트만 하고 싶은 경우

#### **작업 내용**

##### 1. 환경 변수만 수정
```bash
# .dev.vars 파일에 실제 값 입력 (위 옵션 A의 Step 3-4 참조)
```

##### 2. 리다이렉트 URI 확인
```javascript
// src/index.tsx 185번 줄 확인
const redirectUri = c.env.GOOGLE_REDIRECT_URI || 'http://localhost:8787/api/auth/google/callback'

// Google Cloud Console에 이 URI가 정확히 등록되어 있는지 확인
```

##### 3. 에러 로그 확인
```bash
# 개발 서버 로그 보면서 테스트
npx wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 8787

# Google 로그인 시도 후 에러 확인
# 흔한 에러:
# - redirect_uri_mismatch → Google Console에 URI 추가
# - invalid_client → Client ID 틀림
# - access_denied → 사용자가 거부함 (정상)
```

**예상 결과:**
- ✅ 로컬에서 Google 로그인 작동
- ❌ 프로덕션은 여전히 설정 필요

**장점:**
- 🟢 빠른 테스트 가능
- 🟢 코드 수정 불필요

**단점:**
- 🔴 근본적 문제 해결 안 됨
- 🔴 프로덕션 배포 불가

---

### 옵션 C: 일단 비활성화 (현실적) 🟢 **추천!**

**작업 시간:** 1분  
**난이도:** 매우 쉬움  
**권장 대상:** 지금 당장 핵심 기능 개발에 집중하고 싶은 경우

#### **이유**

1. **현재 JWT 로그인 시스템 완벽 작동 중**
   ```bash
   ✅ POST /api/auth/register    - 회원가입
   ✅ POST /api/auth/login        - 로그인
   ✅ JWT 토큰 발급 및 검증
   ```

2. **Google OAuth는 편의 기능일 뿐**
   - 필수 기능 아님
   - 4자리 PIN 로그인도 충분히 빠름 (모바일 최적화)

3. **프로덕션 배포 후 추가 가능**
   - 사용자 피드백 수집 후 결정
   - "Google 로그인도 지원해주세요" 요청 많으면 그때 추가

#### **작업 내용**

##### 방법 1: HTML 주석 처리 (권장)
```javascript
// public/static/app.js 740번 줄 근처 찾기
// "Sign in with Google" 버튼 부분을 주석 처리

// Before:
<a href="/api/auth/google" class="flex items-center justify-center gap-3...">
  <svg><!-- Google Logo --></svg>
  <span class="text-sm font-medium text-gray-700">Sign in with Google</span>
</a>

// After:
<!--
<a href="/api/auth/google" class="flex items-center justify-center gap-3...">
  <svg><!-- Google Logo --></svg>
  <span class="text-sm font-medium text-gray-700">Sign in with Google</span>
</a>
-->
```

##### 방법 2: CSS로 숨기기 (더 간단)
```javascript
// 로그인 모달 렌더링 함수에 추가
function showLoginModal() {
  // ... 기존 코드 ...
  
  // Google 로그인 버튼 숨기기
  setTimeout(() => {
    const googleSection = document.querySelector('a[href="/api/auth/google"]')?.closest('.mt-6');
    if (googleSection) googleSection.style.display = 'none';
  }, 0);
}
```

##### 방법 3: 백엔드에서 기능 플래그
```javascript
// src/index.tsx
const GOOGLE_AUTH_ENABLED = false; // 기능 플래그

app.get('/api/auth/google', async (c) => {
  if (!GOOGLE_AUTH_ENABLED) {
    return c.json({ success: false, error: 'Google 로그인은 현재 준비 중입니다.' }, 503);
  }
  // ... 기존 코드 ...
});
```

**예상 결과:**
- ✅ Google 로그인 버튼 안 보임
- ✅ 기존 로그인 시스템 정상 작동
- ✅ 나중에 언제든지 재활성화 가능

**장점:**
- 🟢 시간 절약 (1분)
- 🟢 기존 기능 영향 없음
- 🟢 나중에 쉽게 복구 가능

**단점:**
- 🔴 Google 로그인 편의성 없음 (하지만 PIN 로그인도 충분히 빠름)

---

## 🎬 최종 권장 사항

### 🏆 **권장: 옵션 C (비활성화)** + 향후 옵션 A

**이유:**
1. **지금 당장 필요한 것**
   - ✅ 로그인 작동 (JWT 완벽함)
   - ✅ 데이터베이스 안정화 (24개 마이그레이션 완료)
   - ✅ 핵심 기능 테스트 (거래, 저축, 예산, 투자)

2. **Google OAuth가 필요한 시점**
   - 📊 사용자 100명 이상 확보 후
   - 💬 사용자 요청이 많을 때
   - 🚀 프리미엄 기능 추가 시 (다디바이스 동기화 등)

3. **현재 우선순위**
   ```
   1. 핵심 기능 안정화 ⭐⭐⭐⭐⭐
   2. 사용자 테스트 및 피드백 ⭐⭐⭐⭐
   3. 버그 수정 ⭐⭐⭐
   4. 추가 기능 (Google 로그인) ⭐⭐
   ```

### 📝 실행 계획

#### **지금 (5분 내)**
1. 옵션 C 실행: Google 로그인 버튼 숨기기
2. 기존 JWT 로그인 테스트
3. Git commit: "feat: temporarily disable Google OAuth"

#### **이번 주 (배포 전)**
1. 모든 핵심 기능 테스트
2. 데이터 백업/복원 테스트
3. 모바일 반응형 확인
4. 프로덕션 배포

#### **다음 주 (사용자 테스트)**
1. 친구/가족 초대 (5-10명)
2. 피드백 수집
3. 버그 수정
4. 사용성 개선

#### **1개월 후 (성장 단계)**
1. 사용자 피드백 분석
2. "Google 로그인" 요청 많으면 → 옵션 A 실행
3. 새 기능 우선순위 결정

---

## 🛠️ 지금 당장 실행할 명령어 (옵션 C)

```bash
cd /home/user/webapp

# 1. app.js에서 Google 로그인 버튼 숨기기 (CSS 방식)
# 아래 코드를 public/static/app.js의 showLoginModal 함수에 추가
```

```javascript
// Google 로그인 섹션 숨기기
setTimeout(() => {
  const googleSection = document.querySelector('a[href="/api/auth/google"]')?.closest('.mt-6');
  if (googleSection) googleSection.style.display = 'none';
}, 0);
```

```bash
# 2. 빌드 및 테스트
npm run build

# 3. 개발 서버 재시작
pkill -f "wrangler.*8787"
npx wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 8787

# 4. 테스트 확인
# → Google 로그인 버튼 안 보여야 함
# → 기존 로그인은 정상 작동

# 5. Git commit
git add public/static/app.js
git commit -m "feat: temporarily disable Google OAuth button

- Hide Google login section in login modal
- Focus on core features first
- Will enable after user testing and feedback"

git push origin main
```

---

## 📚 추가 자료

### Google OAuth 전체 흐름 (참고용)
```
1. 사용자: "Sign in with Google" 클릭
   ↓
2. 앱: GET /api/auth/google
   ↓
3. 앱: Google 인증 페이지로 리다이렉트
   URL: https://accounts.google.com/o/oauth2/v2/auth?client_id=...
   ↓
4. 사용자: Google 계정 선택 및 권한 승인
   ↓
5. Google: 콜백 URL로 리다이렉트 (code 포함)
   URL: http://localhost:8787/api/auth/google/callback?code=xxxxx
   ↓
6. 앱: POST https://oauth2.googleapis.com/token
   Body: { code, client_id, client_secret, grant_type }
   ↓
7. Google: access_token 반환
   ↓
8. 앱: GET https://www.googleapis.com/oauth2/v2/userinfo
   Header: Authorization: Bearer <access_token>
   ↓
9. Google: 사용자 정보 반환
   { email, name, picture, id }
   ↓
10. 앱: DB에서 google_id로 사용자 찾기 or 생성
   ↓
11. 앱: JWT 토큰 생성
   ↓
12. 앱: 프론트엔드로 리다이렉트 (?token=jwt_token)
   ↓
13. 프론트엔드: localStorage에 토큰 저장
   ↓
14. 완료: 로그인 성공!
```

### 자주 발생하는 에러 및 해결

#### Error 400: redirect_uri_mismatch
```
원인: Google Console에 등록된 redirect_uri와 실제 요청 URI 불일치
해결: Google Console → Authorized redirect URIs 확인
     http://localhost:8787/api/auth/google/callback 정확히 일치해야 함
```

#### Error 401: invalid_client
```
원인: GOOGLE_CLIENT_ID 또는 GOOGLE_CLIENT_SECRET 틀림
해결: .dev.vars 파일 확인, Google Console에서 재확인
```

#### Error 403: access_denied
```
원인: 사용자가 권한 승인 거부
해결: 정상 동작 (사용자 선택)
```

#### Error 500: D1_ERROR
```
원인: users 테이블 없음 또는 google_id 컬럼 없음
해결: npx wrangler d1 migrations apply webapp-production --local
```

---

**문서 작성일:** 2026-03-27  
**작성자:** AI Assistant  
**상태:** ✅ Google OAuth 진단 완료, 옵션 C 권장
