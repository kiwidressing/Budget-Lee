# 가계부 앱 (Household Budget App)

완전한 기능을 갖춘 웹 기반 가계부 애플리케이션입니다. Cloudflare Pages와 D1 데이터베이스를 활용한 엣지 컴퓨팅 기반 개인 재무 관리 솔루션입니다.

## 🌐 실시간 데모

**로컬 개발 서버**: https://3000-ilfxg66dle2ykyvgdbe6r-c07dda5e.sandbox.novita.ai

## 🆕 최신 업데이트 (Session 8)

이번 세션에서 추가된 주요 기능:

### 📱 모바일 최적화 UI (NEW)
- **반응형 글씨 크기**: 모바일(13px), 태블릿(14px), 데스크톱(15px) 자동 조정
- **간소화된 버튼**: + 버튼에서 텍스트 제거, 아이콘만 표시
- **컴팩트 네비게이션**: 월별/주별 화살표 버튼만 표시, 날짜 크기 축소
- **혁신적 달력 뷰**: 
  - 금액 대신 색상 점으로 거래 표시
  - 🔵 파란 점 = 수입 | 🔴 빨간 점 = 지출 | 🟢 초록 점 = 저축
  - 공간 효율 대폭 향상
- **모바일 친화적**: 작은 화면에서도 모든 정보를 명확하게 표시

### 💰 고정지출 확장 (Enhanced)
- **매월 특정 일자**: 매월 5일, 매월 15일 등 특정 날짜 반복 추가
- **3가지 주기 옵션**: 
  - 월별 (특정 주/요일): 첫째 주 월요일 등
  - 매월 (특정 일자): 매월 5일 등
  - 주별: 매주 금요일 등
- **자동 월말 처리**: 31일이 없는 달은 해당 달 마지막 날로 자동 조정

### 세션 6 기능 (이전)
1. **✏️ 거래 내역 수정 기능** - 이미 입력한 거래 내역을 수정할 수 있습니다
2. **🔍 카테고리별 검색/필터** - 거래 내역을 유형, 카테고리, 설명으로 필터링
3. **📊 월간/연간 비교 리포트** - 카테고리별 지출을 기간별로 비교 분석
4. **📈 투자 관리 페이지** - 주식 포트폴리오 관리 및 실시간 주가 추적
5. **🪙 암호화폐 지원** - BTC, ETH, SOL 등 10종의 암호화폐 투자 추적

## ✨ 주요 기능

### 1. 📅 월별 뷰 (Monthly View)
- **월간 통계 카드**: 수입, 지출, 저축, 잔액 한눈에 확인
- **달력 인터페이스**: 날짜별 거래 시각화 및 빠른 입력
- **거래 내역 리스트**: 날짜별 상세 내역 조회
- **예산 진행률 바**: 카테고리별 예산 대비 실제 지출 비교

### 2. 📊 주별 뷰 (Weekly View)
- 주간 수입/지출/저축 통계
- 이전주/다음주 네비게이션
- 주간 거래 내역 상세 보기

### 3. 🐷 저축 관리 (Savings)
- 다중 저축 통장 관리
- 통장별 잔액 실시간 집계
- 총 저축액 대시보드
- 저축 통장 추가/삭제 기능

### 4. 🔄 고정지출 관리 (Fixed Expenses) ⭐ **Enhanced in Session 8**
- 정기적 지출 스케줄 관리
- **3가지 주기 옵션**:
  - **월별 (특정 주/요일)**: 매월 첫째 주 목요일 등
  - **매월 (특정 일자)**: 매월 5일, 15일 등 ⭐ **NEW**
  - **주별**: 매주 금요일 등 → 해당 월의 모든 반복 표시 (4-5개)
- **월별 네비게이션**: 이전/다음 달로 이동하며 각 달의 고정지출 확인
- **체크박스 시스템**: 클릭 한 번으로 지불 완료 처리 및 거래 내역 자동 생성
- 배지 시스템으로 주기/주차/요일/일자 시각화
- 지불 상태 실시간 표시 (완료/예정)
- **31일 자동 처리**: 31일이 없는 달은 해당 달 마지막 날로 자동 조정

