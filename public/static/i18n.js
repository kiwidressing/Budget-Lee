// 다국어 지원 시스템
const translations = {
  ko: {
    // 탭 메뉴
    'tab.home': '홈',
    'tab.month': '월별',
    'tab.week': '주별',
    'tab.savings': '저축',
    'tab.debts': '채무',
    'tab.investments': '투자',
    'tab.fixed_expenses': '고정지출',
    'tab.budgets': '예산',
    'tab.reports': '리포트',
    'tab.settings': '설정',
    
    // 공통
    'common.add': '추가',
    'common.edit': '수정',
    'common.delete': '삭제',
    'common.cancel': '취소',
    'common.save': '저장',
    'common.close': '닫기',
    'common.confirm': '확인',
    'common.search': '검색',
    'common.filter': '필터',
    'common.all': '전체',
    'common.loading': '로딩 중...',
    'common.error': '오류',
    'common.success': '성공',
    'common.date': '날짜',
    'common.amount': '금액',
    'common.category': '카테고리',
    'common.description': '설명',
    'common.memo': '메모',
    'common.total': '합계',
    'common.income': '수입',
    'common.expense': '지출',
    'common.balance': '잔액',
    'common.year': '년',
    'common.month': '월',
    'common.week': '주',
    'common.day': '일',
    'common.won': '원',
    'common.count': '건',
    'common.average': '평균',
    'common.select': '선택',
    'common.required': '필수',
    'common.optional': '선택',
    'common.yes': '예',
    'common.no': '아니오',
    
    // 홈 화면
    'home.title': '가계부 앱',
    'home.quick_add': '빠른 추가',
    'home.recent_transactions': '최근 거래',
    'home.this_month': '이번 달',
    'home.summary': '요약',
    'home.no_transactions': '거래 내역이 없습니다',
    
    // 거래 추가/수정
    'transaction.add': '거래 추가',
    'transaction.edit': '거래 수정',
    'transaction.type': '유형',
    'transaction.type.income': '수입',
    'transaction.type.expense': '지출',
    'transaction.type.savings': '저축',
    'transaction.date': '날짜',
    'transaction.amount': '금액',
    'transaction.category': '카테고리',
    'transaction.description': '내용',
    'transaction.memo': '메모',
    'transaction.payment_method': '결제 수단',
    'transaction.delete_confirm': '이 거래를 삭제하시겠습니까?',
    
    // 카테고리
    'category.food': '식비',
    'category.transport': '교통',
    'category.shopping': '쇼핑',
    'category.entertainment': '문화/여가',
    'category.health': '의료/건강',
    'category.education': '교육',
    'category.housing': '주거/통신',
    'category.other': '기타',
    'category.salary': '급여',
    'category.business': '사업',
    'category.investment': '투자',
    'category.allowance': '용돈',
    'category.bonus': '상여',
    
    // 결제 수단
    'payment.cash': '현금',
    'payment.card': '카드',
    'payment.transfer': '이체',
    'payment.other': '기타',
    
    // 저축
    'savings.title': '저축 관리',
    'savings.goal': '목표',
    'savings.current': '현재',
    'savings.target': '목표액',
    'savings.progress': '달성률',
    'savings.add_goal': '저축 목표 추가',
    'savings.edit_goal': '저축 목표 수정',
    'savings.goal_name': '목표 이름',
    'savings.target_amount': '목표 금액',
    'savings.current_amount': '현재 금액',
    'savings.deadline': '목표 기한',
    'savings.add_transaction': '입출금',
    'savings.deposit': '입금',
    'savings.withdraw': '출금',
    
    // 채무
    'debt.title': '채무 관리',
    'debt.creditor': '채권자',
    'debt.debtor': '채무자',
    'debt.principal': '원금',
    'debt.interest': '이자',
    'debt.due_date': '만기일',
    'debt.status': '상태',
    'debt.status.ongoing': '진행중',
    'debt.status.completed': '완료',
    'debt.type.lend': '빌려줌',
    'debt.type.borrow': '빌림',
    'debt.add': '채무 추가',
    'debt.repay': '상환',
    
    // 투자
    'investment.title': '투자 관리',
    'investment.stock': '주식',
    'investment.crypto': '암호화폐',
    'investment.fund': '펀드',
    'investment.other': '기타',
    'investment.ticker': '종목',
    'investment.quantity': '수량',
    'investment.buy_price': '매수가',
    'investment.current_price': '현재가',
    'investment.profit_loss': '손익',
    'investment.return_rate': '수익률',
    
    // 고정지출
    'fixed.title': '고정지출 관리',
    'fixed.name': '항목명',
    'fixed.amount': '금액',
    'fixed.due_day': '납부일',
    'fixed.frequency': '주기',
    'fixed.frequency.monthly': '매월',
    'fixed.frequency.yearly': '매년',
    'fixed.auto_create': '자동 생성',
    'fixed.next_due': '다음 납부일',
    
    // 예산
    'budget.title': '예산 관리',
    'budget.set': '예산 설정',
    'budget.spent': '지출',
    'budget.remaining': '남은 예산',
    'budget.over': '초과',
    'budget.warning': '예산 경고',
    'budget.monthly': '월별 예산',
    'budget.category_budget': '카테고리별 예산',
    
    // 리포트
    'report.title': '리포트',
    'report.year': '연도',
    'report.month': '월',
    'report.income': '수입',
    'report.expense': '지출',
    'report.savings': '저축',
    'report.net': '순액',
    'report.chart': '차트',
    'report.trend': '추이',
    'report.category_analysis': '카테고리 분석',
    'report.category_avg': '카테고리별 평균 지출',
    'report.total_spent': '총 지출',
    'report.transaction_count': '거래 건수',
    'report.avg_per_transaction': '거래당 평균',
    'report.monthly_avg': '월평균',
    
    // 영수증
    'receipt.title': '영수증 관리',
    'receipt.add': '영수증 추가',
    'receipt.merchant': '상점명',
    'receipt.purchase_date': '구매일',
    'receipt.photo': '영수증 사진',
    'receipt.upload': '사진 업로드',
    'receipt.ocr': '자동 인식',
    'receipt.ocr_processing': '영수증을 분석하는 중...',
    'receipt.ocr_success': '정보 추출 완료! 내용을 확인하고 수정하세요.',
    'receipt.ocr_failed': '자동 추출 실패. 직접 입력해주세요.',
    'receipt.tax_deductible': '세금 공제 대상',
    'receipt.notes': '비고',
    
    // 설정
    'settings.title': '설정',
    'settings.language': '언어',
    'settings.language.korean': '한국어',
    'settings.language.english': 'English',
    'settings.currency': '통화',
    'settings.theme': '테마',
    'settings.theme.light': '라이트',
    'settings.theme.dark': '다크',
    'settings.data': '데이터',
    'settings.export': '내보내기',
    'settings.import': '가져오기',
    'settings.backup': '백업',
    'settings.restore': '복원',
    'settings.reset': '초기화',
    'settings.reset_confirm': '모든 데이터가 삭제됩니다. 계속하시겠습니까?',
    'settings.about': '앱 정보',
    'settings.version': '버전',
    
    // 메시지
    'msg.save_success': '저장되었습니다',
    'msg.save_failed': '저장에 실패했습니다',
    'msg.delete_success': '삭제되었습니다',
    'msg.delete_failed': '삭제에 실패했습니다',
    'msg.network_error': '네트워크 오류가 발생했습니다',
    'msg.server_error': '서버 오류가 발생했습니다',
    'msg.invalid_input': '입력값이 올바르지 않습니다',
    'msg.required_field': '필수 항목을 입력해주세요',
    'msg.confirm_delete': '삭제하시겠습니까?',
    'msg.no_data': '데이터가 없습니다',
  },
  
  en: {
    // Tab menu
    'tab.home': 'Home',
    'tab.month': 'Monthly',
    'tab.week': 'Weekly',
    'tab.savings': 'Savings',
    'tab.debts': 'Debts',
    'tab.investments': 'Investments',
    'tab.fixed_expenses': 'Fixed Expenses',
    'tab.budgets': 'Budgets',
    'tab.reports': 'Reports',
    'tab.settings': 'Settings',
    
    // Common
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.all': 'All',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.date': 'Date',
    'common.amount': 'Amount',
    'common.category': 'Category',
    'common.description': 'Description',
    'common.memo': 'Memo',
    'common.total': 'Total',
    'common.income': 'Income',
    'common.expense': 'Expense',
    'common.balance': 'Balance',
    'common.year': 'Year',
    'common.month': 'Month',
    'common.week': 'Week',
    'common.day': 'Day',
    'common.won': 'KRW',
    'common.count': 'Count',
    'common.average': 'Average',
    'common.select': 'Select',
    'common.required': 'Required',
    'common.optional': 'Optional',
    'common.yes': 'Yes',
    'common.no': 'No',
    
    // Home screen
    'home.title': 'Budget App',
    'home.quick_add': 'Quick Add',
    'home.recent_transactions': 'Recent Transactions',
    'home.this_month': 'This Month',
    'home.summary': 'Summary',
    'home.no_transactions': 'No transactions',
    
    // Transaction add/edit
    'transaction.add': 'Add Transaction',
    'transaction.edit': 'Edit Transaction',
    'transaction.type': 'Type',
    'transaction.type.income': 'Income',
    'transaction.type.expense': 'Expense',
    'transaction.type.savings': 'Savings',
    'transaction.date': 'Date',
    'transaction.amount': 'Amount',
    'transaction.category': 'Category',
    'transaction.description': 'Description',
    'transaction.memo': 'Memo',
    'transaction.payment_method': 'Payment Method',
    'transaction.delete_confirm': 'Delete this transaction?',
    
    // Categories
    'category.food': 'Food',
    'category.transport': 'Transportation',
    'category.shopping': 'Shopping',
    'category.entertainment': 'Entertainment',
    'category.health': 'Health',
    'category.education': 'Education',
    'category.housing': 'Housing',
    'category.other': 'Other',
    'category.salary': 'Salary',
    'category.business': 'Business',
    'category.investment': 'Investment',
    'category.allowance': 'Allowance',
    'category.bonus': 'Bonus',
    
    // Payment methods
    'payment.cash': 'Cash',
    'payment.card': 'Card',
    'payment.transfer': 'Transfer',
    'payment.other': 'Other',
    
    // Savings
    'savings.title': 'Savings',
    'savings.goal': 'Goal',
    'savings.current': 'Current',
    'savings.target': 'Target',
    'savings.progress': 'Progress',
    'savings.add_goal': 'Add Savings Goal',
    'savings.edit_goal': 'Edit Savings Goal',
    'savings.goal_name': 'Goal Name',
    'savings.target_amount': 'Target Amount',
    'savings.current_amount': 'Current Amount',
    'savings.deadline': 'Deadline',
    'savings.add_transaction': 'Add Transaction',
    'savings.deposit': 'Deposit',
    'savings.withdraw': 'Withdraw',
    
    // Debts
    'debt.title': 'Debts',
    'debt.creditor': 'Creditor',
    'debt.debtor': 'Debtor',
    'debt.principal': 'Principal',
    'debt.interest': 'Interest',
    'debt.due_date': 'Due Date',
    'debt.status': 'Status',
    'debt.status.ongoing': 'Ongoing',
    'debt.status.completed': 'Completed',
    'debt.type.lend': 'Lent',
    'debt.type.borrow': 'Borrowed',
    'debt.add': 'Add Debt',
    'debt.repay': 'Repay',
    
    // Investments
    'investment.title': 'Investments',
    'investment.stock': 'Stock',
    'investment.crypto': 'Crypto',
    'investment.fund': 'Fund',
    'investment.other': 'Other',
    'investment.ticker': 'Ticker',
    'investment.quantity': 'Quantity',
    'investment.buy_price': 'Buy Price',
    'investment.current_price': 'Current Price',
    'investment.profit_loss': 'P&L',
    'investment.return_rate': 'Return',
    
    // Fixed expenses
    'fixed.title': 'Fixed Expenses',
    'fixed.name': 'Name',
    'fixed.amount': 'Amount',
    'fixed.due_day': 'Due Day',
    'fixed.frequency': 'Frequency',
    'fixed.frequency.monthly': 'Monthly',
    'fixed.frequency.yearly': 'Yearly',
    'fixed.auto_create': 'Auto Create',
    'fixed.next_due': 'Next Due',
    
    // Budget
    'budget.title': 'Budget',
    'budget.set': 'Set Budget',
    'budget.spent': 'Spent',
    'budget.remaining': 'Remaining',
    'budget.over': 'Over',
    'budget.warning': 'Warning',
    'budget.monthly': 'Monthly Budget',
    'budget.category_budget': 'Category Budget',
    
    // Reports
    'report.title': 'Reports',
    'report.year': 'Year',
    'report.month': 'Month',
    'report.income': 'Income',
    'report.expense': 'Expense',
    'report.savings': 'Savings',
    'report.net': 'Net',
    'report.chart': 'Chart',
    'report.trend': 'Trend',
    'report.category_analysis': 'Category Analysis',
    'report.category_avg': 'Average Spending by Category',
    'report.total_spent': 'Total Spent',
    'report.transaction_count': 'Transactions',
    'report.avg_per_transaction': 'Avg per Transaction',
    'report.monthly_avg': 'Monthly Avg',
    
    // Receipts
    'receipt.title': 'Receipts',
    'receipt.add': 'Add Receipt',
    'receipt.merchant': 'Merchant',
    'receipt.purchase_date': 'Purchase Date',
    'receipt.photo': 'Receipt Photo',
    'receipt.upload': 'Upload Photo',
    'receipt.ocr': 'Auto Recognition',
    'receipt.ocr_processing': 'Analyzing receipt...',
    'receipt.ocr_success': 'Extraction complete! Please verify the information.',
    'receipt.ocr_failed': 'Auto extraction failed. Please enter manually.',
    'receipt.tax_deductible': 'Tax Deductible',
    'receipt.notes': 'Notes',
    
    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.language.korean': '한국어',
    'settings.language.english': 'English',
    'settings.currency': 'Currency',
    'settings.theme': 'Theme',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.data': 'Data',
    'settings.export': 'Export',
    'settings.import': 'Import',
    'settings.backup': 'Backup',
    'settings.restore': 'Restore',
    'settings.reset': 'Reset',
    'settings.reset_confirm': 'All data will be deleted. Continue?',
    'settings.about': 'About',
    'settings.version': 'Version',
    
    // Messages
    'msg.save_success': 'Saved successfully',
    'msg.save_failed': 'Failed to save',
    'msg.delete_success': 'Deleted successfully',
    'msg.delete_failed': 'Failed to delete',
    'msg.network_error': 'Network error occurred',
    'msg.server_error': 'Server error occurred',
    'msg.invalid_input': 'Invalid input',
    'msg.required_field': 'Please fill in required fields',
    'msg.confirm_delete': 'Are you sure you want to delete?',
    'msg.no_data': 'No data available',
  }
};

