# 🔐 Google OAuth 설정 가이드

가계부 앱에 Google 로그인을 추가하는 방법입니다.

---

## 📋 목차

1. [Google Cloud Console 설정](#1-google-cloud-console-설정)
2. [환경 변수 설정](#2-환경-변수-설정)
3. [테스트 방법](#3-테스트-방법)
4. [프로덕션 배포](#4-프로덕션-배포)
5. [문제 해결](#5-문제-해결)

---

## 1. Google Cloud Console 설정

### 1.1 프로젝트 생성

1. **Google Cloud Console** 접속
   - URL: https://console.cloud.google.com/

2. **새 프로젝트 생성**
   - 좌측 상단 프로젝트 선택 드롭다운 클릭
   - "새 프로젝트" 클릭
   - 프로젝트 이름 입력 (예: "Budget App")
   - "만들기" 클릭

### 1.2 OAuth 2.0 클라이언트 ID 생성

1. **API 및 서비스 > 사용자 인증 정보** 이동
   - URL: https://console.cloud.google.com/apis/credentials

2. **OAuth 동의 화면 구성** (처음 한 번만)
   - "OAuth 동의 화면" 탭 클릭
   - 사용자 유형: **외부** 선택
   - "만들기" 클릭
   
   **앱 정보 입력:**
   - 앱 이름: `Budget App` (또는 원하는 이름)
   - 사용자 지원 이메일: 본인 이메일
   - 개발자 연락처 정보: 본인 이메일
   - "저장 후 계속" 클릭
   
   **범위 설정:**
   - "범위 추가 또는 삭제" 클릭
   - 다음 항목 선택:
     - `email`
     - `profile`
     - `openid`
   - "저장 후 계속" 클릭
   
   **테스트 사용자 추가:** (선택사항)
   - 테스트 단계에서는 추가한 이메일만 로그인 가능
   - 본인 이메일 추가
   - "저장 후 계속" 클릭

3. **OAuth 2.0 클라이언트 ID 만들기**
   - "사용자 인증 정보" 탭으로 돌아가기
   - 상단 "사용자 인증 정보 만들기" 클릭
   - "OAuth 2.0 클라이언트 ID" 선택
   
   **애플리케이션 유형:**
   - **웹 애플리케이션** 선택
   
   **이름:**
   - `Budget App Web Client` (또는 원하는 이름)
   
   **승인된 자바스크립트 원본:** (선택사항)
   - 로컬 개발: `http://localhost:8787`
   - 샌드박스: `https://8787-icnvuia0t8mlzu9gxid5n-cbeee0f9.sandbox.novita.ai`
   
   **승인된 리디렉션 URI:** (중요!)
   - 로컬 개발:
     ```
     http://localhost:8787/api/auth/google/callback
     ```
   - 샌드박스 테스트:
     ```
     https://8787-icnvuia0t8mlzu9gxid5n-cbeee0f9.sandbox.novita.ai/api/auth/google/callback
     ```
   - 프로덕션 (Cloudflare Pages):
     ```
     https://your-app.pages.dev/api/auth/google/callback
     ```
   
   - "만들기" 클릭

4. **클라이언트 ID와 비밀번호 복사**
   - 생성된 OAuth 클라이언트 팝업에서:
     - **클라이언트 ID**: `xxxxx.apps.googleusercontent.com`
     - **클라이언트 보안 비밀**: `GOCSPX-xxxxx`
   - 두 값을 안전하게 복사해두세요!

---

## 2. 환경 변수 설정

### 2.1 로컬 개발 환경 (.dev.vars)

프로젝트 루트의 `.dev.vars` 파일을 다음과 같이 수정:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-client-secret
GOOGLE_REDIRECT_URI=https://8787-icnvuia0t8mlzu9gxid5n-cbeee0f9.sandbox.novita.ai/api/auth/google/callback

# JWT Secret for token signing
JWT_SECRET=your-secure-random-secret-key-here
```

> **중요**: 
> - `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`를 실제 값으로 교체하세요
> - `JWT_SECRET`은 안전한 랜덤 문자열로 변경하세요 (최소 32자 이상 권장)

### 2.2 Cloudflare Pages 프로덕션 환경

Cloudflare Dashboard에서 환경 변수 설정:

1. Cloudflare Pages 프로젝트 페이지 이동
2. "Settings" → "Environment variables" 클릭
3. 다음 변수 추가:

| 변수명 | 값 | 환경 |
|--------|-----|------|
| `GOOGLE_CLIENT_ID` | `xxxxx.apps.googleusercontent.com` | Production & Preview |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxxx` | Production & Preview |
| `GOOGLE_REDIRECT_URI` | `https://your-app.pages.dev/api/auth/google/callback` | Production |
| `JWT_SECRET` | `your-random-secret` | Production & Preview |

---

## 3. 테스트 방법

### 3.1 로컬 서버 시작

```bash
cd /home/user/webapp

# 빌드
npm run build

# 로컬 서버 시작
npm run dev:sandbox
```

서버 URL: **https://8787-icnvuia0t8mlzu9gxid5n-cbeee0f9.sandbox.novita.ai**

### 3.2 테스트 시나리오

#### ✅ 시나리오 1: 로그인 전 (Guest Mode)
1. 앱 접속
2. 우측 상단에 **"Sign in with Google"** 버튼 확인
3. 데이터는 localStorage에 저장됨 (로컬 전용)

#### ✅ 시나리오 2: Google 로그인
1. **"Sign in with Google"** 버튼 클릭
2. Google 로그인 페이지로 리디렉션
3. Google 계정으로 로그인
4. 권한 요청 화면에서 "허용" 클릭
5. 앱으로 자동 리디렉션
6. 우측 상단에 사용자 정보 표시 확인:
   - 이름
   - 이메일 주소
   - Logout 버튼

#### ✅ 시나리오 3: 로그인 상태 유지
1. 페이지 새로고침
2. 로그인 상태가 유지되는지 확인
3. 브라우저 개발자 도구 → Application → Local Storage 확인:
   - `auth_token`: JWT 토큰
   - `user_email`: 이메일
   - `user_name`: 이름

#### ✅ 시나리오 4: 로그아웃
1. 우측 상단 **"Logout"** 버튼 클릭
2. 페이지 새로고침
3. **"Sign in with Google"** 버튼으로 돌아오는지 확인
4. Local Storage에서 토큰 삭제 확인

#### ✅ 시나리오 5: API 인증 테스트
```javascript
// 브라우저 콘솔에서 테스트
// 로그인 후 실행:
axios.get('/api/auth/me')
  .then(res => console.log('Current user:', res.data))
  .catch(err => console.error('Error:', err));

// 예상 결과:
// {
//   "success": true,
//   "user": {
//     "id": 123,
//     "username": "john",
//     "email": "john@gmail.com",
//     "name": "John Doe",
//     "isGuest": false
//   }
// }
```

---

## 4. 프로덕션 배포

### 4.1 Google OAuth 설정 업데이트

Google Cloud Console에서 **승인된 리디렉션 URI**에 프로덕션 URL 추가:
```
https://your-app.pages.dev/api/auth/google/callback
```

### 4.2 Cloudflare Pages 환경 변수 설정

Cloudflare Dashboard에서:
1. `GOOGLE_REDIRECT_URI` 값을 프로덕션 URL로 변경
2. 모든 환경 변수가 올바른지 확인

### 4.3 배포

```bash
npm run deploy:prod
```

### 4.4 프로덕션 테스트

1. 배포된 URL 접속: `https://your-app.pages.dev`
2. Google 로그인 테스트
3. 로그아웃 테스트
4. 새로고침 시 세션 유지 확인

---

## 5. 문제 해결

### ❌ 문제 1: "Redirect URI mismatch" 오류

**원인**: Google Cloud Console의 리디렉션 URI와 실제 요청 URI가 불일치

**해결**:
1. Google Cloud Console → OAuth 클라이언트 편집
2. **승인된 리디렉션 URI**에 정확한 URL 추가:
   ```
   https://8787-icnvuia0t8mlzu9gxid5n-cbeee0f9.sandbox.novita.ai/api/auth/google/callback
   ```
3. 저장 후 몇 분 대기 (반영 시간)

---

### ❌ 문제 2: "OAuth not configured" 페이지

**원인**: 환경 변수가 설정되지 않음

**해결**:
1. `.dev.vars` 파일 확인:
   ```bash
   cat .dev.vars
   ```
2. `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`이 설정되어 있는지 확인
3. 서버 재시작:
   ```bash
   # 서버 종료
   pkill -f wrangler
   
   # 서버 재시작
   npm run dev:sandbox
   ```

---

### ❌ 문제 3: "Failed to exchange token" 오류

**원인**: Client Secret이 잘못되었거나 만료됨

**해결**:
1. Google Cloud Console에서 Client Secret 재생성
2. `.dev.vars` 파일 업데이트
3. 서버 재시작

---

### ❌ 문제 4: 로그인 후 데이터가 사라짐

**원인**: 사용자 ID가 변경되어 다른 데이터 세트 조회

**설명**:
- Guest 모드 (로그인 전): 세션 ID 기반 user_id
- 로그인 후: 실제 사용자 DB user_id

**해결 (선택사항)**:
로그인 시 게스트 데이터를 실제 계정으로 마이그레이션하는 기능 추가 가능

---

### ❌ 문제 5: 로그인 버튼이 보이지 않음

**원인**: JavaScript 로딩 오류 또는 HTML 구조 문제

**해결**:
1. 브라우저 콘솔(F12) 확인
2. 에러 메시지 확인
3. 캐시 삭제 후 새로고침 (Ctrl+Shift+R)
4. 서버 재빌드:
   ```bash
   npm run build
   npm run dev:sandbox
   ```

---

## 6. 보안 고려사항

### 🔒 JWT Secret 보안

- **절대 공개하지 마세요!**
- 프로덕션 환경에서는 강력한 랜덤 문자열 사용
- 정기적으로 변경 (권장: 3개월마다)

### 🔒 Client Secret 보안

- Git에 커밋하지 마세요 (`.dev.vars`는 `.gitignore`에 추가)
- 팀원과 안전한 방법으로 공유 (예: 1Password, LastPass)

### 🔒 환경 변수 관리

```bash
# .gitignore에 추가 (이미 추가되어 있음)
.dev.vars
.env
*.local
```

---

## 7. 추가 기능 (선택사항)

### 7.1 프로필 이미지 추가

Google OAuth는 사용자 프로필 이미지도 제공합니다:

```javascript
// src/index.tsx의 Google OAuth callback에서
const googleUser = await userInfoResponse.json() as any;

// picture 필드 추가
const profilePicture = googleUser.picture;

// DB 저장
await DB.prepare(`
  INSERT INTO users (username, email, name, profile_picture, password_hash)
  VALUES (?, ?, ?, ?, ?)
`).bind(
  googleUser.email.split('@')[0],
  googleUser.email,
  googleUser.name || 'Google User',
  profilePicture,  // 추가
  'GOOGLE_OAUTH'
).run()
```

### 7.2 다른 OAuth 제공자 추가

같은 방식으로 다른 OAuth 제공자 추가 가능:
- Facebook Login
- GitHub Login
- Apple Sign In
- Microsoft Account

---

## 8. 참고 자료

- [Google OAuth 2.0 공식 문서](https://developers.google.com/identity/protocols/oauth2)
- [Cloudflare Workers JWT](https://developers.cloudflare.com/workers/examples/signing-requests/)
- [Hono Authentication](https://hono.dev/docs/middleware/builtin/jwt)

---

## 9. 현재 구현 상태

✅ **완료된 기능:**
- Google OAuth 로그인 플로우
- JWT 토큰 발급 및 검증
- 사용자 정보 DB 저장
- 프론트엔드 로그인 상태 관리
- 로그아웃 기능
- 세션 유지 (localStorage)
- Guest 모드 지원

🚧 **추후 추가 가능한 기능:**
- 프로필 이미지 표시
- Guest 데이터 → 로그인 계정 마이그레이션
- 소셜 로그인 통합 (Facebook, GitHub 등)
- 이메일 인증
- 비밀번호 찾기

---

## 💡 요약

1. **Google Cloud Console**에서 OAuth 클라이언트 생성
2. **Client ID와 Secret**을 `.dev.vars`에 추가
3. **리디렉션 URI**를 정확히 설정
4. 서버 재시작 후 **테스트**
5. 문제 발생 시 **문제 해결** 섹션 참고

---

**작성일**: 2025-11-05  
**버전**: 1.0  
**테스트 환경**: Cloudflare Workers Local (wrangler pages dev)

---

## 🎉 Google OAuth 추가 완료!

이제 사용자가 Google 계정으로 간편하게 로그인할 수 있습니다!

**테스트 서버 URL**: https://8787-icnvuia0t8mlzu9gxid5n-cbeee0f9.sandbox.novita.ai

궁금한 점이 있으시면 언제든지 문의하세요! 😊
