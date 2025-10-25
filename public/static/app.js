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
  currentTransactionType: 'income'
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
  state.activeView = view;
  
  // 모든 탭 버튼 업데이트
  const tabs = ['month', 'week', 'savings', 'fixed-expenses', 'budgets', 'settings'];
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
  
  contentArea.innerHTML = `
    <div class="space-y-6">
      <!-- 월 네비게이션 -->
      <div class="flex justify-between items-center">
        <button onclick="changeMonth(-1)" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          <i class="fas fa-chevron-left"></i> 이전 달
        </button>
        <h2 class="text-2xl font-bold">${state.currentMonth.getFullYear()}년 ${state.currentMonth.getMonth() + 1}월</h2>
        <button onclick="changeMonth(1)" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          다음 달 <i class="fas fa-chevron-right"></i>
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
      
      <!-- 거래 내역 -->
      <div class="bg-white p-6 rounded-lg shadow">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">거래 내역</h3>
          <button onclick="openTransactionModal(null)" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            <i class="fas fa-plus mr-2"></i>거래 추가
          </button>
        </div>
        ${renderTransactionList(state.transactions)}
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
  
  // 날짜 렌더링
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dateStr = getDateString(currentDate);
    const dayOfWeek = currentDate.getDay();
    const dayData = calendarData[dateStr] || {};
    
    // 토요일(6) 파란색, 일요일(0) 빨간색
    let dayColor = 'text-gray-800';
    if (dayOfWeek === 0) dayColor = 'text-red-600';
    else if (dayOfWeek === 6) dayColor = 'text-blue-600';
    
    html += `
      <div class="border p-2 rounded cursor-pointer hover:bg-gray-50 min-h-[80px]" 
           onclick="openTransactionModal('${dateStr}')">
        <div class="font-bold mb-1 ${dayColor}">${day}</div>
        ${dayData.income ? `<div class="text-xs text-blue-600">+${formatCurrencyShort(dayData.income)}</div>` : ''}
        ${dayData.expense ? `<div class="text-xs text-red-600">-${formatCurrencyShort(dayData.expense)}</div>` : ''}
        ${dayData.savings ? `<div class="text-xs text-green-600">저축${formatCurrencyShort(dayData.savings)}</div>` : ''}
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
  
  const contentArea = document.getElementById('content-area');
  contentArea.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <button onclick="changeWeek(-1)" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          <i class="fas fa-chevron-left"></i> 이전 주
        </button>
        <h2 class="text-2xl font-bold">${getDateString(state.currentWeekStart)} ~ ${getDateString(weekEnd)}</h2>
        <button onclick="changeWeek(1)" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          다음 주 <i class="fas fa-chevron-right"></i>
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
      
      <div class="bg-white p-6 rounded-lg shadow">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">거래 내역</h3>
          <button onclick="openTransactionModal(null)" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            <i class="fas fa-plus mr-2"></i>거래 추가
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
          <i class="fas fa-plus mr-2"></i>통장 추가
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
          <i class="fas fa-plus mr-2"></i>고정지출 추가
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
        ${fixedExpenseInstances.map((instance, index) => `
          <div class="bg-white p-6 rounded-lg shadow">
            <div class="flex justify-between items-start mb-3">
              <div class="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="check-${instance.id}-${index}"
                  ${instance.is_paid ? 'checked' : ''}
                  onchange="handleFixedExpenseCheck(${instance.id}, '${instance.scheduled_date}', this.checked)"
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
              <span class="px-2 py-1 text-xs rounded-full ${instance.frequency === 'monthly' ? 'bg-blue-500' : 'bg-green-500'} text-white">
                ${instance.frequency === 'monthly' ? '월별' : '주별'}
              </span>
              ${instance.frequency === 'monthly' ? `
                <span class="px-2 py-1 text-xs rounded-full bg-orange-500 text-white">
                  ${getWeekName(instance.week_of_month)}주
                </span>
              ` : ''}
              <span class="px-2 py-1 text-xs rounded-full bg-purple-500 text-white">
                ${getDayName(instance.day_of_week)}요일
              </span>
            </div>
            <p class="text-sm text-gray-600">카테고리: ${instance.category}</p>
          </div>
        `).join('')}
      </div>
      
      ${fixedExpenseInstances.length === 0 ? '<p class="text-center text-gray-500 py-8">이번 달에 예정된 고정지출이 없습니다.</p>' : ''}
    </div>
  `;
}

// 고정지출 날짜 계산 헬퍼 함수 (getNthDayOfMonth는 이미 백엔드에 있지만 프론트엔드에서도 필요)
function getNthDayOfMonth(year, month, weekOfMonth, dayOfWeek) {
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay();
  
  // 첫 번째 해당 요일 찾기
  let daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7;
  const firstOccurrence = 1 + daysToAdd;
  
  // n번째 해당 요일 계산
  const targetDay = firstOccurrence + (weekOfMonth - 1) * 7;
  
  // 해당 월에 존재하는지 확인
  const targetDate = new Date(year, month, targetDay);
  if (targetDate.getMonth() !== month) {
    return null;
  }
  
  return targetDate;
}

// 고정지출 체크박스 핸들러
async function handleFixedExpenseCheck(expenseId, date, isChecked) {
  if (isChecked) {
    // 체크 시: 지불 처리
    if (!confirm(`이 고정지출을 ${date}에 지불하시겠습니까?`)) {
      // 취소 시 체크박스 원상복구
      document.getElementById(`check-${expenseId}`).checked = false;
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
      document.getElementById(`check-${expenseId}`).checked = false;
    }
  } else {
    // 체크 해제 시: 삭제 여부 확인
    if (!confirm('이 지불 내역을 취소하시겠습니까? 거래 내역도 함께 삭제됩니다.')) {
      document.getElementById(`check-${expenseId}`).checked = true;
      return;
    }
    
    try {
      const yearMonth = getYearMonth(new Date(date));
      const paymentsResponse = await axios.get(`/api/fixed-expenses/${expenseId}/payments/${yearMonth}`);
      
      if (paymentsResponse.data.success && paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
        const payment = paymentsResponse.data.data[0];
        await axios.delete(`/api/transactions/${payment.transaction_id}`);
        alert('지불 내역이 취소되었습니다.');
        renderFixedExpensesView();
      }
    } catch (error) {
      alert('지불 취소 중 오류가 발생했습니다.');
      document.getElementById(`check-${expenseId}`).checked = true;
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
              <span class="text-gray-600">₩</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
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
            <select name="frequency" class="w-full px-4 py-2 border rounded" required onchange="toggleWeekOfMonth(this.value)">
              <option value="monthly">월별</option>
              <option value="weekly">주별</option>
            </select>
          </div>
          <div id="week-of-month-container">
            <label class="block text-sm font-medium mb-2">주차 (월별만)</label>
            <select name="week_of_month" class="w-full px-4 py-2 border rounded">
              <option value="1">첫째 주</option>
              <option value="2">둘째 주</option>
              <option value="3">셋째 주</option>
              <option value="4">넷째 주</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">요일</label>
            <select name="day_of_week" class="w-full px-4 py-2 border rounded" required>
              <option value="0">일요일</option>
              <option value="1">월요일</option>
              <option value="2">화요일</option>
              <option value="3">수요일</option>
              <option value="4">목요일</option>
              <option value="5">금요일</option>
              <option value="6">토요일</option>
            </select>
          </div>
          <button type="submit" class="w-full py-3 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium">
            추가
          </button>
        </form>
      </div>
    </div>
  `;
}

function toggleWeekOfMonth(frequency) {
  const container = document.getElementById('week-of-month-container');
  container.style.display = frequency === 'monthly' ? 'block' : 'none';
}

async function handleFixedExpenseSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  
  const data = {
    name: formData.get('name'),
    category: formData.get('category'),
    amount: parseInt(formData.get('amount')),
    frequency: formData.get('frequency'),
    week_of_month: formData.get('frequency') === 'monthly' ? parseInt(formData.get('week_of_month')) : null,
    day_of_week: parseInt(formData.get('day_of_week'))
  };
  
  try {
    const response = await axios.post('/api/fixed-expenses', data);
    if (response.data.success) {
      closeModal();
      renderFixedExpensesView();
    }
  } catch (error) {
    alert('고정지출 추가 중 오류가 발생했습니다.');
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
  document.getElementById('tab-settings').onclick = () => switchView('settings');
}

// 앱 시작
init();

