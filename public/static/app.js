// =============================================================================
// 가계부 앱 - 프론트엔드 JavaScript
// =============================================================================

// =============================================================================
// 전역 상태 객체
// =============================================================================

const state = {
  currentMonth: new Date(),
  currentWeekStart: null,
  transactions: [],
  savingsAccounts: [],
  fixedExpenses: [],
  budgets: [],
  investments: [],
  receipts: [],
  settings: {
    currency: 'KRW',
    initial_balance: 0,
    initial_savings: 0,
    category_colors: {
      income: '#3B82F6',
      expense: '#EF4444',
      savings: '#10B981'
    }
  },
  activeView: 'month',
  expenseChart: null,
  currentTransactionType: 'income',
  investmentPriceRefreshInterval: null
};

// =============================================================================
// 카테고리 정의
// =============================================================================

const categories = {
  income: ['급여', '상여금', '부수입', '기타수입'],
  expense: [
    '의복비', '식비', '주거비', '교통비', 
    '문화생활', '쇼핑', '의료비', '교육비', 
    '통신비', '보험', '기타지출'
  ],
  savings: ['저축']
};

// =============================================================================
// 통화 정의
// =============================================================================

const CURRENCIES = {
  'KRW': { symbol: '₩', name: '원화 (KRW)' },
  'USD': { symbol: '$', name: '미국 달러 (USD)' },
  'EUR': { symbol: '€', name: '유로 (EUR)' },
  'JPY': { symbol: '¥', name: '일본 엔 (JPY)' },
  'AUD': { symbol: 'A$', name: '호주 달러 (AUD)' },
  'GBP': { symbol: '£', name: '영국 파운드 (GBP)' }
};

// =============================================================================
// 유틸리티 함수
// =============================================================================

function formatCurrency(amount) {
  const currency = state.settings.currency || 'KRW';
  const symbol = CURRENCIES[currency]?.symbol || '₩';
  return `${symbol}${amount.toLocaleString()}`;
}

function formatCurrencyShort(amount) {
  if (amount >= 10000) {
    return `${Math.floor(amount / 10000)}만`;
  }
  return formatCurrency(amount);
}

function getYearMonth(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getWeekName(nth) {
  const names = ['', '첫째', '둘째', '셋째', '넷째'];
  return names[nth] || '';
}

function getDayName(dayOfWeek) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[dayOfWeek] || '';
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

// N번째 특정 요일 날짜 구하기
function getNthDayOfMonth(year, month, nth, dayOfWeek) {
  let date = new Date(year, month, 1);
  let count = 0;
  
  while (date.getMonth() === month) {
    if (date.getDay() === dayOfWeek) {
      count++;
      if (count === nth) {
        return new Date(date);
      }
    }
    date.setDate(date.getDate() + 1);
  }
  
  return null;
}

// =============================================================================
// API 호출 함수
// =============================================================================

// 거래 내역 가져오기
async function fetchTransactions(startDate, endDate, type = null) {
  try {
    let url = `/api/transactions?start_date=${startDate}&end_date=${endDate}`;
    if (type) {
      url += `&type=${type}`;
    }
    const response = await axios.get(url);
    if (response.data.success) {
      state.transactions = response.data.data;
    }
  } catch (error) {
    console.error('거래 내역 조회 오류:', error);
  }
}

// 저축 통장 가져오기
async function fetchSavingsAccounts() {
  try {
    const response = await axios.get('/api/savings-accounts');
    if (response.data.success) {
      state.savingsAccounts = response.data.data;
    }
  } catch (error) {
    console.error('저축 통장 조회 오류:', error);
  }
}

// 고정지출 가져오기
async function fetchFixedExpenses() {
  try {
    const response = await axios.get('/api/fixed-expenses');
    if (response.data.success) {
      state.fixedExpenses = response.data.data;
    }
  } catch (error) {
    console.error('고정지출 조회 오류:', error);
  }
}

// 고정지출 반복 인스턴스 가져오기
async function fetchFixedExpenseInstances(yearMonth) {
  try {
    const response = await axios.get(`/api/fixed-expenses/instances/${yearMonth}`);
    if (response.data.success) {
      return response.data.data;
    }
    return [];
  } catch (error) {
    console.error('고정지출 인스턴스 조회 오류:', error);
    return [];
  }
}

// 예산 가져오기
async function fetchBudgets() {
  try {
    const response = await axios.get('/api/budgets');
    if (response.data.success) {
      state.budgets = response.data.data;
    }
  } catch (error) {
    console.error('예산 조회 오류:', error);
  }
}

// 설정 가져오기
async function fetchSettings() {
  try {
    const response = await axios.get('/api/settings');
    if (response.data.success && response.data.data) {
      state.settings = {
        ...state.settings,
        ...response.data.data,
        category_colors: response.data.data.category_colors 
          ? JSON.parse(response.data.data.category_colors) 
          : state.settings.category_colors
      };
    }
  } catch (error) {
    console.error('설정 조회 오류:', error);
  }
}

// 월별 통계 가져오기
async function fetchMonthlyStatistics(yearMonth) {
  try {
    const response = await axios.get(`/api/statistics/monthly/${yearMonth}`);
    return response.data;
  } catch (error) {
    console.error('월별 통계 조회 오류:', error);
    return { success: false, summary: [], expenseByCategory: [] };
  }
}

// 주별 통계 가져오기
async function fetchWeeklyStatistics(startDate) {
  try {
    const response = await axios.get(`/api/statistics/weekly/${startDate}`);
    return response.data;
  } catch (error) {
    console.error('주별 통계 조회 오류:', error);
    return { success: false, summary: [], expenseByCategory: [] };
  }
}

// 달력 데이터 가져오기
async function fetchCalendarData(yearMonth) {
  try {
    const response = await axios.get(`/api/calendar/${yearMonth}`);
    return response.data;
  } catch (error) {
    console.error('달력 데이터 조회 오류:', error);
    return { success: false, data: [] };
  }
}

// 예산 vs 지출 현황 가져오기
async function fetchBudgetVsSpending(yearMonth) {
  try {
    const response = await axios.get(`/api/budgets/vs-spending/${yearMonth}`);
    return response.data;
  } catch (error) {
    console.error('예산 현황 조회 오류:', error);
    return { success: false, data: [] };
  }
}

// =============================================================================
// 탭 전환 함수
// =============================================================================

async function switchView(view) {
  console.log('🔀 switchView 호출:', view);
  state.activeView = view;
  
  // 모든 탭 버튼 업데이트
  const tabs = ['month', 'week', 'savings', 'fixed-expenses', 'budgets', 'investments', 'receipts', 'reports', 'settings'];
  tabs.forEach(tabName => {
    const tab = document.getElementById(`tab-${tabName}`);
    if (tab) {
      if (tabName === view) {
        tab.className = 'tab-button border-b-2 border-blue-600 text-blue-600 py-4 px-6 font-medium';
      } else {
        tab.className = 'tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6';
      }
    }
  });
  
  // 해당 뷰 렌더링
  switch (view) {
    case 'month':
      await renderMonthView();
      break;
    case 'week':
      await renderWeekView();
      break;
    case 'savings':
      await renderSavingsView();
      break;
    case 'fixed-expenses':
      await renderFixedExpensesView();
      break;
    case 'budgets':
      await renderBudgetsView();
      break;
    case 'investments':
      await renderInvestmentsView();
      break;
    case 'receipts':
      console.log('📋 receipts 케이스 진입');
      await renderReceiptsView();
      console.log('✅ receipts 렌더링 완료');
      break;
    case 'reports':
      await renderReportsView();
      break;
    case 'settings':
      await renderSettingsView();
      break;
  }
}


// =============================================================================
// 뷰 렌더링 함수들
// =============================================================================

// 월별 뷰 렌더링
async function renderMonthView() {
  const contentArea = document.getElementById('content-area');
  const yearMonth = getYearMonth(state.currentMonth);
  const daysInMonth = getDaysInMonth(state.currentMonth);
  
  // 데이터 로드
  await Promise.all([
    fetchTransactions(`${yearMonth}-01`, `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`),
    fetchBudgetVsSpending(yearMonth),
    fetchFixedExpenses()
  ]);
  
  // 통계 계산
  const income = state.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = state.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const savings = state.transactions.filter(t => t.type === 'savings').reduce((sum, t) => sum + t.amount, 0);
  const balance = state.settings.initial_balance + income - expense - savings;
  
  // 달력 데이터 준비
  const calendarDataResponse = await fetchCalendarData(yearMonth);
  const calendarDataArray = calendarDataResponse.data || [];
  const calendarData = {};
  calendarDataArray.forEach(item => {
    if (!calendarData[item.date]) {
      calendarData[item.date] = {};
    }
    calendarData[item.date][item.type] = item.total;
  });
  
  // 예산 vs 지출 데이터 가져오기
  const budgetDataResponse = await fetchBudgetVsSpending(yearMonth);
  const budgetData = budgetDataResponse.data || [];
  
  // 월별 통계 데이터 가져오기 (카테고리별 지출)
  const monthlyStats = await fetchMonthlyStatistics(yearMonth);
  const expenseByCategory = monthlyStats.expenseByCategory || [];
  
  contentArea.innerHTML = `
    <div class="space-y-6">
      <!-- 월 네비게이션 -->
      <div class="flex justify-between items-center">
        <button onclick="changeMonth(-1)" class="w-8 h-8 md:w-10 md:h-10 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center">
          <i class="fas fa-chevron-left text-sm"></i>
        </button>
        <h2 class="text-sm md:text-base font-semibold">${state.currentMonth.getFullYear()}년 ${state.currentMonth.getMonth() + 1}월</h2>
        <button onclick="changeMonth(1)" class="w-8 h-8 md:w-10 md:h-10 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center">
          <i class="fas fa-chevron-right text-sm"></i>
        </button>
      </div>
      
      <!-- 통계 카드 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-blue-50 p-4 rounded-lg shadow">
          <p class="text-blue-600 text-sm font-medium">수입</p>
          <p class="text-2xl font-bold text-blue-800">${formatCurrency(income)}</p>
        </div>
        <div class="bg-red-50 p-4 rounded-lg shadow">
          <p class="text-red-600 text-sm font-medium">지출</p>
          <p class="text-2xl font-bold text-red-800">${formatCurrency(expense)}</p>
        </div>
        <div class="bg-green-50 p-4 rounded-lg shadow">
          <p class="text-green-600 text-sm font-medium">저축</p>
          <p class="text-2xl font-bold text-green-800">${formatCurrency(savings)}</p>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg shadow">
          <p class="text-gray-600 text-sm font-medium">잔액</p>
          <p class="text-2xl font-bold text-gray-800">${formatCurrency(balance)}</p>
        </div>
      </div>
      
      <!-- 예산 vs 지출 그래프 -->
      ${renderBudgetChart(budgetData, '월별')}
      
      <!-- 달력 -->
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-xl font-bold mb-4">월간 달력</h3>
        ${renderCalendar(calendarData)}
      </div>
      
      <!-- 카테고리별 지출 바 그래프 -->
      ${renderExpenseBarChart(expenseByCategory, '월별')}
      
      <!-- 거래 내역 -->
      <div class="bg-white p-6 rounded-lg shadow">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">거래 내역</h3>
          <button onclick="openTransactionModal(null)" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        
        <!-- 검색 및 필터 -->
        <div class="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="text" id="search-transaction" 
                 placeholder="설명으로 검색..." 
                 class="px-4 py-2 border rounded"
                 oninput="filterTransactions()">
          
          <select id="filter-type" class="px-4 py-2 border rounded" onchange="filterTransactions()">
            <option value="">전체 유형</option>
            <option value="income">수입</option>
            <option value="expense">지출</option>
            <option value="savings">저축</option>
          </select>
          
          <select id="filter-category" class="px-4 py-2 border rounded" onchange="filterTransactions()">
            <option value="">전체 카테고리</option>
            ${Object.values(categories).flat().map(cat => `<option value="${cat}">${cat}</option>`).join('')}
          </select>
        </div>
        
        <div id="filtered-transactions">
          ${renderTransactionList(state.transactions)}
        </div>
      </div>
    </div>
  `;
}

// 달력 렌더링 (토요일 파란색, 일요일 빨간색)
function renderCalendar(calendarData) {
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(state.currentMonth);
  const firstDay = new Date(year, month, 1).getDay();
  
  let html = '<div class="grid grid-cols-7 gap-2">';
  
  // 요일 헤더 (일요일 빨강, 토요일 파랑)
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayColors = ['text-red-600', 'text-gray-600', 'text-gray-600', 'text-gray-600', 'text-gray-600', 'text-gray-600', 'text-blue-600'];
  
  dayNames.forEach((day, index) => {
    html += `<div class="text-center font-bold ${dayColors[index]} py-2">${day}</div>`;
  });
  
  // 첫 주 빈 칸
  for (let i = 0; i < firstDay; i++) {
    html += '<div></div>';
  }
  
  // 날짜 렌더링 (컴팩트 모드 - 점으로 표시)
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dateStr = getDateString(currentDate);
    const dayOfWeek = currentDate.getDay();
    const dayData = calendarData[dateStr] || {};
    
    // 토요일(6) 파란색, 일요일(0) 빨간색
    let dayColor = 'text-gray-700';
    if (dayOfWeek === 0) dayColor = 'text-red-500';
    else if (dayOfWeek === 6) dayColor = 'text-blue-500';
    
    // 거래 점 생성
    let dots = '';
    const hasIncome = dayData.income && dayData.income > 0;
    const hasExpense = dayData.expense && dayData.expense > 0;
    const hasSavings = dayData.savings && dayData.savings > 0;
    
    if (hasIncome) dots += '<span class="calendar-dot income"></span>';
    if (hasExpense) dots += '<span class="calendar-dot expense"></span>';
    if (hasSavings) dots += '<span class="calendar-dot savings"></span>';
    
    html += `
      <div class="border p-1 md:p-2 rounded cursor-pointer hover:bg-gray-50 calendar-cell-compact" 
           onclick="openTransactionModal('${dateStr}')">
        <div class="text-xs md:text-sm font-semibold mb-1 ${dayColor}">${day}</div>
        <div class="calendar-dots-container">
          ${dots}
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

// 예산 vs 지출 그래프 렌더링
function renderBudgetChart(budgetData, period) {
  if (!budgetData || budgetData.length === 0) {
    return `
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-xl font-bold mb-4">${period} 예산 현황</h3>
        <p class="text-center text-gray-500 py-4">설정된 예산이 없습니다. 예산 탭에서 카테고리별 예산을 설정하세요.</p>
      </div>
    `;
  }
  
  let html = `
    <div class="bg-white p-6 rounded-lg shadow">
      <h3 class="text-xl font-bold mb-4">${period} 예산 현황</h3>
      <div class="space-y-4">
  `;
  
  budgetData.forEach(item => {
    const percentage = item.monthly_budget > 0 ? (item.actual_spending / item.monthly_budget * 100) : 0;
    const remaining = item.monthly_budget - item.actual_spending;
    
    // 진행률에 따른 색상
    let barColor = '#10B981'; // 초록
    if (percentage >= 100) barColor = '#EF4444'; // 빨강
    else if (percentage >= 80) barColor = '#F97316'; // 주황
    else if (percentage >= 50) barColor = '#F59E0B'; // 노랑
    
    html += `
      <div>
        <div class="flex justify-between items-center mb-2">
          <span class="font-medium text-gray-700">${item.category}</span>
          <div class="text-right">
            <span class="text-sm font-bold" style="color: ${barColor}">${formatCurrency(item.actual_spending)}</span>
            <span class="text-sm text-gray-500"> / ${formatCurrency(item.monthly_budget)}</span>
            <span class="text-xs ml-2 px-2 py-1 rounded" style="background-color: ${barColor}20; color: ${barColor}">
              ${percentage.toFixed(1)}%
            </span>
          </div>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div class="h-4 rounded-full transition-all flex items-center justify-end px-2" 
               style="width: ${Math.min(percentage, 100)}%; background-color: ${barColor}">
            ${percentage > 10 ? `<span class="text-xs text-white font-bold">${formatCurrencyShort(item.actual_spending)}</span>` : ''}
          </div>
        </div>
        <p class="text-xs mt-1 ${remaining < 0 ? 'text-red-600 font-bold' : 'text-gray-600'}">
          ${remaining >= 0 ? `잔액: ${formatCurrency(remaining)}` : `⚠️ 초과: ${formatCurrency(Math.abs(remaining))}`}
        </p>
      </div>
    `;
  });
  
  html += `
      </div>
    </div>
  `;
  
  return html;
}

// 카테고리별 지출 바 그래프 렌더링
function renderExpenseBarChart(expenseByCategory, period) {
  if (!expenseByCategory || expenseByCategory.length === 0) {
    return `
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-xl font-bold mb-4">${period} 카테고리별 지출</h3>
        <p class="text-center text-gray-500 py-4">지출 내역이 없습니다.</p>
      </div>
    `;
  }
  
  // 카테고리별 색상 매핑 (일관된 색상 사용)
  const categoryColors = {
    '의복비': '#8B5CF6',
    '식비': '#10B981',
    '주거비': '#F59E0B',
    '교통비': '#3B82F6',
    '문화생활': '#EC4899',
    '쇼핑': '#F97316',
    '의료비': '#EF4444',
    '교육비': '#6366F1',
    '통신비': '#14B8A6',
    '보험': '#8B5CF6',
    '기타지출': '#6B7280'
  };
  
  // 총 지출 계산
  const totalExpense = expenseByCategory.reduce((sum, item) => sum + item.total, 0);
  
  // 최대값 찾기 (바 너비 계산용)
  const maxAmount = Math.max(...expenseByCategory.map(item => item.total));
  
  let html = `
    <div class="bg-white p-6 rounded-lg shadow">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-bold">
          <i class="fas fa-chart-bar mr-2 text-blue-600"></i>${period} 카테고리별 지출
        </h3>
        <div class="text-right">
          <p class="text-sm text-gray-600">총 지출</p>
          <p class="text-2xl font-bold text-red-600">${formatCurrency(totalExpense)}</p>
        </div>
      </div>
      <div class="space-y-3">
  `;
  
  // 지출 금액 순으로 정렬
  const sortedExpenses = [...expenseByCategory].sort((a, b) => b.total - a.total);
  
  sortedExpenses.forEach(item => {
    const percentage = totalExpense > 0 ? (item.total / totalExpense * 100) : 0;
    const barWidth = maxAmount > 0 ? (item.total / maxAmount * 100) : 0;
    const color = categoryColors[item.category] || '#6B7280';
    
    html += `
      <div>
        <div class="flex justify-between items-center mb-1">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
            <span class="font-medium text-gray-700">${item.category}</span>
            <span class="text-xs text-gray-500">(${item.count}건)</span>
          </div>
          <div class="text-right">
            <span class="font-bold text-gray-900">${formatCurrency(item.total)}</span>
            <span class="text-xs ml-2 px-2 py-1 rounded" style="background-color: ${color}20; color: ${color}">
              ${percentage.toFixed(1)}%
            </span>
          </div>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
          <div class="h-6 rounded-full transition-all flex items-center px-3" 
               style="width: ${barWidth}%; background-color: ${color}">
            ${barWidth > 15 ? `<span class="text-xs text-white font-bold">${formatCurrencyShort(item.total)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  });
  
  html += `
      </div>
    </div>
  `;
  
  return html;
}

// 거래 내역 리스트 렌더링
function renderTransactionList(transactions) {
  if (!transactions || transactions.length === 0) {
    return '<p class="text-center text-gray-500 py-4">거래 내역이 없습니다.</p>';
  }
  
  let html = '<div class="space-y-2 max-h-96 overflow-y-auto">';
  transactions.forEach(t => {
    const typeColor = t.type === 'income' ? 'blue' : t.type === 'expense' ? 'red' : 'green';
    const typeText = t.type === 'income' ? '수입' : t.type === 'expense' ? '지출' : '저축';
    
    html += `
      <div class="flex justify-between items-center p-3 bg-gray-50 rounded hover:bg-gray-100">
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="px-2 py-1 text-xs rounded bg-${typeColor}-100 text-${typeColor}-600">${typeText}</span>
            <span class="font-medium">${t.category}</span>
          </div>
          <p class="text-sm text-gray-600">${t.date} ${t.description ? '· ' + t.description : ''}</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-bold text-${typeColor}-600">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</span>
          <button onclick="openEditTransactionModal(${t.id})" class="text-blue-500 hover:text-blue-700">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="deleteTransaction(${t.id})" class="text-red-500 hover:text-red-700">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  });
  html += '</div>';
  return html;
}

