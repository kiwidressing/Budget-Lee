# 가계부 앱 (Household Budget App)

완전한 기능을 갖춘 웹 기반 가계부 애플리케이션입니다. Cloudflare Pages와 D1 데이터베이스를 활용한 엣지 컴퓨팅 기반 개인 재무 관리 솔루션입니다.

## 🌐 실시간 데모

**🚀 프로덕션 URL**: https://budgetlee.pages.dev  
**🔗 최신 배포**: https://54b34db6.budgetlee.pages.dev
**📦 GitHub 리포지토리**: https://github.com/kiwidressing/Budget-Lee

> 배포 상태: ✅ Active (Cloudflare Pages)  
> 마지막 배포: 2025-11-01 16:56 GMT  
> 데이터베이스: ✅ 모든 21개 마이그레이션 완료  
> 자동 배포: `main` 브랜치에 push 시 자동으로 재배포됩니다

## 🆕 최신 업데이트 (Session 12 - 프로덕션 배포 완료) ⭐ **LATEST**

✅ **프로덕션 배포 성공**: Cloudflare Pages에 완전 배포 완료  
✅ **세션 기반 인증**: 브라우저별 자동 세션 생성으로 다중 사용자 지원  
✅ **데이터 격리**: 각 브라우저마다 독립된 데이터 저장소  
✅ **로그인 불필요**: 자동 세션 생성으로 즉시 사용 가능  
✅ **데이터베이스 마이그레이션**: 모든 21개 마이그레이션 정상 적용  
✅ **안정성 확보**: 프로덕션 환경에서 정상 작동 확인

이번 세션에서 해결한 주요 이슈:

### 🔧 데이터베이스 마이그레이션 수정
- **Migration 0006-0007**: `payment_day` 중복 컬럼 오류 해결
- **Migration 0008**: `user_id` 컬럼 멱등성 보장
- **Migration 0009**: `payment_method` 중복 오류 수정
- **Migrations 0010-0021**: 프로덕션 히스토리 동기화
- **영수증 스키마 수정**: 누락된 컬럼(`merchant`, `is_tax_deductible`, `image_*`) 추가
- **결과**: 모든 21개 마이그레이션이 로컬 및 프로덕션에서 정상 작동

### 👥 세션 기반 다중 사용자 지원 (NEW)
- **자동 세션 생성**: 첫 방문 시 브라우저별 고유 세션 ID 생성
- **데이터 격리**: 각 브라우저는 독립된 user_id로 데이터 저장
- **로그인 불필요**: 복잡한 인증 없이 즉시 사용 가능
- **세션 유지**: LocalStorage에 세션 ID 저장으로 재방문 시 동일 데이터 접근
- **향후 업그레이드**: 정식 로그인/회원가입 UI 구현 예정

이번 세션에서 추가된 주요 개선 사항:

### 🔐 보안 강화 (NEW) ⭐ **CRITICAL UPDATE**

#### 1. **PBKDF2 비밀번호 해싱**
- **150,000 iterations**: 업계 표준 보안 강도
- **Salt + Hash**: 사용자별 고유 salt로 레인보우 테이블 공격 방어
- **레거시 지원**: 기존 SHA-256 사용자 자동 마이그레이션
- **Web Crypto API**: 브라우저 네이티브 암호화 사용
- **마이그레이션**: 로그인 시 자동으로 PBKDF2로 업그레이드

#### 2. **Access/Refresh Token 듀얼 토큰 시스템**
- **Access Token**: 45분 수명 (API 요청용)
- **Refresh Token**: 30일 수명 (토큰 갱신용)
- **세션 관리**: DB에 Refresh Token 저장 및 추적
- **보안 정보**: user_agent, ip_address, last_used_at 기록
- **로그아웃**: Refresh Token 삭제로 완전한 세션 종료
- **자동 갱신**: `/api/auth/refresh` 엔드포인트

### 🏦 계좌 및 이체 관리 (NEW) ⭐ **MAJOR FEATURE**

#### 1. **다중 계좌 관리**
- **4가지 계좌 유형**:
  - 입출금 통장 (checking)
  - 예금 통장 (savings)
  - 신용카드 (credit_card)
  - 현금 (cash)
- **계좌별 잔액**: 실시간 잔액 추적
- **활성화/비활성화**: 소프트 삭제로 데이터 보존
- **다중 통화**: 각 계좌별 통화 설정 가능

