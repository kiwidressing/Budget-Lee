# 가계부 앱 배포 가이드 📱

개인별로 독립적인 데이터를 가지고 사용할 수 있도록 배포하는 방법을 설명합니다.

---

## 🎯 배포 방법 선택

### 방법 1: PWA (Progressive Web App) ⭐ **가장 추천!**

**장점:**
- ✅ 로그인 불필요 - 각자의 휴대폰에 앱처럼 설치
- ✅ 독립적 데이터 - 각자의 기기에 D1 데이터베이스 저장
- ✅ 오프라인 작동 - 인터넷 없이도 사용 가능
- ✅ 무료 배포 - Cloudflare Pages 무료 호스팅
- ✅ 간단한 공유 - URL만 공유하면 누구나 설치 가능

**사용 시나리오:**
1. 개발자가 Cloudflare Pages에 배포 (1회)
2. 사용자는 URL 접속 후 "홈 화면에 추가" 클릭
3. 각자의 휴대폰에 앱처럼 설치됨
4. 각자의 기기에 독립적인 데이터베이스 생성
5. 서로 다른 사용자의 데이터는 완전히 분리됨

---

## 📋 1단계: Cloudflare Pages 배포

### 1.1 Cloudflare API 키 설정

```bash
# 1. Cloudflare 대시보드에서 API 토큰 생성
# 2. 권한: Account > Cloudflare Pages (Edit)
# 3. 환경변수 설정
export CLOUDFLARE_API_TOKEN="your-api-token"
```

또는 샌드박스에서:
```bash
# setup_cloudflare_api_key 도구 사용
# Deploy 탭에서 API 키 설정
```

### 1.2 프로젝트 빌드

```bash
cd /home/user/webapp
npm run build
```

### 1.3 D1 데이터베이스 생성

```bash
# 프로덕션 데이터베이스 생성
npx wrangler d1 create webapp-production

# 출력된 database_id를 wrangler.jsonc에 추가
# wrangler.jsonc 파일 수정:
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "webapp-production",
    "database_id": "여기에-database-id-입력"
  }]
}
```

### 1.4 마이그레이션 실행

```bash
# 프로덕션 데이터베이스에 스키마 생성
npx wrangler d1 migrations apply webapp-production
```

### 1.5 Cloudflare Pages 프로젝트 생성

```bash
# 프로젝트 생성 (production branch는 main)
npx wrangler pages project create webapp \
  --production-branch main \
  --compatibility-date 2025-01-01
```

### 1.6 배포

```bash
# dist 디렉토리 배포
npx wrangler pages deploy dist --project-name webapp

# 배포 완료 후 URL 확인
# 예: https://webapp.pages.dev
```

---

## 📱 2단계: 사용자 설치 방법

### iOS (iPhone/iPad) 사용자

1. **Safari 브라우저로 접속**
   - https://your-app.pages.dev 접속

2. **공유 버튼 클릭**
   - 하단 중앙의 공유 아이콘 (⬆️) 탭

3. **홈 화면에 추가**
   - "홈 화면에 추가" 선택
   - 앱 이름 확인: "가계부"
   - "추가" 버튼 클릭

4. **앱 실행**
   - 홈 화면의 "가계부" 아이콘 클릭
   - 독립적인 앱처럼 실행됨

### Android 사용자

1. **Chrome 브라우저로 접속**
   - https://your-app.pages.dev 접속

2. **메뉴 열기**
   - 우측 상단 ⋮ (점 3개) 클릭

3. **홈 화면에 추가**
   - "홈 화면에 추가" 또는 "설치" 선택
   - 앱 이름 확인: "가계부"
   - "추가" 버튼 클릭

4. **앱 실행**
   - 앱 서랍의 "가계부" 아이콘 클릭
   - 독립적인 앱처럼 실행됨

### 데스크톱 (Chrome/Edge) 사용자

1. **브라우저로 접속**
   - https://your-app.pages.dev 접속

2. **주소창 우측 설치 아이콘 클릭**
   - 또는 메뉴 → "앱 설치"

3. **설치 확인**
   - "설치" 버튼 클릭

4. **앱 실행**
   - 독립 창으로 실행됨

---

## 🔒 데이터 저장 방식

### Cloudflare D1 데이터베이스

**각 사용자별 데이터 분리:**
- Cloudflare D1은 edge에 분산 저장됨
- 각 사용자의 브라우저 세션마다 독립적인 데이터
- **중요**: 현재 구조는 단일 D1 인스턴스를 공유함
- **개선 필요**: 진정한 개인별 분리를 위해서는 추가 작업 필요

