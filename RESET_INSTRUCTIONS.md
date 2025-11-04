# 🔄 Budget Lee 완전 초기화 가이드

## ⚠️ 중요: 반드시 순서대로 진행하세요!

### 1단계: 브라우저에서 로그아웃
1. Budget Lee 앱 열기
2. **Settings (설정)** 탭 클릭
3. **Logout (로그아웃)** 버튼 클릭

### 2단계: 브라우저 완전 초기화 (필수!)

#### 옵션 A - 개발자 도구로 완전 삭제 (가장 확실)
1. **F12** 눌러서 개발자 도구 열기
2. **Application** 탭 클릭
3. 왼쪽 **Storage** 메뉴에서 **Clear site data** 클릭
4. 모든 항목 체크:
   - ✅ Cookies and site data
   - ✅ Cache storage and images
   - ✅ Local and session storage
5. **Clear site data** 버튼 클릭
6. 브라우저 탭 **완전히 닫기**

#### 옵션 B - Incognito/Private 모드 (빠른 테스트)
1. **새 시크릿/프라이빗 브라우징 창** 열기
2. `http://localhost:3000` 또는 실제 URL 접속
3. 완전히 깨끗한 상태로 시작

### 3단계: 새 사용자로 가입
1. **Sign Up (회원가입)** 선택
2. 새로운 username과 4자리 PIN 입력
3. 로그인

### 4단계: 확인사항
- [ ] **Home** 화면의 Monthly Budget Status가 **비어있음**
- [ ] "월별 예산 현황" 섹션에 "예산이 설정되지 않았습니다" 메시지 표시
- [ ] Food, Insurance 등 이전 데이터 **완전히 사라짐**

### 5단계: 테스트
1. **Budgets** 탭에서 새 예산 설정 (예: Food 1000원)
2. **Home** 탭으로 돌아가기
3. **즉시 반영**되는지 확인

---

## 🔧 여전히 문제가 있다면?

### 서버 완전 재시작
```bash
cd /home/user/webapp
pm2 stop webapp
rm -rf .wrangler/state/v3/d1
npx wrangler d1 migrations apply webapp-production --local
pm2 start webapp
```

### 브라우저 하드 리프레시
- **Windows/Linux**: Ctrl + Shift + R
- **Mac**: Cmd + Shift + R
- **Mobile**: 브라우저 설정 → 캐시 삭제

---

## 💡 왜 이렇게 해야 하나요?

### 문제의 원인:
1. **브라우저 세션 토큰**: 이전 사용자의 인증 토큰이 localStorage에 남아있음
2. **캐시된 API 응답**: 브라우저가 이전 API 응답을 캐싱
3. **Service Worker**: 백그라운드에서 오래된 데이터 서빙

### 해결 방법:
- **로그아웃**: 세션 토큰 제거
- **Site Data 삭제**: 모든 캐시와 저장소 완전 삭제
- **새 사용자**: 완전히 새로운 세션으로 시작

---

## ✅ 성공 확인

초기화가 성공하면:
- 🟢 Monthly Budget Status 섹션이 비어있음
- 🟢 이전 예산 데이터 (Food, Insurance) 완전히 사라짐
- 🟢 새 예산 설정 시 즉시 반영됨
- 🟢 지출 추가 시 예산 차감 정상 작동

---

**데이터베이스는 이미 완전히 초기화되었습니다!**
**이제 브라우저만 초기화하면 됩니다!** 🎉
