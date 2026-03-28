# 🎯 Cloudflare Pages 배포 - 비주얼 가이드

## 📍 어디서 찾나요?

### 1단계: Cloudflare Dashboard 접속
```
🌐 https://dash.cloudflare.com/
```

로그인 후 화면에서 **왼쪽 사이드바**를 보세요!

---

## 🔍 "Workers & Pages" 찾기

### 왼쪽 사이드바 메뉴:
```
┌─────────────────────────┐
│ ⌂ Home                  │
│ 🌐 Websites             │
│ 📧 Email                │
│ ⚡ Workers & Pages   ← 여기! │
│ 🔐 Zero Trust           │
│ 📊 Analytics            │
│ ...                     │
└─────────────────────────┘
```

**"Workers & Pages"** 를 클릭하세요!

---

## 🎨 "Create application" 버튼 찾기

"Workers & Pages" 페이지로 들어가면:

```
┌──────────────────────────────────────────────┐
│  Workers & Pages                              │
│                                               │
│  [ + Create application ]  ← 이 버튼 클릭!     │
│                                               │
│  또는                                          │
│                                               │
│  [ Create ]  ← 이것도 같은 버튼입니다           │
│                                               │
└──────────────────────────────────────────────┘
```

---

## 📑 "Pages" 탭 선택

버튼을 클릭하면 두 개의 탭이 나타납니다:

```
┌─────────────────────────────────┐
│  [ Workers ]  [ Pages ]         │
│              ↑                   │
│         Pages 탭 클릭!           │
└─────────────────────────────────┘
```

---

## 🔗 "Connect to Git" 옵션 선택

Pages 탭 안에 두 가지 옵션이 있습니다:

```
┌──────────────────────────────────────┐
│  Pages 탭                             │
│                                       │
│  1. [ Connect to Git ]  ← 이거 선택!  │
│     - GitHub 연동                     │
│     - GitLab 연동                     │
│                                       │
│  2. [ Upload assets ]                │
│     - 파일 직접 업로드                 │
│                                       │
└──────────────────────────────────────┘
```

**"Connect to Git"** 을 선택하세요!

---

## 🐙 GitHub 계정 연결

### 첫 번째 사용 시:
```
┌──────────────────────────────────┐
│  Connect GitHub                  │
│                                  │
│  [ Connect GitHub account ]      │
│                                  │
│  GitHub에서 권한 승인 팝업 나타남  │
└──────────────────────────────────┘
```

### 이미 연결된 경우:
```
┌──────────────────────────────────┐
│  Select a repository             │
│                                  │
│  kiwidressing/Budget-Lee  ✓      │
│                                  │
│  [ Begin setup ]                 │
└──────────────────────────────────┘
```

**"kiwidressing/Budget-Lee"** 를 선택하고 **"Begin setup"** 클릭!

---

## ⚙️ 빌드 설정 화면

이제 이런 화면이 나옵니다:

```
┌────────────────────────────────────────────┐
│  Set up build and deployments              │
│                                            │
│  Project name                              │
│  ┌──────────────────────────────────────┐ │
│  │ budget-lee                           │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  Production branch                         │
│  ┌──────────────────────────────────────┐ │
│  │ main                                 │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  Build command                             │
│  ┌──────────────────────────────────────┐ │
│  │ npm run build                        │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  Build output directory                    │
│  ┌──────────────────────────────────────┐ │
│  │ dist                                 │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  [ Save and Deploy ]                       │
└────────────────────────────────────────────┘
```

### 입력할 내용:
- **Project name**: `budget-lee` (자동 입력됨)
- **Production branch**: `main` (자동 선택됨)
- **Build command**: `npm run build`
- **Build output directory**: `dist`

**"Save and Deploy"** 클릭!

---

## ⏳ 배포 진행 중

```
┌────────────────────────────────┐
│  🔄 Building...                │
│                                │
│  ✓ Cloning repository          │
│  ✓ Installing dependencies     │
│  🔄 Building project           │
│  ⏳ Deploying to Cloudflare    │
│                                │
│  (약 2-3분 소요)                │
└────────────────────────────────┘
```

---

## 🎉 배포 완료!

성공하면 이런 화면이 나타납니다:

```
┌────────────────────────────────────────┐
│  ✅ Success! Your site is live        │
│                                        │
│  https://budget-lee.pages.dev          │
│                                        │
│  [ Continue to project ]               │
└────────────────────────────────────────┘
```

