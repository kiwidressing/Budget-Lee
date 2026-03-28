# ⚡ 빠른 배포 가이드 (5분)

## 🎯 가장 쉬운 방법: Cloudflare Dashboard

### 1단계: Cloudflare 로그인
```
👉 https://dash.cloudflare.com/
```

### 2단계: Pages 프로젝트 생성
1. 왼쪽 메뉴 **"Workers & Pages"** 클릭
2. **"Create application"** 클릭
3. **"Pages"** 탭 선택
4. **"Connect to Git"** 클릭

### 3단계: GitHub 연동
1. **"Connect GitHub"** 클릭
2. Repository: **`kiwidressing/Budget-Lee`** 선택
3. **"Begin setup"** 클릭

### 4단계: 빌드 설정
```
프로젝트 이름: budget-lee
브랜치: main
빌드 명령어: npm run build
빌드 출력 디렉토리: dist
```
**"Save and Deploy"** 클릭!

### 5단계: D1 데이터베이스 설정
1. 배포 완료 후 **Settings** → **Functions** 이동
2. **D1 database bindings** 섹션에서 **"Add binding"** 클릭
3. 설정:
   - Variable name: `DB`
   - D1 database: 새로 생성 → 이름: `webapp-production`
4. **"Save"** 클릭

### 6단계: 데이터베이스 마이그레이션
터미널에서 실행 (API 토큰 필요):
```bash
# 1. API 토큰 생성
# https://dash.cloudflare.com/profile/api-tokens
# "Edit Cloudflare Workers" 템플릿 선택

# 2. 토큰 설정
export CLOUDFLARE_API_TOKEN='your-token-here'

# 3. 마이그레이션 적용
npx wrangler d1 migrations apply webapp-production --remote
```

또는 **Cloudflare Dashboard**에서:
1. **D1** → **webapp-production** → **Console**
2. 각 마이그레이션 파일의 SQL을 복사해서 실행

### 7단계: 환경 변수 설정 (선택사항)
**Settings** → **Environment variables** → **Add variables**

필수 변수:
```
JWT_SECRET=your-random-secret-key-here-min-32-chars
GOOGLE_OAUTH_ENABLED=false
```

---

## 🎉 배포 완료!

앱 URL: `https://budget-lee.pages.dev`

### 테스트 방법
1. URL 접속
2. 회원가입 (username, password 4자리, name)
3. 로그인
4. 가계부 사용 시작!

---

## 🔧 문제 발생 시

### "D1 binding not found" 오류
→ 5단계 D1 바인딩 확인

### "Database error" 발생
→ 6단계 마이그레이션 실행 확인

### "500 Internal Server Error"
→ 환경 변수 `JWT_SECRET` 설정 확인

---

**더 자세한 가이드**: `DEPLOYMENT_GUIDE.md` 참조