### 5. 💰 예산 관리 (Budgets)
- 카테고리별 월별 예산 설정
- 실시간 예산 vs 실제 지출 현황
- 진행률 색상 표시 (안전/양호/주의/초과)
- 0원 입력 시 자동 삭제

### 6. 📈 투자 관리 (Investments) ⭐ **NEW - Session 6**
- **포트폴리오 대시보드**: 총 투자금액, 현재 평가금액, 총 수익/손실 한눈에 확인
- **실시간 주가 연동**: Yahoo Finance API를 통한 30초마다 자동 업데이트
- **다중 종목 관리**: 주식 심볼, 수량, 평균 매수가 입력 및 추적
- **수익률 계산**: 종목별 수익률(%), 평가손익 자동 계산
- **미국/한국 주식 지원**: AAPL (미국), 005930.KS (삼성전자) 등
- **거래 내역**: 매수/매도 기록 관리 (향후 업데이트)
- 종목별 메모 기능

### 7. 📊 연간 지출 리포트 (Reports) ⭐ **NEW - Session 6 v2**
- **3단계 드릴다운 구조**: 연간 → 월별 → 카테고리 → 거래 내역
- **1단계 - 연간 개요**: 
  - 1월~12월 바 그래프로 한눈에 파악
  - 전년 동월 대비 증감률 표시
  - 막대 클릭 시 해당 월 상세로 이동
- **2단계 - 월별 카테고리**:
  - 의복비, 식비, 주거비 등 카테고리별 지출 바 그래프
  - 각 카테고리 비율(%) 및 건수 표시
  - 막대 클릭 시 거래 내역으로 이동
- **3단계 - 거래 내역**:
  - 선택한 카테고리의 모든 거래 리스트
  - 날짜, 설명, 금액 상세 표시
  - 즉시 수정/삭제 가능
- **연도 선택**: 최근 5년 데이터 조회
- **Breadcrumb 네비게이션**: 현재 위치 표시 및 빠른 이동

### 8. ✏️ 거래 내역 수정 (Transaction Edit) ⭐ **NEW - Session 6**
- **편집 버튼**: 각 거래 내역에 수정 버튼 추가
- **모달 폼**: 거래 유형, 카테고리, 금액, 날짜, 설명 모두 수정 가능
- **즉시 반영**: 수정 후 현재 뷰 자동 새로고침
- **유효성 검사**: 필수 항목 체크 및 데이터 검증

### 9. 🔍 거래 검색 및 필터링 (Search & Filter) ⭐ **NEW - Session 6**
- **검색**: 거래 설명(메모)으로 실시간 검색
- **유형 필터**: 수입/지출/저축 선택
- **카테고리 필터**: 모든 카테고리에서 선택
- **복합 필터**: 검색어 + 유형 + 카테고리 동시 적용
- **즉시 결과**: 입력/선택 즉시 필터링 적용

### 10. 🧾 영수증 관리 (Receipts) ⭐ **NEW - Session 7**
- **영수증 사진 업로드**: 카메라 촬영 또는 갤러리에서 선택
- **상세 정보 입력**: 구매처, 구매일, 금액, 카테고리, 결제수단, 메모
- **세금공제 플래그**: 세금공제 대상 영수증 마킹 및 필터링
- **다차원 필터링**: 연도/월/카테고리/세금공제 여부로 필터
- **통계 요약**: 
  - 총 영수증 수 (건수)
  - 총 지출액
  - 세금공제 대상 금액
- **이미지 뷰어**: 클릭으로 영수증 사진 크게 보기
- **편집/삭제**: 영수증 정보 및 사진 수정, 삭제
- **Base64 저장**: 로컬 개발 환경에서 데이터베이스에 이미지 저장