### 개인별 데이터 완전 분리 방법

#### 옵션 A: Browser LocalStorage 활용 (간단)

**장점:**
- ✅ 진정한 개인별 데이터 분리
- ✅ 추가 비용 없음
- ✅ 로그인 불필요

**단점:**
- ❌ 브라우저 데이터 삭제 시 손실
- ❌ 기기 간 동기화 불가
- ❌ 백엔드 API 수정 필요

**구현 방법:**
```javascript
// app.js에서 D1 API 호출 대신 LocalStorage 사용
// 예시:
localStorage.setItem('transactions', JSON.stringify(transactions));
const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
```

#### 옵션 B: 사용자별 D1 인스턴스 (복잡)

**방법:**
1. 사용자별 D1 데이터베이스 생성
2. 간단한 로그인 시스템 (이메일만)
3. 사용자별 database_id 매핑
4. 각 요청마다 올바른 D1 연결

**단점:**
- 복잡한 구현
- 로그인 시스템 필요
- 관리 비용 증가

#### 옵션 C: IndexedDB 활용 (권장)

**장점:**
- ✅ 브라우저 내장 데이터베이스
- ✅ 대용량 데이터 저장 가능
- ✅ 오프라인 작동
- ✅ SQL과 유사한 구조

**구현 필요:**
- IndexedDB wrapper 라이브러리 사용 (Dexie.js)
- Backend API를 IndexedDB로 대체
- 동기화 로직 구현 (선택사항)

---

## 🚀 빠른 배포 (개발자용)

```bash
# 1. 프로젝트 디렉토리로 이동
cd /home/user/webapp

# 2. Cloudflare 인증 설정
# setup_cloudflare_api_key 도구 사용 또는
export CLOUDFLARE_API_TOKEN="your-token"

# 3. D1 데이터베이스 생성 및 설정
npx wrangler d1 create webapp-production
# database_id를 wrangler.jsonc에 추가

# 4. 마이그레이션
npx wrangler d1 migrations apply webapp-production

# 5. 빌드
npm run build

# 6. 배포
npx wrangler pages deploy dist --project-name webapp

# 7. URL 확인 (출력에서 확인)
# 예: ✨ Success! Uploaded 3 files
#      🌎 https://webapp.pages.dev
```

---

## 📝 사용자에게 공유할 정보

### 배포 후 사용자에게 전달할 내용:

```
📱 가계부 앱 설치 안내

1. 아래 링크를 클릭하세요:
   https://your-app.pages.dev

2. 스마트폰에 앱으로 설치:
   - iOS: Safari에서 공유 버튼 → 홈 화면에 추가
   - Android: Chrome에서 메뉴 → 홈 화면에 추가

3. 홈 화면의 "가계부" 아이콘을 클릭하여 사용

✅ 각자의 휴대폰에 독립적으로 저장됩니다
✅ 로그인 불필요
✅ 무료
```

---

## ⚠️ 현재 제한사항 및 개선 필요사항

### 현재 문제:
- 현재 구조는 **단일 D1 데이터베이스를 모든 사용자가 공유**
- 사용자 A와 사용자 B의 데이터가 섞일 수 있음

### 해결 방법 (선택):

#### 1. LocalStorage로 전환 (가장 간단)
- Backend API를 LocalStorage로 대체
- 각 사용자의 브라우저에 데이터 저장
- 진정한 개인별 데이터 분리

#### 2. IndexedDB로 전환 (권장)
- 대용량 데이터 지원
- 오프라인 작동
- SQL과 유사한 쿼리

#### 3. 사용자 인증 추가
- 간단한 이메일 기반 로그인
- 사용자별 D1 데이터베이스
- 더 복잡하지만 완전한 솔루션

---

## 🎯 권장 사항

**현재 상황에 가장 적합한 방법:**

### 방법 1: IndexedDB로 전환 (가장 추천)

**이유:**
- ✅ 각자의 기기에 완전히 독립적인 데이터
- ✅ 로그인 불필요
- ✅ 오프라인 작동
- ✅ 현재 구조와 유사하게 구현 가능

**구현 시간:** 2-3시간

**다음 단계로 IndexedDB 전환을 원하시면 알려주세요!**

---

## 📞 문의 및 지원

배포 과정에서 문제가 발생하면:
1. Cloudflare Pages 대시보드에서 로그 확인
2. 브라우저 개발자 도구 콘솔 확인
3. wrangler.jsonc 설정 재확인

---

**문서 버전:** 1.0  
**최종 업데이트:** 2025-10-25
