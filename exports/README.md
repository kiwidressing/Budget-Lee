# 가계부 앱 - 리소스 익스포트 📦

이 폴더에는 가계부 앱의 **모든 디자인 리소스**와 **레이아웃/템플릿 파일**이 포함되어 있습니다.

---

## 📁 폴더 구조

```
exports/
├── icons/              # 앱 아이콘 파일들 (6개)
├── backgrounds/        # CSS 그라디언트로 생성된 배경 이미지들 (8개)
├── layouts/            # 레이아웃/템플릿 핵심 파일들 (4개)
└── README.md          # 이 파일
```

---

## 🎨 1. Icons (아이콘)

### 포함된 파일 (6개)
| 파일명 | 크기 | 용도 |
|--------|------|------|
| `icon.svg` | 1.2KB | 벡터 아이콘 (확대/축소 가능) |
| `apple-touch-icon.png` | 43KB | iOS 홈 화면 아이콘 |
| `icon-192x192.png` | 48KB | PWA 아이콘 (작은 크기) |
| `icon-512x512.png` | 328KB | PWA 아이콘 (중간 크기) |
| `icon-original.png` | 334KB | 원본 고해상도 아이콘 |
| `favicon.ico` | 4.2KB | 브라우저 탭 아이콘 |

### 사용 방법
```html
<!-- HTML에서 사용 -->
<link rel="icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
```

---

## 🌈 2. Backgrounds (배경 이미지)

### 생성 방식
원래 앱은 **CSS 그라디언트**를 사용하여 배경을 렌더링합니다.  
이 폴더에는 CSS 그라디언트를 **실제 PNG 이미지**로 변환한 파일들이 포함되어 있습니다.

### 포함된 파일 (8개)