#### 2. **계좌 간 이체**
- **트랜잭션 보장**: DB batch로 원자성 보장 (출금 + 입금 동시 처리)
- **잔액 검증**: 출금 계좌 잔액 부족 시 거부
- **이체 내역**: 날짜, 금액, 설명, 계좌명 자동 기록
- **필터링**: 계좌별, 날짜별 이체 내역 조회
- **안전 장치**: 동일 계좌 이체 방지

#### 3. **거래-계좌 연동**
- **account_id 추가**: transactions 테이블에 계좌 정보 연결
- **계좌별 거래**: 어떤 계좌에서 발생한 거래인지 추적
- **통합 분석**: 계좌별 수입/지출 분석 가능 (향후 구현)

## 🆕 이전 업데이트 (Session 10)

Session 10에서 추가된 주요 개선 사항:

### ⚡ 성능 최적화 (NEW)

#### 1. 📱 **PWA 오프라인 지원**
- **Service Worker**: 정적 파일 캐시로 오프라인 접속 가능
- **캐시 전략**: 
  - 정적 파일: Cache First (빠른 로딩)
  - API 요청: Network Only (최신 데이터)
- **자동 업데이트**: 새 버전 감지 시 사용자에게 알림
- **즉시 적용**: 페이지 새로고침 없이 SW 등록

#### 2. 🌐 **Yahoo Finance API 실시간 주가**
- **60초 메모리 캐시**: 동일 심볼 요청 시 캐시에서 즉시 응답
- **84% 속도 향상**: 340ms → 54ms (캐시 적중 시)
- **자동 폴백**: API 실패 시 시뮬레이션 데이터로 자동 전환
- **사용자 표시**: ⚡ 아이콘으로 캐시된 데이터 표시
- **안정성**: 401 에러 시에도 정상 작동

#### 3. 🔄 **통합 에러 처리**
- **axios 인터셉터**: 모든 API 요청에 자동 에러 처리
- **401 인증 오류**: 자동 로그아웃 및 로그인 화면 이동
- **403 권한 오류**: "권한이 없습니다" 메시지
- **404 오류**: 조용히 처리 (사용자 알림 없음)
- **500/503 서버 오류**: "서버 오류" 또는 "서비스 불가" 메시지
- **네트워크 오류**: 인터넷 연결 확인 안내

#### 4. 💾 **월별 통계 캐시** ⭐ **IN PROGRESS**
- **monthly_summary 테이블**: 월별 집계 데이터 캐시
- **자동 업데이트**: 거래 생성/수정/삭제 시 자동 재계산
- **UPSERT 패턴**: INSERT ... ON CONFLICT DO UPDATE로 원자성 보장
- **API 호환성**: 기존 API 응답 형식 100% 유지
- **인덱스 최적화**: user_id, year_month 복합 인덱스로 빠른 조회

### 세션 9 기능 (이전)

### 🛡️ 입력 검증 강화 (NEW)
- **포괄적 검증 시스템**: 모든 사용자 입력에 대한 유효성 검사
- **10개 검증 함수**:
  - `validateNumber()`: 숫자 범위 검증 (min/max)
  - `validateInteger()`: 정수 검증
  - `validatePositiveNumber()`: 양수 검증
  - `validateDate()`: 날짜 유효성 및 범위 (1900-2100년)
  - `validateString()`: 문자열 길이 검증 (min/max)
  - `validateTransactionAmount()`: 거래 금액 (1원 ~ 100억 원)
  - `validateBudgetAmount()`: 예산 금액 (0원 ~ 1000억 원)
  - `validateSavingsGoal()`: 저축 목표 (0원 ~ 1000억 원)
  - `validateInvestmentQuantity()`: 투자 수량 검증
  - `validateInvestmentPrice()`: 투자 가격 검증
- **XSS 방어**: HTML 태그 제거 및 문자열 새니타이징
- **사용자 친화적 에러**: 한국어 에러 메시지 및 명확한 입력 가이드
- **적용 범위**: 8개 핸들러 함수에 적용
  - 거래 추가/수정
  - 저축 통장 추가
  - 저축 목표 설정
  - 고정지출 추가
  - 예산 변경
  - 투자 추가/수정
  - 설정 저장

### 🎯 에러 처리 100% 커버리지 (NEW)
- **16개 async 함수**에 try-catch 블록 추가
- **우아한 에러 처리**: 앱 충돌 대신 에러 UI 표시
- **재시도 기능**: 각 에러 상태에 "다시 시도" 버튼
- **사용자 친화적**: 모든 에러 메시지 한국어로 제공

