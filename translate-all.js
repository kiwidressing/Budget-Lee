// 모든 한글 문자열을 영어로 교체하는 스크립트
const fs = require('fs');

// 번역 매핑 (한글 -> 영어)
const translations = {
  // 공통
  '선택': 'Select',
  '선택하세요': 'Select',
  '검색': 'Search',
  '선택은 검색': 'Search to select',
  '실명으로 검색': 'Search by name',
  
  // 설정
  '설정': 'Settings',
  '초기 총 잔액 (카드 + 현금)': 'Initial Total Balance (Card + Cash)',
  '초기 현금 보유액': 'Initial Cash on Hand',
  '가계부 시작 시점의 전체 자산 (카드 잔액 + 현금 + 저축 포함)': 'Total assets at budget start (card + cash + savings)',
  '가계부 시작 시점에 현금으로 보유한 금액': 'Cash amount held at budget start',
  '배경 테마': 'Background Theme',
  '앱 배경 색상을 선택하세요': 'Select app background color',
  '다크모드': 'Dark Mode',
  '다크모드 켜짐': 'Dark Mode On',
  '라이트모드': 'Light Mode',
  '어두운 화면에서 눈의 피로를 줄입니다': 'Reduce eye strain in dark environments',
  '도움말': 'Help',
  '앱 사용 방법과 주요 기능을 확인하세요': 'Learn how to use the app',
  '사용 방법 보기': 'View Instructions',
  '데이터 내보내기': 'Export Data',
  '재무 데이터를 엑셀이나 JSON 형식으로 내보낼 수 있습니다': 'Export financial data to Excel or JSON',
  '엑셀 (.csv)': 'Excel (.csv)',
  '데이터 복원': 'Import Data',
  '백업한 JSON 파일에서 데이터를 복원할 수 있습니다': 'Restore data from backup JSON file',
  '불러오기': 'Import',
  '설정 저장': 'Save Settings',
  
  // 홈
  '안녕하세요': 'Hello',
  '이민호님': 'User',
  '님': '',
  '로그아웃': 'Logout',
  '빠른 추가': 'Quick Add',
  '최근 거래': 'Recent Transactions',
  '이번 달': 'This Month',
  '저축률': 'Savings Rate',
  '예산 vs 지출': 'Budget vs Spending',
  '월별 실시 현황': 'Monthly Overview',
  
  // 월별/주별/연도
  '월별 지출 현황': 'Monthly Spending',
  '주별 지출 현황': 'Weekly Spending',
  '년': 'Year',
  '월': 'Month',
  '주': 'Week',
  '일': 'Day',
  '지출 추이': 'Spending Trend',
  '수입/지출/저축 비교': 'Income/Expense/Savings Comparison',
  '카테고리별 지출': 'Spending by Category',
  
  // 거래
  '거래 추가': 'Add Transaction',
  '거래 수정': 'Edit Transaction',
  '거래 유형': 'Transaction Type',
  '거래내역': 'Transaction History',
  '최근 거래 내역': 'Recent Transactions',
  '이번 달에 예정된 고정지출이 없습니다': 'No fixed expenses scheduled this month',
  '거래 내역이 없습니다': 'No transactions',
  '지출 내역이 없습니다': 'No expenses',
  
  // 채무
  '채무 관리': 'Debt Management',
  '총 채권액': 'Total Receivables',
  '남은 금액': 'Remaining Balance',
  '상환 완료': 'Fully Repaid',
  '상환율': 'Repayment Rate',
  '진행 중인 채무': 'Ongoing Debts',
  '이자 계산기': 'Interest Calculator',
  '목표 설정하기': 'Set Goal',
  '상환 내역 보기': 'View Repayment History',
  
  // 저축
  '저축 관리': 'Savings Management',
  '총 저축액': 'Total Savings',
  '저축 통장 목록': 'Savings Accounts',
  '저축 목표 달성률': 'Savings Goal Progress',
  '자축': 'Savings',
  '이자': 'Interest',
  
  // 투자
  '투자 관리': 'Investment Management',
  '실시간 주식 현황': 'Real-time Stock Status',
  '총 투자금': 'Total Investment',
  '현재 평가액': 'Current Valuation',
  '평가 손익': 'Unrealized P&L',
  '수익률': 'Return Rate',
  '진행 내역 보기': 'View Transaction History',
  '주식': 'Stock',
  
  // 고정지출
  '고정지출 관리': 'Fixed Expenses',
  '고정지출을 한눈에 관리하세요': 'Manage fixed expenses at a glance',
  '카테고리별 예산 설정': 'Set Budget by Category',
  
  // 예산
  '예산 관리': 'Budget Management',
  '예산 설정': 'Set Budget',
  '예산 초과': 'Over Budget',
  
  // 영수증
  '영수증 관리': 'Receipt Management',
  '영수증 추가': 'Add Receipt',
  '라라': 'Lala',
  '의료비': 'Medical',
  '보기': 'View',
  '저장': 'Save',
  '다운로드': 'Download',
  '삭제': 'Delete',
  
  // 리포트
  '리포트': 'Reports',
  '월 지출 현황': 'Monthly Spending Status',
  '수입/지출/저축 비율': 'Income/Expense/Savings Ratio',
  '수입': 'Income',
  '지출': 'Expense',
  '저축': 'Savings',
  
  // 카테고리
  '식비': 'Food',
  '교통': 'Transportation',
  '문화': 'Entertainment',
  '의료': 'Medical',
  '쇼핑': 'Shopping',
  '교육': 'Education',
  '주거': 'Housing',
  '기타': 'Other',
  '전체': 'All',
  
  // 버튼/액션
  '추가': 'Add',
  '수정': 'Edit',
  '취소': 'Cancel',
  '확인': 'Confirm',
  '닫기': 'Close',
  
  // 메시지
  '데이터가 없습니다': 'No data available',
  '로딩 중...': 'Loading...',
  '저장되었습니다': 'Saved',
  '삭제되었습니다': 'Deleted',
  
  // 기타
  '사용자': 'User',
  '이민호': 'User',
  '대여 관리': 'Loan Management',
  '통화': 'Currency',
  '언어': 'Language',
  '한국어': '한국어',
  'English': 'English',
};

// app.js 파일 읽기
let content = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf-8');

// 각 번역 적용 (긴 문자열부터 처리하여 부분 매칭 방지)
const sortedKeys = Object.keys(translations).sort((a, b) => b.length - a.length);

let replaceCount = 0;
for (const korean of sortedKeys) {
  const english = translations[korean];
  const regex = new RegExp(`['"]${korean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g');
  const beforeLength = content.length;
  content = content.replace(regex, `'${english}'`);
  if (content.length !== beforeLength) {
    replaceCount++;
    console.log(`Replaced: "${korean}" -> "${english}"`);
  }
}

// 결과 저장
fs.writeFileSync('/home/user/webapp/public/static/app.js', content);
console.log(`\n✅ Translation complete! Replaced ${replaceCount} strings.`);