### 11. ⚙️ 설정 (Settings) ⭐ **ENHANCED**
- **다중 통화 지원** (KRW ₩, USD $, EUR €, JPY ¥, AUD A$, GBP £)
- **동적 통화 변경**: 설정 변경 시 모든 화면의 통화 기호 자동 업데이트
- **실시간 반영**: 통화 변경 후 현재 보고 있는 뷰 자동 새로고침
- 초기 잔액/저축액 설정
- 사용자 정의 카테고리 색상

## 🎨 기술 스택

### Backend
- **Hono** v4.10+ - 초경량 웹 프레임워크
- **TypeScript** - 타입 안전성
- **Cloudflare Workers** - 엣지 런타임
- **Cloudflare D1** - 분산 SQLite 데이터베이스

### Frontend
- **Vanilla JavaScript** - 순수 JavaScript (3,000+ 줄) ⭐ **+459줄 추가 (영수증 기능)**
- **TailwindCSS** (CDN) - 유틸리티 우선 CSS
- **Font Awesome** - 아이콘
- **Chart.js** - 데이터 시각화 및 인터랙티브 바 차트
- **Axios** - HTTP 클라이언트
- **Yahoo Finance API** - 실시간 주가 데이터
- **FileReader API** - 영수증 이미지 Base64 변환

### Development Tools
- **Vite** - 빌드 도구
- **Wrangler** - Cloudflare CLI
- **PM2** - 프로세스 관리

## 📊 데이터베이스 설계

### 9개 테이블 구조 ⭐ **+1 NEW (Session 7)**

1. **settings** - 앱 전역 설정
2. **savings_accounts** - 저축 통장
3. **transactions** - 거래 내역 (수입/지출/저축)
4. **fixed_expenses** - 고정지출 스케줄
5. **fixed_expense_payments** - 고정지출 지불 기록
6. **category_budgets** - 카테고리별 예산
7. **investments** - 투자 종목 (주식/암호화폐) ⭐ **Session 6**
8. **investment_transactions** - 투자 거래 내역 (매수/매도) ⭐ **Session 6**
9. **receipts** - 영수증 관리 (사진, 구매처, 금액, 세금공제) ⭐ **NEW - Session 7**

## 🚀 빠른 시작

### 사전 요구사항
- Node.js 18+
- npm 또는 yarn

### 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 D1 데이터베이스 초기화
npm run db:migrate:local

# 3. 프로젝트 빌드
npm run build

# 4. 개발 서버 시작
npm run dev:sandbox

# 또는 PM2로 시작 (권장)
npm run clean-port
pm2 start ecosystem.config.cjs
```

### 접속
- 로컬: http://localhost:3000

## 📝 사용 가능한 스크립트

```bash
npm run dev              # Vite 개발 서버
npm run dev:sandbox      # Wrangler Pages 개발 서버 (로컬 D1)
npm run build            # 프로덕션 빌드
npm run preview          # 빌드 미리보기
npm run deploy           # Cloudflare Pages 배포
npm run deploy:prod      # 프로덕션 배포 (프로젝트명 지정)

# 데이터베이스
npm run db:migrate:local # 로컬 마이그레이션
npm run db:migrate:prod  # 프로덕션 마이그레이션
npm run db:console:local # 로컬 D1 콘솔

# 유틸리티
npm run clean-port       # 포트 3000 정리
npm test                 # 서비스 테스트
```

## 🌐 Cloudflare Pages 배포

### 1단계: Cloudflare API 키 설정
```bash
# API 키를 환경변수로 설정하거나
export CLOUDFLARE_API_TOKEN="your-api-token"

# 또는 wrangler login 사용
npx wrangler login
```

### 2단계: 프로덕션 D1 데이터베이스 생성
```bash
npx wrangler d1 create webapp-production
```

### 3단계: wrangler.jsonc 업데이트
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "webapp-production",
      "database_id": "여기에-실제-database-id-입력"
    }
  ]
}
```

### 4단계: 프로덕션 마이그레이션
```bash
npm run db:migrate:prod
```

### 5단계: 배포
```bash
npm run deploy:prod
```

## 📁 프로젝트 구조

