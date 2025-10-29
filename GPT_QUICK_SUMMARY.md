# 로그인 문제 - 간단 요약

## 문제
브라우저에서 로그인/회원가입이 안됩니다.

## 상황
- ✅ 서버 API는 정상 작동 (curl로 테스트 시 성공)
- ✅ 로그인 화면은 표시됨
- ❌ 브라우저에서 로그인 버튼 클릭 시 실패
- ❌ 회원가입도 실패

## 테스트 결과
```bash
# 서버 직접 테스트 (성공)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"1234"}'
→ 성공, 토큰 발급됨
```

## 의심 지점
1. 프론트엔드 handleLogin 함수 문제?
2. axios 요청 경로 문제?
3. 브라우저 캐시 문제?
4. CORS 문제?

## 기술 스택
- 백엔드: Hono (Cloudflare Workers)
- 프론트엔드: Vanilla JavaScript + axios
- DB: Cloudflare D1 (SQLite)
- 인증: PBKDF2 + JWT

## URL
- 개발 서버: https://3000-ilfxg66dle2ykyvgdbe6r-c07dda5e.sandbox.novita.ai
- GitHub: https://github.com/kiwidressing/Budget-Lee

## 핵심 질문
**브라우저 콘솔에 무슨 에러가 나오나요?**
- F12 → Console 탭 확인
- F12 → Network 탭에서 /api/auth/login 요청 확인

상세 내용은 `GPT_LOGIN_ISSUE.md` 파일 참고