**하지만 아직 끝이 아닙니다!** 

⚠️ **중요: 데이터베이스 설정이 필요합니다!**

---

## 🗄️ D1 데이터베이스 바인딩 (필수!)

### 1. 프로젝트 설정으로 이동
```
budget-lee 프로젝트 → Settings 탭
```

### 2. Functions 섹션 찾기
```
Settings 페이지에서 스크롤하면:

┌────────────────────────────┐
│ Functions                  │
│                            │
│ D1 database bindings       │
│ [ Add binding ]            │
└────────────────────────────┘
```

### 3. D1 바인딩 추가
**"Add binding"** 클릭하면:

```
┌──────────────────────────────────┐
│  Add D1 database binding         │
│                                  │
│  Variable name                   │
│  ┌────────────────────────────┐ │
│  │ DB                         │ │
│  └────────────────────────────┘ │
│                                  │
│  D1 database                     │
│  ┌────────────────────────────┐ │
│  │ [Create new database]      │ │
│  └────────────────────────────┘ │
│                                  │
│  [ Save ]                        │
└──────────────────────────────────┘
```

**입력할 내용:**
- **Variable name**: `DB` (정확히 대문자!)
- **D1 database**: "Create new database" 선택
  - Database name: `webapp-production`

**"Save"** 클릭!

---

## 🔐 환경 변수 설정 (필수!)

### 1. Settings → Environment variables

```
Settings 페이지에서:

┌────────────────────────────┐
│ Environment variables      │
│                            │
│ Production (default)       │
│ [ Add variables ]          │
└────────────────────────────┘
```

### 2. 변수 추가
**"Add variables"** 클릭:

```
┌──────────────────────────────────┐
│  Variable name                   │
│  ┌────────────────────────────┐ │
│  │ JWT_SECRET                 │ │
│  └────────────────────────────┘ │
│                                  │
│  Value                           │
│  ┌────────────────────────────┐ │
│  │ (32자 이상 랜덤 문자열)     │ │
│  └────────────────────────────┘ │
│                                  │
│  [ Add variable ]                │
└──────────────────────────────────┘
```

**필수 환경 변수:**
1. **JWT_SECRET**: 강력한 랜덤 문자열 (최소 32자)
2. **GOOGLE_OAUTH_ENABLED**: `false`

**JWT_SECRET 생성 방법:**
```bash
# 터미널에서 실행
openssl rand -base64 32
# 또는
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 📊 데이터베이스 마이그레이션 (필수!)

### 방법 1: Cloudflare Dashboard
1. **D1** (왼쪽 사이드바) 클릭
2. **webapp-production** 데이터베이스 선택
3. **Console** 탭 클릭
4. GitHub에서 각 마이그레이션 파일 내용 복사:
   ```
   https://github.com/kiwidressing/Budget-Lee/tree/main/migrations
   ```
5. SQL 콘솔에 붙여넣고 실행
6. 24개 파일 모두 순서대로 실행 (0001 → 0024)

### 방법 2: Wrangler CLI (API 토큰 필요)
```bash
export CLOUDFLARE_API_TOKEN='your-token'
npx wrangler d1 migrations apply webapp-production --remote
```

---

## ✅ 배포 완료 확인

### 앱 접속 테스트
```
https://budget-lee.pages.dev
```

### 확인 사항:
- ✅ 로그인 화면 나타남
- ✅ 회원가입 가능
- ✅ 로그인 성공
- ✅ 가계부 기능 작동

---

## 🔧 문제 해결

### "D1 binding not found" 오류
→ D1 데이터베이스 바인딩 확인 (Variable name: `DB`)

### "Database error" 발생
→ 마이그레이션 24개 모두 실행 확인

### "500 Internal Server Error"
→ 환경 변수 `JWT_SECRET` 설정 확인

### 빌드 실패
→ Build command: `npm run build`, Output: `dist` 확인

---

## 📱 모바일에서도 테스트하세요!

앱은 PWA(Progressive Web App)로 제작되어 모바일에서도 완벽하게 작동합니다!

---

## 🎊 축하합니다!

이제 앱이 전 세계에 배포되었습니다! 🌍

**최종 URL**: https://budget-lee.pages.dev

친구들에게 공유하세요! 😊

---

**문제가 있으신가요?**
- 스크린샷을 찍어서 보여주세요
- 어떤 단계에서 막혔는지 알려주세요
- 함께 해결하겠습니다! 💪