```
webapp/
├── src/
│   └── index.tsx              # Hono 백엔드 API (1,046 줄, 37개 엔드포인트) ⭐ **+239줄**
├── public/
│   ├── manifest.json          # PWA 매니페스트
│   ├── sw.js                  # Service Worker
│   └── static/
│       ├── app.js             # 프론트엔드 JavaScript (3,000+ 줄) ⭐ **+459줄**
│       └── style.css          # 커스텀 CSS
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_add_settings.sql
│   ├── 0003_add_fixed_expenses_and_budgets.sql
│   ├── 0004_add_investments.sql    ⭐ **Session 6**
│   └── 0005_add_receipts.sql       ⭐ **NEW - Session 7**
├── ecosystem.config.cjs       # PM2 설정
├── wrangler.jsonc             # Cloudflare 설정
├── package.json
├── vite.config.ts
└── README.md
```

## 🔌 API 엔드포인트 (31개) ⭐ **+6 NEW**

### 저축 통장 (3개)
- `GET /api/savings-accounts` - 목록 조회
- `POST /api/savings-accounts` - 생성
- `DELETE /api/savings-accounts/:id` - 삭제

### 거래 내역 (5개)
- `GET /api/transactions` - 조회 (날짜 범위)
- `GET /api/transactions/date/:date` - 특정 날짜 조회
- `POST /api/transactions` - 생성
- `PUT /api/transactions/:id` - 수정 ⭐ **기존 API 활용**
- `DELETE /api/transactions/:id` - 삭제

### 통계 (3개)
- `GET /api/statistics/monthly/:yearMonth` - 월별 통계
- `GET /api/statistics/weekly/:startDate` - 주별 통계
- `GET /api/calendar/:yearMonth` - 달력 데이터

### 설정 (2개)
- `GET /api/settings` - 조회
- `PUT /api/settings` - 수정

### 고정지출 (6개)
- `GET /api/fixed-expenses` - 목록 조회
- `GET /api/fixed-expenses/instances/:yearMonth` - 반복 인스턴스 조회
- `POST /api/fixed-expenses` - 생성
- `DELETE /api/fixed-expenses/:id` - 삭제
- `POST /api/fixed-expenses/:id/pay` - 지불 처리
- `GET /api/fixed-expenses/:id/payments/:yearMonth` - 지불 내역

### 예산 (4개)
- `GET /api/budgets` - 목록 조회
- `PUT /api/budgets/:category` - 설정/수정 (UPSERT)
- `DELETE /api/budgets/:category` - 삭제
- `GET /api/budgets/vs-spending/:yearMonth` - 예산 vs 지출 현황

### 투자 (6개) ⭐ **NEW - Session 6**
- `GET /api/investments` - 보유 종목 목록
- `POST /api/investments` - 새 종목 추가
- `PUT /api/investments/:id` - 종목 정보 수정
- `DELETE /api/investments/:id` - 종목 삭제
- `GET /api/investments/price/:symbol` - 실시간 주가 조회 (Yahoo Finance API)
- `GET /api/investments/:id/transactions` - 종목별 거래 내역 (향후 구현 예정)

## 💡 핵심 알고리즘

### 고정지출 날짜 계산
```javascript
// N번째 특정 요일 찾기 (예: 매월 첫째 주 목요일)
function getNthDayOfMonth(year, month, nth, dayOfWeek) {
  let date = new Date(year, month, 1);
  let count = 0;
  
  while (date.getMonth() === month) {
    if (date.getDay() === dayOfWeek) {
      count++;
      if (count === nth) return new Date(date);
    }
    date.setDate(date.getDate() + 1);
  }
  return null;
}
```

### 잔액 계산
```
잔액 = initial_balance + SUM(수입) - SUM(지출) - SUM(저축)
```

### 예산 진행률 색상
```javascript
function getBudgetColor(percentage) {
  if (percentage < 50) return '#10B981';   // 초록 (안전)
  if (percentage < 80) return '#F59E0B';   // 노랑 (양호)
  if (percentage <= 100) return '#F97316'; // 주황 (주의)
  return '#EF4444';                        // 빨강 (초과)
}
```

