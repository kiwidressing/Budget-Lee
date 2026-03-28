# 🚀 Budget-Lee 배포 가이드

## 📋 배포 준비 체크리스트

- ✅ 코드 최적화 완료
- ✅ 빌드 완료 (`dist/` 폴더 생성됨)
- ✅ DB 마이그레이션 24개 준비됨
- ✅ GitHub 푸시 완료 (commit: 3dbac6b)
- ⏳ Cloudflare 인증 필요

---

## 🔐 방법 1: Cloudflare Dashboard 수동 배포 (권장)

### 단계별 가이드

#### 1. Cloudflare 계정 로그인
```
https://dash.cloudflare.com/
```

#### 2. Pages 프로젝트 생성
1. 왼쪽 메뉴에서 **"Workers & Pages"** 선택
2. **"Create application"** 클릭
3. **"Pages"** 탭 선택
4. **"Connect to Git"** 선택

#### 3. GitHub 연동
1. **"Connect GitHub"** 클릭
2. Repository 선택: `kiwidressing/Budget-Lee`
3. 권한 승인

#### 4. 빌드 설정
```
Project name: budget-lee
Branch: main
Build command: npm run build
Build output directory: dist
Root directory: /
```

#### 5. 환경 변수 설정 (중요!)
```
프로덕션 환경 변수:
- JWT_SECRET: (강력한 랜덤 문자열, 예: openssl rand -base64 32)
- GOOGLE_OAUTH_ENABLED: false (나중에 true로 변경)
- GOOGLE_CLIENT_ID: (Google Cloud Console에서 발급)
- GOOGLE_CLIENT_SECRET: (Google Cloud Console에서 발급)
- GOOGLE_REDIRECT_URI: https://your-app.pages.dev/api/auth/google/callback
```

#### 6. D1 데이터베이스 바인딩
1. Settings → Functions → D1 Database Bindings
2. **"Add binding"** 클릭
3. Variable name: `DB`
4. D1 database: `webapp-production` 선택

#### 7. 배포 및 마이그레이션
```bash
# 원격 DB 마이그레이션 적용
npx wrangler d1 migrations apply webapp-production --remote

# 또는 Cloudflare Dashboard에서:
# D1 Database → webapp-production → Console → SQL 실행
```

---

## 🔧 방법 2: Wrangler CLI 배포 (API 토큰 필요)

### 2-1. Cloudflare API 토큰 생성

1. **토큰 생성 페이지**
   ```
   https://dash.cloudflare.com/profile/api-tokens
   ```

2. **"Create Token"** 클릭

3. **템플릿 선택: "Edit Cloudflare Workers"**

4. **권한 설정 확인:**
   ```
   Account - Cloudflare Pages: Edit
   Account - D1: Edit
   Zone - Workers Routes: Edit
   ```

5. **토큰 복사** (한 번만 표시됨!)

### 2-2. 로컬에서 배포

```bash
# 1. 환경 변수 설정
export CLOUDFLARE_API_TOKEN='your-api-token-here'

# 2. 인증 확인
npx wrangler whoami

# 3. D1 데이터베이스 마이그레이션 (원격)
npx wrangler d1 migrations apply webapp-production --remote

# 4. Pages 배포
npx wrangler pages deploy dist --project-name=budget-lee

# 5. 환경 변수 설정 (프로덕션)
npx wrangler secret put JWT_SECRET --env production
# 프롬프트에서 강력한 JWT secret 입력

npx wrangler secret put GOOGLE_OAUTH_ENABLED --env production
# 입력: false

# 6. D1 바인딩 (wrangler.jsonc에 이미 설정됨)
# binding: DB → database: webapp-production
```

---

## 🗄️ 데이터베이스 마이그레이션 상세

### 로컬 마이그레이션 (이미 완료)
```bash
npx wrangler d1 migrations apply webapp-production --local
# ✅ 24개 마이그레이션 적용 완료
```

