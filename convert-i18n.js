// 한글 텍스트를 t() 함수로 변환하는 스크립트
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'public/static/app.js');
let content = fs.readFileSync(appJsPath, 'utf-8');

// 번역 매핑 (한글 -> 영어 키)
const translations = {
  // 탭
  '홈': 'tab.home',
  '월별': 'tab.month',
  '주별': 'tab.week',
  '저축': 'tab.savings',
  '채무': 'tab.debts',
  '투자': 'tab.investments',
  '고정지출': 'tab.fixed_expenses',
  '예산': 'tab.budgets',
  '리포트': 'tab.reports',
  '설정': 'tab.settings',
  
  // 공통
  '추가': 'common.add',
  '수정': 'common.edit',
  '삭제': 'common.delete',
  '취소': 'common.cancel',
  '저장': 'common.save',
  '닫기': 'common.close',
  '확인': 'common.confirm',
  '검색': 'common.search',
  '필터': 'common.filter',
  '전체': 'common.all',
  '로딩 중...': 'common.loading',
  '오류': 'common.error',
  '성공': 'common.success',
  '날짜': 'common.date',
  '금액': 'common.amount',
  '카테고리': 'common.category',
  '설명': 'common.description',
  '메모': 'common.memo',
  '합계': 'common.total',
  '수입': 'common.income',
  '지출': 'common.expense',
  '잔액': 'common.balance',
  '년': 'common.year',
  '월': 'common.month',
  '주': 'common.week',
  '일': 'common.day',
  '원': 'common.won',
  '건': 'common.count',
  '평균': 'common.average',
  '선택': 'common.select',
  '필수': 'common.required',
  '선택': 'common.optional',
  '예': 'common.yes',
  '아니오': 'common.no',
};

// 문자열 내의 한글을 t() 함수로 변환
function convertToT(match, quote, text) {
  // 이미 t() 함수 호출인 경우 스킵
  if (match.includes('${') || match.includes('t(')) {
    return match;
  }
  
  // 한글이 포함된 경우에만 변환
  if (/[가-힣]/.test(text)) {
    // 번역 키 찾기
    const key = translations[text];
    if (key) {
      return `t('${key}')`;
    }
  }
  
  return match;
}

// 백틱 문자열 내의 한글을 찾아서 ${t()} 형태로 변환
function convertTemplateStrings(content) {
  // 작은따옴표, 큰따옴표로 감싸진 한글 문자열 찾기
  content = content.replace(/(['"])(.*?[가-힣].*?)\1/g, (match, quote, text) => {
    const trimmed = text.trim();
    const key = translations[trimmed];
    if (key) {
      return `t('${key}')`;
    }
    return match;
  });
  
  return content;
}

// 변환 실행
const converted = convertTemplateStrings(content);

// 백업 생성
fs.writeFileSync(appJsPath + '.backup', content);
console.log('✅ Backup created: app.js.backup');

// 변환된 파일 저장
fs.writeFileSync(appJsPath, converted);
console.log('✅ Conversion complete!');
console.log(`📊 Original size: ${content.length} bytes`);
console.log(`📊 Converted size: ${converted.length} bytes`);