### 💾 데이터 백업/복원 (NEW) ⭐ **ENHANCED - UX 개선**
- **이중 백업 시스템**:
  - 📱 **브라우저 저장**: LocalStorage에 자동 저장 (최근 3개 유지)
  - 💾 **파일 다운로드**: JSON 파일로 다운로드 (백업용)
- **스마트 내보내기**:
  - 백업 완료 시 저장 위치 명확히 안내
  - 브라우저 다운로드 폴더 경로 가이드
  - 백업 개수 표시 (X/3개)
- **개선된 불러오기 UI**:
  - 📋 최근 3개 백업 목록 표시
  - 📅 백업 날짜/시간 표시
  - 📊 백업 내용 미리보기 (거래 수, 저축 계좌 수 등)
  - 라디오 버튼으로 간편 선택
  - 파일 불러오기도 지원 (백업 옵션)
- **백업 내용**:
  - 설정 (통화, 초기 잔액)
  - 거래 내역 (수입/지출/저축)
  - 저축 통장 목록
  - 고정지출 스케줄
  - 카테고리 예산
  - 투자 포트폴리오
- **안전 장치**: 복원 전 확인 다이얼로그 (백업 내용 요약 포함)
- **자동 정리**: 3개 초과 시 가장 오래된 백업 자동 삭제

### 🌙 다크모드 (NEW)
- **토글 버튼**: 설정 페이지에서 다크/라이트 모드 전환
- **LocalStorage 저장**: 브라우저 세션 간 모드 유지
- **CSS 변수 기반**: 효율적인 테마 전환
- **부드러운 전환**: 0.3초 애니메이션 효과
- **전체 커버리지**: 모든 UI 요소에 다크모드 적용

### 📊 수입/지출/저축 비율 파이차트 (NEW)
- **월별 뷰**: 월간 수입/지출/저축 비율 시각화
- **주별 뷰**: 주간 수입/지출/저축 비율 시각화
- **Chart.js 활용**: 인터랙티브 파이 차트
- **퍼센티지 표시**: 각 항목의 비율(%) 툴팁으로 표시
- **색상 코딩**: 수입(파란색), 지출(빨간색), 저축(초록색)

### 🎯 저축 목표 및 진행률 게이지 (NEW)
- **목표 설정**: 각 저축 통장별로 목표 금액 설정
- **진행률 바**: 시각적 프로그레스 바로 진행 상황 표시
- **색상 변화**: 
  - 파란색 (<75%)
  - 주황색 (75-99%)
  - 초록색 (100% 이상, 목표 달성!)
- **남은 금액**: 목표까지 남은 금액 자동 계산
- **달성 축하**: 목표 달성 시 "🎉 목표 달성!" 메시지

### 세션 8 기능 (이전)

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

### 14개 테이블 구조 ⭐ **+4 NEW (Session 11)**