### 원격 마이그레이션 (배포 시 필요)
```bash
npx wrangler d1 migrations apply webapp-production --remote
```

### 마이그레이션 파일 목록
```
migrations/
├── 0001_initial_schema.sql
├── 0002_add_settings.sql
├── 0003_add_fixed_expenses.sql
├── 0004_add_budgets.sql
├── 0005_add_monthly_summary.sql
├── 0006_add_investments.sql
├── 0007_add_receipts.sql
├── 0008_add_debts.sql
├── 0009_add_accounts.sql
├── 0010_add_transfers.sql
├── 0011_add_savings_accounts.sql
├── 0012_add_users_table.sql          ← 중요!
├── 0013_add_sessions.sql
├── 0014_update_settings_for_multi_user.sql
├── 0015_add_monthly_summary.sql
├── 0016_add_pbkdf2_support.sql
├── 0017_upgrade_sessions_table.sql
├── 0018_add_accounts_and_transfers.sql
├── 0019_remove_settings_check_constraint.sql
├── 0020_add_r2_receipts_support.sql
├── 0021_fix_receipts_schema.sql
├── 0022_make_image_columns_nullable.sql
├── 0023_add_debts_table.sql
└── 0024_add_google_oauth_columns.sql  ← Google OAuth 지원
```

---

## 🌐 방법 3: GitHub Actions 자동 배포 (선택사항)

### .github/workflows/deploy.yml 생성

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=budget-lee
```

### GitHub Secrets 설정
1. Repository → Settings → Secrets and variables → Actions
2. **New repository secret** 클릭
3. 추가할 시크릿:
   - `CLOUDFLARE_API_TOKEN`: Cloudflare API 토큰
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 계정 ID

---

## 📊 배포 후 확인 사항

### 1. 앱 접속 테스트
```
https://budget-lee.pages.dev
또는
https://your-custom-domain.com
```

### 2. API 엔드포인트 확인
```bash
# 1. 헬스 체크
curl https://budget-lee.pages.dev/api/auth/me

# 2. 로그인 테스트 (테스트 계정 생성 후)
curl -X POST https://budget-lee.pages.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"1234","name":"테스트유저"}'

curl -X POST https://budget-lee.pages.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"1234"}'
```

### 3. 데이터베이스 확인
```bash
# Cloudflare Dashboard
D1 Database → webapp-production → Console

# SQL 쿼리 실행
SELECT COUNT(*) FROM users;
SELECT * FROM d1_migrations;
```

### 4. 로그 모니터링
```
Cloudflare Dashboard → Pages → budget-lee → Deployments → View logs
```

---

## 🔧 환경 변수 설정 가이드

### 프로덕션 환경 변수 (필수)

#### JWT_SECRET
```bash
# 강력한 랜덤 문자열 생성
openssl rand -base64 32
# 또는
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 설정
npx wrangler secret put JWT_SECRET
```

#### GOOGLE_OAUTH_ENABLED
```bash
# 처음에는 false로 설정 (나중에 활성화)
npx wrangler secret put GOOGLE_OAUTH_ENABLED
# 입력: false
```

### Google OAuth 환경 변수 (선택사항)

#### 1. Google Cloud Console 설정
```
https://console.cloud.google.com/apis/credentials
```

1. 프로젝트 생성 또는 선택
2. **"OAuth 2.0 Client IDs"** → **"Create credentials"**
3. Application type: **Web application**
4. Authorized redirect URIs:
   ```
   https://budget-lee.pages.dev/api/auth/google/callback
   https://your-custom-domain.com/api/auth/google/callback
   ```

#### 2. Cloudflare Secrets 설정
```bash
npx wrangler secret put GOOGLE_CLIENT_ID
# 입력: your-client-id.apps.googleusercontent.com

npx wrangler secret put GOOGLE_CLIENT_SECRET
# 입력: your-client-secret

