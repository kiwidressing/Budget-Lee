# 🚀 프로덕션 배포 가이드 (Session 10)

## ✅ 로컬 테스트 완료

### 테스트 결과 요약

#### 1. PWA 오프라인 지원 ✅
- Service Worker 등록: 정상
- 정적 파일 캐시: Cache First 전략 작동
- API 요청: Network Only 작동
- 로딩 시간: 16ms

#### 2. Yahoo Finance API 캐시 ✅
- 첫 요청: 340ms (실제 API 호출)
- 캐시 요청: 54ms (84% 속도 향상)
- 폴백: API 실패 시 시뮬레이션 데이터로 자동 전환
- 사용자 피드백: "엄청 빨라졌어" ⭐

#### 3. axios 인터셉터 에러 처리 ✅
- 401: 자동 로그아웃 및 로그인 화면 이동
- 403/404/500/503: 적절한 에러 메시지
- 네트워크 오류: 연결 확인 안내

#### 4. 월별 통계 캐시 ✅
**CRUD 테스트 완료:**

| 작업 | 테스트 내용 | 결과 |
|------|-------------|------|
| **CREATE** | 거래 생성 (income, expense, savings) | ✅ 캐시 자동 생성 |
| **UPDATE** | 지출 35,000원 → 50,000원 수정 | ✅ 캐시 자동 업데이트 |
| **DELETE** | 수입 거래 삭제 | ✅ 캐시 자동 재계산 |

**PM2 로그 확인:**
```
[Cache] Monthly summary updated: 2025-10 for user 2
```

**캐시 테이블 최종 상태:**
```json
{
  "year_month": "2025-10",
  "user_id": "2",
  "income": 0,
  "expense": 50000,
  "savings": 1000000,
  "transaction_count": 2,
  "updated_at": "2025-10-28 15:12:29"
}
```

**API 응답:**
```json
{
  "success": true,
  "summary": [...],
  "expenseByCategory": [...],
  "cached": true  ← 캐시 사용 확인
}
```

## 🚀 프로덕션 배포 단계

### 1단계: Cloudflare API 키 설정

#### 옵션 A: Deploy 탭에서 설정 (권장)
1. 사이드바에서 **Deploy** 탭 클릭
2. Cloudflare API 키 생성 가이드 따라하기
3. API 키 입력 및 저장

#### 옵션 B: 수동 로그인
```bash
npx wrangler login
```

### 2단계: 프로덕션 D1 마이그레이션 실행

```bash
# 프로덕션 데이터베이스에 새 마이그레이션 적용
cd /home/user/webapp
npx wrangler d1 migrations apply webapp-production
```

**예상 출력:**
```
Migrations to be applied:
┌──────────────────────────────────┐
│ name                             │
├──────────────────────────────────┤
│ 0015_add_monthly_summary.sql     │
└──────────────────────────────────┘
```

### 3단계: 프로덕션 빌드 및 배포

```bash
# 빌드
npm run build

# Cloudflare Pages 배포
npm run deploy:prod
```

**예상 결과:**
```
✨ Compiled Worker successfully
✨ Success! Uploaded 1 files

🌎 Deploying...
✨ Deployment complete!

URLs:
  https://budgetlee.pages.dev (Production)
  https://main.budgetlee.pages.dev (Branch)
```

### 4단계: 배포 확인

```bash
# 1. 프로덕션 URL 접속
curl https://budgetlee.pages.dev

# 2. API 헬스 체크
curl https://budgetlee.pages.dev/api/auth/me

# 3. 마이그레이션 확인
npx wrangler d1 execute webapp-production \
  --command="SELECT name FROM sqlite_master WHERE type='table' AND name='monthly_summary'"
```

### 5단계: 캐시 동작 확인

프로덕션 앱에서:
1. 로그인 또는 회원가입
2. 거래 생성 (수입/지출/저축)
3. 월별 통계 페이지 확인
4. 브라우저 개발자 도구 → Network 탭에서 응답 확인
   - `cached: true` 플래그 확인

## 📊 성능 모니터링

### 캐시 효과 측정

**프로덕션에서 확인할 지표:**
1. **월별 통계 API 응답 시간**
   - Before: ~200-500ms (매번 집계 쿼리)
   - After: ~50-100ms (캐시 조회)

2. **Yahoo Finance API**
   - 첫 요청: ~300-500ms
   - 캐시 히트: ~50-100ms

3. **Service Worker 캐시**
   - 정적 파일: ~10-50ms (캐시)
   - API 요청: Network only

### Cloudflare 대시보드 확인

1. [Cloudflare Dashboard](https://dash.cloudflare.com) 접속
2. **Pages** 섹션에서 `budgetlee` 프로젝트 선택
3. **Analytics** 탭:
   - 요청 수
   - 응답 시간
   - 에러율
   - 대역폭 사용량

4. **D1** 섹션에서 `webapp-production` 선택:
   - 쿼리 수
   - 읽기/쓰기 작업
   - 스토리지 사용량

## 🔧 문제 해결

### 마이그레이션 실패 시
```bash
# 마이그레이션 목록 확인
npx wrangler d1 migrations list webapp-production

# 특정 마이그레이션 재실행
npx wrangler d1 migrations apply webapp-production --force
```

### 배포 실패 시
```bash
# 빌드 오류 확인
npm run build

# 로그 확인
npx wrangler pages deployment list --project-name budgetlee

# 롤백 (필요시)
npx wrangler pages deployment tail --project-name budgetlee
```

### 캐시가 작동하지 않을 때
1. 브라우저 개발자 도구에서 API 응답 확인
2. `cached: false` 인 경우: 캐시가 아직 생성되지 않음 (정상)
3. `cached: true` 인 경우: 캐시 정상 작동
4. 캐시 테이블 직접 확인:
```bash
npx wrangler d1 execute webapp-production \
  --command="SELECT COUNT(*) as count FROM monthly_summary"
```

## 📝 배포 체크리스트

- [ ] Cloudflare API 키 설정 완료
- [ ] 로컬 테스트 통과 확인
- [ ] Git 커밋 및 푸시 완료
- [ ] 프로덕션 마이그레이션 실행
- [ ] 프로덕션 빌드 성공
- [ ] Cloudflare Pages 배포 성공
- [ ] 프로덕션 URL 접속 확인
- [ ] 회원가입/로그인 테스트
- [ ] 거래 생성 및 캐시 동작 확인
- [ ] Yahoo Finance API 동작 확인
- [ ] Service Worker 캐시 확인

## 🎉 배포 완료 후

### README 업데이트
- [ ] 프로덕션 URL 업데이트
- [ ] 새 기능 문서화
- [ ] 성능 개선 지표 추가

### 모니터링 설정
- [ ] Cloudflare Analytics 확인
- [ ] D1 사용량 모니터링
- [ ] 에러 로그 확인

### 다음 스프린트 계획
- [ ] PBKDF2 비밀번호 해싱 (Task 6)
- [ ] Access/Refresh 토큰 시스템 (Task 7)
- [ ] Accounts + Transfers 모델 (Task 8)

---

**Built with ❤️ using Cloudflare Pages + Hono + D1**