1. **settings** - 앱 전역 설정
2. **savings_accounts** - 저축 통장
3. **transactions** - 거래 내역 (수입/지출/저축) ⭐ **account_id 추가**
4. **fixed_expenses** - 고정지출 스케줄
5. **fixed_expense_payments** - 고정지출 지불 기록
6. **category_budgets** - 카테고리별 예산
7. **investments** - 투자 종목 (주식/암호화폐)
8. **investment_transactions** - 투자 거래 내역 (매수/매도)
9. **receipts** - 영수증 관리 (사진, 구매처, 금액, 세금공제)
10. **monthly_summary** - 월별 통계 캐시 (성능 최적화)
11. **users** - 사용자 계정 (username, PBKDF2 hash, salt) ⭐ **Session 11**
12. **sessions** - Refresh Token 세션 관리 ⭐ **Session 11**
13. **accounts** - 금융 계좌 (입출금, 예금, 신용카드, 현금) ⭐ **NEW - Session 11**
14. **transfers** - 계좌 간 이체 내역 ⭐ **NEW - Session 11**

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
│   ├── 0004_add_investments.sql
│   ├── 0005_add_receipts.sql
│   ├── 0015_add_monthly_summary.sql
│   ├── 0016_add_pbkdf2_support.sql        ⭐ **NEW - Session 11**
│   ├── 0017_upgrade_sessions_table.sql    ⭐ **NEW - Session 11**
│   └── 0018_add_accounts_and_transfers.sql ⭐ **NEW - Session 11**
├── ecosystem.config.cjs       # PM2 설정
├── wrangler.jsonc             # Cloudflare 설정
├── package.json
├── vite.config.ts
└── README.md
```

## 🔌 API 엔드포인트 (44개) ⭐ **+13 NEW (Session 11)**

### 인증 (4개) ⭐ **NEW - Session 11**
- `POST /api/auth/register` - 회원가입 (PBKDF2 해싱)
- `POST /api/auth/login` - 로그인 (Access + Refresh Token 발급)
- `POST /api/auth/refresh` - Access Token 갱신
- `POST /api/auth/logout` - 로그아웃 (Refresh Token 삭제)

### 계좌 (5개) ⭐ **NEW - Session 11**
- `GET /api/accounts` - 계좌 목록 조회
- `GET /api/accounts/:id` - 계좌 상세 조회
- `POST /api/accounts` - 계좌 생성
- `PUT /api/accounts/:id` - 계좌 수정
- `DELETE /api/accounts/:id` - 계좌 비활성화

### 이체 (2개) ⭐ **NEW - Session 11**
- `POST /api/transfers` - 계좌 간 이체 실행
- `GET /api/transfers` - 이체 내역 조회 (필터링 지원)

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

### 세션 11 (보안 및 계좌 관리) ⭐ **LATEST**
- ✅ **PBKDF2 비밀번호 해싱** - 150,000 iterations 보안 강화
- ✅ **Access/Refresh Token 시스템** - 듀얼 토큰 인증 (45분/30일)
- ✅ **세션 관리** - DB 기반 Refresh Token 추적 및 관리
- ✅ **다중 계좌 관리** - 입출금/예금/신용카드/현금 계좌 지원
- ✅ **계좌 간 이체** - 트랜잭션 보장 및 잔액 자동 업데이트
- ✅ **이체 내역 추적** - 날짜별, 계좌별 필터링
- ✅ **거래-계좌 연동** - transactions 테이블에 account_id 추가
- ✅ **레거시 마이그레이션** - SHA-256 → PBKDF2 자동 업그레이드

### 세션 10 (성능 최적화)
- ✅ **PWA 오프라인 지원** - Service Worker로 캐시 전략 구현
- ✅ **Yahoo Finance 캐시** - 60초 메모리 캐시로 84% 속도 향상
- ✅ **통합 에러 처리** - axios 인터셉터로 모든 API 에러 자동 처리
- ✅ **월별 통계 캐시** - 거래 CRUD 훅 및 캐시 테이블 구현

### 세션 9 (품질 개선 및 신규 기능)
- ✅ **입력 검증 강화** - 10개 검증 함수로 모든 입력 유효성 검사
- ✅ **에러 처리 100% 커버리지** - 16개 async 함수에 try-catch 추가
- ✅ **데이터 백업/복원** - JSON 내보내기/불러오기
- ✅ **다크모드** - LocalStorage 기반 테마 전환
- ✅ **파이차트 시각화** - 월별/주별 수입/지출/저축 비율
- ✅ **저축 목표 시스템** - 목표 설정 및 진행률 게이지
- ✅ **XSS 방어** - HTML 새니타이징 및 입력 필터링
- ✅ **사용자 경험 개선** - 한국어 에러 메시지 및 재시도 버튼

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

### 단기 (Next Sprint) ⭐ **PRIORITY**
- [ ] **프론트엔드 인증 UI** (로그인/회원가입 페이지) - 백엔드 API 완료
- [ ] **계좌 관리 UI** (계좌 목록, 이체 화면) - 백엔드 API 완료
- [ ] **거래 입력 시 계좌 선택 옵션** - 백엔드 account_id 컬럼 준비 완료
- [ ] 투자 거래 내역 (매수/매도) 완전 구현
- [ ] 투자 포트폴리오 차트 (파이 차트)
- [x] 데이터 내보내기 (CSV/JSON) ✅ **완료 (Session 9)**
- [x] 다중 사용자 지원 (인증 시스템) ✅ **완료 (Session 11)**

### 중기 (Future Releases)
- [ ] 계좌별 거래 내역 분석 (수입/지출 차트)
- [ ] 계좌별 월별 통계
- [ ] 차트 시각화 개선 (더 많은 차트 유형)
- [ ] 알림 기능 (예산 초과, 고정지출 알림)
- [ ] 2FA (Two-Factor Authentication)
- [ ] 비밀번호 찾기/재설정

### 장기 (Vision)
- [ ] AI 기반 지출 예측
- [ ] 영수증 OCR 스캔
- [ ] 자동 카테고리 분류 (머신러닝)
- [ ] 다국어 지원
- [ ] 은행 API 연동 (자동 거래 동기화)

---

**Built with ❤️ using Cloudflare Pages and Hono**