// 현재 언어
let currentLanguage = localStorage.getItem('app_language') || 'ko';

// 번역 함수
function t(key) {
  return translations[currentLanguage][key] || key;
}

// 언어 변경 함수
function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    localStorage.setItem('app_language', lang);
    
    // 페이지 전체 새로고침하여 모든 텍스트 업데이트
    location.reload();
  }
}

// 언어 가져오기
function getLanguage() {
  return currentLanguage;
}

// DOM에서 모든 한글 텍스트를 찾아서 번역
function translateDOM() {
  if (currentLanguage === 'ko') return; // 한국어면 번역하지 않음
  
  // 모든 텍스트 노드 찾기
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  const nodes = [];
  let node;
  while (node = walker.nextNode()) {
    // 스크립트 태그나 스타일 태그 내부는 제외
    if (node.parentElement && !['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) {
      nodes.push(node);
    }
  }
  
  // 각 텍스트 노드의 한글을 번역
  nodes.forEach(node => {
    const text = node.textContent.trim();
    if (text && /[가-힣]/.test(text)) {
      // 번역 키를 찾아서 번역
      for (const [key, koText] of Object.entries(translations.ko)) {
        if (text.includes(koText)) {
          const enText = translations.en[key];
          if (enText) {
            node.textContent = node.textContent.replace(koText, enText);
          }
        }
      }
    }
  });
  
  // placeholder, title 등의 속성도 번역
  const elements = document.querySelectorAll('[placeholder], [title], [aria-label]');
  elements.forEach(el => {
    ['placeholder', 'title', 'aria-label'].forEach(attr => {
      const value = el.getAttribute(attr);
      if (value && /[가-힣]/.test(value)) {
        for (const [key, koText] of Object.entries(translations.ko)) {
          if (value.includes(koText)) {
            const enText = translations.en[key];
            if (enText) {
              el.setAttribute(attr, value.replace(koText, enText));
            }
          }
        }
      }
    });
  });
}

// MutationObserver로 동적으로 추가되는 컨텐츠도 번역
let observer = null;
function startTranslationObserver() {
  if (currentLanguage === 'ko' || observer) return;
  
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        setTimeout(translateDOM, 100);
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// 페이지 로드 시 번역 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    translateDOM();
    startTranslationObserver();
  });
} else {
  translateDOM();
  startTranslationObserver();
}