## 🎯 사용 시나리오

### 일반 사용자
1. 매일 지출 입력 (달력에서 날짜 클릭 → 거래 추가)
2. 월말 통계 확인 (카테고리별 지출 분석)
3. 다음 달 예산 설정 (예산 탭)

### 체계적 관리자
1. 고정지출 등록 (월세, 통신비 등)
2. 저축 통장 분리 관리 (비상금, 목돈마련 등)
3. 주간 리뷰 (주별 탭에서 지출 패턴 분석)

## 🔧 문제 해결

### 데이터베이스 오류
```bash
# 로컬 데이터베이스 리셋
rm -rf .wrangler/state/v3/d1
npm run db:migrate:local
```

### 포트 충돌
```bash
# 포트 정리 후 재시작
npm run clean-port
pm2 restart webapp
```

### 빌드 오류
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📚 추가 자료

- [Hono Documentation](https://hono.dev/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)

## 🤝 기여

이 프로젝트는 개인 재무 관리를 위한 오픈소스 솔루션입니다.

## 📄 라이선스

MIT License

## 🎉 완료된 기능

### 세션 1-5 (기본 기능)
- ✅ 월별/주별 뷰
- ✅ 거래 내역 관리 (수입/지출/저축)
- ✅ 저축 통장 다중 관리
- ✅ 고정지출 스케줄 관리
- ✅ 고정지출 반복 인스턴스 자동 생성 (주별 → 월 4-5개, 월별 → 월 1개)
- ✅ 고정지출 월별 네비게이션 (이전/다음 달 이동)
- ✅ 카테고리별 예산 관리
- ✅ 다중 통화 지원 (6개 통화)
- ✅ 동적 통화 변경 및 실시간 UI 업데이트
- ✅ 달력 인터페이스 (토요일 파란색, 일요일 빨간색)
- ✅ 실시간 통계 대시보드
- ✅ 예산 vs 지출 진행률 바 (색상 코딩)
- ✅ PWA 지원 (설치 가능한 웹 앱)

### 세션 6 (신규 기능) ⭐ **NEW**
- ✅ **거래 내역 수정 기능** - 편집 버튼으로 기존 거래 수정
- ✅ **카테고리별 검색/필터** - 유형, 카테고리, 설명으로 거래 필터링
- ✅ **연간 지출 리포트 (v2 개선)** - 3단계 드릴다운 구조로 직관적 분석
  - 1단계: 연간 월별 바 그래프 (전년 대비 증감률)
  - 2단계: 월별 카테고리 바 그래프 (의식주 등)
  - 3단계: 카테고리별 거래 내역 상세
- ✅ **인터랙티브 차트** - 바 클릭으로 상세 정보 드릴다운
- ✅ **투자 관리 페이지** - 주식 포트폴리오 및 실시간 주가 추적
- ✅ **실시간 주가 업데이트** - 30초마다 자동 갱신
- ✅ **수익률 계산** - 평가손익 및 수익률 자동 계산

## 🚧 향후 계획

### 단기 (Next Sprint)
- [ ] 투자 거래 내역 (매수/매도) 완전 구현
- [ ] 투자 포트폴리오 차트 (파이 차트)
- [ ] 카테고리별 예산 vs 실제 비교 리포트 확장
- [ ] 데이터 내보내기 (CSV/JSON)

### 중기 (Future Releases)
- [ ] 차트 시각화 개선 (더 많은 차트 유형)
- [ ] 다중 사용자 지원 (인증 시스템)
- [ ] 알림 기능 (예산 초과, 고정지출 알림)
- [ ] 영수증 사진 첨부

### 장기 (Vision)
- [ ] AI 기반 지출 예측
- [ ] 영수증 OCR 스캔
- [ ] 자동 카테고리 분류 (머신러닝)
- [ ] 다국어 지원

---

**Built with ❤️ using Cloudflare Pages and Hono**