npx wrangler secret put GOOGLE_REDIRECT_URI
# 입력: https://budget-lee.pages.dev/api/auth/google/callback
```

---

## 🎯 커스텀 도메인 설정 (선택사항)

### Cloudflare Dashboard에서 설정

1. Pages 프로젝트 선택
2. **Custom domains** 탭
3. **"Set up a custom domain"** 클릭
4. 도메인 입력 (예: `budget.your-domain.com`)
5. DNS 레코드 자동 생성 (Cloudflare에서 관리하는 도메인인 경우)

### DNS 수동 설정 (다른 DNS 제공업체)
```
Type: CNAME
Name: budget (또는 원하는 서브도메인)
Value: budget-lee.pages.dev
TTL: Auto
```

---

## 🔍 문제 해결

### 배포 실패 시

#### 1. 빌드 오류
```bash
# 로컬에서 빌드 테스트
npm run build

# 빌드 로그 확인
cat dist/_worker.js | wc -l
# 출력: 3200+ 줄이어야 함
```

#### 2. 데이터베이스 연결 오류
```bash
# D1 바인딩 확인
npx wrangler d1 info webapp-production

# 마이그레이션 상태 확인
npx wrangler d1 execute webapp-production --remote \
  --command="SELECT * FROM d1_migrations ORDER BY id DESC LIMIT 5;"
```

#### 3. 환경 변수 누락
```
Cloudflare Dashboard → Pages → budget-lee → Settings → Environment variables

확인 항목:
- Production 환경에 모든 변수 설정됨
- Preview 환경에도 동일하게 설정 (선택사항)
```

#### 4. OAuth 리다이렉트 오류
```
Google Cloud Console → Credentials → OAuth 2.0 Client IDs

Authorized redirect URIs 확인:
- https://budget-lee.pages.dev/api/auth/google/callback
- http://localhost:8787/api/auth/google/callback (개발용)
```

---

## 📈 배포 후 모니터링

### Cloudflare Analytics
```
Dashboard → Pages → budget-lee → Analytics

확인 항목:
- 요청 수
- 대역폭 사용량
- 응답 시간
- 오류율
```

### 로그 확인
```bash
# 실시간 로그 (로컬)
npx wrangler tail

# 프로덕션 로그
Cloudflare Dashboard → Workers & Pages → budget-lee → Logs
```

---

## ✅ 배포 체크리스트

### 배포 전
- [ ] 코드 테스트 완료 (로컬)
- [ ] `npm run build` 성공
- [ ] Git 커밋 및 푸시
- [ ] Cloudflare 계정 준비
- [ ] API 토큰 발급 (CLI 배포 시)

### 배포 중
- [ ] D1 데이터베이스 마이그레이션 적용
- [ ] Pages 프로젝트 생성
- [ ] 환경 변수 설정
- [ ] D1 바인딩 설정
- [ ] 배포 성공 확인

### 배포 후
- [ ] 앱 접속 테스트
- [ ] 회원가입/로그인 테스트
- [ ] 가계부 기능 테스트
- [ ] 다국어 전환 테스트
- [ ] 모바일 반응형 테스트
- [ ] (선택) 커스텀 도메인 설정
- [ ] (선택) Google OAuth 활성화

---

## 🎉 배포 완료 후

### 예상 URL
```
메인: https://budget-lee.pages.dev
(또는 커스텀 도메인: https://budget.your-domain.com)
```

### 공유 가능한 링크
```
앱: https://budget-lee.pages.dev
GitHub: https://github.com/kiwidressing/Budget-Lee
문서: https://github.com/kiwidressing/Budget-Lee/blob/main/README.md
```

---

## 📞 지원

### 문서
- Cloudflare Pages: https://developers.cloudflare.com/pages/
- D1 Database: https://developers.cloudflare.com/d1/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/

### 커뮤니티
- Cloudflare Discord: https://discord.gg/cloudflaredev
- GitHub Issues: https://github.com/kiwidressing/Budget-Lee/issues

---

**배포 가이드 작성일**: 2026-03-28  
**최종 커밋**: 3dbac6b  
**상태**: 배포 준비 완료 ✅
