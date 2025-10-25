# 가계부 앱 (Household Budget App)

완전한 기능을 갖춘 웹 기반 가계부 애플리케이션입니다. Cloudflare Pages와 D1 데이터베이스를 활용한 엣지 컴퓨팅 기반 개인 재무 관리 솔루션입니다.

## 🌐 실시간 데모

**로컬 개발 서버**: https://3000-ilfxg66dle2ykyvgdbe6r-c07dda5e.sandbox.novita.ai

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

### 4. 🔄 고정지출 관리 (Fixed Expenses)
- 정기적 지출 스케줄 관리
- **월별 고정지출**: 매월 N번째 특정 요일 (예: 매월 첫째 주 목요일)
- **주별 고정지출**: 매주 특정 요일 (예: 매주 금요일)
- 배지 시스템으로 주기/주차/요일 시각화
- 자동 지불 기능

### 5. 💰 예산 관리 (Budgets)
- 카테고리별 월별 예산 설정
- 실시간 예산 vs 실제 지출 현황
- 진행률 색상 표시 (안전/양호/주의/초과)
- 0원 입력 시 자동 삭제

### 6. ⚙️ 설정 (Settings)
- 다중 통화 지원 (KRW, USD, EUR, JPY, AUD, GBP)
- 초기 잔액/저축액 설정
- 사용자 정의 카테고리 색상

## 🎨 기술 스택

### Backend
- **Hono** v4.10+ - 초경량 웹 프레임워크
- **TypeScript** - 타입 안전성
- **Cloudflare Workers** - 엣지 런타임
- **Cloudflare D1** - 분산 SQLite 데이터베이스

### Frontend
- **Vanilla JavaScript** - 순수 JavaScript (1,744줄)
- **TailwindCSS** (CDN) - 유틸리티 우선 CSS
- **Font Awesome** - 아이콘
- **Chart.js** - 데이터 시각화
- **Axios** - HTTP 클라이언트

### Development Tools
- **Vite** - 빌드 도구
- **Wrangler** - Cloudflare CLI
- **PM2** - 프로세스 관리

## 📊 데이터베이스 설계

### 6개 테이블 구조

1. **settings** - 앱 전역 설정
2. **savings_accounts** - 저축 통장
3. **transactions** - 거래 내역 (수입/지출/저축)
4. **fixed_expenses** - 고정지출 스케줄
5. **fixed_expense_payments** - 고정지출 지불 기록
6. **category_budgets** - 카테고리별 예산

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
│   └── index.tsx              # Hono 백엔드 API (536줄, 24개 엔드포인트)
├── public/
│   └── static/
│       ├── app.js             # 프론트엔드 JavaScript (1,744줄)
│       └── style.css          # 커스텀 CSS
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_add_settings.sql
│   └── 0003_add_fixed_expenses_and_budgets.sql
├── ecosystem.config.cjs       # PM2 설정
├── wrangler.jsonc             # Cloudflare 설정
├── package.json
├── vite.config.ts
└── README.md
```

## 🔌 API 엔드포인트 (24개)

### 저축 통장 (3개)
- `GET /api/savings-accounts` - 목록 조회
- `POST /api/savings-accounts` - 생성
- `DELETE /api/savings-accounts/:id` - 삭제

### 거래 내역 (5개)
- `GET /api/transactions` - 조회 (날짜 범위)
- `GET /api/transactions/date/:date` - 특정 날짜 조회
- `POST /api/transactions` - 생성
- `PUT /api/transactions/:id` - 수정
- `DELETE /api/transactions/:id` - 삭제

### 통계 (3개)
- `GET /api/statistics/monthly/:yearMonth` - 월별 통계
- `GET /api/statistics/weekly/:startDate` - 주별 통계
- `GET /api/calendar/:yearMonth` - 달력 데이터

### 설정 (2개)
- `GET /api/settings` - 조회
- `PUT /api/settings` - 수정

### 고정지출 (5개)
- `GET /api/fixed-expenses` - 목록 조회
- `POST /api/fixed-expenses` - 생성
- `DELETE /api/fixed-expenses/:id` - 삭제
- `POST /api/fixed-expenses/:id/pay` - 지불 처리
- `GET /api/fixed-expenses/:id/payments/:yearMonth` - 지불 내역

### 예산 (4개)
- `GET /api/budgets` - 목록 조회
- `PUT /api/budgets/:category` - 설정/수정 (UPSERT)
- `DELETE /api/budgets/:category` - 삭제
- `GET /api/budgets/vs-spending/:yearMonth` - 예산 vs 지출 현황

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

- ✅ 월별/주별 뷰
- ✅ 거래 내역 관리 (수입/지출/저축)
- ✅ 저축 통장 다중 관리
- ✅ 고정지출 스케줄 관리
- ✅ 카테고리별 예산 관리
- ✅ 다중 통화 지원
- ✅ 달력 인터페이스
- ✅ 실시간 통계 대시보드

## 🚧 향후 계획

- [ ] 차트 시각화 개선
- [ ] 데이터 내보내기 (CSV/JSON)
- [ ] 모바일 앱 (PWA)
- [ ] 다중 사용자 지원
- [ ] AI 기반 지출 예측
- [ ] 영수증 OCR 스캔

---

**Built with ❤️ using Cloudflare Pages and Hono**
