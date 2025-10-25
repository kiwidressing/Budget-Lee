# 📱 PWA 아이콘 설정 가이드

PWA로 설치할 때 표시되는 앱 아이콘을 설정하는 방법입니다.

## 필요한 아이콘 크기

- **192x192 픽셀** - 기본 아이콘
- **512x512 픽셀** - 고해상도 아이콘

## 아이콘 생성 방법

### 옵션 1: 온라인 도구 사용 (가장 쉬움)

1. **Canva** (https://canva.com)
   - 무료 계정 생성
   - "앱 아이콘" 템플릿 선택
   - 지갑 아이콘 추가
   - 192x192, 512x512 크기로 다운로드

2. **Favicon Generator** (https://realfavicongenerator.net)
   - 원본 이미지 업로드
   - PWA 설정 선택
   - 모든 크기 자동 생성

3. **Figma** (https://figma.com)
   - 무료 계정
   - Frame 생성 (192x192)
   - 디자인 후 Export PNG

### 옵션 2: 임시 아이콘 생성 (빠른 테스트용)

**간단한 이모지 아이콘:**

```html
<!-- 브라우저 콘솔에서 실행 -->
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#3B82F6"/>
  <text x="50%" y="50%" font-size="256" text-anchor="middle" dy=".3em">💰</text>
</svg>
```

### 옵션 3: 전문 디자이너 의뢰

- Fiverr, 크몽 등에서 앱 아이콘 디자인 의뢰
- 가격: 5,000원 ~ 50,000원

## 아이콘 파일 위치

생성한 아이콘을 다음 위치에 저장:

```
/home/user/webapp/public/
├── icon-192.png  (192x192 픽셀)
└── icon-512.png  (512x512 픽셀)
```

## 현재 상태

⚠️ **아이콘 파일이 아직 없습니다!**

배포 전에 반드시 아이콘 파일을 추가해야 합니다.

### 임시 해결 방법

아이콘이 없어도 앱은 작동하지만, 기본 브라우저 아이콘이 표시됩니다.

### 빠른 테스트용 아이콘

아래 명령어로 임시 placeholder 생성:

```bash
# 빨간색 정사각형 (개발용)
cd /home/user/webapp/public
convert -size 192x192 xc:#3B82F6 -gravity center -pointsize 120 -annotate +0+0 "💰" icon-192.png
convert -size 512x512 xc:#3B82F6 -gravity center -pointsize 320 -annotate +0+0 "💰" icon-512.png
```

## 디자인 권장사항

### 색상
- **Primary**: #3B82F6 (파란색)
- **Background**: #FFFFFF (흰색)
- **Icon**: 지갑, 돈, 차트 등

### 스타일
- 간결하고 명확한 디자인
- 작은 크기에서도 식별 가능
- 브랜드 컬러 일관성

### 예시 콘셉트
- 💰 지갑 아이콘
- 📊 차트와 돈
- 💳 신용카드 스타일
- 📱 가계부 노트

## 테스트 방법

1. 아이콘 파일 추가
2. `npm run build` 실행
3. 로컬에서 테스트: http://localhost:3000
4. 개발자 도구 → Application → Manifest 확인
5. 아이콘이 제대로 표시되는지 확인

## 문제 해결

### 아이콘이 표시되지 않음
- 파일 이름 확인: `icon-192.png`, `icon-512.png`
- 파일 위치 확인: `/public/` 디렉토리
- 빌드 후 `/dist/` 에 복사되었는지 확인
- 브라우저 캐시 삭제 후 재시도

### 아이콘이 깨져 보임
- PNG 형식 확인
- 정확한 크기 확인 (192x192, 512x512)
- 투명 배경 사용 시 배경색 확인

---

**다음 단계:** 아이콘 준비 완료 후 배포 진행