#### Light Mode (라이트 모드) - 4개
1. **`bg_light_1_fhd_1920x1080.png`** (Full HD)
   - 색상: Rose Quartz (#E8D5D2) → Serenity Blue (#C5D5EA) → Lavender Gray (#D4CCE8)
   - 기본 배경으로 사용되는 그라디언트

2. **`bg_light_1_hd_1366x768.png`** (HD)
   - 위와 동일한 그라디언트 (작은 해상도)

3. **`bg_light_2_fhd_1920x1080.png`** (Full HD)
   - 색상: #F8E5E0 → #D4E4F7 → #E6DDF5
   - 대체 배경 (더 밝은 톤)

4. **`bg_light_2_hd_1366x768.png`** (HD)
   - 위와 동일한 그라디언트 (작은 해상도)

#### Dark Mode (다크 모드) - 4개
5. **`bg_dark_1_fhd_1920x1080.png`** (Full HD)
   - 색상: #1a1f2e → #0f1419 → #1a1f2e
   - 다크 모드 기본 배경

6. **`bg_dark_1_hd_1366x768.png`** (HD)
   - 위와 동일한 그라디언트 (작은 해상도)

7. **`bg_dark_2_fhd_1920x1080.png`** (Full HD)
   - 색상: #2a2f3e → #1f242e → #2a2f3e
   - 다크 모드 대체 배경

8. **`bg_dark_2_hd_1366x768.png`** (HD)
   - 위와 동일한 그라디언트 (작은 해상도)

### CSS 원본 코드
원래 앱에서 사용하는 CSS:
```css
/* Light Mode */
--bg-gradient: linear-gradient(135deg, #E8D5D2 0%, #C5D5EA 50%, #D4CCE8 100%);
--bg-gradient-2: linear-gradient(135deg, #F8E5E0 0%, #D4E4F7 50%, #E6DDF5 100%);

/* Dark Mode */
--bg-gradient: linear-gradient(135deg, #1a1f2e 0%, #0f1419 50%, #1a1f2e 100%);
--bg-gradient-2: linear-gradient(135deg, #2a2f3e 0%, #1f242e 50%, #2a2f3e 100%);
```

### 사용 방법
```css
/* CSS에서 이미지로 사용 */
body {
  background-image: url('/backgrounds/bg_light_1_fhd_1920x1080.png');
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}
```

---

## 📐 3. Layouts (레이아웃/템플릿)

### 포함된 파일 (4개)

#### 1. **`style.css`** (1,122줄, 핵심 디자인 시스템)
**완전한 Glassmorphism 디자인 시스템**

##### 주요 구성 요소:
```css
/* 컬러 팔레트 - Pantone Soft Colors */
:root {
  --primary: #C9ADA7;        /* Rose Quartz */
  --secondary: #9CADCE;      /* Serenity Blue */
  --accent: #B4A7D6;         /* Lavender Gray */
  --success: #A8DADC;        /* Mint Cream */
  --warning: #F1C6A0;        /* Apricot Cream */
  --danger: #E8B4B8;         /* Dusty Rose */
  
  /* Glass Effect */
  --glass-white: rgba(255, 255, 255, 0.15);
  --glass-border: rgba(255, 255, 255, 0.5);
  
  /* Shadows */
  --shadow-glass: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
}
```

##### 주요 기능:
- ✅ **Glassmorphism 효과**: `backdrop-filter: blur(40px)`
- ✅ **다크 모드 지원**: `.dark` 클래스 자동 전환
- ✅ **반응형 디자인**: 모바일/태블릿/데스크톱
- ✅ **애니메이션**: 부드러운 전환 효과
- ✅ **컴포넌트 스타일**: 카드, 버튼, 입력 필드, 모달 등

##### 커스터마이징:
```css
/* 색상 변경 */
:root {
  --primary: #YOUR_COLOR;
  --bg-gradient: linear-gradient(135deg, #COLOR1 0%, #COLOR2 50%, #COLOR3 100%);
}

/* Glass 효과 강도 조절 */
.glass-card {
  backdrop-filter: blur(40px);  /* 40px → 원하는 값 */
  background: rgba(255, 255, 255, 0.15);  /* 투명도 조절 */
}
```

---

#### 2. **`app.js`** (7,875줄, 301KB - 메인 프론트엔드 로직)
**모든 UI 렌더링 및 기능 구현**

##### 주요 기능:
- 📊 **데이터 관리**: 수입/지출 CRUD
- 📈 **차트 렌더링**: Chart.js 통합
- 🔄 **실시간 업데이트**: 데이터 동기화
- 📱 **PWA 지원**: 오프라인 동작
- 🎨 **UI 렌더링**: 모든 화면 구성

##### 핵심 함수들:
```javascript
// 데이터 로딩
async function loadData() { ... }

// 차트 렌더링
function renderChart(data) { ... }

// 모달 표시
window.showHelpModal = function() { ... }

// 언어 전환
function changeLanguage(lang) { ... }
```

---

#### 3. **`i18n.js`** (1,433줄, 63KB - 다국어 지원)
**한국어/영어 번역 시스템**

##### 지원 언어:
- 🇰🇷 한국어 (ko)
- 🇺🇸 영어 (en)

##### 구조:
```javascript
const translations = {
  ko: {
    'help.title': '가계부 앱 사용 방법',
    'button.add': '추가',
    'label.income': '수입',
    // ... 총 58개 키
  },
  en: {
    'help.title': 'How to Use Budget App',
    'button.add': 'Add',
    'label.income': 'Income',
    // ... 총 58개 키
  }
};

// 사용 방법
const text = t('help.title');  // 현재 언어에 맞는 번역 반환
```

##### 번역 추가 방법:
```javascript
// i18n.js에 추가
translations.ko['your.new.key'] = '새로운 텍스트';
translations.en['your.new.key'] = 'New Text';

// app.js에서 사용
const text = t('your.new.key');
```

---

#### 4. **`index.tsx`** (TypeScript - HTML 템플릿 생성기)
**백엔드에서 HTML을 생성하는 Hono 서버**

##### 구조:
```typescript
app.get('/', (c) => {
  return c.html(
    <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <title>가계부</title>
        <link rel="stylesheet" href="/static/style.css" />
      </head>
      <body class="bg-gray-100">
        {/* 앱 컨테이너 */}
        <div id="app"></div>
        
        {/* 스크립트 로드 */}
        <script src="/static/i18n.js"></script>
        <script src="/static/app.js"></script>
      </body>
    </html>
  );
});
```

##### 커스터마이징:
- `<html lang="ko">` → 기본 언어 변경
- `<body class="...">` → 배경 스타일 변경
- 메타 태그 추가 (SEO, PWA 등)

---

## 🚀 사용 가이드

### 1. 아이콘 교체
```bash
# 원하는 아이콘으로 교체
cp your-icon.svg exports/icons/icon.svg
cp your-icon.png exports/icons/icon-512x512.png
```

### 2. 배경 변경
```css
/* style.css 수정 */
:root {
  --bg-gradient: linear-gradient(135deg, #YOUR_COLOR1 0%, #YOUR_COLOR2 100%);
}

/* 또는 이미지 사용 */
body {
  background-image: url('/backgrounds/bg_light_1_fhd_1920x1080.png');
}
```

### 3. 색상 테마 변경
```css
/* style.css의 :root 섹션 수정 */
:root {
  --primary: #C9ADA7;     /* 원하는 색상으로 변경 */
  --secondary: #9CADCE;
  --accent: #B4A7D6;
}
```

### 4. 새 언어 추가
```javascript
// i18n.js에 추가
translations.ja = {  // 일본어 예시
  'help.title': 'アプリの使い方',
  // ...
};
```

---

## 📊 파일 크기 요약

| 카테고리 | 파일 수 | 총 크기 |
|---------|---------|---------|
| Icons | 6개 | ~760KB |
| Backgrounds | 8개 | ~8MB |
| Layouts | 4개 | ~370KB |
| **합계** | **18개** | **~9.1MB** |

---

## 🎨 디자인 컨셉

### Glassmorphism (글라스모피즘)
- **반투명 유리 효과**: `backdrop-filter: blur()`
- **부드러운 그림자**: 입체감 강조
- **밝은 테두리**: 유리 가장자리 효과
- **배경 그라디언트**: 파스텔 톤 조화

### Pantone Soft Palette (팬톤 소프트 팔레트)
- **Rose Quartz** (#C9ADA7): 따뜻한 핑크
- **Serenity Blue** (#9CADCE): 차분한 블루
- **Lavender Gray** (#B4A7D6): 부드러운 보라

---

## 🛠️ 기술 스택

- **프론트엔드**: Vanilla JavaScript + Chart.js
- **스타일**: Custom CSS (Glassmorphism)
- **번역**: Custom i18n 시스템
- **백엔드**: Hono (TypeScript)
- **PWA**: Service Worker + Manifest

---

## 📝 참고사항

1. **배경 이미지는 선택사항**: 원래 앱은 CSS 그라디언트를 사용하므로 이미지 없이도 동작합니다.
2. **성능 최적화**: 이미지 대신 CSS 그라디언트 사용을 권장합니다 (더 빠른 로딩).
3. **커스터마이징**: `style.css`의 CSS 변수만 수정하면 전체 테마 변경 가능합니다.
4. **반응형 디자인**: 모든 화면 크기에 자동으로 최적화되어 있습니다.

---

## 📧 문의

추가 리소스나 커스터마이징이 필요하시면 언제든지 문의하세요! 😊

---

**생성일**: 2025-11-04  
**버전**: 1.0  
**라이선스**: 프로젝트 라이선스와 동일