// 거래 내역 필터링
function filterTransactions() {
  const searchText = document.getElementById('search-transaction')?.value.toLowerCase() || '';
  const filterType = document.getElementById('filter-type')?.value || '';
  const filterCategory = document.getElementById('filter-category')?.value || '';
  
  let filtered = state.transactions.filter(t => {
    // 검색어 필터
    if (searchText && !(t.description || '').toLowerCase().includes(searchText)) {
      return false;
    }
    
    // 거래 유형 필터
    if (filterType && t.type !== filterType) {
      return false;
    }
    
    // 카테고리 필터
    if (filterCategory && t.category !== filterCategory) {
      return false;
    }
    
    return true;
  });
  
  // 필터링된 결과 렌더링
  const filteredContainer = document.getElementById('filtered-transactions');
  if (filteredContainer) {
    filteredContainer.innerHTML = renderTransactionList(filtered);
  }
}

// 주별 뷰 렌더링
async function renderWeekView() {
  if (!state.currentWeekStart) {
    state.currentWeekStart = getWeekStart(new Date());
  }
  
  const weekEnd = new Date(state.currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  await fetchTransactions(getDateString(state.currentWeekStart), getDateString(weekEnd));
  
  const income = state.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = state.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const savings = state.transactions.filter(t => t.type === 'savings').reduce((sum, t) => sum + t.amount, 0);
  
  // 주간 예산 계산 (월별 예산을 4로 나눔)
  const yearMonth = getYearMonth(state.currentWeekStart);
  const budgetDataResponse = await fetchBudgetVsSpending(yearMonth);
  const budgetData = (budgetDataResponse.data || []).map(item => ({
    ...item,
    monthly_budget: Math.round(item.monthly_budget / 4),
    actual_spending: state.transactions
      .filter(t => t.type === 'expense' && t.category === item.category)
      .reduce((sum, t) => sum + t.amount, 0)
  }));
  
  // 주간 통계 데이터 가져오기 (카테고리별 지출)
  const weeklyStats = await fetchWeeklyStatistics(getDateString(state.currentWeekStart));
  const expenseByCategory = weeklyStats.expenseByCategory || [];
  
  const contentArea = document.getElementById('content-area');
  contentArea.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <button onclick="changeWeek(-1)" class="w-8 h-8 md:w-10 md:h-10 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center">
          <i class="fas fa-chevron-left text-sm"></i>
        </button>
        <h2 class="text-xs md:text-sm font-semibold">${getDateString(state.currentWeekStart)} ~ ${getDateString(weekEnd)}</h2>
        <button onclick="changeWeek(1)" class="w-8 h-8 md:w-10 md:h-10 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center">
          <i class="fas fa-chevron-right text-sm"></i>
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-blue-50 p-4 rounded-lg shadow">
          <p class="text-blue-600 text-sm font-medium">수입</p>
          <p class="text-2xl font-bold text-blue-800">${formatCurrency(income)}</p>
        </div>
        <div class="bg-red-50 p-4 rounded-lg shadow">
          <p class="text-red-600 text-sm font-medium">지출</p>
          <p class="text-2xl font-bold text-red-800">${formatCurrency(expense)}</p>
        </div>
        <div class="bg-green-50 p-4 rounded-lg shadow">
          <p class="text-green-600 text-sm font-medium">저축</p>
          <p class="text-2xl font-bold text-green-800">${formatCurrency(savings)}</p>
        </div>
      </div>
      
      <!-- 주간 예산 vs 지출 그래프 -->
      ${renderBudgetChart(budgetData, '주별')}
      
      <!-- 주간 카테고리별 지출 바 그래프 -->
      ${renderExpenseBarChart(expenseByCategory, '주별')}
      
      <div class="bg-white p-6 rounded-lg shadow">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">거래 내역</h3>
          <button onclick="openTransactionModal(null)" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        ${renderTransactionList(state.transactions)}
      </div>
    </div>
  `;
}

// 저축 뷰 렌더링
async function renderSavingsView() {
  await fetchSavingsAccounts();
  
  const totalSavings = state.savingsAccounts.reduce((sum, acc) => sum + (acc.total_savings || 0), 0);
  
  const contentArea = document.getElementById('content-area');
  contentArea.innerHTML = `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
        <h2 class="text-lg font-medium">총 저축액</h2>
        <p class="text-4xl font-bold mt-2">${formatCurrency(totalSavings)}</p>
      </div>
      
      <div class="flex justify-between items-center">
        <h3 class="text-xl font-bold">저축 통장 목록</h3>
        <button onclick="openSavingsAccountModal()" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${state.savingsAccounts.map(acc => `
          <div class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
            <div class="flex justify-between items-start mb-4">
              <h4 class="text-lg font-bold">${acc.name}</h4>
              <button onclick="deleteSavingsAccount(${acc.id})" class="text-red-500 hover:text-red-700">
                <i class="fas fa-trash"></i>
              </button>
            </div>
            <p class="text-3xl font-bold text-green-600">${formatCurrency(acc.total_savings || 0)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// 고정지출 뷰 렌더링
async function renderFixedExpensesView() {
  await fetchFixedExpenses();
  
  // 현재 월의 고정지출 반복 인스턴스 가져오기
  const currentYearMonth = getYearMonth(new Date());
  const fixedExpenseInstances = await fetchFixedExpenseInstances(currentYearMonth);
  
  const contentArea = document.getElementById('content-area');
  contentArea.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-bold">고정지출 관리</h3>
        <button onclick="openFixedExpenseModal()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      
      <!-- 월 선택 네비게이션 -->
      <div class="flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <button onclick="changeFixedExpenseMonth(-1)" class="p-2 hover:bg-gray-100 rounded">
          <i class="fas fa-chevron-left"></i>
        </button>
        <h3 class="text-lg font-semibold">
          ${state.currentMonth.getFullYear()}년 ${state.currentMonth.getMonth() + 1}월
        </h3>
        <button onclick="changeFixedExpenseMonth(1)" class="p-2 hover:bg-gray-100 rounded">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
      
      <!-- 고정지출 인스턴스 목록 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${fixedExpenseInstances.map((instance, index) => {
          // 체크박스 ID를 날짜 기반으로 고유하게 생성
          const checkboxId = 'check-' + instance.id + '-' + instance.scheduled_date.replace(/-/g, '');
          
          return `
          <div class="bg-white p-6 rounded-lg shadow">
            <div class="flex justify-between items-start mb-3">
              <div class="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="${checkboxId}"
                  ${instance.is_paid ? 'checked' : ''}
                  onchange="handleFixedExpenseCheck('${checkboxId}', ${instance.id}, '${instance.scheduled_date}', this.checked)"
                  class="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                <h4 class="text-lg font-bold ${instance.is_paid ? 'line-through text-gray-400' : ''}">${instance.name}</h4>
              </div>
              <button onclick="deleteFixedExpense(${instance.id})" class="text-red-500 hover:text-red-700">
                <i class="fas fa-trash"></i>
              </button>
            </div>
            <p class="text-2xl font-bold ${instance.is_paid ? 'text-gray-400' : 'text-red-600'} mb-2">${formatCurrency(instance.amount)}</p>
            
            ${instance.is_paid ? `
              <div class="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded">
                <p class="text-sm text-green-700">
                  <i class="fas fa-check-circle mr-1"></i>
                  ${instance.scheduled_date} 지불 완료
                </p>
              </div>
            ` : `
              <div class="mb-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded">
                <p class="text-sm text-yellow-700">
                  <i class="fas fa-clock mr-1"></i>
                  예정일: ${instance.scheduled_date}
                </p>
              </div>
            `}
            
            <div class="flex flex-wrap gap-1 mb-3">
              <span class="px-2 py-1 text-xs rounded-full ${instance.frequency === 'monthly' ? 'bg-blue-500' : instance.frequency === 'monthly_day' ? 'bg-indigo-500' : 'bg-green-500'} text-white">
                ${instance.frequency === 'monthly' ? '월별' : instance.frequency === 'monthly_day' ? '매월' : '주별'}
              </span>
              ${instance.frequency === 'monthly' ? `
                <span class="px-2 py-1 text-xs rounded-full bg-orange-500 text-white">
                  ${getWeekName(instance.week_of_month)}주
                </span>
                <span class="px-2 py-1 text-xs rounded-full bg-purple-500 text-white">
                  ${getDayName(instance.day_of_week)}요일
                </span>
              ` : instance.frequency === 'monthly_day' ? `
                <span class="px-2 py-1 text-xs rounded-full bg-purple-500 text-white">
                  ${instance.payment_day}일
                </span>
              ` : `
                <span class="px-2 py-1 text-xs rounded-full bg-purple-500 text-white">
                  ${getDayName(instance.day_of_week)}요일
                </span>
              `}
            </div>
            <p class="text-sm text-gray-600">카테고리: ${instance.category}</p>
          </div>
        `;
        }).join('')}
      </div>
      
      ${fixedExpenseInstances.length === 0 ? '<p class="text-center text-gray-500 py-8">이번 달에 예정된 고정지출이 없습니다.</p>' : ''}
    </div>
  `;
}

// 고정지출 체크박스 핸들러
async function handleFixedExpenseCheck(checkboxId, expenseId, date, isChecked) {
  if (isChecked) {
    // 체크 시: 지불 처리
    if (!confirm(`이 고정지출을 ${date}에 지불하시겠습니까?`)) {
      // 취소 시 체크박스 원상복구
      document.getElementById(checkboxId).checked = false;
      return;
    }
    
    try {
      const response = await axios.post(`/api/fixed-expenses/${expenseId}/pay`, { date });
      if (response.data.success) {
        alert('지불이 완료되었습니다. 거래 내역에 자동으로 추가되었습니다.');
        renderFixedExpensesView();
      }
    } catch (error) {
      alert(error.response?.data?.error || '지불 처리 중 오류가 발생했습니다.');
      document.getElementById(checkboxId).checked = false;
    }
  } else {
    // 체크 해제 시: 삭제 여부 확인
    if (!confirm('이 지불 내역을 취소하시겠습니까? 거래 내역도 함께 삭제됩니다.')) {
      document.getElementById(checkboxId).checked = true;
      return;
    }
    
    try {
      const yearMonth = getYearMonth(new Date(date));
      const paymentsResponse = await axios.get(`/api/fixed-expenses/${expenseId}/payments/${yearMonth}`);
      
      if (paymentsResponse.data.success && paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
        // 특정 날짜의 지불 내역 찾기
        const payment = paymentsResponse.data.data.find(p => p.payment_date === date);
        if (payment) {
          await axios.delete(`/api/transactions/${payment.transaction_id}`);
          alert('지불 내역이 취소되었습니다.');
          renderFixedExpensesView();
        } else {
          alert('해당 날짜의 지불 내역을 찾을 수 없습니다.');
          document.getElementById(checkboxId).checked = false;
        }
      } else {
        alert('지불 내역이 없습니다.');
        document.getElementById(checkboxId).checked = false;
      }
    } catch (error) {
      alert('지불 취소 중 오류가 발생했습니다.');
      document.getElementById(checkboxId).checked = true;
    }
  }
}

// 예산 뷰 렌더링
async function renderBudgetsView() {
  await fetchBudgets();
  
  const contentArea = document.getElementById('content-area');
  contentArea.innerHTML = `
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-2xl font-bold mb-4">카테고리별 예산 설정</h2>
      
      <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <p class="text-sm text-green-800">
          <i class="fas fa-lightbulb mr-2"></i>
          <strong>예산 관리 팁:</strong> 각 카테고리에 월별 예산을 설정하세요. 0원 입력 시 예산이 삭제됩니다.
        </p>
      </div>
      
      <div class="space-y-4">
        ${categories.expense.map(category => {
          const budget = state.budgets.find(b => b.category === category);
          const budgetAmount = budget ? budget.monthly_budget : 0;
          const currencySymbol = CURRENCIES[state.settings.currency]?.symbol || '₩';
          
          return `
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <label class="w-32 font-medium">${category}</label>
              <input 
                type="number" 
                value="${budgetAmount}" 
                min="0"
                step="10000"
                class="flex-1 px-4 py-2 border rounded"
                onchange="handleBudgetChange('${category}', this.value)"
                placeholder="예산 없음 (0원 입력 시 삭제)">
              <span class="text-gray-600">${currencySymbol}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// =============================================================================
// 투자 관리 뷰 렌더링
// =============================================================================

async function renderInvestmentsView() {
  await fetchInvestments();
  
  const contentArea = document.getElementById('content-area');
  
  // 전체 포트폴리오 계산
  let totalInvestment = 0;
  let totalCurrentValue = 0;
  
  contentArea.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">투자 관리</h2>
        <button onclick="openInvestmentModal()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      
      <!-- 안내 메시지 -->
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <i class="fas fa-info-circle text-yellow-600 mt-1"></i>
          <div class="text-sm text-yellow-800">
            <p class="font-medium mb-1">실시간 주가 정보 안내</p>
            <p>샌드박스 환경에서는 외부 API 접근이 제한되어 시뮬레이션 데이터가 표시될 수 있습니다.</p>
            <p class="mt-1">실제 Cloudflare Pages 배포 시에는 실시간 주가 데이터가 정상적으로 표시됩니다.</p>
            <p class="mt-2 text-xs">
              <strong>지원 종목:</strong> 
              <br/>• 미국 주식: AAPL, GOOGL, MSFT, TSLA, AMZN, META, NVDA, AMD, NFLX
              <br/>• 한국 주식: 005930.KS (삼성전자), 000660.KS (SK하이닉스)
              <br/>• 암호화폐: BTC, ETH, BNB, XRP, SOL, ADA, DOGE, DOT, MATIC, AVAX
            </p>
          </div>
        </div>
      </div>
      
      <!-- 포트폴리오 요약 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4" id="portfolio-summary">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-gray-500 text-sm">총 투자금액</div>
          <div class="text-2xl font-bold mt-1" id="total-investment">로딩중...</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-gray-500 text-sm">현재 평가금액</div>
          <div class="text-2xl font-bold mt-1" id="total-current-value">로딩중...</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-gray-500 text-sm">총 수익/손실</div>
          <div class="text-2xl font-bold mt-1" id="total-profit-loss">로딩중...</div>
        </div>
      </div>
      
      <!-- 보유 종목 리스트 -->
      <div class="bg-white rounded-lg shadow">
        <div class="p-4 border-b">
          <h3 class="text-lg font-bold">보유 종목</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-sm font-medium text-gray-700">종목</th>
                <th class="px-4 py-3 text-right text-sm font-medium text-gray-700">수량</th>
                <th class="px-4 py-3 text-right text-sm font-medium text-gray-700">평균매수가</th>
                <th class="px-4 py-3 text-right text-sm font-medium text-gray-700">현재가</th>
                <th class="px-4 py-3 text-right text-sm font-medium text-gray-700">평가금액</th>
                <th class="px-4 py-3 text-right text-sm font-medium text-gray-700">수익률</th>
                <th class="px-4 py-3 text-right text-sm font-medium text-gray-700">손익</th>
                <th class="px-4 py-3 text-center text-sm font-medium text-gray-700">관리</th>
              </tr>
            </thead>
            <tbody id="investments-list">
              <tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">로딩중...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  // 실시간 주가 업데이트 시작
  await updateInvestmentPrices();
  startInvestmentPriceRefresh();
}

async function fetchInvestments() {
  try {
    const response = await axios.get('/api/investments');
    if (response.data.success) {
      state.investments = response.data.data || [];
    }
  } catch (error) {
    console.error('Failed to fetch investments:', error);
    state.investments = [];
  }
}

async function updateInvestmentPrices() {
  const investmentsList = document.getElementById('investments-list');
  const totalInvestmentEl = document.getElementById('total-investment');
  const totalCurrentValueEl = document.getElementById('total-current-value');
  const totalProfitLossEl = document.getElementById('total-profit-loss');
  
  if (!investmentsList || state.investments.length === 0) {
    if (investmentsList) {
      investmentsList.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">보유 종목이 없습니다.</td></tr>';
    }
    return;
  }
  
  let totalInvestment = 0;
  let totalCurrentValue = 0;
  
  let rowsHTML = '';
  
  for (const inv of state.investments) {
    try {
      const priceResponse = await axios.get(`/api/investments/price/${inv.symbol}`);
      
      if (priceResponse.data.success) {
        const priceData = priceResponse.data.data;
        const currentPrice = priceData.price;
        const purchaseValue = inv.purchase_price * inv.quantity;
        const currentValue = currentPrice * inv.quantity;
        const profitLoss = currentValue - purchaseValue;
        const profitLossPercent = (profitLoss / purchaseValue * 100).toFixed(2);
        
        totalInvestment += purchaseValue;
        totalCurrentValue += currentValue;
        
        const profitClass = profitLoss >= 0 ? 'text-red-600' : 'text-blue-600';
        const profitSign = profitLoss >= 0 ? '+' : '';
        
        rowsHTML += `
          <tr class="border-t hover:bg-gray-50">
            <td class="px-4 py-3">
              <div class="font-medium">${inv.name}</div>
              <div class="text-sm text-gray-500">${inv.symbol}${priceData.simulated ? ' <span class="text-orange-500" title="실제 API 접근 제한으로 시뮬레이션 데이터가 표시됩니다">[시뮬레이션]</span>' : ''}</div>
            </td>
            <td class="px-4 py-3 text-right">${inv.quantity.toLocaleString()}주</td>
            <td class="px-4 py-3 text-right">${formatCurrency(inv.purchase_price)}</td>
            <td class="px-4 py-3 text-right">
              <div>${formatCurrency(currentPrice)}</div>
              <div class="text-sm ${priceData.change >= 0 ? 'text-red-600' : 'text-blue-600'}">
                ${priceData.change >= 0 ? '▲' : '▼'} ${Math.abs(priceData.changePercent).toFixed(2)}%
              </div>
            </td>
            <td class="px-4 py-3 text-right font-medium">${formatCurrency(currentValue)}</td>
            <td class="px-4 py-3 text-right ${profitClass} font-medium">${profitSign}${profitLossPercent}%</td>
            <td class="px-4 py-3 text-right ${profitClass} font-medium">${profitSign}${formatCurrency(Math.abs(profitLoss))}</td>
            <td class="px-4 py-3 text-center">
              <button onclick="editInvestment(${inv.id})" 
                      class="px-2 py-1 text-blue-600 hover:bg-blue-50 text-xs rounded mr-1"
                      title="수정">
                <i class="fas fa-edit"></i>
              </button>
              <button onclick="deleteInvestment(${inv.id})" 
                      class="px-2 py-1 text-red-600 hover:bg-red-50 text-xs rounded"
                      title="삭제">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }
    } catch (error) {
      console.error(`Failed to fetch price for ${inv.symbol}:`, error);
      rowsHTML += `
        <tr class="border-t hover:bg-gray-50">
          <td class="px-4 py-3">
            <div class="font-medium">${inv.name}</div>
            <div class="text-sm text-gray-500">${inv.symbol}</div>
          </td>
          <td colspan="7" class="px-4 py-3 text-center text-red-500">주가 정보를 불러올 수 없습니다.</td>
        </tr>
      `;
    }
  }
  
  investmentsList.innerHTML = rowsHTML || '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">보유 종목이 없습니다.</td></tr>';
  
  // 포트폴리오 요약 업데이트
  const totalProfitLoss = totalCurrentValue - totalInvestment;
  const totalProfitLossPercent = totalInvestment > 0 ? ((totalProfitLoss / totalInvestment) * 100).toFixed(2) : 0;
  const profitClass = totalProfitLoss >= 0 ? 'text-red-600' : 'text-blue-600';
  const profitSign = totalProfitLoss >= 0 ? '+' : '';
  
  if (totalInvestmentEl) totalInvestmentEl.textContent = formatCurrency(totalInvestment);
  if (totalCurrentValueEl) totalCurrentValueEl.textContent = formatCurrency(totalCurrentValue);
  if (totalProfitLossEl) {
    totalProfitLossEl.innerHTML = `
      <span class="${profitClass}">${profitSign}${formatCurrency(Math.abs(totalProfitLoss))}</span>
      <span class="text-sm ${profitClass}"> (${profitSign}${totalProfitLossPercent}%)</span>
    `;
  }
}

function startInvestmentPriceRefresh() {
  // 기존 인터벌 제거
  if (state.investmentPriceRefreshInterval) {
    clearInterval(state.investmentPriceRefreshInterval);
  }
  
  // 30초마다 주가 업데이트
  state.investmentPriceRefreshInterval = setInterval(() => {
    if (state.activeView === 'investments') {
      updateInvestmentPrices();
    }
  }, 30000);
}

async function openInvestmentModal(investmentId = null) {
  const modalContainer = document.getElementById('modal-container');
  const isEdit = investmentId !== null;
  
  let investment = null;
  if (isEdit) {
    investment = state.investments.find(inv => inv.id === investmentId);
    if (!investment) {
      alert('투자 정보를 찾을 수 없습니다.');
      return;
    }
  }
  
  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="closeModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">${isEdit ? '투자 수정' : '투자 추가'}</h3>
          <button onclick="closeModal()" class="text-gray-500 hover:text-gray-700">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <form onsubmit="handleInvestmentSubmit(event, ${investmentId})" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">종목 심볼</label>
            <input type="text" name="symbol" value="${investment?.symbol || ''}" 
                   placeholder="예: AAPL, BTC, 005930.KS" required
                   class="w-full px-4 py-2 border rounded">
            <p class="text-xs text-gray-500 mt-1">주식: AAPL, 005930.KS / 코인: BTC, ETH, SOL</p>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">종목 이름</label>
            <input type="text" name="name" value="${investment?.name || ''}" 
                   placeholder="예: Apple Inc., 비트코인, 삼성전자" required
                   class="w-full px-4 py-2 border rounded">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">보유 수량</label>
            <input type="number" name="quantity" value="${investment?.quantity || ''}" 
                   placeholder="보유 주식 수" required min="1"
                   class="w-full px-4 py-2 border rounded">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">평균 매수가</label>
            <input type="number" name="purchase_price" value="${investment?.purchase_price || ''}" 
                   placeholder="주당 매수 가격" required min="0" step="0.01"
                   class="w-full px-4 py-2 border rounded">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">매수일</label>
            <input type="date" name="purchase_date" 
                   value="${investment?.purchase_date || getDateString(new Date())}" 
                   required class="w-full px-4 py-2 border rounded">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">메모 (선택)</label>
            <textarea name="notes" rows="2" 
                      class="w-full px-4 py-2 border rounded">${investment?.notes || ''}</textarea>
          </div>
          
          <div class="flex gap-2 pt-4">
            <button type="submit" class="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              ${isEdit ? '수정' : '추가'}
            </button>
            <button type="button" onclick="closeModal()" class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function handleInvestmentSubmit(event, investmentId = null) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const data = {
    symbol: formData.get('symbol').toUpperCase().trim(),
    name: formData.get('name').trim(),
    quantity: parseInt(formData.get('quantity')),
    purchase_price: parseFloat(formData.get('purchase_price')),
    purchase_date: formData.get('purchase_date'),
    notes: formData.get('notes')?.trim() || null
  };
  
  try {
    let response;
    if (investmentId) {
      // 수정
      response = await axios.put(`/api/investments/${investmentId}`, data);
      if (response.data.success) {
        alert(`${data.name} 투자 정보가 수정되었습니다.`);
      }
    } else {
      // 추가
      response = await axios.post('/api/investments', data);
      if (response.data.success) {
        alert(`${data.name} 투자가 추가되었습니다.`);
      }
    }
    
    closeModal();
    await renderInvestmentsView();
  } catch (error) {
    console.error('Failed to save investment:', error);
    alert('투자 정보 저장 중 오류가 발생했습니다.\n' + (error.response?.data?.error || error.message));
  }
}

async function editInvestment(id) {
  console.log('Edit investment:', id);
  try {
    // 투자 목록 다시 로드 (최신 데이터 확보)
    await fetchInvestments();
    await openInvestmentModal(id);
  } catch (error) {
    console.error('Failed to open edit modal:', error);
    alert('투자 수정 모달을 여는 중 오류가 발생했습니다.');
  }
}

async function deleteInvestment(id) {
  console.log('Delete investment:', id);
  
  const investment = state.investments.find(inv => inv.id === id);
  const confirmMessage = investment 
    ? `${investment.name} (${investment.symbol}) 투자를 삭제하시겠습니까?`
    : '이 투자를 삭제하시겠습니까?';
  
  if (!confirm(confirmMessage)) return;
  
  try {
    const response = await axios.delete(`/api/investments/${id}`);
    
    if (response.data.success) {
      alert('투자가 삭제되었습니다.');
      await renderInvestmentsView();
    } else {
      alert('투자 삭제에 실패했습니다.');
    }
  } catch (error) {
    console.error('Failed to delete investment:', error);
    alert('투자 삭제 중 오류가 발생했습니다.');
  }
}

// =============================================================================
// 거래 내역 수정 기능
// =============================================================================

async function openEditTransactionModal(transactionId) {
  // 거래 정보 가져오기
  const transaction = state.transactions.find(t => t.id === transactionId);
  if (!transaction) {
    alert('거래 정보를 찾을 수 없습니다.');
    return;
  }
  
  await fetchSavingsAccounts();
  
  const modalContainer = document.getElementById('modal-container');
  
  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="closeModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">거래 수정</h3>
          <button onclick="closeModal()" class="text-gray-500 hover:text-gray-700">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <form onsubmit="handleEditTransactionSubmit(event, ${transactionId})" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">거래 유형</label>
            <div class="flex gap-2">
              <button type="button" onclick="setEditTransactionType('income', ${transactionId})" 
                      class="flex-1 py-2 rounded border ${transaction.type === 'income' ? 'bg-blue-500 text-white' : 'bg-gray-100'}"
                      id="edit-type-income-${transactionId}">
                수입
              </button>
              <button type="button" onclick="setEditTransactionType('expense', ${transactionId})" 
                      class="flex-1 py-2 rounded border ${transaction.type === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-100'}"
                      id="edit-type-expense-${transactionId}">
                지출
              </button>
              <button type="button" onclick="setEditTransactionType('savings', ${transactionId})" 
                      class="flex-1 py-2 rounded border ${transaction.type === 'savings' ? 'bg-green-500 text-white' : 'bg-gray-100'}"
                      id="edit-type-savings-${transactionId}">
                저축
              </button>
            </div>
            <input type="hidden" name="type" value="${transaction.type}" id="edit-transaction-type-${transactionId}">
          </div>
          
          <div id="edit-savings-account-select-${transactionId}" style="display: ${transaction.type === 'savings' ? 'block' : 'none'}">
            <label class="block text-sm font-medium mb-2">저축 통장</label>
            <select name="savings_account_id" class="w-full px-4 py-2 border rounded">
              <option value="">선택하세요</option>
              ${state.savingsAccounts.map(acc => 
                `<option value="${acc.id}" ${acc.id === transaction.savings_account_id ? 'selected' : ''}>${acc.name}</option>`
              ).join('')}
            </select>
          </div>
          
          <div id="edit-category-select-${transactionId}">
            <label class="block text-sm font-medium mb-2">카테고리</label>
            <select name="category" required class="w-full px-4 py-2 border rounded" 
                    id="edit-category-${transactionId}">
              ${(categories[transaction.type] || []).map(cat => 
                `<option value="${cat}" ${cat === transaction.category ? 'selected' : ''}>${cat}</option>`
              ).join('')}
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">금액</label>
            <input type="number" name="amount" value="${transaction.amount}" 
                   required min="0" class="w-full px-4 py-2 border rounded">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">날짜</label>
            <input type="date" name="date" value="${transaction.date}" 
                   required class="w-full px-4 py-2 border rounded">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">설명 (선택)</label>
            <input type="text" name="description" value="${transaction.description || ''}" 
                   class="w-full px-4 py-2 border rounded">
          </div>
          
          <div class="flex gap-2 pt-4">
            <button type="submit" class="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              수정
            </button>
            <button type="button" onclick="closeModal()" class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function setEditTransactionType(type, transactionId) {
  document.getElementById(`edit-transaction-type-${transactionId}`).value = type;
  
  // 버튼 스타일 업데이트
  ['income', 'expense', 'savings'].forEach(t => {
    const btn = document.getElementById(`edit-type-${t}-${transactionId}`);
    if (t === type) {
      btn.className = `flex-1 py-2 rounded border ${
        t === 'income' ? 'bg-blue-500 text-white' : 
        t === 'expense' ? 'bg-red-500 text-white' : 
        'bg-green-500 text-white'
      }`;
    } else {
      btn.className = 'flex-1 py-2 rounded border bg-gray-100';
    }
  });
  
  // 카테고리 업데이트
  const categorySelect = document.getElementById(`edit-category-${transactionId}`);
  categorySelect.innerHTML = (categories[type] || [])
    .map(cat => `<option value="${cat}">${cat}</option>`)
    .join('');
  
  // 저축 통장 선택 표시/숨김
  const savingsAccountSelect = document.getElementById(`edit-savings-account-select-${transactionId}`);
  savingsAccountSelect.style.display = type === 'savings' ? 'block' : 'none';
}

async function handleEditTransactionSubmit(event, transactionId) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const data = {
    type: formData.get('type'),
    category: formData.get('category'),
    amount: parseFloat(formData.get('amount')),
    date: formData.get('date'),
    description: formData.get('description') || null,
    savings_account_id: formData.get('savings_account_id') || null
  };
  
  try {
    await axios.put(`/api/transactions/${transactionId}`, data);
    closeModal();
    
    // 현재 뷰에 따라 다시 렌더링
    switch (state.activeView) {
      case 'month':
        await renderMonthView();
        break;
      case 'week':
        await renderWeekView();
        break;
      default:
        await switchView(state.activeView);
    }
  } catch (error) {
    alert('거래 수정 중 오류가 발생했습니다.');
    console.error(error);
  }
}

// =============================================================================
// 연간 지출 리포트 뷰 (3단계 드릴다운)
// =============================================================================

async function renderReportsView() {
  const contentArea = document.getElementById('content-area');
  const currentYear = new Date().getFullYear();
  
  contentArea.innerHTML = `
    <div class="space-y-6">
      <!-- 헤더 -->
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-2xl font-bold" id="report-title">연간 지출 현황</h2>
          <p class="text-gray-600 text-sm mt-1" id="report-subtitle">월별 총 지출을 확인하세요. 막대를 클릭하면 카테고리별 상세 내역을 볼 수 있습니다.</p>
        </div>
        <div class="flex gap-2">
          <button onclick="changeReportYear(-1)" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            <i class="fas fa-chevron-left"></i>
          </button>
          <select id="report-year" onchange="loadYearlyReport()" class="px-4 py-2 border rounded">
            ${[0, 1, 2, 3, 4].map(offset => `
              <option value="${currentYear - offset}" ${offset === 0 ? 'selected' : ''}>${currentYear - offset}년</option>
            `).join('')}
          </select>
          <button onclick="changeReportYear(1)" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
      
      <!-- 네비게이션 경로 (Breadcrumb) -->
      <div id="report-breadcrumb" class="bg-white rounded-lg shadow px-6 py-3">
        <div class="flex items-center gap-2 text-sm">
          <button onclick="loadYearlyReport()" class="text-blue-600 hover:text-blue-800 font-medium">
            <i class="fas fa-home mr-1"></i>연간 지출
          </button>
        </div>
      </div>
      
      <!-- 차트 영역 -->
      <div class="bg-white rounded-lg shadow p-6">
        <canvas id="report-chart" style="height: 400px;"></canvas>
      </div>
      
      <!-- 상세 데이터 테이블 -->
      <div id="report-details" class="bg-white rounded-lg shadow p-6">
        <p class="text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>데이터를 불러오는 중...</p>
      </div>
    </div>
  `;
  
  // 초기 로드
  await loadYearlyReport();
}

// 리포트 상태 관리
let reportChart = null;
let reportState = {
  year: new Date().getFullYear(),
  selectedMonth: null,
  selectedCategory: null,
  yearlyData: null
};

// 연도 변경
function changeReportYear(delta) {
  reportState.year += delta;
  document.getElementById('report-year').value = reportState.year;
  loadYearlyReport();
}

// 1단계: 연간 월별 지출 현황 (바 그래프)
async function loadYearlyReport() {
  reportState.selectedMonth = null;
  reportState.selectedCategory = null;
  reportState.year = parseInt(document.getElementById('report-year').value);
  
  const detailsDiv = document.getElementById('report-details');
  detailsDiv.innerHTML = '<p class="text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>데이터를 불러오는 중...</p>';
  
  // 업데이트 제목과 서브타이틀
  document.getElementById('report-title').textContent = `${reportState.year}년 월별 지출 현황`;
  document.getElementById('report-subtitle').textContent = '막대를 클릭하면 해당 월의 카테고리별 지출을 확인할 수 있습니다.';
  
  // Breadcrumb 업데이트
  document.getElementById('report-breadcrumb').innerHTML = `
    <div class="flex items-center gap-2 text-sm">
      <button onclick="loadYearlyReport()" class="text-blue-600 hover:text-blue-800 font-medium">
        <i class="fas fa-home mr-1"></i>${reportState.year}년 연간 지출
      </button>
    </div>
  `;
  
  // 12개월 데이터 가져오기
  const monthlyData = [];
  const monthLabels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  
  for (let month = 1; month <= 12; month++) {
    const monthStr = `${reportState.year}-${String(month).padStart(2, '0')}`;
    const firstDay = `${monthStr}-01`;
    const lastDay = `${monthStr}-${new Date(reportState.year, month, 0).getDate()}`;
    
    const response = await axios.get(`/api/transactions?start_date=${firstDay}&end_date=${lastDay}`);
    const transactions = response.data.data || [];
    
    const total = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    monthlyData.push({
      month: month,
      monthStr: monthStr,
      label: monthLabels[month - 1],
      total: total
    });
  }
  
  reportState.yearlyData = monthlyData;
  
  // 바 차트 그리기
  drawYearlyBarChart(monthlyData);
  
  // 상세 테이블
  const maxAmount = Math.max(...monthlyData.map(d => d.total));
  const prevYearSameMonthComparison = await getPreviousYearComparison(reportState.year);
  
  let tableHTML = `
    <h3 class="text-lg font-bold mb-4">월별 상세</h3>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left">월</th>
            <th class="px-4 py-3 text-right">지출액</th>
            <th class="px-4 py-3 text-right">전년 대비</th>
            <th class="px-4 py-3 text-center">액션</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  monthlyData.forEach((data, index) => {
    const prevYearAmount = prevYearSameMonthComparison[data.month - 1] || 0;
    const diff = prevYearAmount > 0 ? ((data.total - prevYearAmount) / prevYearAmount * 100).toFixed(1) : 0;
    const diffClass = diff > 0 ? 'text-red-600' : diff < 0 ? 'text-blue-600' : 'text-gray-600';
    const diffSign = diff > 0 ? '+' : '';
    
    tableHTML += `
      <tr class="border-t hover:bg-gray-50">
        <td class="px-4 py-3 font-medium">${data.label}</td>
        <td class="px-4 py-3 text-right">
          <div class="font-bold">${formatCurrency(data.total)}</div>
          <div class="text-xs text-gray-500">전체의 ${maxAmount > 0 ? ((data.total / maxAmount) * 100).toFixed(0) : 0}%</div>
        </td>
        <td class="px-4 py-3 text-right ${diffClass}">
          ${prevYearAmount > 0 ? `${diffSign}${diff}%` : '-'}
        </td>
        <td class="px-4 py-3 text-center">
          <button onclick="loadMonthCategoryReport(${data.month})" 
                  class="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">
            <i class="fas fa-chart-bar mr-1"></i>상세보기
          </button>
        </td>
      </tr>
    `;
  });
  
  const yearTotal = monthlyData.reduce((sum, d) => sum + d.total, 0);
  tableHTML += `
      <tr class="border-t-2 bg-gray-50 font-bold">
        <td class="px-4 py-3">연간 합계</td>
        <td class="px-4 py-3 text-right">${formatCurrency(yearTotal)}</td>
        <td class="px-4 py-3"></td>
        <td class="px-4 py-3"></td>
      </tr>
    </tbody>
  </table>
</div>
  `;
  
  detailsDiv.innerHTML = tableHTML;
}

// 전년 동월 비교 데이터 가져오기
async function getPreviousYearComparison(currentYear) {
  const prevYear = currentYear - 1;
  const prevYearData = [];
  
  for (let month = 1; month <= 12; month++) {
    const monthStr = `${prevYear}-${String(month).padStart(2, '0')}`;
    const firstDay = `${monthStr}-01`;
    const lastDay = `${monthStr}-${new Date(prevYear, month, 0).getDate()}`;
    
    try {
      const response = await axios.get(`/api/transactions?start_date=${firstDay}&end_date=${lastDay}`);
      const transactions = response.data.data || [];
      const total = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      prevYearData.push(total);
    } catch (error) {
      prevYearData.push(0);
    }
  }
  
  return prevYearData;
}

// 2단계: 특정 월의 카테고리별 지출 (바 그래프)
async function loadMonthCategoryReport(month) {
  reportState.selectedMonth = month;
  reportState.selectedCategory = null;
  
  const monthStr = `${reportState.year}-${String(month).padStart(2, '0')}`;
  const monthLabel = ['', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'][month];
  
  const detailsDiv = document.getElementById('report-details');
  detailsDiv.innerHTML = '<p class="text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>데이터를 불러오는 중...</p>';
  
  // 제목 업데이트
  document.getElementById('report-title').textContent = `${reportState.year}년 ${monthLabel} 카테고리별 지출`;
  document.getElementById('report-subtitle').textContent = '막대를 클릭하면 해당 카테고리의 거래 내역을 확인할 수 있습니다.';
  
  // Breadcrumb 업데이트
  document.getElementById('report-breadcrumb').innerHTML = `
    <div class="flex items-center gap-2 text-sm">
      <button onclick="loadYearlyReport()" class="text-blue-600 hover:text-blue-800">
        <i class="fas fa-home mr-1"></i>${reportState.year}년 연간 지출
      </button>
      <i class="fas fa-chevron-right text-gray-400"></i>
      <span class="text-gray-700 font-medium">${monthLabel}</span>
    </div>
  `;
  
  // 해당 월의 거래 데이터 가져오기
  const firstDay = `${monthStr}-01`;
  const lastDay = `${monthStr}-${new Date(reportState.year, month, 0).getDate()}`;
  
  const response = await axios.get(`/api/transactions?start_date=${firstDay}&end_date=${lastDay}`);
  const transactions = response.data.data || [];
  const expenses = transactions.filter(t => t.type === 'expense');
  
  // 카테고리별 집계
  const categoryData = {};
  categories.expense.forEach(cat => {
    categoryData[cat] = {
      category: cat,
      total: 0,
      count: 0
    };
  });
  
  expenses.forEach(t => {
    if (categoryData[t.category]) {
      categoryData[t.category].total += t.amount;
      categoryData[t.category].count++;
    }
  });
  
  // 배열로 변환하고 금액 순으로 정렬
  const categoryArray = Object.values(categoryData)
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total);
  
  if (categoryArray.length === 0) {
    detailsDiv.innerHTML = '<p class="text-center text-gray-500">이 달에는 지출 내역이 없습니다.</p>';
    
    if (reportChart) {
      reportChart.destroy();
      reportChart = null;
    }
    return;
  }
  
  // 바 차트 그리기
  drawCategoryBarChart(categoryArray, monthLabel);
  
  // 상세 테이블
  const monthTotal = categoryArray.reduce((sum, d) => sum + d.total, 0);
  
  let tableHTML = `
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-bold">카테고리별 상세</h3>
      <div class="text-sm text-gray-600">
        총 <span class="font-bold text-blue-600">${formatCurrency(monthTotal)}</span>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left">카테고리</th>
            <th class="px-4 py-3 text-right">지출액</th>
            <th class="px-4 py-3 text-right">비율</th>
            <th class="px-4 py-3 text-right">건수</th>
            <th class="px-4 py-3 text-center">액션</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  categoryArray.forEach(data => {
    const percentage = ((data.total / monthTotal) * 100).toFixed(1);
    
    tableHTML += `
      <tr class="border-t hover:bg-gray-50">
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded" style="background-color: ${getCategoryColor(data.category)}"></div>
            <span class="font-medium">${data.category}</span>
          </div>
        </td>
        <td class="px-4 py-3 text-right font-bold">${formatCurrency(data.total)}</td>
        <td class="px-4 py-3 text-right text-gray-600">${percentage}%</td>
        <td class="px-4 py-3 text-right text-gray-600">${data.count}건</td>
        <td class="px-4 py-3 text-center">
          <button onclick="loadCategoryTransactions('${data.category}')" 
                  class="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600">
            <i class="fas fa-list mr-1"></i>거래내역
          </button>
        </td>
      </tr>
    `;
  });
  
  tableHTML += `
    </tbody>
  </table>
</div>
  `;
  
  detailsDiv.innerHTML = tableHTML;
}

// 카테고리별 색상 (Chart.js 기본 팔레트)
function getCategoryColor(category) {
  const colors = {
    '의복비': '#FF6384',
    '식비': '#36A2EB',
    '주거비': '#FFCE56',
    '교통비': '#4BC0C0',
    '문화생활': '#9966FF',
    '쇼핑': '#FF9F40',
    '의료비': '#FF6384',
    '교육비': '#C9CBCF',
    '통신비': '#4BC0C0',
    '보험': '#FF6384',
    '기타지출': '#36A2EB'
  };
  return colors[category] || '#999999';
}

// 3단계: 특정 카테고리의 거래 내역 리스트
async function loadCategoryTransactions(category) {
  reportState.selectedCategory = category;
  
  const month = reportState.selectedMonth;
  const monthStr = `${reportState.year}-${String(month).padStart(2, '0')}`;
  const monthLabel = ['', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'][month];
  
  const detailsDiv = document.getElementById('report-details');
  detailsDiv.innerHTML = '<p class="text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>데이터를 불러오는 중...</p>';
  
  // 제목 업데이트
  document.getElementById('report-title').textContent = `${reportState.year}년 ${monthLabel} - ${category}`;
  document.getElementById('report-subtitle').textContent = '해당 카테고리의 모든 거래 내역입니다.';
  
  // Breadcrumb 업데이트
  document.getElementById('report-breadcrumb').innerHTML = `
    <div class="flex items-center gap-2 text-sm">
      <button onclick="loadYearlyReport()" class="text-blue-600 hover:text-blue-800">
        <i class="fas fa-home mr-1"></i>${reportState.year}년 연간 지출
      </button>
      <i class="fas fa-chevron-right text-gray-400"></i>
      <button onclick="loadMonthCategoryReport(${month})" class="text-blue-600 hover:text-blue-800">
        ${monthLabel}
      </button>
      <i class="fas fa-chevron-right text-gray-400"></i>
      <span class="text-gray-700 font-medium">${category}</span>
    </div>
  `;
  
  // 해당 월의 거래 데이터 가져오기
  const firstDay = `${monthStr}-01`;
  const lastDay = `${monthStr}-${new Date(reportState.year, month, 0).getDate()}`;
  
  const response = await axios.get(`/api/transactions?start_date=${firstDay}&end_date=${lastDay}`);
  const transactions = response.data.data || [];
  const categoryTransactions = transactions
    .filter(t => t.type === 'expense' && t.category === category)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (categoryTransactions.length === 0) {
    detailsDiv.innerHTML = '<p class="text-center text-gray-500">거래 내역이 없습니다.</p>';
    
    if (reportChart) {
      reportChart.destroy();
      reportChart = null;
    }
    return;
  }
  
  // 차트 숨기기 (거래 내역은 차트가 필요없음)
  if (reportChart) {
    reportChart.destroy();
    reportChart = null;
  }
  
  // 거래 내역 테이블
  const categoryTotal = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  let tableHTML = `
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-bold">거래 내역</h3>
      <div class="text-sm">
        총 <span class="font-bold text-red-600">${formatCurrency(categoryTotal)}</span>
        <span class="text-gray-500 ml-2">(${categoryTransactions.length}건)</span>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left">날짜</th>
            <th class="px-4 py-3 text-left">설명</th>
            <th class="px-4 py-3 text-right">금액</th>
            <th class="px-4 py-3 text-center">액션</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  categoryTransactions.forEach(t => {
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][new Date(t.date).getDay()];
    
    tableHTML += `
      <tr class="border-t hover:bg-gray-50">
        <td class="px-4 py-3">
          <div class="font-medium">${t.date}</div>
          <div class="text-xs text-gray-500">${dayOfWeek}요일</div>
        </td>
        <td class="px-4 py-3">
          ${t.description ? `<div class="text-gray-700">${t.description}</div>` : '<div class="text-gray-400 text-sm">-</div>'}
        </td>
        <td class="px-4 py-3 text-right">
          <span class="font-bold text-red-600">${formatCurrency(t.amount)}</span>
        </td>
        <td class="px-4 py-3 text-center">
          <button onclick="openEditTransactionModal(${t.id})" 
                  class="text-blue-600 hover:text-blue-800 mr-2"
                  title="수정">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="deleteTransaction(${t.id})" 
                  class="text-red-600 hover:text-red-800"
                  title="삭제">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
  
  tableHTML += `
    </tbody>
  </table>
</div>
  `;
  
  detailsDiv.innerHTML = tableHTML;
}

// 바 차트 그리기 함수들
function drawYearlyBarChart(data) {
  const ctx = document.getElementById('report-chart');
  
  if (reportChart) {
    reportChart.destroy();
  }
  
  const labels = data.map(d => d.label);
  const amounts = data.map(d => d.total);
  const maxAmount = Math.max(...amounts);
  
  reportChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '지출액',
        data: amounts,
        backgroundColor: amounts.map((amount, index) => {
          // 금액에 따라 색상 그라데이션
          const intensity = maxAmount > 0 ? (amount / maxAmount) : 0;
          return `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`;
        }),
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const month = data[index].month;
          loadMonthCategoryReport(month);
        }
      },
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: `${reportState.year}년 월별 지출 (클릭하여 상세보기)`,
          font: {
            size: 16,
            weight: 'bold'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return formatCurrency(context.parsed.y);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatCurrencyShort(value);
            }
          }
        }
      }
    }
  });
}

function drawCategoryBarChart(data, monthLabel) {
  const ctx = document.getElementById('report-chart');
  
  if (reportChart) {
    reportChart.destroy();
  }
  
  const labels = data.map(d => d.category);
  const amounts = data.map(d => d.total);
  const colors = data.map(d => getCategoryColor(d.category));
  
  reportChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '지출액',
        data: amounts,
        backgroundColor: colors.map(c => c + '80'), // 80% opacity
        borderColor: colors,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const category = data[index].category;
          loadCategoryTransactions(category);
        }
      },
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: `${reportState.year}년 ${monthLabel} 카테고리별 지출 (클릭하여 상세보기)`,
          font: {
            size: 16,
            weight: 'bold'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return formatCurrency(context.parsed.y);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatCurrencyShort(value);
            }
          }
        }
      }
    }
  });
}

// 설정 뷰 렌더링
async function renderSettingsView() {
  await fetchSettings();
  
  const contentArea = document.getElementById('content-area');
  contentArea.innerHTML = `
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-2xl font-bold mb-6">설정</h2>
      
      <div class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">통화</label>
          <select id="currency-select" class="w-full px-4 py-2 border rounded">
            ${Object.keys(CURRENCIES).map(code => `
              <option value="${code}" ${state.settings.currency === code ? 'selected' : ''}>
                ${CURRENCIES[code].name}
              </option>
            `).join('')}
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">초기 잔액</label>
          <input type="number" id="initial-balance" value="${state.settings.initial_balance}" 
                 class="w-full px-4 py-2 border rounded" placeholder="0">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">초기 저축액</label>
          <input type="number" id="initial-savings" value="${state.settings.initial_savings}" 
                 class="w-full px-4 py-2 border rounded" placeholder="0">
        </div>
        
        <button onclick="saveSettings()" class="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium">
          <i class="fas fa-save mr-2"></i>설정 저장
        </button>
      </div>
    </div>
  `;
}

// =============================================================================
// 이벤트 핸들러 함수들
// =============================================================================

function changeMonth(delta) {
  state.currentMonth.setMonth(state.currentMonth.getMonth() + delta);
  renderMonthView();
}

function changeWeek(delta) {
  state.currentWeekStart.setDate(state.currentWeekStart.getDate() + (delta * 7));
  renderWeekView();
}

function changeFixedExpenseMonth(delta) {
  state.currentMonth.setMonth(state.currentMonth.getMonth() + delta);
  renderFixedExpensesView();
}

async function openTransactionModal(date) {
  const modalContainer = document.getElementById('modal-container');
  const selectedDate = date || getDateString(new Date());
  
  await fetchSavingsAccounts();
  
  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="closeModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">거래 추가</h3>
          <button onclick="closeModal()" class="text-gray-500 hover:text-gray-700">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <form onsubmit="handleTransactionSubmit(event)" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">거래 유형</label>
            <div class="flex gap-2">
              <button type="button" onclick="setTransactionType('income')" 
                      class="flex-1 py-2 rounded border ${state.currentTransactionType === 'income' ? 'bg-blue-500 text-white' : 'bg-gray-100'}">
                수입
              </button>
              <button type="button" onclick="setTransactionType('expense')" 
                      class="flex-1 py-2 rounded border ${state.currentTransactionType === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-100'}">
                지출
              </button>
              <button type="button" onclick="setTransactionType('savings')" 
                      class="flex-1 py-2 rounded border ${state.currentTransactionType === 'savings' ? 'bg-green-500 text-white' : 'bg-gray-100'}">
                저축
              </button>
            </div>
          </div>
          
          <div id="savings-account-select" style="display: ${state.currentTransactionType === 'savings' ? 'block' : 'none'}">
            <label class="block text-sm font-medium mb-2">저축 통장</label>
            <select name="savings_account_id" class="w-full px-4 py-2 border rounded">
              <option value="">선택하세요</option>
              ${state.savingsAccounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('')}
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">카테고리</label>
            <select name="category" class="w-full px-4 py-2 border rounded" required>
              ${(categories[state.currentTransactionType] || []).map(cat => 
                `<option value="${cat}">${cat}</option>`
              ).join('')}
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">금액</label>
            <input type="number" name="amount" class="w-full px-4 py-2 border rounded" required min="0" placeholder="0">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">날짜</label>
            <input type="date" name="date" value="${selectedDate}" class="w-full px-4 py-2 border rounded" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">메모 (선택)</label>
            <input type="text" name="description" class="w-full px-4 py-2 border rounded" placeholder="메모를 입력하세요">
          </div>
          
          <button type="submit" class="w-full py-3 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium">
            추가
          </button>
        </form>
      </div>
    </div>
  `;
}

function setTransactionType(type) {
  state.currentTransactionType = type;
  openTransactionModal(null);
}

async function handleTransactionSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  
  const data = {
    type: state.currentTransactionType,
    category: formData.get('category'),
    amount: parseInt(formData.get('amount')),
    description: formData.get('description'),
    date: formData.get('date'),
    savings_account_id: formData.get('savings_account_id') || null
  };
  
  try {
    const response = await axios.post('/api/transactions', data);
    if (response.data.success) {
      closeModal();
      switchView(state.activeView);
    }
  } catch (error) {
    alert('거래 추가 중 오류가 발생했습니다.');
  }
}

async function deleteTransaction(id) {
  if (!confirm('이 거래를 삭제하시겠습니까?')) return;
  
  try {
    const response = await axios.delete(`/api/transactions/${id}`);
    if (response.data.success) {
      switchView(state.activeView);
    }
  } catch (error) {
    alert('거래 삭제 중 오류가 발생했습니다.');
  }
}

function openSavingsAccountModal() {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="closeModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">저축 통장 추가</h3>
        <form onsubmit="handleSavingsAccountSubmit(event)" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">통장 이름</label>
            <input type="text" name="name" class="w-full px-4 py-2 border rounded" required placeholder="예: 비상금">
          </div>
          <button type="submit" class="w-full py-3 bg-green-500 text-white rounded hover:bg-green-600 font-medium">
            추가
          </button>
        </form>
      </div>
    </div>
  `;
}

async function handleSavingsAccountSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  
  try {
    const response = await axios.post('/api/savings-accounts', {
      name: formData.get('name')
    });
    if (response.data.success) {
      closeModal();
      renderSavingsView();
    }
  } catch (error) {
    alert('통장 추가 중 오류가 발생했습니다.');
  }
}

async function deleteSavingsAccount(id) {
  if (!confirm('이 저축 통장을 삭제하시겠습니까? 관련된 모든 저축 거래도 삭제됩니다.')) return;
  
  try {
    const response = await axios.delete(`/api/savings-accounts/${id}`);
    if (response.data.success) {
      renderSavingsView();
    }
  } catch (error) {
    alert('통장 삭제 중 오류가 발생했습니다.');
  }
}

function openFixedExpenseModal() {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="closeModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">고정지출 추가</h3>
        <form onsubmit="handleFixedExpenseSubmit(event)" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">이름</label>
            <input type="text" name="name" class="w-full px-4 py-2 border rounded" required placeholder="예: 월세">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">카테고리</label>
            <select name="category" class="w-full px-4 py-2 border rounded" required>
              ${categories.expense.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">금액</label>
            <input type="number" name="amount" class="w-full px-4 py-2 border rounded" required min="0">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">주기</label>
            <select name="frequency" class="w-full px-4 py-2 border rounded" required onchange="toggleFixedExpenseFields(this.value)">
              <option value="monthly">월별 (특정 주/요일)</option>
              <option value="monthly_day">매월 (특정 일자)</option>
              <option value="weekly">주별</option>
            </select>
          </div>
          <div id="week-of-month-container">
            <label class="block text-sm font-medium mb-2">주차</label>
            <select name="week_of_month" class="w-full px-4 py-2 border rounded">
              <option value="1">첫째 주</option>
              <option value="2">둘째 주</option>
              <option value="3">셋째 주</option>
              <option value="4">넷째 주</option>
            </select>
          </div>
          <div id="day-of-week-container">
            <label class="block text-sm font-medium mb-2">요일</label>
            <select name="day_of_week" class="w-full px-4 py-2 border rounded">
              <option value="0">일요일</option>
              <option value="1">월요일</option>
              <option value="2">화요일</option>
              <option value="3">수요일</option>
              <option value="4">목요일</option>
              <option value="5">금요일</option>
              <option value="6">토요일</option>
            </select>
          </div>
          <div id="payment-day-container" style="display: none;">
            <label class="block text-sm font-medium mb-2">일자</label>
            <input type="number" name="payment_day" class="w-full px-4 py-2 border rounded" min="1" max="31" placeholder="1-31">
          </div>
          <button type="submit" class="w-full py-3 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium">
            추가
          </button>
        </form>
      </div>
    </div>
  `;
}

function toggleFixedExpenseFields(frequency) {
  const weekOfMonthContainer = document.getElementById('week-of-month-container');
  const dayOfWeekContainer = document.getElementById('day-of-week-container');
  const paymentDayContainer = document.getElementById('payment-day-container');
  
  if (frequency === 'monthly') {
    // 월별 (특정 주/요일)
    weekOfMonthContainer.style.display = 'block';
    dayOfWeekContainer.style.display = 'block';
    paymentDayContainer.style.display = 'none';
  } else if (frequency === 'monthly_day') {
    // 매월 (특정 일자)
    weekOfMonthContainer.style.display = 'none';
    dayOfWeekContainer.style.display = 'none';
    paymentDayContainer.style.display = 'block';
  } else if (frequency === 'weekly') {
    // 주별
    weekOfMonthContainer.style.display = 'none';
    dayOfWeekContainer.style.display = 'block';
    paymentDayContainer.style.display = 'none';
  }
}

async function handleFixedExpenseSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const frequency = formData.get('frequency');
  
  const data = {
    name: formData.get('name'),
    category: formData.get('category'),
    amount: parseInt(formData.get('amount')),
    frequency: frequency
  };
  
  if (frequency === 'monthly') {
    data.week_of_month = parseInt(formData.get('week_of_month'));
    data.day_of_week = parseInt(formData.get('day_of_week'));
  } else if (frequency === 'monthly_day') {
    data.payment_day = parseInt(formData.get('payment_day'));
  } else if (frequency === 'weekly') {
    data.day_of_week = parseInt(formData.get('day_of_week'));
  }
  
  try {
    const response = await axios.post('/api/fixed-expenses', data);
    if (response.data.success) {
      closeModal();
      renderFixedExpensesView();
    }
  } catch (error) {
    alert(error.response?.data?.error || '고정지출 추가 중 오류가 발생했습니다.');
  }
}

async function deleteFixedExpense(id) {
  if (!confirm('이 고정지출을 삭제하시겠습니까?')) return;
  
  try {
    const response = await axios.delete(`/api/fixed-expenses/${id}`);
    if (response.data.success) {
      renderFixedExpensesView();
    }
  } catch (error) {
    alert('고정지출 삭제 중 오류가 발생했습니다.');
  }
}

async function handleBudgetChange(category, value) {
  const amount = parseInt(value) || 0;
  
  try {
    if (amount === 0) {
      await axios.delete(`/api/budgets/${encodeURIComponent(category)}`);
      alert(`${category} 예산이 삭제되었습니다.`);
    } else {
      await axios.put(`/api/budgets/${encodeURIComponent(category)}`, {
        monthly_budget: amount
      });
      alert(`${category} 예산이 ${formatCurrency(amount)}으로 설정되었습니다.`);
    }
    await fetchBudgets();
  } catch (error) {
    alert('예산 처리 중 오류가 발생했습니다.');
  }
}

async function saveSettings() {
  const currency = document.getElementById('currency-select').value;
  const initialBalance = parseInt(document.getElementById('initial-balance').value) || 0;
  const initialSavings = parseInt(document.getElementById('initial-savings').value) || 0;
  
  try {
    const response = await axios.put('/api/settings', {
      currency,
      initial_balance: initialBalance,
      initial_savings: initialSavings,
      category_colors: state.settings.category_colors
    });
    
    if (response.data.success) {
      const previousCurrency = state.settings.currency;
      await fetchSettings();
      
      // 통화가 변경되었으면 현재 화면을 다시 렌더링
      if (previousCurrency !== currency) {
        alert(`설정이 저장되었습니다. 통화가 ${CURRENCIES[previousCurrency]?.name || previousCurrency}에서 ${CURRENCIES[currency]?.name || currency}로 변경되었습니다.`);
        
        // 현재 활성화된 뷰에 따라 다시 렌더링
        switch(state.activeView) {
          case 'month':
            await renderMonthView();
            break;
          case 'week':
            await renderWeekView();
            break;
          case 'savings':
            await renderSavingsView();
            break;
          case 'fixed-expenses':
            await renderFixedExpensesView();
            break;
          case 'budgets':
            await renderBudgetsView();
            break;
          case 'receipts':
            await renderReceiptsView();
            break;
          case 'settings':
            await renderSettingsView();
            break;
        }
      } else {
        alert('설정이 저장되었습니다.');
        await renderSettingsView();
      }
    }
  } catch (error) {
    alert('설정 저장 중 오류가 발생했습니다.');
  }
}

function closeModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('modal-container').innerHTML = '';
}

// =============================================================================
// 영수증 관리
// =============================================================================

// =============================================================================
// 영수증 관리
// =============================================================================

async function renderReceiptsView() {
  console.log('🔍 renderReceiptsView 시작');
  
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    console.log('📅 현재 연도/월:', currentYear, currentMonth);
    
    const html = `
    <div class="mb-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold text-gray-800">
          <i class="fas fa-receipt mr-2 text-blue-600"></i>영수증 관리
        </h2>
        <button onclick="showReceiptModal()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      
      <!-- 필터 -->
      <div class="bg-gray-50 p-4 rounded-lg mb-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">연도</label>
            <select id="receipt-year-filter" class="w-full px-3 py-2 border rounded-lg" onchange="loadReceipts()">
              ${[currentYear, currentYear - 1, currentYear - 2].map(year => 
                `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}년</option>`
              ).join('')}
              <option value="">전체</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">월</label>
            <select id="receipt-month-filter" class="w-full px-3 py-2 border rounded-lg" onchange="loadReceipts()">
              <option value="">전체</option>
              ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => 
                `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${m}월</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">카테고리</label>
            <select id="receipt-category-filter" class="w-full px-3 py-2 border rounded-lg" onchange="loadReceipts()">
              <option value="">전체</option>
              ${categories.expense.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">세금공제</label>
            <select id="receipt-tax-filter" class="w-full px-3 py-2 border rounded-lg" onchange="loadReceipts()">
              <option value="">전체</option>
              <option value="true">공제 대상</option>
              <option value="false">일반</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- 통계 요약 -->
      <div id="receipt-stats" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <!-- 통계가 여기에 표시됩니다 -->
      </div>
      
      <!-- 영수증 목록 -->
      <div id="receipt-list" class="bg-white rounded-lg">
        <div class="text-center py-8 text-gray-500">
          <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
          <p>로딩 중...</p>
        </div>
      </div>
    </div>
  `;
  
  console.log('📝 HTML 생성 완료');
  contentArea.innerHTML = html;
  console.log('🎨 contentArea에 HTML 삽입 완료');
  
  await loadReceipts();
  console.log('✅ renderReceiptsView 완료');
  
  } catch (error) {
    console.error('❌ renderReceiptsView 에러:', error);
    contentArea.innerHTML = `
      <div class="text-center py-16">
        <i class="fas fa-exclamation-triangle text-6xl text-red-500 mb-4"></i>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">영수증 페이지 로딩 오류</h2>
        <p class="text-gray-600 mb-4">${error.message}</p>
        <pre class="text-left bg-gray-100 p-4 rounded-lg text-sm overflow-auto">${error.stack}</pre>
      </div>
    `;
  }
}

async function loadReceipts() {
  try {
    const year = document.getElementById('receipt-year-filter')?.value || '';
    const month = document.getElementById('receipt-month-filter')?.value || '';
    const category = document.getElementById('receipt-category-filter')?.value || '';
    const taxDeductible = document.getElementById('receipt-tax-filter')?.value || '';
    
    // 필터 파라미터 구성
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (month) params.append('month', month);
    if (category) params.append('category', category);
    if (taxDeductible) params.append('tax_deductible', taxDeductible);
    
    const response = await axios.get(`/api/receipts?${params.toString()}`);
    if (!response.data.success) {
      throw new Error(response.data.error || '영수증을 불러올 수 없습니다.');
    }
    const receipts = response.data.data || [];
    
    // 통계 계산
    const totalAmount = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    const taggedAmount = receipts.filter(r => r.tags && r.tags.includes('세금공제')).reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalCount = receipts.length;
    
    // 통계 표시
    document.getElementById('receipt-stats').innerHTML = `
      <div class="bg-blue-50 p-4 rounded-lg">
        <div class="text-sm text-gray-600 mb-1">총 영수증 수</div>
        <div class="text-2xl font-bold text-blue-600">${totalCount}건</div>
      </div>
      <div class="bg-green-50 p-4 rounded-lg">
        <div class="text-sm text-gray-600 mb-1">총 지출액</div>
        <div class="text-2xl font-bold text-green-600">${formatCurrency(totalAmount)}</div>
      </div>
      <div class="bg-purple-50 p-4 rounded-lg">
        <div class="text-sm text-gray-600 mb-1">세금공제 태그</div>
        <div class="text-2xl font-bold text-purple-600">${formatCurrency(taggedAmount)}</div>
      </div>
    `;
    
    // 영수증 목록 표시
    if (receipts.length === 0) {
      document.getElementById('receipt-list').innerHTML = `
        <div class="text-center py-12 text-gray-500">
          <i class="fas fa-receipt text-6xl mb-4 opacity-20"></i>
          <p class="text-lg">등록된 영수증이 없습니다.</p>
          <button onclick="showReceiptModal()" class="mt-4 text-blue-600 hover:text-blue-700">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      `;
      return;
    }
    
    let listHTML = `
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">구매일</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">구매처</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">금액</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">결제수단</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">세금공제</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">영수증</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">관리</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
    `;
    
    for (const receipt of receipts) {
      const date = new Date(receipt.purchase_date);
      const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      listHTML += `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 text-sm">${formattedDate}</td>
          <td class="px-4 py-3">
            <div class="font-medium">${receipt.store_name}</div>
            ${receipt.description ? `<div class="text-xs text-gray-500">${receipt.description}</div>` : ''}
          </td>
          <td class="px-4 py-3">
            ${receipt.category ? `<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">${receipt.category}</span>` : '<span class="text-gray-400 text-xs">미분류</span>'}
          </td>
          <td class="px-4 py-3 text-right font-medium">${formatCurrency(receipt.amount)}</td>
          <td class="px-4 py-3 text-sm">${receipt.payment_method || '-'}</td>
          <td class="px-4 py-3 text-center">
            ${receipt.tags && receipt.tags.includes('세금공제') ? '<span class="text-green-600"><i class="fas fa-check-circle"></i></span>' : '<span class="text-gray-300"><i class="fas fa-times-circle"></i></span>'}
          </td>
          <td class="px-4 py-3 text-center">
            ${receipt.image_data ? `<button onclick="viewReceiptImage(${receipt.id})" class="text-blue-600 hover:text-blue-800" title="영수증 보기"><i class="fas fa-image"></i></button>` : '<span class="text-gray-300"><i class="fas fa-image"></i></span>'}
          </td>
          <td class="px-4 py-3 text-center">
            <button onclick="editReceipt(${receipt.id})" 
                    class="px-2 py-1 text-blue-600 hover:bg-blue-50 text-xs rounded mr-1"
                    title="수정">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="deleteReceipt(${receipt.id})" 
                    class="px-2 py-1 text-red-600 hover:bg-red-50 text-xs rounded"
                    title="삭제">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }
    
    listHTML += `
          </tbody>
        </table>
      </div>
    `;
    
    document.getElementById('receipt-list').innerHTML = listHTML;
    
  } catch (error) {
    console.error('영수증 로딩 오류:', error);
    const errorMessage = error.response?.data?.error || error.message || '알 수 없는 오류';
    document.getElementById('receipt-list').innerHTML = `
      <div class="text-center py-8">
        <i class="fas fa-exclamation-circle text-4xl mb-4 text-yellow-500"></i>
        <h3 class="text-xl font-bold text-gray-800 mb-2">영수증을 불러올 수 없습니다</h3>
        <p class="text-gray-600 mb-4">${errorMessage}</p>
        <p class="text-sm text-gray-500">데이터베이스가 연결되지 않았거나 서버 오류가 발생했습니다.</p>
        <button onclick="loadReceipts()" class="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
          <i class="fas fa-redo mr-2"></i>다시 시도
        </button>
      </div>
    `;
    
    // 통계도 초기화
    document.getElementById('receipt-stats').innerHTML = `
      <div class="bg-gray-100 p-4 rounded-lg">
        <div class="text-sm text-gray-600 mb-1">총 영수증 수</div>
        <div class="text-2xl font-bold text-gray-400">0건</div>
      </div>
      <div class="bg-gray-100 p-4 rounded-lg">
        <div class="text-sm text-gray-600 mb-1">총 지출액</div>
        <div class="text-2xl font-bold text-gray-400">0원</div>
      </div>
      <div class="bg-gray-100 p-4 rounded-lg">
        <div class="text-sm text-gray-600 mb-1">세금공제 대상</div>
        <div class="text-2xl font-bold text-gray-400">0원</div>
      </div>
    `;
  }
}

function showReceiptModal(receiptId = null) {
  let receipt = null;
  
  if (receiptId) {
    // 수정 모드: 기존 영수증 데이터 가져오기
    axios.get(`/api/receipts/${receiptId}`)
      .then(response => {
        receipt = response.data.data;
        renderReceiptModal(receipt);
      })
      .catch(error => {
        alert('영수증 정보를 불러올 수 없습니다.');
      });
  } else {
    renderReceiptModal(null);
  }
}

function renderReceiptModal(receipt) {
  const today = new Date().toISOString().split('T')[0];
  
  const modalHTML = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onclick="closeModal(event)">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h3 class="text-xl font-bold">
            <i class="fas fa-receipt mr-2 text-blue-600"></i>
            ${receipt ? '영수증 수정' : '새 영수증 추가'}
          </h3>
          <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times text-2xl"></i>
          </button>
        </div>
        
        <form id="receipt-form" class="p-6">
          <input type="hidden" name="id" value="${receipt?.id || ''}">
          
          <!-- 이미지 업로드 -->
          <div class="mb-6">
            <label class="block text-sm font-medium mb-2">영수증 사진</label>
            <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <input type="file" id="receipt-image" accept="image/*" class="hidden" onchange="previewReceiptImage(event)">
              <div id="image-preview-area">
                ${receipt?.image_data ? `
                  <img src="${receipt.image_data}" class="max-w-full max-h-64 mx-auto mb-2 rounded">
                  <p class="text-sm text-gray-500 mb-2">사진을 변경하려면 클릭하세요</p>
                ` : `
                  <i class="fas fa-camera text-4xl text-gray-400 mb-2"></i>
                  <p class="text-sm text-gray-500 mb-2">영수증 사진을 추가하세요 (필수)</p>
                `}
              </div>
              <button type="button" onclick="document.getElementById('receipt-image').click()" 
                      class="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                <i class="fas fa-upload mr-2"></i>사진 선택
              </button>
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- 구매처명 -->
            <div>
              <label class="block text-sm font-medium mb-2">구매처명 <span class="text-red-500">*</span></label>
              <input type="text" name="store_name" value="${receipt?.store_name || ''}" 
                     placeholder="예: 스타벅스, 이마트" required
                     class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            
            <!-- 구매일 -->
            <div>
              <label class="block text-sm font-medium mb-2">구매일 <span class="text-red-500">*</span></label>
              <input type="date" name="purchase_date" value="${receipt?.purchase_date || today}" required
                     class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            
            <!-- 총 금액 -->
            <div>
              <label class="block text-sm font-medium mb-2">총 금액 <span class="text-red-500">*</span></label>
              <input type="number" name="amount" value="${receipt?.amount || ''}" 
                     placeholder="10000" min="0" step="100" required
                     class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            
            <!-- 카테고리 -->
            <div>
              <label class="block text-sm font-medium mb-2">카테고리</label>
              <select name="category" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="">선택 안함</option>
                ${categories.expense.map(cat => 
                  `<option value="${cat}" ${receipt?.category === cat ? 'selected' : ''}>${cat}</option>`
                ).join('')}
              </select>
            </div>
            
            <!-- 결제수단 -->
            <div>
              <label class="block text-sm font-medium mb-2">결제수단</label>
              <select name="payment_method" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="">선택 안함</option>
                <option value="카드" ${receipt?.payment_method === '카드' ? 'selected' : ''}>카드</option>
                <option value="현금" ${receipt?.payment_method === '현금' ? 'selected' : ''}>현금</option>
                <option value="계좌이체" ${receipt?.payment_method === '계좌이체' ? 'selected' : ''}>계좌이체</option>
                <option value="기타" ${receipt?.payment_method === '기타' ? 'selected' : ''}>기타</option>
              </select>
            </div>
            
            <!-- 태그 -->
            <div>
              <label class="block text-sm font-medium mb-2">태그</label>
              <input type="text" name="tags" value="${receipt?.tags || ''}" 
                     placeholder="예: 세금공제,사업비용" 
                     class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
              <p class="text-xs text-gray-500 mt-1">쉼표로 구분해서 여러 태그 입력 가능</p>
            </div>
          </div>
          
          <!-- 구매 내역 설명 -->
          <div class="mt-4">
            <label class="block text-sm font-medium mb-2">구매 내역</label>
            <textarea name="description" rows="2" 
                      placeholder="예: 커피 2잔, 샌드위치 1개"
                      class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">${receipt?.description || ''}</textarea>
          </div>
          
          <!-- 추가 메모 -->
          <div class="mt-4">
            <label class="block text-sm font-medium mb-2">추가 메모</label>
            <textarea name="notes" rows="2" 
                      placeholder="기타 메모 사항"
                      class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">${receipt?.notes || ''}</textarea>
          </div>
          
          <!-- 버튼 -->
          <div class="flex justify-end space-x-3 mt-6">
            <button type="button" onclick="closeModal()" 
                    class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              취소
            </button>
            <button type="submit" 
                    class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i class="fas fa-save mr-2"></i>${receipt ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.getElementById('modal-container').innerHTML = modalHTML;
  
  // 폼 제출 이벤트
  document.getElementById('receipt-form').onsubmit = async (e) => {
    e.preventDefault();
    await saveReceipt(receipt?.id);
  };
}

function previewReceiptImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const previewArea = document.getElementById('image-preview-area');
    previewArea.innerHTML = `
      <img src="${e.target.result}" class="max-w-full max-h-64 mx-auto mb-2 rounded">
      <p class="text-sm text-gray-500 mb-2">사진을 변경하려면 다시 선택하세요</p>
    `;
    
    // Base64 데이터 저장 (나중에 서버로 전송)
    previewArea.dataset.imageBase64 = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveReceipt(receiptId) {
  try {
    const form = document.getElementById('receipt-form');
    const formData = new FormData(form);
    
    const data = {
      store_name: formData.get('store_name'),
      purchase_date: formData.get('purchase_date'),
      amount: parseFloat(formData.get('amount')),
      category: formData.get('category') || null,
      payment_method: formData.get('payment_method') || null,
      description: formData.get('description') || null,
      tags: formData.get('tags') || null,
      notes: formData.get('notes') || null,
    };
    
    // 이미지 Base64 데이터 추가 (필수)
    const previewArea = document.getElementById('image-preview-area');
    if (previewArea.dataset.imageBase64) {
      data.image_data = previewArea.dataset.imageBase64;
      // MIME 타입 추출
      const matches = data.image_data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
      data.image_type = matches ? matches[1] : 'image/jpeg';
    } else if (!receiptId) {
      alert('영수증 사진은 필수입니다.');
      return;
    }
    
    if (receiptId) {
      // 수정
      await axios.put(`/api/receipts/${receiptId}`, data);
      alert('영수증이 수정되었습니다.');
    } else {
      // 추가
      await axios.post('/api/receipts', data);
      alert('영수증이 추가되었습니다.');
    }
    
    closeModal();
    await loadReceipts();
    
  } catch (error) {
    console.error('영수증 저장 오류:', error);
    alert('영수증 저장 중 오류가 발생했습니다.');
  }
}

async function editReceipt(receiptId) {
  showReceiptModal(receiptId);
}

async function deleteReceipt(receiptId) {
  if (!confirm('이 영수증을 삭제하시겠습니까?')) return;
  
  try {
    await axios.delete(`/api/receipts/${receiptId}`);
    alert('영수증이 삭제되었습니다.');
    await loadReceipts();
  } catch (error) {
    console.error('영수증 삭제 오류:', error);
    alert('영수증 삭제 중 오류가 발생했습니다.');
  }
}

async function viewReceiptImage(receiptId) {
  try {
    const response = await axios.get(`/api/receipts/${receiptId}`);
    const receipt = response.data.data;
    
    if (!receipt.image_data) {
      alert('영수증 이미지가 없습니다.');
      return;
    }
    
    const modalHTML = `
      <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onclick="closeModal(event)">
        <div class="relative max-w-4xl w-full" onclick="event.stopPropagation()">
          <button onclick="closeModal()" class="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300">
            <i class="fas fa-times"></i>
          </button>
          <div class="bg-white rounded-lg p-4">
            <div class="mb-3">
              <h3 class="text-lg font-bold">${receipt.store_name}</h3>
              <p class="text-sm text-gray-500">${receipt.purchase_date} | ${formatCurrency(receipt.amount)}</p>
              ${receipt.tags ? `<p class="text-xs text-blue-600 mt-1"><i class="fas fa-tags mr-1"></i>${receipt.tags}</p>` : ''}
            </div>
            <img src="${receipt.image_data}" class="w-full max-h-[70vh] object-contain rounded">
            ${receipt.description ? `<p class="mt-3 text-sm text-gray-600"><strong>구매 내역:</strong> ${receipt.description}</p>` : ''}
            ${receipt.notes ? `<p class="mt-2 text-sm text-gray-500"><strong>메모:</strong> ${receipt.notes}</p>` : ''}
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('modal-container').innerHTML = modalHTML;
    
  } catch (error) {
    console.error('영수증 이미지 로딩 오류:', error);
    alert('영수증 이미지를 불러올 수 없습니다.');
  }
}

// =============================================================================
// 초기화
// =============================================================================

async function init() {
  await fetchSettings();
  await switchView('month');
  
  // 탭 버튼 이벤트 리스너 등록
  document.getElementById('tab-month').onclick = () => switchView('month');
  document.getElementById('tab-week').onclick = () => switchView('week');
  document.getElementById('tab-savings').onclick = () => switchView('savings');
  document.getElementById('tab-fixed-expenses').onclick = () => switchView('fixed-expenses');
  document.getElementById('tab-budgets').onclick = () => switchView('budgets');
  document.getElementById('tab-investments').onclick = () => switchView('investments');
  document.getElementById('tab-receipts').onclick = () => switchView('receipts');
  document.getElementById('tab-reports').onclick = () => switchView('reports');
  document.getElementById('tab-settings').onclick = () => switchView('settings');
}

// 앱 시작
init();

