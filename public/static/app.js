// ===== 앱 초기 부팅 시 세션 ID 생성 및 axios에 장착 =====
(function initializeSession() {
  // 1. 세션 ID가 없으면 생성 (브라우저별 고유 ID)
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    // UUID 형식의 고유 ID 생성
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('sessionId', sessionId);
    console.log('[Session] New session created:', sessionId);
  } else {
    console.log('[Session] Existing session loaded:', sessionId);
  }
  
  // 2. axios 기본 헤더에 세션 ID 설정
  axios.defaults.headers.common['Authorization'] = `Bearer ${sessionId}`;
  
  // 3. 기존 authToken도 유지 (향후 로그인 기능용)
  const authToken = localStorage.getItem('authToken');
  if (authToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  }
})();

// 전역 상태 객체

const state = {
  currentMonth: new Date(),
  currentWeekStart: null,
  transactions: [],
  savingsAccounts: [],
  fixedExpenses: [],
  budgets: [],
  investments: [],
  settings: {
    currency: 'KRW',
    initial_balance: 0,
    cash_on_hand: 0,
    category_colors: {
      income: '#3B82F6',
      expense: '#EF4444',
      savings: '#10B981'
    }
  },
  activeView: 'month',
  expenseChart: null,
  currentTransactionType: 'income',
  investmentPriceRefreshInterval: null,
  darkMode: localStorage.getItem('darkMode') === 'true',
  backgroundTheme: localStorage.getItem('backgroundTheme') || 'morning',
  // 인증 관련 상태
  isAuthenticated: false,
  currentUser: null,
  authToken: localStorage.getItem('authToken') || null
};

// 배경 테마 정의
const BACKGROUND_THEMES = {
  morning: {
    name: '오전 (시원한 파랑)',
    colors: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    description: '차가운 파란색/보라색 톤'
  },
  sunset: {
    name: '노을 (따뜻한 핑크)',
    colors: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
    description: '따뜻한 핑크/살구색 톤'
  },
  gray: {
    name: '회색 (기본)',
    colors: '#F3F4F6',
    description: '심플한 회색 배경'
  }
};

// 카테고리 정의

const categories = {
  income: ['급여', '상여금', '부수입', '기타수입'],
  expense: [
    '의복비', '식비', '주거비', '교통비', 
    '문화생활', '쇼핑', '의료비', '교육비', 
    '통신비', '보험', '기타지출'
  ],
  savings: ['저축']
};

// 통화 정의

const CURRENCIES = {
  'KRW': { symbol: '₩', name: '원화 (KRW)' },
  'USD': { symbol: '$', name: '미국 달러 (USD)' },
  'EUR': { symbol: '€', name: '유로 (EUR)' },
  'JPY': { symbol: '¥', name: '일본 엔 (JPY)' },
  'AUD': { symbol: 'A$', name: '호주 달러 (AUD)' },
  'GBP': { symbol: '£', name: '영국 파운드 (GBP)' }
};

// 유틸리티 함수

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

// 입력 검증 유틸리티 함수들

function validateNumber(value, min = 0, max = null, fieldName = '값') {
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName}은(는) 유효한 숫자여야 합니다.` };
  }
  
  if (num < min) {
    return { valid: false, error: `${fieldName}은(는) ${min} 이상이어야 합니다.` };
  }
  
  if (max !== null && num > max) {
    return { valid: false, error: `${fieldName}은(는) ${max} 이하여야 합니다.` };
  }
  
  return { valid: true, value: num };
}

function validateInteger(value, min = 0, max = null, fieldName = '값') {
  const result = validateNumber(value, min, max, fieldName);
  
  if (!result.valid) {
    return result;
  }
  
  if (!Number.isInteger(result.value)) {
    return { valid: false, error: `${fieldName}은(는) 정수여야 합니다.` };
  }
  
  return result;
}

function validatePositiveNumber(value, fieldName = '금액') {
  const result = validateNumber(value, 0.01, null, fieldName);
  
  if (!result.valid) {
    return result;
  }
  
  if (result.value <= 0) {
    return { valid: false, error: `${fieldName}은(는) 0보다 커야 합니다.` };
  }
  
  return result;
}

function validateDate(dateString, fieldName = '날짜') {
  if (!dateString || dateString.trim() === '') {
    return { valid: false, error: `${fieldName}을(를) 입력해주세요.` };
  }
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return { valid: false, error: `${fieldName}이(가) 유효하지 않습니다.` };
  }
  
  // 1900년 ~ 2100년 사이만 허용
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) {
    return { valid: false, error: `${fieldName}은(는) 1900년부터 2100년 사이여야 합니다.` };
  }
  
  return { valid: true, value: dateString };
}

function validateDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    return { valid: false, error: '시작 날짜는 종료 날짜보다 이전이어야 합니다.' };
  }
  
  return { valid: true };
}

function validateString(value, minLength = 1, maxLength = 255, fieldName = '텍스트') {
  if (!value || typeof value !== 'string') {
    return { valid: false, error: `${fieldName}을(를) 입력해주세요.` };
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length < minLength) {
    return { valid: false, error: `${fieldName}은(는) 최소 ${minLength}자 이상이어야 합니다.` };
  }
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName}은(는) 최대 ${maxLength}자 이하여야 합니다.` };
  }
  
  return { valid: true, value: trimmed };
}

function sanitizeString(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  // HTML 태그 제거 및 특수 문자 이스케이프
  return value
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 500); // 최대 500자로 제한
}

function validateRequired(value, fieldName = '필드') {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: `${fieldName}은(는) 필수 입력 항목입니다.` };
  }
  
  if (typeof value === 'string' && value.trim() === '') {
    return { valid: false, error: `${fieldName}을(를) 입력해주세요.` };
  }
  
  return { valid: true };
}

function showValidationError(message) {
  alert(`⚠️ 입력 오류\n\n${message}`);
}

function validateTransactionAmount(amount) {
  // 거래 금액은 1원 이상 100억 원 이하
  return validateNumber(amount, 1, 10000000000, '거래 금액');
}

function validateBudgetAmount(amount) {
  // 예산은 0원 이상 (0은 삭제를 의미)
  return validateNumber(amount, 0, 100000000000, '예산 금액');
}

function validateSavingsGoal(amount) {
  // 저축 목표는 0원 이상 (0은 목표 제거를 의미)
  return validateNumber(amount, 0, 100000000000, '저축 목표');
}

function validateInvestmentQuantity(quantity) {
  // 투자 수량은 1 이상의 정수 또는 소수
  return validateNumber(quantity, 0.00000001, 1000000000, '보유 수량');
}

function validateInvestmentPrice(price) {
  // 투자 가격은 0.01 이상
  return validateNumber(price, 0.01, 100000000, '매수 가격');
}

// 인증 관련 함수

function setAuthToken(accessToken, refreshToken) {
  console.log('[Auth] Setting tokens - Access:', accessToken?.substring(0, 20) + '...', 'Refresh:', refreshToken?.substring(0, 20) + '...');
  state.authToken = accessToken;
  localStorage.setItem('authToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  console.log('[Auth] Tokens set successfully');
}

function clearAuthToken() {
  state.authToken = null;
  state.isAuthenticated = false;
  state.currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  delete axios.defaults.headers.common['Authorization'];
}

async function checkAuth() {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    return false;
  }
  
  try {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    const response = await axios.get('/api/auth/me');
    
    if (response.data.success) {
      state.isAuthenticated = true;
      state.currentUser = response.data.user;
      return true;
    }
  } catch (error) {
    console.error('[Auth] Check failed:', error);
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
  }
  
  return false;
}

// 단순한 axios 인터셉터 (401 시 로그아웃)
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const errorMessage = error?.response?.data?.error || error.message;
    
    // 401 인증 오류 - 로그아웃
    if (status === 401) {
      console.warn('[Auth] 401 Unauthorized - 토큰 만료, 로그아웃 처리');
      localStorage.removeItem('authToken');
      delete axios.defaults.headers.common['Authorization'];
      
      if (state.isAuthenticated) {
        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
        state.isAuthenticated = false;
        state.currentUser = null;
        renderLoginScreen();
      }
      
      return Promise.reject(error);
    }
    
    // 403 권한 오류
    if (status === 403) {
      console.warn('[Auth] 403 Forbidden - 권한 없음');
      alert('이 작업을 수행할 권한이 없습니다.');
      return Promise.reject(error);
    }
    
    // 404 Not Found
    if (status === 404) {
      console.warn('[API] 404 Not Found:', error.config?.url);
      // 404는 조용히 처리 (사용자에게 알림 안 함)
      return Promise.reject(error);
    }
    
    // 500 서버 오류
    if (status === 500) {
      console.error('[API] 500 Server Error:', errorMessage);
      alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      return Promise.reject(error);
    }
    
    // 503 Service Unavailable (오프라인)
    if (status === 503) {
      console.warn('[Network] 503 Service Unavailable - 오프라인 상태');
      alert('오프라인 상태입니다. 인터넷 연결을 확인해주세요.');
      return Promise.reject(error);
    }
    
    // 네트워크 오류 (인터넷 연결 끊김)
    if (!error.response) {
      console.error('[Network] Network error:', error.message);
      alert('네트워크 연결을 확인해주세요.');
      return Promise.reject(error);
    }
    
    // 기타 오류
    console.error('[API] Error:', status, errorMessage);
    return Promise.reject(error);
  }
);

async function handleLogin(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const username = formData.get('username');
  const password = formData.get('password');
  const rememberMe = formData.get('rememberMe') === 'on';
  const saveUsername = formData.get('saveUsername') === 'on';
  
  console.log('[Login] Attempting login for user:', username);
  
  if (!username || !password) {
    alert('아이디와 비밀번호를 입력해주세요.');
    return;
  }
  
  try {
    const res = await axios.post('/api/auth/login', { username, password });
    console.log('[Login] Response:', res.data);
    
    const token = res.data.token;
    
    if (!token) {
      console.error('No token in response', res.data);
      alert('로그인 응답에 토큰이 없습니다.');
      return;
    }
    
    // 로컬 저장 + Authorization 헤더 세팅
    console.log('[Login] Setting token...');
    localStorage.setItem('authToken', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // 자동 로그인 설정
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true');
      console.log('[Login] Auto-login enabled');
    } else {
      localStorage.removeItem('rememberMe');
    }
    
    // 아이디 저장 설정
    if (saveUsername) {
      localStorage.setItem('savedUsername', username);
      console.log('[Login] Username saved:', username);
    } else {
      localStorage.removeItem('savedUsername');
    }
    
    // 상태/화면 갱신
    state.isAuthenticated = true;
    state.currentUser = res.data.user || null;
    console.log('[Login] State updated:', state);
    console.log('[Login] Rendering app...');
    renderApp();
  } catch (err) {
    console.error('[Login] Error:', err);
    alert(err?.response?.data?.error || '로그인 실패');
  }
}

async function handleRegister(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const username = formData.get('username');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');
  const name = formData.get('name');
  
  if (!username || !password || !confirmPassword || !name) {
    alert('모든 필드를 입력해주세요.');
    return;
  }
  
  if (password !== confirmPassword) {
    alert('비밀번호가 일치하지 않습니다.');
    return;
  }
  
  if (password.length !== 4) {
    alert('비밀번호는 4자리여야 합니다.');
    return;
  }
  
  if (!/^\d{4}$/.test(password)) {
    alert('비밀번호는 숫자 4자리여야 합니다.');
    return;
  }
  
  try {
    const res = await axios.post('/api/auth/register', { username, password, name });
    console.log('[Register] Response:', res.data);
    
    const token = res.data.token;
    
    if (token) {
      localStorage.setItem('authToken', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    state.isAuthenticated = true;
    state.currentUser = res.data.user || null;
    renderApp();
  } catch (err) {
    console.error('[Register] Error:', err);
    alert(err?.response?.data?.error || '회원가입 실패');
  }
}

function handleLogout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.removeItem('authToken');
    
    // "로그인 상태 유지" 옵션도 제거 (로그아웃하면 초기화)
    localStorage.removeItem('rememberMe');
    
    // 참고: "아이디 저장"은 유지됨 (savedUsername은 삭제하지 않음)
    
    delete axios.defaults.headers.common['Authorization'];
    state.isAuthenticated = false;
    state.currentUser = null;
    renderLoginScreen();
  }
}

function renderLoginScreen() {
  const savedUsername = localStorage.getItem('savedUsername') || '';
  const rememberMe = localStorage.getItem('rememberMe') === 'true';
  
  document.getElementById('app').innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div class="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
        <div class="text-center mb-8">
          <i class="fas fa-wallet text-6xl text-blue-600 mb-4"></i>
          <h1 class="text-3xl font-bold text-gray-800">가계부 앱</h1>
          <p class="text-gray-600 mt-2">개인 재무 관리 도우미</p>
        </div>
        
        <div class="mb-6">
          <div class="flex border-b">
            <button onclick="showLoginForm()" id="login-tab" class="flex-1 py-3 font-medium text-blue-600 border-b-2 border-blue-600">
              로그인
            </button>
            <button onclick="showRegisterForm()" id="register-tab" class="flex-1 py-3 font-medium text-gray-600">
              회원가입
            </button>
          </div>
        </div>
        
        <!-- 로그인 폼 -->
        <div id="login-form">
          <form onsubmit="handleLogin(event)" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                <i class="fas fa-user mr-2"></i>아이디
              </label>
              <input 
                type="text" 
                name="username" 
                id="login-username"
                required 
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="아이디 입력"
                autocomplete="username"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                <i class="fas fa-lock mr-2"></i>비밀번호 (숫자 4자리)
              </label>
              <input 
                type="password" 
                name="password" 
                required 
                pattern="\\d{4}"
                maxlength="4"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                placeholder="••••"
                inputmode="numeric"
                autocomplete="current-password"
              >
            </div>
            
            <!-- 자동 로그인 및 아이디 저장 옵션 -->
            <div class="space-y-2">
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  name="saveUsername" 
                  id="save-username-checkbox"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                >
                <span class="ml-2 text-sm text-gray-700">
                  <i class="fas fa-user-check mr-1"></i>아이디 저장
                </span>
              </label>
              
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  name="rememberMe" 
                  id="remember-me-checkbox"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                >
                <span class="ml-2 text-sm text-gray-700">
                  <i class="fas fa-check-circle mr-1"></i>로그인 상태 유지
                </span>
              </label>
            </div>
            
            <button 
              type="submit" 
              class="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              <i class="fas fa-sign-in-alt mr-2"></i>로그인
            </button>
          </form>
        </div>
        
        <!-- 회원가입 폼 -->
        <div id="register-form" style="display: none;">
          <form onsubmit="handleRegister(event)" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                <i class="fas fa-user mr-2"></i>이름
              </label>
              <input 
                type="text" 
                name="name" 
                required 
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="홍길동"
                autocomplete="name"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                <i class="fas fa-id-card mr-2"></i>아이디
              </label>
              <input 
                type="text" 
                name="username" 
                required 
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="아이디 입력"
                autocomplete="username"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                <i class="fas fa-lock mr-2"></i>비밀번호 (숫자 4자리)
              </label>
              <input 
                type="password" 
                name="password" 
                required 
                pattern="\\d{4}"
                maxlength="4"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                placeholder="••••"
                inputmode="numeric"
                autocomplete="new-password"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                <i class="fas fa-lock mr-2"></i>비밀번호 확인
              </label>
              <input 
                type="password" 
                name="confirmPassword" 
                required 
                pattern="\\d{4}"
                maxlength="4"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                placeholder="••••"
                inputmode="numeric"
                autocomplete="new-password"
              >
            </div>
            <button 
              type="submit" 
              class="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
            >
              <i class="fas fa-user-plus mr-2"></i>회원가입
            </button>
          </form>
        </div>
        
        <div class="mt-6 text-center text-sm text-gray-600">
          <p>처음 사용하시나요? 회원가입 후 이용하세요!</p>
        </div>
      </div>
    </div>
  `;
  
  // 저장된 아이디와 체크박스 상태 복원
  setTimeout(() => {
    const usernameInput = document.getElementById('login-username');
    const saveUsernameCheckbox = document.getElementById('save-username-checkbox');
    const rememberMeCheckbox = document.getElementById('remember-me-checkbox');
    
    if (usernameInput && savedUsername) {
      usernameInput.value = savedUsername;
      console.log('[Login] Restored username:', savedUsername);
    }
    
    if (saveUsernameCheckbox && savedUsername) {
      saveUsernameCheckbox.checked = true;
    }
    
    if (rememberMeCheckbox && rememberMe) {
      rememberMeCheckbox.checked = true;
    }
  }, 0);
}

function showLoginForm() {
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('login-tab').className = 'flex-1 py-3 font-medium text-blue-600 border-b-2 border-blue-600';
  document.getElementById('register-tab').className = 'flex-1 py-3 font-medium text-gray-600';
}

function showRegisterForm() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
  document.getElementById('login-tab').className = 'flex-1 py-3 font-medium text-gray-600';
  document.getElementById('register-tab').className = 'flex-1 py-3 font-medium text-blue-600 border-b-2 border-blue-600';
}

async function renderApp() {
  // 인증 확인 후 메인 앱 렌더링
  const isAuth = await checkAuth();
  
  if (!isAuth) {
    renderLoginScreen();
    return;
  }
  
  // 메인 앱 UI 렌더링
  document.getElementById('app').innerHTML = `
    <div class="container mx-auto max-w-7xl p-4">
      <div class="bg-white rounded-lg shadow-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-3xl font-bold text-gray-800 flex items-center">
            <i class="fas fa-wallet mr-3 text-blue-600"></i>
            가계부 앱
          </h1>
          <div class="flex items-center gap-4">
            <span class="text-sm text-gray-600">
              <i class="fas fa-user mr-2"></i>${state.currentUser?.name || '사용자'}님
            </span>
            <button onclick="handleLogout()" class="text-sm text-red-600 hover:text-red-700">
              <i class="fas fa-sign-out-alt mr-1"></i>로그아웃
            </button>
          </div>
        </div>
        
        <!-- 탭 네비게이션 -->
        <div class="border-b mb-6">
          <nav class="flex flex-wrap -mb-px">
            <button id="tab-home" class="tab-button border-b-2 border-blue-600 text-blue-600 py-4 px-6 font-medium">
              <i class="fas fa-home mr-2"></i>홈
            </button>
            <button id="tab-month" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
              <i class="fas fa-calendar-alt mr-2"></i>월별
            </button>
            <button id="tab-week" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
              <i class="fas fa-calendar-week mr-2"></i>주별
            </button>
            <button id="tab-savings" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
              <i class="fas fa-piggy-bank mr-2"></i>저축
            </button>
            <button id="tab-fixed-expenses" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
              <i class="fas fa-redo mr-2"></i>고정지출
            </button>
            <button id="tab-budgets" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
              <i class="fas fa-chart-pie mr-2"></i>예산
            </button>
            <button id="tab-investments" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
              <i class="fas fa-chart-line mr-2"></i>투자
            </button>
            <button id="tab-receipts" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
              <i class="fas fa-receipt mr-2"></i>영수증
            </button>
            <button id="tab-debts" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
              <i class="fas fa-hand-holding-usd mr-2"></i>채무
            </button>
            <button id="tab-reports" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
              <i class="fas fa-chart-bar mr-2"></i>리포트
            </button>
            <button id="tab-settings" class="tab-button border-b-2 border-transparent text-gray-600 hover:text-gray-800 py-4 px-6">
              <i class="fas fa-cog mr-2"></i>설정
            </button>
          </nav>
        </div>
        
        <!-- 콘텐츠 영역 -->
        <div id="content-area" class="min-h-screen">
          <div class="text-center text-gray-500 py-8">
            <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
            <p>로딩 중...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 모달들이 여기에 동적으로 추가됩니다 -->
    <div id="modal-container"></div>
  `;
  
  // 탭 이벤트 리스너 설정
  setupTabListeners();
  
  // 다크모드 적용
  applyDarkMode();
  
  // 배경 테마 적용
  applyBackgroundTheme(state.backgroundTheme);
  
  // 설정 로드 및 초기 뷰 렌더링
  await fetchSettings();
  await switchView('home');
}

function setupTabListeners() {
  document.getElementById('tab-home').onclick = () => switchView('home');
  document.getElementById('tab-month').onclick = () => switchView('month');
  document.getElementById('tab-week').onclick = () => switchView('week');
  document.getElementById('tab-savings').onclick = () => switchView('savings');
  document.getElementById('tab-fixed-expenses').onclick = () => switchView('fixed-expenses');
  document.getElementById('tab-budgets').onclick = () => switchView('budgets');
  document.getElementById('tab-investments').onclick = () => switchView('investments');
  document.getElementById('tab-receipts').onclick = () => switchView('receipts');
  document.getElementById('tab-debts').onclick = () => switchView('debts');
  document.getElementById('tab-reports').onclick = () => switchView('reports');
  document.getElementById('tab-settings').onclick = () => switchView('settings');
}

// API 호출 함수

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
  } catch (error) {}
}

// 저축 통장 가져오기
async function fetchSavingsAccounts() {
  try {
    const response = await axios.get('/api/savings-accounts');
    if (response.data.success) {
      state.savingsAccounts = response.data.data;
    }
  } catch (error) {}
}

// 고정지출 가져오기
async function fetchFixedExpenses() {
  try {
    const response = await axios.get('/api/fixed-expenses');
    if (response.data.success) {
      state.fixedExpenses = response.data.data;
    }
  } catch (error) {}
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
  } catch (error) {}
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
  } catch (error) {}
}

// 월별 통계 가져오기
async function fetchMonthlyStatistics(yearMonth) {
  try {
    const response = await axios.get(`/api/statistics/monthly/${yearMonth}`);
    return response.data;
  } catch (error) {

    return { success: false, summary: [], expenseByCategory: [] };
  }
}

// 주별 통계 가져오기
async function fetchWeeklyStatistics(startDate) {
  try {
    const response = await axios.get(`/api/statistics/weekly/${startDate}`);
    return response.data;
  } catch (error) {

    return { success: false, summary: [], expenseByCategory: [] };
  }
}

// 달력 데이터 가져오기
async function fetchCalendarData(yearMonth) {
  try {
    const response = await axios.get(`/api/calendar/${yearMonth}`);
    return response.data;
  } catch (error) {

    return { success: false, data: [] };
  }
}

// 예산 vs 지출 현황 가져오기
async function fetchBudgetVsSpending(yearMonth) {
  try {
    const response = await axios.get(`/api/budgets/vs-spending/${yearMonth}`);
    return response.data;
  } catch (error) {

    return { success: false, data: [] };
  }
}

// 탭 전환 함수

async function switchView(view) {
  state.activeView = view;
  
  // 모든 탭 버튼 업데이트
  const tabs = ['home', 'month', 'week', 'savings', 'fixed-expenses', 'budgets', 'investments', 'receipts', 'debts', 'reports', 'settings'];
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
    case 'home':
      await renderHomeView();
      break;
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
      await renderReceiptsView();
      break;
    case 'debts':
      await renderDebtsView();
      break;
    case 'reports':
      await renderReportsView();
      break;
    case 'settings':
      await renderSettingsView();
      break;
  }
}

// 뷰 렌더링 함수들

// 홈 대시보드 뷰 렌더링
async function renderHomeView() {
  const contentArea = document.getElementById('content-area');
  const yearMonth = getYearMonth(new Date());
  const daysInMonth = getDaysInMonth(new Date());
  
  // 현재 월 데이터 로드
  await Promise.all([
    fetchTransactions(`${yearMonth}-01`, `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`),
    fetchBudgets(),
    fetchSettings()
  ]);
  
  // 통계 계산
  const income = state.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = state.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const savings = state.transactions.filter(t => t.type === 'savings').reduce((sum, t) => sum + t.amount, 0);
  const totalAssets = state.settings.initial_balance + income - expense - savings;
  
  // 저축률 계산 (수입 대비 저축)
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;
  
  // 예산 데이터 가져오기
  const budgetDataResponse = await fetchBudgetVsSpending(yearMonth);
  const budgetData = budgetDataResponse.data || [];
  
  // 카테고리별 지출 계산
  const expenseByCategory = {};
  state.transactions.filter(t => t.type === 'expense').forEach(t => {
    if (!expenseByCategory[t.category]) {
      expenseByCategory[t.category] = 0;
    }
    expenseByCategory[t.category] += t.amount;
  });
  
  // 카테고리별 예산 매핑
  const categoryBudgetMap = {};
  state.budgets.forEach(b => {
    categoryBudgetMap[b.category] = b.monthly_budget;
  });
  
  // 예산이 있는 경우와 없는 경우 데이터 준비
  const hasBudgets = budgetData.length > 0;
  
  contentArea.innerHTML = `
    <div class="space-y-6">
      <!-- 환영 메시지 -->
      <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
        <h2 class="text-2xl md:text-3xl font-bold mb-2">
          <i class="fas fa-chart-line mr-2"></i>
          안녕하세요, ${state.currentUser?.name || '사용자'}님! 💼
        </h2>
        <p class="text-blue-100 text-sm md:text-base">
          ${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월의 재정 현황을 확인하세요 📊
        </p>
      </div>
      
      <!-- 총 자산 및 요약 카드 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-gradient-to-br from-purple-500 to-purple-700 text-white p-5 rounded-lg shadow-lg">
          <p class="text-purple-100 text-sm font-medium flex items-center">
            <i class="fas fa-wallet mr-2"></i>총 자산
          </p>
          <p class="text-3xl font-bold mt-2">${formatCurrency(totalAssets)}</p>
        </div>
        
        <div class="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-5 rounded-lg shadow-lg">
          <p class="text-blue-100 text-sm font-medium flex items-center">
            <i class="fas fa-arrow-up mr-2"></i>수입
          </p>
          <p class="text-3xl font-bold mt-2">${formatCurrency(income)}</p>
          <p class="text-blue-200 text-xs mt-2">이번 달</p>
        </div>
        
        <div class="bg-gradient-to-br from-red-500 to-red-700 text-white p-5 rounded-lg shadow-lg">
          <p class="text-red-100 text-sm font-medium flex items-center">
            <i class="fas fa-arrow-down mr-2"></i>지출
          </p>
          <p class="text-3xl font-bold mt-2">${formatCurrency(expense)}</p>
          <p class="text-red-200 text-xs mt-2">이번 달</p>
        </div>
        
        <div class="bg-gradient-to-br from-green-500 to-green-700 text-white p-5 rounded-lg shadow-lg">
          <p class="text-green-100 text-sm font-medium flex items-center">
            <i class="fas fa-piggy-bank mr-2"></i>저축
          </p>
          <p class="text-3xl font-bold mt-2">${formatCurrency(savings)}</p>
          <p class="text-green-200 text-xs mt-2">이번 달</p>
        </div>
      </div>
      
      <!-- 저축률 달성 바 -->
      <div class="bg-white p-6 rounded-lg shadow-lg">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-lg font-bold text-gray-800">
            <i class="fas fa-chart-line mr-2 text-green-600"></i>저축률
          </h3>
          <span class="text-2xl font-bold text-green-600">${savingsRate}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
          <div class="bg-gradient-to-r from-green-400 to-green-600 h-8 flex items-center justify-center text-white font-bold text-sm transition-all duration-500" 
               style="width: ${Math.min(savingsRate, 100)}%; border-radius: ${savingsRate >= 100 ? '9999px' : '9999px 0 0 9999px'};">
            ${savingsRate > 10 ? `${savingsRate}%` : ''}
          </div>
        </div>
        <div class="flex justify-between text-xs text-gray-600 mt-2">
          <span>수입 대비 저축 비율</span>
          <span>${formatCurrency(savings)} / ${formatCurrency(income)}</span>
        </div>
      </div>
      
      <!-- 예산 대비 카테고리별 지출 차트 -->
      <div class="bg-white p-6 rounded-lg shadow-lg">
        <h3 class="text-lg font-bold mb-4 text-gray-800">
          <i class="fas fa-chart-bar mr-2 text-blue-600"></i>
          ${hasBudgets ? '예산 대비 카테고리별 지출' : '카테고리별 지출'}
        </h3>
        <div class="h-80">
          <canvas id="home-category-chart"></canvas>
        </div>
      </div>
      
      <!-- 월별 추이 그래프 -->
      <div class="bg-white p-6 rounded-lg shadow-lg">
        <h3 class="text-lg font-bold mb-4 text-gray-800">
          <i class="fas fa-chart-area mr-2 text-purple-600"></i>수입/지출/저축 비교
        </h3>
        <div class="h-64">
          <canvas id="home-comparison-chart"></canvas>
        </div>
      </div>
      
      <!-- 빠른 액션 버튼 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onclick="switchView('month')" 
                class="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-lg shadow-lg transition-all">
          <i class="fas fa-calendar-alt text-2xl mb-2"></i>
          <p class="font-medium">월별 보기</p>
        </button>
        <button onclick="switchView('budgets')" 
                class="bg-green-500 hover:bg-green-600 text-white p-4 rounded-lg shadow-lg transition-all">
          <i class="fas fa-chart-pie text-2xl mb-2"></i>
          <p class="font-medium">예산 관리</p>
        </button>
        <button onclick="switchView('savings')" 
                class="bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-lg shadow-lg transition-all">
          <i class="fas fa-piggy-bank text-2xl mb-2"></i>
          <p class="font-medium">저축 관리</p>
        </button>
        <button onclick="switchView('reports')" 
                class="bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-lg shadow-lg transition-all">
          <i class="fas fa-chart-bar text-2xl mb-2"></i>
          <p class="font-medium">리포트</p>
        </button>
      </div>
    </div>
  `;
  
  // 차트 그리기
  setTimeout(() => {
    drawHomeCategoryChart(expenseByCategory, categoryBudgetMap, hasBudgets);
    drawHomeComparisonChart(income, expense, savings);
  }, 100);
}

// 홈 화면 카테고리 차트 그리기
function drawHomeCategoryChart(expenseByCategory, categoryBudgetMap, hasBudgets) {
  const canvas = document.getElementById('home-category-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const categories = Object.keys(expenseByCategory).sort((a, b) => expenseByCategory[b] - expenseByCategory[a]);
  
  const datasets = [{
    label: '실제 지출',
    data: categories.map(cat => expenseByCategory[cat]),
    backgroundColor: 'rgba(239, 68, 68, 0.7)',
    borderColor: 'rgba(239, 68, 68, 1)',
    borderWidth: 1
  }];
  
  // 예산이 있으면 추가
  if (hasBudgets && Object.keys(categoryBudgetMap).length > 0) {
    datasets.push({
      label: '예산',
      data: categories.map(cat => categoryBudgetMap[cat] || 0),
      backgroundColor: 'rgba(59, 130, 246, 0.7)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 1
    });
  }
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
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

// 홈 화면 비교 차트 그리기
function drawHomeComparisonChart(income, expense, savings) {
  const canvas = document.getElementById('home-comparison-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['수입', '지출', '저축'],
      datasets: [{
        data: [income, expense, savings],
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(16, 185, 129, 0.7)'
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(16, 185, 129, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = formatCurrency(context.parsed);
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
              return label + ': ' + value + ' (' + percentage + '%)';
            }
          }
        }
      }
    }
  });
}

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
  
  // 현금 거래 계산
  const cashIncome = state.transactions.filter(t => t.type === 'income' && t.payment_method === 'cash').reduce((sum, t) => sum + t.amount, 0);
  const cashExpense = state.transactions.filter(t => t.type === 'expense' && t.payment_method === 'cash').reduce((sum, t) => sum + t.amount, 0);
  const cashSavings = state.transactions.filter(t => t.type === 'savings' && t.payment_method === 'cash').reduce((sum, t) => sum + t.amount, 0);
  const cashBalance = (state.settings.cash_on_hand || 0) + cashIncome - cashExpense - cashSavings;
  
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
        <button onclick="changeMonth(-1)" class="w-8 h-8 md:w-10 md:h-10 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 flex items-center justify-center">
          <i class="fas fa-chevron-left text-sm"></i>
        </button>
        <h2 class="text-sm md:text-base font-semibold">${state.currentMonth.getFullYear()}년 ${state.currentMonth.getMonth() + 1}월</h2>
        <button onclick="changeMonth(1)" class="w-8 h-8 md:w-10 md:h-10 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 flex items-center justify-center">
          <i class="fas fa-chevron-right text-sm"></i>
        </button>
      </div>
      
      <!-- 통계 카드 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-4 rounded-lg shadow-lg">
          <p class="text-blue-100 text-sm font-medium flex items-center">
            <i class="fas fa-arrow-up mr-2"></i>수입
          </p>
          <p class="text-2xl font-bold mt-1">${formatCurrency(income)}</p>
          <p class="text-blue-200 text-xs mt-2">💵 현금: ${formatCurrency(cashIncome)}</p>
        </div>
        <div class="bg-gradient-to-br from-red-500 to-red-700 text-white p-4 rounded-lg shadow-lg">
          <p class="text-red-100 text-sm font-medium flex items-center">
            <i class="fas fa-arrow-down mr-2"></i>지출
          </p>
          <p class="text-2xl font-bold mt-1">${formatCurrency(expense)}</p>
          <p class="text-red-200 text-xs mt-2">💵 현금: ${formatCurrency(cashExpense)}</p>
        </div>
        <div class="bg-gradient-to-br from-green-500 to-green-700 text-white p-4 rounded-lg shadow-lg">
          <p class="text-green-100 text-sm font-medium flex items-center">
            <i class="fas fa-piggy-bank mr-2"></i>저축
          </p>
          <p class="text-2xl font-bold mt-1">${formatCurrency(savings)}</p>
          <p class="text-green-200 text-xs mt-2">💵 현금: ${formatCurrency(cashSavings)}</p>
        </div>
        <div class="bg-gradient-to-br from-purple-500 to-purple-700 text-white p-4 rounded-lg shadow-lg">
          <p class="text-purple-100 text-sm font-medium flex items-center">
            <i class="fas fa-wallet mr-2"></i>잔액
          </p>
          <p class="text-2xl font-bold mt-1">${formatCurrency(balance)}</p>
          <p class="text-purple-200 text-xs mt-2">💵 현금: ${formatCurrency(cashBalance)}</p>
        </div>
      </div>
      
      <!-- 수입/지출/저축 비율 파이차트 -->
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-xl font-bold mb-4">월별 수입/지출/저축 비율</h3>
        <div class="flex justify-center">
          <canvas id="month-pie-chart" style="max-width: 300px; max-height: 300px;"></canvas>
        </div>
      </div>
      
      <!-- 예산 vs 지출 그래프 -->
      ${renderBudgetChart(budgetData, '월별')}
      
      <!-- 저축 목표 진행 상황 -->
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-xl font-bold mb-4">
          <i class="fas fa-piggy-bank mr-2 text-green-600"></i>저축 목표 달성률
        </h3>
        <div id="savings-goals-section" class="space-y-4">
          <div class="text-center text-gray-500 py-4">
            <i class="fas fa-spinner fa-spin text-2xl"></i>
            <p class="mt-2">로딩 중...</p>
          </div>
        </div>
      </div>
      
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
  
  // 파이차트 그리기
  setTimeout(() => drawPieChart('month-pie-chart', income, expense, savings), 100);
  
  // 저축 목표 렌더링
  setTimeout(() => renderSavingsGoalsProgress(), 100);
}

// 파이차트 그리기
function drawPieChart(canvasId, income, expense, savings) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const total = income + expense + savings;
  
  if (total === 0) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.fillText('데이터 없음', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['수입', '지출', '저축'],
      datasets: [{
        data: [income, expense, savings],
        backgroundColor: ['#3B82F6', '#EF4444', '#10B981'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${formatCurrency(value)} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// 저축 목표 진행 상황 렌더링
async function renderSavingsGoalsProgress() {
  const container = document.getElementById('savings-goals-section');
  if (!container) return;
  
  try {
    // 저축 계좌 정보 가져오기
    await fetchSavingsAccounts();
    
    if (!state.savingsAccounts || state.savingsAccounts.length === 0) {
      container.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <i class="fas fa-piggy-bank text-4xl mb-3 opacity-20"></i>
          <p>등록된 저축 계좌가 없습니다.</p>
          <button onclick="switchView('savings')" class="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            <i class="fas fa-plus mr-2"></i>저축 계좌 추가
          </button>
        </div>
      `;
      return;
    }
    
    // 모든 계좌 표시 (목표 유무 관계없이)
    let html = '<div class="space-y-4">';
    
    state.savingsAccounts.forEach(account => {
      const hasGoal = account.savings_goal && account.savings_goal > 0;
      
      if (!hasGoal) {
        // 목표가 없는 경우
        html += `
          <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-all">
            <div class="flex justify-between items-center">
              <div>
                <h4 class="font-semibold text-lg">${account.name}</h4>
                <p class="text-sm text-gray-500">현재 잔액: ${formatCurrency(account.balance || 0)}</p>
              </div>
              <button onclick="openSavingsGoalModal(${account.id}, 0)" 
                      class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2">
                <i class="fas fa-bullseye"></i>
                <span>목표 설정</span>
              </button>
            </div>
            <p class="text-xs text-gray-400 mt-2">💡 저축 목표를 설정하고 진행 상황을 추적하세요!</p>
          </div>
        `;
        return;
      }
      
      // 목표가 있는 경우
      const current = account.balance || 0;
      const goal = account.savings_goal || 0;
      const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
      const remaining = Math.max(goal - current, 0);
      
      // 진행률에 따른 색상 결정
      let colorClass = 'bg-red-500';
      if (percentage >= 75) colorClass = 'bg-green-500';
      else if (percentage >= 50) colorClass = 'bg-yellow-500';
      else if (percentage >= 25) colorClass = 'bg-orange-500';
      
      html += `
        <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
          <div class="flex justify-between items-start mb-2">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h4 class="font-semibold text-lg">${account.name}</h4>
                <button onclick="openSavingsGoalModal(${account.id}, ${goal})" 
                        class="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                        title="목표 수정">
                  <i class="fas fa-edit"></i>
                </button>
              </div>
              <p class="text-sm text-gray-500">현재: ${formatCurrency(current)} / 목표: ${formatCurrency(goal)}</p>
            </div>
            <div class="text-right">
              <p class="text-2xl font-bold ${percentage >= 100 ? 'text-green-600' : 'text-blue-600'}">
                ${percentage.toFixed(1)}%
              </p>
              ${percentage < 100 ? `<p class="text-xs text-gray-500">잔여: ${formatCurrency(remaining)}</p>` : ''}
            </div>
          </div>
          
          <!-- 진행바 -->
          <div class="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div class="${colorClass} h-full rounded-full transition-all duration-500 flex items-center justify-center text-white text-xs font-bold"
                 style="width: ${percentage}%">
              ${percentage >= 10 ? `${percentage.toFixed(0)}%` : ''}
            </div>
          </div>
          
          ${percentage >= 100 ? `
            <div class="mt-2 flex items-center text-green-600 text-sm font-medium">
              <i class="fas fa-check-circle mr-2"></i>목표 달성! 🎉
            </div>
          ` : ''}
        </div>
      `;
    });
    
    // 전체 저축 목표 요약 (목표가 있는 계좌만)
    const accountsWithGoals = state.savingsAccounts.filter(acc => acc.savings_goal && acc.savings_goal > 0);
    const totalCurrent = accountsWithGoals.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const totalGoal = accountsWithGoals.reduce((sum, acc) => sum + (acc.savings_goal || 0), 0);
    const totalPercentage = totalGoal > 0 ? (totalCurrent / totalGoal) * 100 : 0;
    
    html += `</div>`;
    
    // 전체 요약 (목표가 있는 계좌가 있을 때만)
    if (accountsWithGoals.length > 0) {
      html += `
        <!-- 전체 요약 -->
        <div class="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
          <div class="flex justify-between items-center">
            <div>
              <p class="text-sm text-gray-600 font-medium">전체 저축 목표 달성률</p>
              <p class="text-xl font-bold text-green-700 mt-1">${formatCurrency(totalCurrent)} / ${formatCurrency(totalGoal)}</p>
            </div>
            <div class="text-right">
              <p class="text-3xl font-bold ${totalPercentage >= 100 ? 'text-green-600' : 'text-blue-600'}">
                ${totalPercentage.toFixed(1)}%
              </p>
            </div>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-3 mt-3 overflow-hidden">
            <div class="bg-gradient-to-r from-green-500 to-blue-500 h-full rounded-full transition-all duration-500"
                 style="width: ${Math.min(totalPercentage, 100)}%">
            </div>
          </div>
        </div>
      `;
    }
    
    container.innerHTML = html;
    
  } catch (error) {
    console.error('[Savings Goals] Render error:', error);
    container.innerHTML = `
      <div class="text-center text-red-500 py-4">
        <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
        <p>저축 목표를 불러오는데 실패했습니다.</p>
      </div>
    `;
  }
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
    
    // 거래 점 생성 (입력 순서대로 배치)
    let dots = '';
    const hasIncome = dayData.income && dayData.income > 0;
    const hasExpense = dayData.expense && dayData.expense > 0;
    const hasSavings = dayData.savings && dayData.savings > 0;
    
    if (hasIncome) dots += '<span class="calendar-dot income"></span>';
    if (hasExpense) dots += '<span class="calendar-dot expense"></span>';
    if (hasSavings) dots += '<span class="calendar-dot savings"></span>';
    
    html += `
      <div class="border rounded cursor-pointer hover:bg-gray-50 calendar-cell-compact" 
           onclick="openTransactionModal('${dateStr}')">
        <div class="calendar-day-number text-xs md:text-sm font-semibold ${dayColor}">${day}</div>
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
    const paymentIcon = t.payment_method === 'cash' ? '💵' : '💳';
    
    html += `
      <div class="flex justify-between items-center p-3 bg-gray-50 rounded hover:bg-gray-100">
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="text-lg">${paymentIcon}</span>
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
  
  // 현금 거래 계산
  const cashIncome = state.transactions.filter(t => t.type === 'income' && t.payment_method === 'cash').reduce((sum, t) => sum + t.amount, 0);
  const cashExpense = state.transactions.filter(t => t.type === 'expense' && t.payment_method === 'cash').reduce((sum, t) => sum + t.amount, 0);
  const cashSavings = state.transactions.filter(t => t.type === 'savings' && t.payment_method === 'cash').reduce((sum, t) => sum + t.amount, 0);
  
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
        <button onclick="changeWeek(-1)" class="w-8 h-8 md:w-10 md:h-10 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 flex items-center justify-center">
          <i class="fas fa-chevron-left text-sm"></i>
        </button>
        <h2 class="text-xs md:text-sm font-semibold">${getDateString(state.currentWeekStart)} ~ ${getDateString(weekEnd)}</h2>
        <button onclick="changeWeek(1)" class="w-8 h-8 md:w-10 md:h-10 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 flex items-center justify-center">
          <i class="fas fa-chevron-right text-sm"></i>
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-4 rounded-lg shadow-lg">
          <p class="text-blue-100 text-sm font-medium flex items-center">
            <i class="fas fa-arrow-up mr-2"></i>수입
          </p>
          <p class="text-2xl font-bold mt-1">${formatCurrency(income)}</p>
          <p class="text-blue-200 text-xs mt-2">💵 현금: ${formatCurrency(cashIncome)}</p>
        </div>
        <div class="bg-gradient-to-br from-red-500 to-red-700 text-white p-4 rounded-lg shadow-lg">
          <p class="text-red-100 text-sm font-medium flex items-center">
            <i class="fas fa-arrow-down mr-2"></i>지출
          </p>
          <p class="text-2xl font-bold mt-1">${formatCurrency(expense)}</p>
          <p class="text-red-200 text-xs mt-2">💵 현금: ${formatCurrency(cashExpense)}</p>
        </div>
        <div class="bg-gradient-to-br from-green-500 to-green-700 text-white p-4 rounded-lg shadow-lg">
          <p class="text-green-100 text-sm font-medium flex items-center">
            <i class="fas fa-piggy-bank mr-2"></i>저축
          </p>
          <p class="text-2xl font-bold mt-1">${formatCurrency(savings)}</p>
          <p class="text-green-200 text-xs mt-2">💵 현금: ${formatCurrency(cashSavings)}</p>
        </div>
      </div>
      
      <!-- 수입/지출/저축 비율 파이차트 -->
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-xl font-bold mb-4">주별 수입/지출/저축 비율</h3>
        <div class="flex justify-center">
          <canvas id="week-pie-chart" style="max-width: 300px; max-height: 300px;"></canvas>
        </div>
      </div>
      
      <!-- 주간 예산 vs 지출 그래프 -->
      ${renderBudgetChart(budgetData, '주별')}
      
      <!-- 저축 목표 진행 상황 -->
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-xl font-bold mb-4">
          <i class="fas fa-piggy-bank mr-2 text-green-600"></i>저축 목표 달성률
        </h3>
        <div id="savings-goals-section" class="space-y-4">
          <div class="text-center text-gray-500 py-4">
            <i class="fas fa-spinner fa-spin text-2xl"></i>
            <p class="mt-2">로딩 중...</p>
          </div>
        </div>
      </div>
      
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
  
  // 파이차트 그리기
  setTimeout(() => drawPieChart('week-pie-chart', income, expense, savings), 100);
  
  // 저축 목표 렌더링
  setTimeout(() => renderSavingsGoalsProgress(), 100);
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
      
      ${state.savingsAccounts.length === 0 ? `
        <div class="bg-white p-8 rounded-lg shadow text-center">
          <i class="fas fa-piggy-bank text-6xl text-gray-300 mb-4"></i>
          <h3 class="text-xl font-semibold text-gray-700 mb-2">저축 계좌가 없습니다</h3>
          <p class="text-gray-500 mb-6">저축 계좌를 추가하고 목표를 설정해보세요!</p>
          <button onclick="openSavingsAccountModal()" class="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 inline-flex items-center gap-2">
            <i class="fas fa-plus"></i>
            <span>첫 저축 계좌 만들기</span>
          </button>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${state.savingsAccounts.map(acc => {
          const savingsGoal = acc.savings_goal || 0;
          const currentSavings = acc.total_savings || 0;
          const progress = savingsGoal > 0 ? Math.min((currentSavings / savingsGoal) * 100, 100) : 0;
          const progressColor = progress >= 100 ? '#10B981' : progress >= 75 ? '#F59E0B' : '#3B82F6';
          
          return `
          <div class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
            <div class="flex justify-between items-start mb-3">
              <h4 class="text-lg font-bold">${acc.name}</h4>
              <div class="flex gap-2">
                <button onclick="openEditSavingsAccountModal(${acc.id}, '${acc.name.replace(/'/g, "\'")}')\" 
                        class="text-blue-500 hover:text-blue-700 text-lg" title="이름 수정">
                  <i class="fas fa-edit"></i>
                </button>
                <button onclick="openSavingsGoalModal(${acc.id}, ${savingsGoal})" 
                        class="text-green-500 hover:text-green-700 text-lg" title="${savingsGoal > 0 ? '목표 수정' : '목표 설정'}">
                  <i class="fas fa-${savingsGoal > 0 ? 'bullseye' : 'plus-circle'}"></i>
                </button>
                <button onclick="deleteSavingsAccount(${acc.id})" 
                        class="text-red-500 hover:text-red-700 text-lg" title="삭제">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            
            <p class="text-3xl font-bold text-green-600 mb-2">${formatCurrency(currentSavings)}</p>
            
            ${savingsGoal > 0 ? `
              <div class="mt-3">
                <div class="flex justify-between text-xs text-gray-600 mb-1">
                  <span>목표: ${formatCurrency(savingsGoal)}</span>
                  <span>${progress.toFixed(1)}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div class="h-3 rounded-full transition-all" 
                       style="width: ${progress}%; background-color: ${progressColor}">
                  </div>
                </div>
                <p class="text-xs text-gray-500 mt-1">
                  ${currentSavings >= savingsGoal ? '🎉 목표 달성!' : `남은 금액: ${formatCurrency(savingsGoal - currentSavings)}`}
                </p>
              </div>
            ` : `
              <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p class="text-sm text-blue-700 mb-3 text-center">
                  <i class="fas fa-bullseye mr-1"></i>저축 목표가 설정되지 않았습니다
                </p>
                <button onclick="openSavingsGoalModal(${acc.id}, 0)" 
                        class="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium">
                  <i class="fas fa-plus-circle mr-2"></i>목표 설정하기
                </button>
              </div>
            `}
          </div>
        `;
          }).join('')}
        </div>
      `}
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
      
      <!-- 안내 메시지 -->
      <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <div class="flex items-start">
          <i class="fas fa-info-circle text-blue-500 text-xl mr-3 mt-1"></i>
          <div>
            <h4 class="font-bold text-blue-800 mb-1">📌 고정지출 항목 안내</h4>
            <p class="text-sm text-blue-700 leading-relaxed">
              고정지출 항목은 <strong>확인용</strong>으로 만들어졌습니다.<br>
              번거롭겠지만 <strong>거래내역</strong> 탭에서 고정지출 지불내역을 <strong>별도로 입력</strong>해야 합니다.<br>
              이곳은 매월/매주 발생하는 고정지출을 잊지 않도록 관리하는 용도입니다.
            </p>
          </div>
        </div>
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
          <div class="bg-white p-5 rounded-lg shadow hover:shadow-md transition">
            <div class="flex items-center justify-between mb-3">
              <div class="flex-1">
                <h4 class="text-lg font-bold text-gray-800">${instance.name}</h4>
                <p class="text-2xl font-bold text-red-600">${formatCurrency(instance.amount)}</p>
              </div>
              <div class="flex gap-2">
                <button onclick="openEditFixedExpenseModal({id: ${instance.id}, name: '${instance.name.replace(/'/g, "\'")}', amount: ${instance.amount}, category: '${instance.category}', frequency: '${instance.frequency}', week_of_month: ${instance.week_of_month || 'null'}, day_of_week: ${instance.day_of_week ?? 'null'}, payment_day: ${instance.payment_day || 'null'}})" 
                        class="text-blue-500 hover:text-blue-700" title="수정">
                  <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteFixedExpense(${instance.id})" class="text-red-500 hover:text-red-700" title="삭제">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            
            <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <i class="fas fa-calendar-alt"></i>
              <span>${instance.scheduled_date}</span>
              <span class="text-xs px-2 py-0.5 rounded-full ${instance.frequency === 'monthly_day' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}">
                ${instance.frequency === 'monthly_day' ? `매월 ${instance.payment_day}일` : `매주 ${getDayName(instance.day_of_week)}요일`}
              </span>
            </div>
            
            <div class="flex items-center gap-2 text-sm text-gray-500">
              <i class="fas fa-tag"></i>
              <span>${instance.category}</span>
            </div>
          </div>
        `;
        }).join('')}
      </div>
      
      ${fixedExpenseInstances.length === 0 ? '<p class="text-center text-gray-500 py-8">이번 달에 예정된 고정지출이 없습니다.</p>' : ''}
    </div>
  `;
}

// 고정지출 체크박스 핸들러 - 단순 확인용
async function handleFixedExpenseCheck(checkboxId, expenseId, date, isChecked) {
  // 체크박스 상태만 저장 (거래내역에 추가하지 않음)
  try {
    if (isChecked) {
      // 체크 시: 지불 표시만 저장
      await axios.post(`/api/fixed-expenses/${expenseId}/mark-paid`, { date });
      renderFixedExpensesView();
    } else {
      // 체크 해제 시: 지불 표시 제거
      await axios.delete(`/api/fixed-expenses/${expenseId}/mark-paid/${date}`);
      renderFixedExpensesView();
    }
  } catch (error) {
    console.error('체크박스 상태 저장 오류:', error);
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) checkbox.checked = !isChecked;
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

// 투자 관리 뷰 렌더링

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
              <div class="text-sm text-gray-500">
                ${inv.symbol}
                ${priceData.simulated ? ' <span class="text-orange-500" title="실제 API 접근 제한으로 시뮬레이션 데이터가 표시됩니다">[시뮬레이션]</span>' : ''}
                ${priceResponse.data.cached ? ' <span class="text-green-500" title="60초 캐시된 데이터">⚡</span>' : ''}
              </div>
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
  
  // 종목 심볼 검증
  const symbolValue = formData.get('symbol');
  const symbolValidation = validateString(symbolValue, 1, 20, '종목 심볼');
  if (!symbolValidation.valid) {
    showValidationError(symbolValidation.error);
    return;
  }
  
  // 종목 이름 검증
  const nameValue = formData.get('name');
  const nameValidation = validateString(nameValue, 1, 100, '종목 이름');
  if (!nameValidation.valid) {
    showValidationError(nameValidation.error);
    return;
  }
  
  // 수량 검증
  const quantityValue = formData.get('quantity');
  const quantityValidation = validateInvestmentQuantity(quantityValue);
  if (!quantityValidation.valid) {
    showValidationError(quantityValidation.error);
    return;
  }
  
  // 매수 가격 검증
  const priceValue = formData.get('purchase_price');
  const priceValidation = validateInvestmentPrice(priceValue);
  if (!priceValidation.valid) {
    showValidationError(priceValidation.error);
    return;
  }
  
  // 매수일 검증
  const dateValue = formData.get('purchase_date');
  const dateValidation = validateDate(dateValue, '매수일');
  if (!dateValidation.valid) {
    showValidationError(dateValidation.error);
    return;
  }
  
  const data = {
    symbol: symbolValidation.value.toUpperCase(),
    name: nameValidation.value,
    quantity: quantityValidation.value,
    purchase_price: priceValidation.value,
    purchase_date: dateValidation.value,
    notes: sanitizeString(formData.get('notes'))
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

// 거래 내역 수정 기능

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
          
          <div>
            <label class="block text-sm font-medium mb-2">결제 수단</label>
            <select name="payment_method" class="w-full px-4 py-2 border rounded" required>
              <option value="card" ${(transaction.payment_method || 'card') === 'card' ? 'selected' : ''}>카드</option>
              <option value="cash" ${transaction.payment_method === 'cash' ? 'selected' : ''}>현금</option>
            </select>
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
  
  // 입력 검증
  const typeValue = formData.get('type');
  const amountValue = formData.get('amount');
  const dateValue = formData.get('date');
  const categoryValue = formData.get('category');
  const descriptionValue = formData.get('description');
  
  // 금액 검증
  const amountValidation = validateTransactionAmount(amountValue);
  if (!amountValidation.valid) {
    showValidationError(amountValidation.error);
    return;
  }
  
  // 날짜 검증
  const dateValidation = validateDate(dateValue, '거래 날짜');
  if (!dateValidation.valid) {
    showValidationError(dateValidation.error);
    return;
  }
  
  // 카테고리 검증
  const categoryValidation = validateRequired(categoryValue, '카테고리');
  if (!categoryValidation.valid) {
    showValidationError(categoryValidation.error);
    return;
  }
  
  // 저축 유형일 경우 저축 통장 선택 검증
  if (typeValue === 'savings') {
    const savingsAccountId = formData.get('savings_account_id');
    if (!savingsAccountId) {
      showValidationError('저축 통장을 선택해주세요.');
      return;
    }
  }
  
  const data = {
    type: typeValue,
    category: categoryValue,
    amount: Math.round(amountValidation.value),
    date: dateValidation.value,
    description: sanitizeString(descriptionValue),
    payment_method: formData.get('payment_method') || 'card',
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
  }
}

// ============================================================
// 채무 관리 뷰
// ============================================================

async function renderDebtsView() {
  const contentArea = document.getElementById('content-area');
  
  // 채무 데이터 로드
  const response = await axios.get('/api/debts');
  const debts = response.data.debts || [];
  
  // 상태별 분류
  const activeDebts = debts.filter(d => d.status === 'active');
  const overdueDebts = debts.filter(d => d.status === 'overdue');
  const paidDebts = debts.filter(d => d.status === 'paid');
  
  // 통계 계산
  const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);
  const totalRemaining = debts.reduce((sum, d) => sum + d.remaining_amount, 0);
  const totalPaid = totalDebt - totalRemaining;
  const paymentProgress = totalDebt > 0 ? ((totalPaid / totalDebt) * 100).toFixed(1) : 0;
  
  contentArea.innerHTML = `
    <div class="space-y-6">
      <!-- 헤더 -->
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold text-gray-800">
          <i class="fas fa-hand-holding-usd mr-2"></i>채무 관리
        </h2>
        <div class="flex gap-2">
          <button onclick="showInterestCalculator()" class="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600">
            <i class="fas fa-calculator mr-2"></i>이자 계산기
          </button>
          <button onclick="showAddDebtModal()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            <i class="fas fa-plus mr-2"></i>채무 추가
          </button>
        </div>
      </div>
      
      <!-- 통계 카드 -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">총 채무액</p>
              <p class="text-2xl font-bold text-red-600">${formatCurrency(totalDebt)}</p>
            </div>
            <i class="fas fa-file-invoice-dollar text-3xl text-red-300"></i>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">남은 금액</p>
              <p class="text-2xl font-bold text-orange-600">${formatCurrency(totalRemaining)}</p>
            </div>
            <i class="fas fa-exclamation-circle text-3xl text-orange-300"></i>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">상환 완료</p>
              <p class="text-2xl font-bold text-green-600">${formatCurrency(totalPaid)}</p>
            </div>
            <i class="fas fa-check-circle text-3xl text-green-300"></i>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">상환율</p>
              <p class="text-2xl font-bold text-blue-600">${paymentProgress}%</p>
            </div>
            <i class="fas fa-percentage text-3xl text-blue-300"></i>
          </div>
        </div>
      </div>
      
      <!-- 채무 목록 -->
      <div class="space-y-4">
        ${overdueDebts.length > 0 ? `
          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-lg font-bold text-red-600 mb-4">
              <i class="fas fa-exclamation-triangle mr-2"></i>연체된 채무
            </h3>
            <div class="space-y-3">
              ${overdueDebts.map(debt => renderDebtCard(debt)).join('')}
            </div>
          </div>
        ` : ''}
        
        ${activeDebts.length > 0 ? `
          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">
              <i class="fas fa-clock mr-2"></i>진행 중인 채무
            </h3>
            <div class="space-y-3">
              ${activeDebts.map(debt => renderDebtCard(debt)).join('')}
            </div>
          </div>
        ` : ''}
        
        ${paidDebts.length > 0 ? `
          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-lg font-bold text-green-600 mb-4">
              <i class="fas fa-check-double mr-2"></i>상환 완료
            </h3>
            <div class="space-y-3">
              ${paidDebts.map(debt => renderDebtCard(debt)).join('')}
            </div>
          </div>
        ` : ''}
        
        ${debts.length === 0 ? `
          <div class="bg-white rounded-lg shadow-md p-12 text-center">
            <i class="fas fa-hand-holding-usd text-6xl text-gray-300 mb-4"></i>
            <p class="text-gray-500 mb-6">등록된 채무가 없습니다</p>
            <button onclick="showAddDebtModal()" class="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600">
              <i class="fas fa-plus mr-2"></i>첫 채무 추가하기
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderDebtCard(debt) {
  const progress = debt.amount > 0 ? ((debt.amount - debt.remaining_amount) / debt.amount * 100).toFixed(1) : 0;
  const isOverdue = debt.status === 'overdue';
  const isPaid = debt.status === 'paid';
  
  const statusColor = isPaid ? 'green' : (isOverdue ? 'red' : 'orange');
  const statusIcon = isPaid ? 'check-circle' : (isOverdue ? 'exclamation-triangle' : 'clock');
  const statusText = isPaid ? '상환완료' : (isOverdue ? '연체' : '진행중');
  
  // 이자 계산
  const startDate = new Date(debt.start_date);
  const today = new Date();
  const daysElapsed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  
  // 일할 계산 (현재까지 발생한 이자)
  const accruedInterest = debt.remaining_amount * (debt.interest_rate / 100) * (daysElapsed / 365);
  
  // 연간 이자 (남은 원금 기준)
  const yearlyInterest = debt.remaining_amount * (debt.interest_rate / 100);
  
  // 월간 이자 (남은 원금 기준)
  const monthlyInterest = debt.remaining_amount * (debt.interest_rate / 100) / 12;
  
  return `
    <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div class="flex justify-between items-start mb-3">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <h4 class="font-bold text-lg">${debt.creditor}</h4>
            <span class="text-xs px-2 py-1 rounded bg-${statusColor}-100 text-${statusColor}-600">
              <i class="fas fa-${statusIcon} mr-1"></i>${statusText}
            </span>
            <span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
              ${debt.category}
            </span>
          </div>
          ${debt.notes ? `<p class="text-sm text-gray-600">${debt.notes}</p>` : ''}
        </div>
        <div class="flex gap-2">
          ${!isPaid ? `
            <button onclick="showRecordPaymentModal(${debt.id})" 
                    class="text-green-500 hover:text-green-700" title="상환 기록">
              <i class="fas fa-money-bill-wave"></i>
            </button>
          ` : ''}
          <button onclick="showEditDebtModal(${debt.id})" 
                  class="text-blue-500 hover:text-blue-700" title="수정">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="deleteDebt(${debt.id})" 
                  class="text-red-500 hover:text-red-700" title="삭제">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p class="text-xs text-gray-500">총 채무액</p>
          <p class="font-semibold">${formatCurrency(debt.amount)}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">남은 원금</p>
          <p class="font-semibold text-${statusColor}-600">${formatCurrency(debt.remaining_amount)}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">이자율 (연)</p>
          <p class="font-semibold">${debt.interest_rate}%</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">발생 이자 (연/월)</p>
          <p class="font-semibold text-orange-600">
            ${formatCurrency(yearlyInterest.toFixed(2))}/${formatCurrency(monthlyInterest.toFixed(2))}
          </p>
        </div>
        <div>
          <p class="text-xs text-gray-500">만기일</p>
          <p class="font-semibold">${debt.due_date || '-'}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">총 상환 예상액</p>
          <p class="font-semibold text-red-600">${formatCurrency((debt.remaining_amount + accruedInterest).toFixed(2))}</p>
        </div>
      </div>
      
      <!-- 상환 진행률 -->
      <div class="mb-3">
        <div class="flex justify-between text-xs text-gray-600 mb-1">
          <span>상환 진행률</span>
          <span>${progress}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="bg-${statusColor}-500 h-2 rounded-full transition-all" 
               style="width: ${progress}%"></div>
        </div>
      </div>
      
      <!-- 상환 내역 보기 버튼 -->
      ${!isPaid ? `
        <button onclick="showPaymentHistory(${debt.id})" 
                class="text-sm text-blue-500 hover:text-blue-700">
          <i class="fas fa-history mr-1"></i>상환 내역 보기
        </button>
      ` : ''}
    </div>
  `;
}

// 채무 추가 모달
window.showAddDebtModal = function() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <h3 class="text-xl font-bold mb-4">
        <i class="fas fa-plus mr-2"></i>채무 추가
      </h3>
      <form id="add-debt-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">채권자 *</label>
          <input type="text" name="creditor" required
                 class="w-full border rounded px-3 py-2"
                 placeholder="예: 김철수, OO은행">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">채무 금액 (${CURRENCIES[state.settings.currency]?.symbol || '₩'}) *</label>
          <input type="number" name="amount" required min="0"
                 class="w-full border rounded px-3 py-2"
                 placeholder="0">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">이자율 (%)</label>
          <input type="number" name="interest_rate" step="0.1" min="0"
                 class="w-full border rounded px-3 py-2"
                 placeholder="0">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">시작일 *</label>
          <input type="date" name="start_date" required
                 class="w-full border rounded px-3 py-2"
                 value="${new Date().toISOString().split('T')[0]}">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">만기일</label>
          <input type="date" name="due_date"
                 class="w-full border rounded px-3 py-2">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">카테고리</label>
          <select name="category" class="w-full border rounded px-3 py-2">
            <option value="개인">개인</option>
            <option value="은행">은행</option>
            <option value="카드">카드</option>
            <option value="기타">기타</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">메모</label>
          <textarea name="notes" rows="3"
                    class="w-full border rounded px-3 py-2"
                    placeholder="추가 정보를 입력하세요"></textarea>
        </div>
        
        <div class="flex gap-3">
          <button type="submit" class="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
            추가
          </button>
          <button type="button" onclick="this.closest('.fixed').remove()"
                  class="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400">
            취소
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('add-debt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
      await axios.post('/api/debts', data);
      modal.remove();
      await renderDebtsView();
    } catch (error) {
      alert('채무 추가 실패: ' + (error.response?.data?.error || error.message));
    }
  });
};

// 채무 수정 모달
window.showEditDebtModal = async function(debtId) {
  const response = await axios.get('/api/debts');
  const debt = response.data.debts.find(d => d.id === debtId);
  
  if (!debt) {
    alert('채무를 찾을 수 없습니다');
    return;
  }
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <h3 class="text-xl font-bold mb-4">
        <i class="fas fa-edit mr-2"></i>채무 수정
      </h3>
      <form id="edit-debt-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">채권자 *</label>
          <input type="text" name="creditor" required value="${debt.creditor}"
                 class="w-full border rounded px-3 py-2">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">총 채무액 (${CURRENCIES[state.settings.currency]?.symbol || '₩'}) *</label>
          <input type="number" name="amount" required min="0" value="${debt.amount}"
                 class="w-full border rounded px-3 py-2">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">남은 금액 (${CURRENCIES[state.settings.currency]?.symbol || '₩'}) *</label>
          <input type="number" name="remaining_amount" required min="0" value="${debt.remaining_amount}"
                 class="w-full border rounded px-3 py-2">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">이자율 (%)</label>
          <input type="number" name="interest_rate" step="0.1" min="0" value="${debt.interest_rate}"
                 class="w-full border rounded px-3 py-2">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">시작일 *</label>
          <input type="date" name="start_date" required value="${debt.start_date}"
                 class="w-full border rounded px-3 py-2">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">만기일</label>
          <input type="date" name="due_date" value="${debt.due_date || ''}"
                 class="w-full border rounded px-3 py-2">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">상태</label>
          <select name="status" class="w-full border rounded px-3 py-2">
            <option value="active" ${debt.status === 'active' ? 'selected' : ''}>진행중</option>
            <option value="overdue" ${debt.status === 'overdue' ? 'selected' : ''}>연체</option>
            <option value="paid" ${debt.status === 'paid' ? 'selected' : ''}>상환완료</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">카테고리</label>
          <select name="category" class="w-full border rounded px-3 py-2">
            <option value="개인" ${debt.category === '개인' ? 'selected' : ''}>개인</option>
            <option value="은행" ${debt.category === '은행' ? 'selected' : ''}>은행</option>
            <option value="카드" ${debt.category === '카드' ? 'selected' : ''}>카드</option>
            <option value="기타" ${debt.category === '기타' ? 'selected' : ''}>기타</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">메모</label>
          <textarea name="notes" rows="3"
                    class="w-full border rounded px-3 py-2">${debt.notes || ''}</textarea>
        </div>
        
        <div class="flex gap-3">
          <button type="submit" class="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
            저장
          </button>
          <button type="button" onclick="this.closest('.fixed').remove()"
                  class="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400">
            취소
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('edit-debt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
      await axios.put(`/api/debts/${debtId}`, data);
      modal.remove();
      await renderDebtsView();
    } catch (error) {
      alert('채무 수정 실패: ' + (error.response?.data?.error || error.message));
    }
  });
};

// 채무 삭제
window.deleteDebt = async function(debtId) {
  if (!confirm('이 채무를 삭제하시겠습니까?')) return;
  
  try {
    await axios.delete(`/api/debts/${debtId}`);
    await renderDebtsView();
  } catch (error) {
    alert('채무 삭제 실패: ' + (error.response?.data?.error || error.message));
  }
};

// 상환 기록 모달
window.showRecordPaymentModal = function(debtId) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <h3 class="text-xl font-bold mb-4">
        <i class="fas fa-money-bill-wave mr-2"></i>상환 기록
      </h3>
      <form id="record-payment-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">상환 금액 (${CURRENCIES[state.settings.currency]?.symbol || '₩'}) *</label>
          <input type="number" name="amount" required min="0"
                 class="w-full border rounded px-3 py-2"
                 placeholder="0">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">상환 날짜 *</label>
          <input type="date" name="payment_date" required
                 class="w-full border rounded px-3 py-2"
                 value="${new Date().toISOString().split('T')[0]}">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">메모</label>
          <textarea name="notes" rows="3"
                    class="w-full border rounded px-3 py-2"
                    placeholder="상환 관련 메모"></textarea>
        </div>
        
        <div class="flex gap-3">
          <button type="submit" class="flex-1 bg-green-500 text-white py-2 rounded hover:bg-green-600">
            기록
          </button>
          <button type="button" onclick="this.closest('.fixed').remove()"
                  class="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400">
            취소
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('record-payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
      await axios.post(`/api/debts/${debtId}/payments`, data);
      modal.remove();
      await renderDebtsView();
    } catch (error) {
      alert('상환 기록 실패: ' + (error.response?.data?.error || error.message));
    }
  });
};

// 상환 내역 보기
window.showPaymentHistory = async function(debtId) {
  try {
    const response = await axios.get(`/api/debts/${debtId}/payments`);
    const payments = response.data.payments || [];
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <h3 class="text-xl font-bold mb-4">
          <i class="fas fa-history mr-2"></i>상환 내역
        </h3>
        ${payments.length > 0 ? `
          <div class="space-y-3">
            ${payments.map(payment => `
              <div class="border rounded-lg p-4 flex justify-between items-start">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <span class="font-bold text-lg text-green-600">${formatCurrency(payment.amount)}</span>
                    <span class="text-sm text-gray-500">${payment.payment_date}</span>
                  </div>
                  ${payment.notes ? `<p class="text-sm text-gray-600">${payment.notes}</p>` : ''}
                </div>
                <button onclick="deletePayment(${debtId}, ${payment.id})"
                        class="text-red-500 hover:text-red-700 ml-4" title="삭제">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            `).join('')}
          </div>
          <div class="mt-4 pt-4 border-t">
            <div class="flex justify-between font-bold">
              <span>총 상환액:</span>
              <span class="text-green-600">${formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}</span>
            </div>
          </div>
        ` : `
          <p class="text-center text-gray-500 py-8">상환 내역이 없습니다</p>
        `}
        <div class="mt-6">
          <button onclick="this.closest('.fixed').remove()"
                  class="w-full bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400">
            닫기
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  } catch (error) {
    alert('상환 내역 조회 실패: ' + (error.response?.data?.error || error.message));
  }
};

// 상환 내역 삭제
window.deletePayment = async function(debtId, paymentId) {
  if (!confirm('이 상환 기록을 삭제하시겠습니까?')) return;
  
  try {
    await axios.delete(`/api/debts/${debtId}/payments/${paymentId}`);
    // 모달 닫고 다시 열기
    document.querySelector('.fixed').remove();
    await showPaymentHistory(debtId);
    // 채무 목록도 갱신
    await renderDebtsView();
  } catch (error) {
    alert('상환 기록 삭제 실패: ' + (error.response?.data?.error || error.message));
  }
};

// 이자 계산기 모달
window.showInterestCalculator = function() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
      <h3 class="text-xl font-bold mb-4">
        <i class="fas fa-calculator mr-2"></i>이자 계산기
      </h3>
      
      <!-- 계산기 입력 -->
      <div class="bg-blue-50 rounded-lg p-6 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">채무 금액 (${CURRENCIES[state.settings.currency]?.symbol || '₩'})</label>
            <input type="number" id="calc-amount" min="0" value="10000000"
                   class="w-full border rounded px-3 py-2">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">연 이자율 (%)</label>
            <input type="number" id="calc-rate" min="0" max="100" step="0.1" value="5"
                   class="w-full border rounded px-3 py-2">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">상환 기간 (개월)</label>
            <input type="number" id="calc-months" min="1" max="360" value="12"
                   class="w-full border rounded px-3 py-2">
          </div>
        </div>
        
        <div class="mt-4">
          <label class="block text-sm font-medium mb-1">상환 방식</label>
          <select id="calc-method" class="w-full border rounded px-3 py-2">
            <option value="equal-principal">원금균등상환 (매월 원금 동일)</option>
            <option value="equal-payment">원리금균등상환 (매월 총액 동일)</option>
            <option value="maturity">만기일시상환 (만기에 일괄 상환)</option>
          </select>
        </div>
        
        <button onclick="calculateInterest()" 
                class="mt-4 w-full bg-purple-500 text-white py-2 rounded hover:bg-purple-600">
          <i class="fas fa-calculator mr-2"></i>계산하기
        </button>
      </div>
      
      <!-- 계산 결과 -->
      <div id="calc-result" class="hidden">
        <!-- 요약 -->
        <div class="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 class="font-bold text-lg mb-3">📊 상환 요약</h4>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p class="text-xs text-gray-600">총 원금</p>
              <p class="font-bold text-blue-600" id="summary-principal"></p>
            </div>
            <div>
              <p class="text-xs text-gray-600">총 이자</p>
              <p class="font-bold text-orange-600" id="summary-interest"></p>
            </div>
            <div>
              <p class="text-xs text-gray-600">총 상환액</p>
              <p class="font-bold text-red-600" id="summary-total"></p>
            </div>
            <div>
              <p class="text-xs text-gray-600">월 평균 상환액</p>
              <p class="font-bold text-green-600" id="summary-monthly"></p>
            </div>
          </div>
        </div>
        
        <!-- 상환 스케줄 -->
        <div>
          <h4 class="font-bold text-lg mb-3">📅 상환 일정표</h4>
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse border">
              <thead class="bg-gray-100">
                <tr>
                  <th class="border px-3 py-2 text-sm">회차</th>
                  <th class="border px-3 py-2 text-sm">납부액</th>
                  <th class="border px-3 py-2 text-sm">원금</th>
                  <th class="border px-3 py-2 text-sm">이자</th>
                  <th class="border px-3 py-2 text-sm">잔액</th>
                </tr>
              </thead>
              <tbody id="schedule-table" class="text-sm">
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div class="mt-6">
        <button onclick="this.closest('.fixed').remove()"
                class="w-full bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400">
          닫기
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
};

// 이자 계산 함수
window.calculateInterest = function() {
  const amount = parseFloat(document.getElementById('calc-amount').value) || 0;
  const rate = parseFloat(document.getElementById('calc-rate').value) || 0;
  const months = parseInt(document.getElementById('calc-months').value) || 0;
  const method = document.getElementById('calc-method').value;
  
  if (amount <= 0 || rate < 0 || months <= 0) {
    alert('유효한 값을 입력해주세요.');
    return;
  }
  
  const monthlyRate = rate / 100 / 12;
  let schedule = [];
  let totalInterest = 0;
  let totalPayment = 0;
  
  if (method === 'equal-principal') {
    // 원금균등상환
    const monthlyPrincipal = amount / months;
    let remaining = amount;
    
    for (let i = 1; i <= months; i++) {
      const interest = remaining * monthlyRate;
      const payment = monthlyPrincipal + interest;
      remaining -= monthlyPrincipal;
      
      schedule.push({
        month: i,
        payment: Math.round(payment),
        principal: Math.round(monthlyPrincipal),
        interest: Math.round(interest),
        remaining: Math.round(Math.max(0, remaining))
      });
      
      totalInterest += interest;
      totalPayment += payment;
    }
  } else if (method === 'equal-payment') {
    // 원리금균등상환
    const monthlyPayment = amount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                          (Math.pow(1 + monthlyRate, months) - 1);
    let remaining = amount;
    
    for (let i = 1; i <= months; i++) {
      const interest = remaining * monthlyRate;
      const principal = monthlyPayment - interest;
      remaining -= principal;
      
      schedule.push({
        month: i,
        payment: Math.round(monthlyPayment),
        principal: Math.round(principal),
        interest: Math.round(interest),
        remaining: Math.round(Math.max(0, remaining))
      });
      
      totalInterest += interest;
      totalPayment += monthlyPayment;
    }
  } else {
    // 만기일시상환
    const totalInterestAmount = amount * monthlyRate * months;
    
    for (let i = 1; i <= months; i++) {
      const interest = amount * monthlyRate;
      
      if (i < months) {
        schedule.push({
          month: i,
          payment: Math.round(interest),
          principal: 0,
          interest: Math.round(interest),
          remaining: Math.round(amount)
        });
        totalInterest += interest;
        totalPayment += interest;
      } else {
        schedule.push({
          month: i,
          payment: Math.round(amount + interest),
          principal: Math.round(amount),
          interest: Math.round(interest),
          remaining: 0
        });
        totalInterest += interest;
        totalPayment += amount + interest;
      }
    }
  }
  
  // 결과 표시
  document.getElementById('summary-principal').textContent = formatCurrency(Math.round(amount));
  document.getElementById('summary-interest').textContent = formatCurrency(Math.round(totalInterest));
  document.getElementById('summary-total').textContent = formatCurrency(Math.round(totalPayment));
  document.getElementById('summary-monthly').textContent = formatCurrency(Math.round(totalPayment / months));
  
  // 스케줄 테이블
  const tableBody = document.getElementById('schedule-table');
  tableBody.innerHTML = schedule.map(row => `
    <tr class="${row.month % 2 === 0 ? 'bg-gray-50' : ''}">
      <td class="border px-3 py-2 text-center">${row.month}</td>
      <td class="border px-3 py-2 text-right font-semibold">${formatCurrency(row.payment)}</td>
      <td class="border px-3 py-2 text-right text-blue-600">${formatCurrency(row.principal)}</td>
      <td class="border px-3 py-2 text-right text-orange-600">${formatCurrency(row.interest)}</td>
      <td class="border px-3 py-2 text-right text-gray-600">${formatCurrency(row.remaining)}</td>
    </tr>
  `).join('');
  
  document.getElementById('calc-result').classList.remove('hidden');
};

// 연간 지출 리포트 뷰

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
      
      <!-- 연간 요약 카드 -->
      <div id="yearly-summary-cards" class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">연수입</p>
              <p class="text-2xl font-bold text-blue-600" id="summary-yearly-income">-</p>
            </div>
            <i class="fas fa-arrow-down text-3xl text-blue-300"></i>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">연지출</p>
              <p class="text-2xl font-bold text-red-600" id="summary-yearly-expense">-</p>
            </div>
            <i class="fas fa-arrow-up text-3xl text-red-300"></i>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">연저축</p>
              <p class="text-2xl font-bold text-green-600" id="summary-yearly-savings">-</p>
            </div>
            <i class="fas fa-piggy-bank text-3xl text-green-300"></i>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">순수익</p>
              <p class="text-2xl font-bold text-purple-600" id="summary-yearly-net">-</p>
            </div>
            <i class="fas fa-chart-line text-3xl text-purple-300"></i>
          </div>
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
  try {
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
  
  // 연간 합계 계산용 변수
  let yearlyIncome = 0;
  let yearlyExpense = 0;
  let yearlySavings = 0;
  
  for (let month = 1; month <= 12; month++) {
    const monthStr = `${reportState.year}-${String(month).padStart(2, '0')}`;
    const firstDay = `${monthStr}-01`;
    const lastDay = `${monthStr}-${new Date(reportState.year, month, 0).getDate()}`;
    
    const response = await axios.get(`/api/transactions?start_date=${firstDay}&end_date=${lastDay}`);
    const transactions = response.data.data || [];
    
    const total = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    // 연간 합계 누적
    yearlyIncome += transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    yearlyExpense += transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    yearlySavings += transactions.filter(t => t.type === 'savings').reduce((sum, t) => sum + t.amount, 0);
    
    monthlyData.push({
      month: month,
      monthStr: monthStr,
      label: monthLabels[month - 1],
      total: total
    });
  }
  
  reportState.yearlyData = monthlyData;
  
  // 연간 요약 카드 업데이트
  const yearlyNet = yearlyIncome - yearlyExpense - yearlySavings;
  document.getElementById('summary-yearly-income').textContent = formatCurrency(yearlyIncome);
  document.getElementById('summary-yearly-expense').textContent = formatCurrency(yearlyExpense);
  document.getElementById('summary-yearly-savings').textContent = formatCurrency(yearlySavings);
  document.getElementById('summary-yearly-net').textContent = formatCurrency(yearlyNet);
  
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
  } catch (error) {
    const detailsDiv = document.getElementById('report-details');
    if (detailsDiv) {
      detailsDiv.innerHTML = `
        <div class="bg-red-50 p-6 rounded-lg">
          <p class="text-red-800 mb-2"><i class="fas fa-exclamation-circle mr-2"></i>연간 리포트를 불러오는 중 오류가 발생했습니다.</p>
          <button onclick="loadYearlyReport()" class="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
            <i class="fas fa-redo mr-2"></i>다시 시도
          </button>
        </div>
      `;
    }
  }
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
  try {
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
  } catch (error) {
    const detailsDiv = document.getElementById('report-details');
    if (detailsDiv) {
      detailsDiv.innerHTML = `
        <div class="bg-red-50 p-6 rounded-lg">
          <p class="text-red-800 mb-2"><i class="fas fa-exclamation-circle mr-2"></i>월별 카테고리 리포트를 불러오는 중 오류가 발생했습니다.</p>
          <button onclick="loadMonthCategoryReport(${month})" class="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
            <i class="fas fa-redo mr-2"></i>다시 시도
          </button>
        </div>
      `;
    }
  }
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
  try {
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
  } catch (error) {
    const detailsDiv = document.getElementById('report-details');
    if (detailsDiv) {
      detailsDiv.innerHTML = `
        <div class="bg-red-50 p-6 rounded-lg">
          <p class="text-red-800 mb-2"><i class="fas fa-exclamation-circle mr-2"></i>거래 내역을 불러오는 중 오류가 발생했습니다.</p>
          <button onclick="loadCategoryTransactions('${category}')" class="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
            <i class="fas fa-redo mr-2"></i>다시 시도
          </button>
        </div>
      `;
    }
  }
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
          <label class="block text-sm font-medium text-gray-700 mb-2">💰 초기 총 잔액 (카드 + 현금)</label>
          <input type="number" id="initial-balance" value="${state.settings.initial_balance}" 
                 class="w-full px-4 py-2 border rounded" placeholder="0">
          <p class="text-xs text-gray-500 mt-1">
            <i class="fas fa-info-circle mr-1"></i>가계부 시작 시점의 전체 자산 (카드 잔액 + 현금 + 저축 포함)
          </p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">💵 초기 현금 보유액</label>
          <input type="number" id="cash-on-hand" value="${state.settings.cash_on_hand || 0}" 
                 class="w-full px-4 py-2 border rounded" placeholder="0">
          <p class="text-xs text-gray-500 mt-1">
            <i class="fas fa-info-circle mr-1"></i>가계부 시작 시점에 현금으로 보유한 금액
          </p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">🎨 배경 테마</label>
          <select id="background-theme-select" class="w-full px-4 py-2 border rounded" onchange="previewBackgroundTheme(this.value)">
            ${Object.keys(BACKGROUND_THEMES).map(key => \`
              <option value="\${key}" \${state.backgroundTheme === key ? 'selected' : ''}>
                \${BACKGROUND_THEMES[key].name} - \${BACKGROUND_THEMES[key].description}
              </option>
            \`).join('')}
          </select>
          <p class="text-xs text-gray-500 mt-1">
            <i class="fas fa-info-circle mr-1"></i>앱 배경 색상을 선택하세요
          </p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">🌙 다크모드</label>
          <div class="flex items-center gap-3">
            <button onclick="toggleDarkMode()" 
                    class="px-4 py-2 rounded ${state.darkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'}">
              <i class="fas fa-${state.darkMode ? 'moon' : 'sun'} mr-2"></i>
              ${state.darkMode ? '다크모드 켜짐' : '라이트모드'}
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            <i class="fas fa-info-circle mr-1"></i>어두운 화면에서 눈의 피로를 줄입니다
          </p>
        </div>
        
        <hr class="my-6">
        
        <div>
          <h3 class="text-lg font-bold mb-3">📚 도움말</h3>
          <p class="text-sm text-gray-600 mb-4">
            <i class="fas fa-info-circle mr-1"></i>
            앱 사용 방법과 주요 기능을 확인하세요.
          </p>
          <button onclick="showHelpModal()" 
                  class="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium">
            <i class="fas fa-question-circle mr-2"></i>사용 방법 보기
          </button>
        </div>
        
        <hr class="my-6">
        
        <div>
          <h3 class="text-lg font-bold mb-3">📊 데이터 내보내기</h3>
          <p class="text-sm text-gray-600 mb-4">
            <i class="fas fa-info-circle mr-1"></i>
            재무 데이터를 엑셀이나 JSON 형식으로 내보낼 수 있습니다.
          </p>
          <div class="grid grid-cols-2 gap-3">
            <button onclick="exportToExcel()" 
                    class="px-4 py-3 bg-green-600 text-white rounded hover:bg-green-700 font-medium">
              <i class="fas fa-file-excel mr-2"></i>엑셀 (.csv)
            </button>
            <button onclick="exportData()" 
                    class="px-4 py-3 bg-green-500 text-white rounded hover:bg-green-600 font-medium">
              <i class="fas fa-download mr-2"></i>JSON
            </button>
          </div>
        </div>
        
        <hr class="my-6">
        
        <div>
          <h3 class="text-lg font-bold mb-3">데이터 복원</h3>
          <p class="text-sm text-gray-600 mb-4">
            <i class="fas fa-info-circle mr-1"></i>
            백업한 JSON 파일에서 데이터를 복원할 수 있습니다.
          </p>
          <button onclick="openImportDataModal()" 
                  class="w-full px-4 py-3 bg-orange-500 text-white rounded hover:bg-orange-600 font-medium">
            <i class="fas fa-upload mr-2"></i>불러오기
          </button>
        </div>
        
        <button onclick="saveSettings()" class="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium">
          <i class="fas fa-save mr-2"></i>설정 저장
        </button>
      </div>
    </div>
  `;
}

// ---
// 이벤트 핸들러 함수들
// ---

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
          
          <div>
            <label class="block text-sm font-medium mb-2">결제 수단</label>
            <select name="payment_method" class="w-full px-4 py-2 border rounded" required>
              <option value="card">카드</option>
              <option value="cash">현금</option>
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

function setTransactionType(type) {
  state.currentTransactionType = type;
  openTransactionModal(null);
}

async function handleTransactionSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  
  // 입력 검증
  const amountValue = formData.get('amount');
  const dateValue = formData.get('date');
  const categoryValue = formData.get('category');
  const descriptionValue = formData.get('description');
  
  // 금액 검증
  const amountValidation = validateTransactionAmount(amountValue);
  if (!amountValidation.valid) {
    showValidationError(amountValidation.error);
    return;
  }
  
  // 날짜 검증
  const dateValidation = validateDate(dateValue, '거래 날짜');
  if (!dateValidation.valid) {
    showValidationError(dateValidation.error);
    return;
  }
  
  // 카테고리 검증
  const categoryValidation = validateRequired(categoryValue, '카테고리');
  if (!categoryValidation.valid) {
    showValidationError(categoryValidation.error);
    return;
  }
  
  // 저축 유형일 경우 저축 통장 선택 검증
  if (state.currentTransactionType === 'savings') {
    const savingsAccountId = formData.get('savings_account_id');
    if (!savingsAccountId) {
      showValidationError('저축 통장을 선택해주세요.');
      return;
    }
  }
  
  const data = {
    type: state.currentTransactionType,
    category: categoryValue,
    amount: Math.round(amountValidation.value),
    description: sanitizeString(descriptionValue),
    date: dateValidation.value,
    payment_method: formData.get('payment_method') || 'card',
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
  
  // 통장 이름 검증
  const nameValue = formData.get('name');
  const nameValidation = validateString(nameValue, 1, 50, '통장 이름');
  if (!nameValidation.valid) {
    showValidationError(nameValidation.error);
    return;
  }
  
  try {
    const response = await axios.post('/api/savings-accounts', {
      name: nameValidation.value
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

function openSavingsGoalModal(accountId, currentGoal) {
  const modalContainer = document.getElementById('modal-container');
  const account = state.savingsAccounts.find(a => a.id === accountId);
  
  if (!account) {
    alert('저축 통장을 찾을 수 없습니다.');
    return;
  }
  
  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="closeModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">${account.name} - 저축 목표 설정</h3>
        <form onsubmit="handleSavingsGoalSubmit(event, ${accountId})" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">목표 금액</label>
            <input type="number" name="savings_goal" value="${currentGoal}" 
                   class="w-full px-4 py-2 border rounded" required min="0" placeholder="0">
            <p class="text-xs text-gray-500 mt-1">
              <i class="fas fa-info-circle mr-1"></i>0을 입력하면 목표가 제거됩니다
            </p>
          </div>
          <div class="bg-blue-50 p-3 rounded">
            <p class="text-sm text-blue-800">
              <i class="fas fa-info-circle mr-2"></i>
              현재 저축액: <strong>${formatCurrency(account.total_savings || 0)}</strong>
            </p>
          </div>
          <div class="flex gap-2">
            <button type="submit" class="flex-1 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium">
              저장
            </button>
            <button type="button" onclick="closeModal()" 
                    class="flex-1 py-3 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 font-medium">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function handleSavingsGoalSubmit(event, accountId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  
  // 저축 목표 금액 검증
  const goalValue = formData.get('savings_goal');
  const goalValidation = validateSavingsGoal(goalValue);
  if (!goalValidation.valid) {
    showValidationError(goalValidation.error);
    return;
  }
  
  try {
    const response = await axios.put(`/api/savings-accounts/${accountId}/goal`, {
      savings_goal: Math.round(goalValidation.value)
    });
    
    if (response.data.success) {
      closeModal();
      alert('저축 목표가 설정되었습니다.');
      renderSavingsView();
    }
  } catch (error) {
    alert('목표 설정 중 오류가 발생했습니다.');
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
              <option value="monthly_day">매월</option>
              <option value="weekly">매주</option>
            </select>
          </div>
          <div id="day-of-week-container" style="display: none;">
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
  
  if (frequency === 'monthly_day') {
    // 매월 (특정 일자)
    weekOfMonthContainer.style.display = 'none';
    dayOfWeekContainer.style.display = 'none';
    paymentDayContainer.style.display = 'block';
  } else if (frequency === 'weekly') {
    // 매주 (특정 요일)
    weekOfMonthContainer.style.display = 'none';
    dayOfWeekContainer.style.display = 'block';
    paymentDayContainer.style.display = 'none';
  }
}

async function handleFixedExpenseSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const frequency = formData.get('frequency');
  
  // 이름 검증
  const nameValue = formData.get('name');
  const nameValidation = validateString(nameValue, 1, 100, '고정지출 이름');
  if (!nameValidation.valid) {
    showValidationError(nameValidation.error);
    return;
  }
  
  // 카테고리 검증
  const categoryValue = formData.get('category');
  const categoryValidation = validateRequired(categoryValue, '카테고리');
  if (!categoryValidation.valid) {
    showValidationError(categoryValidation.error);
    return;
  }
  
  // 금액 검증
  const amountValue = formData.get('amount');
  const amountValidation = validateTransactionAmount(amountValue);
  if (!amountValidation.valid) {
    showValidationError(amountValidation.error);
    return;
  }
  
  const data = {
    name: nameValidation.value,
    category: categoryValue,
    amount: Math.round(amountValidation.value),
    frequency: frequency
  };
  
  if (frequency === 'monthly_day') {
    const paymentDay = formData.get('payment_day');
    const paymentDayValidation = validateInteger(paymentDay, 1, 31, '결제일');
    if (!paymentDayValidation.valid) {
      showValidationError(paymentDayValidation.error);
      return;
    }
    data.payment_day = paymentDayValidation.value;
  } else if (frequency === 'weekly') {
    const dayOfWeek = formData.get('day_of_week');
    const dayValidation = validateInteger(dayOfWeek, 0, 6, '요일');
    if (!dayValidation.valid) {
      showValidationError(dayValidation.error);
      return;
    }
    data.day_of_week = dayValidation.value;
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
  // 예산 금액 검증
  const budgetValidation = validateBudgetAmount(value);
  if (!budgetValidation.valid) {
    showValidationError(budgetValidation.error);
    return;
  }
  
  const amount = Math.round(budgetValidation.value);
  
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
  const initialBalanceValue = document.getElementById('initial-balance').value;
  const cashOnHandValue = document.getElementById('cash-on-hand').value;
  const backgroundTheme = document.getElementById('background-theme-select').value;
  
  // 초기 잔액 검증
  const balanceValidation = validateNumber(initialBalanceValue, 0, 1000000000000, '초기 잔액');
  if (!balanceValidation.valid) {
    showValidationError(balanceValidation.error);
    return;
  }
  
  // 현금 보유액 검증
  const cashValidation = validateNumber(cashOnHandValue, 0, 1000000000000, '현금 보유액');
  if (!cashValidation.valid) {
    showValidationError(cashValidation.error);
    return;
  }
  
  // 현금이 총 잔액보다 많으면 안됨
  if (cashValidation.value > balanceValidation.value) {
    showValidationError('현금 보유액은 초기 총 잔액보다 클 수 없습니다.');
    return;
  }
  
  const initialBalance = Math.round(balanceValidation.value);
  const cashOnHand = Math.round(cashValidation.value);
  
  try {
    const response = await axios.put('/api/settings', {
      currency,
      initial_balance: initialBalance,
      cash_on_hand: cashOnHand,
      category_colors: state.settings.category_colors
    });
    
    if (response.data.success) {
      const previousCurrency = state.settings.currency;
      const previousTheme = state.backgroundTheme;
      
      // 배경 테마 저장 (로컬 스토리지)
      state.backgroundTheme = backgroundTheme;
      localStorage.setItem('backgroundTheme', backgroundTheme);
      applyBackgroundTheme(backgroundTheme);
      
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

// 다크모드

function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  localStorage.setItem('darkMode', state.darkMode);
  applyDarkMode();
}

function applyDarkMode() {
  if (state.darkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// 배경 테마 적용
function applyBackgroundTheme(theme) {
  const body = document.body;
  const html = document.documentElement;
  const themeConfig = BACKGROUND_THEMES[theme];
  
  if (!themeConfig) return;
  
  // 동적 스타일 생성 또는 업데이트
  let styleEl = document.getElementById('dynamic-background-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-background-style';
    document.head.appendChild(styleEl);
  }
  
  // 테마 적용
  const bgStyle = themeConfig.colors.includes('gradient') ? themeConfig.colors : themeConfig.colors;
  
  styleEl.textContent = `
    html {
      background: ${bgStyle} !important;
      ${themeConfig.colors.includes('gradient') ? 'background-attachment: fixed !important;' : ''}
    }
    body {
      background: ${bgStyle} !important;
      ${themeConfig.colors.includes('gradient') ? 'background-attachment: fixed !important;' : ''}
    }
    body::before {
      background: ${bgStyle} !important;
    }
    body::after {
      background: ${bgStyle} !important;
    }
  `;
}

// 배경 테마 미리보기 (설정에서 선택 시)
window.previewBackgroundTheme = function(theme) {
  applyBackgroundTheme(theme);
}

// 데이터 내보내기/불러오기

// LocalStorage에서 백업 목록 가져오기
function getBackupList() {
  try {
    const backupKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('backup_')) {
        backupKeys.push(key);
      }
    }
    
    // 타임스탬프 기준으로 정렬 (최신순)
    backupKeys.sort((a, b) => {
      const timeA = parseInt(a.split('_')[1]);
      const timeB = parseInt(b.split('_')[1]);
      return timeB - timeA;
    });
    
    return backupKeys;
  } catch (error) {
    console.error('백업 목록 조회 오류:', error);
    return [];
  }
}

// 오래된 백업 정리 (최대 3개 유지)
function cleanOldBackups() {
  try {
    const backupKeys = getBackupList();
    
    // 3개 초과시 오래된 것 삭제
    if (backupKeys.length > 3) {
      for (let i = 3; i < backupKeys.length; i++) {
        localStorage.removeItem(backupKeys[i]);
      }
    }
  } catch (error) {
    console.error('백업 정리 오류:', error);
  }
}

// 백업 메타데이터 생성
function createBackupMetadata(exportData) {
  return {
    exportDate: exportData.exportDate,
    transactionCount: exportData.transactions?.length || 0,
    savingsAccountCount: exportData.savingsAccounts?.length || 0,
    fixedExpenseCount: exportData.fixedExpenses?.length || 0,
    budgetCount: exportData.budgets?.length || 0,
    investmentCount: exportData.investments?.length || 0
  };
}

async function exportData() {
  try {
    // 모든 데이터 수집
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      settings: state.settings,
      transactions: state.transactions,
      savingsAccounts: state.savingsAccounts,
      fixedExpenses: state.fixedExpenses,
      budgets: state.budgets,
      investments: state.investments
    };
    
    const timestamp = Date.now();
    const fileName = `가계부_백업_${getYearMonth(new Date())}_${timestamp}.json`;
    
    // 1. LocalStorage에 백업 저장
    try {
      const backupKey = `backup_${timestamp}`;
      const backupData = {
        data: exportData,
        metadata: createBackupMetadata(exportData)
      };
      
      localStorage.setItem(backupKey, JSON.stringify(backupData));
      
      // 오래된 백업 정리
      cleanOldBackups();
      
      const backupList = getBackupList();
      const backupPosition = backupList.indexOf(backupKey) + 1;
      
      console.log('✅ 브라우저에 백업 저장 완료:', backupKey);
    } catch (storageError) {
      console.warn('LocalStorage 저장 실패:', storageError);
      // LocalStorage 실패해도 파일 다운로드는 계속 진행
    }
    
    // 2. 파일 다운로드
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const backupCount = getBackupList().length;
    
    // 성공 메시지
    alert(
      `✅ 데이터 백업이 완료되었습니다!\n\n` +
      `📱 브라우저에 저장됨 (${backupCount}/3개)\n` +
      `💾 파일 다운로드: ${fileName}\n\n` +
      `다운로드된 파일은 브라우저의 다운로드 폴더에 저장되었습니다.\n` +
      `(Chrome: Ctrl+J, Safari: Cmd+Shift+L로 확인)`
    );
  } catch (error) {
    console.error('데이터 내보내기 오류:', error);
    alert('데이터 내보내기 중 오류가 발생했습니다.');
  }
}

function openImportDataModal() {
  const modalContainer = document.getElementById('modal-container');
  
  // LocalStorage에서 백업 목록 가져오기
  const backupKeys = getBackupList();
  const recentBackups = backupKeys.slice(0, 3); // 최신 3개만
  
  let backupListHTML = '';
  
  if (recentBackups.length > 0) {
    backupListHTML = `
      <div class="mb-6">
        <h4 class="text-sm font-semibold mb-3 text-gray-700">
          <i class="fas fa-clock mr-2"></i>최근 백업 (${recentBackups.length}개)
        </h4>
        <div class="space-y-2">
    `;
    
    recentBackups.forEach((backupKey, index) => {
      try {
        const backupData = JSON.parse(localStorage.getItem(backupKey));
        const metadata = backupData.metadata;
        const exportDate = new Date(metadata.exportDate);
        const dateStr = exportDate.toLocaleString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        backupListHTML += `
          <label class="flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                 onclick="selectBackup('${backupKey}')">
            <input type="radio" name="backup" value="${backupKey}" 
                   class="mt-1 mr-3" id="backup_radio_${index}">
            <div class="flex-1">
              <div class="font-medium text-gray-900 mb-1">
                <i class="fas fa-calendar-alt mr-2 text-blue-500"></i>${dateStr}
              </div>
              <div class="text-sm text-gray-600 space-y-1">
                <div>
                  <i class="fas fa-exchange-alt mr-2 w-4 text-gray-400"></i>거래 ${metadata.transactionCount}건
                </div>
                <div class="flex gap-4 flex-wrap">
                  <span><i class="fas fa-piggy-bank mr-1 text-gray-400"></i>저축 ${metadata.savingsAccountCount}</span>
                  <span><i class="fas fa-receipt mr-1 text-gray-400"></i>고정지출 ${metadata.fixedExpenseCount}</span>
                  <span><i class="fas fa-chart-pie mr-1 text-gray-400"></i>예산 ${metadata.budgetCount}</span>
                  <span><i class="fas fa-chart-line mr-1 text-gray-400"></i>투자 ${metadata.investmentCount}</span>
                </div>
              </div>
            </div>
          </label>
        `;
      } catch (error) {
        console.error('백업 파싱 오류:', backupKey, error);
      }
    });
    
    backupListHTML += `
        </div>
        <button type="button" onclick="restoreFromLocalStorage()" 
                class="w-full mt-3 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium">
          <i class="fas fa-download mr-2"></i>선택한 백업 불러오기
        </button>
      </div>
      
      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-300"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-3 bg-white text-gray-500">또는</span>
        </div>
      </div>
    `;
  } else {
    backupListHTML = `
      <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p class="text-sm text-blue-800">
          <i class="fas fa-info-circle mr-2"></i>
          저장된 백업이 없습니다. 파일에서 백업을 불러오세요.
        </p>
      </div>
    `;
  }
  
  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="closeModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">
          <i class="fas fa-upload mr-2"></i>데이터 불러오기
        </h3>
        
        <div class="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p class="text-sm text-yellow-800">
            <i class="fas fa-exclamation-triangle mr-2"></i>
            <strong>주의:</strong> 데이터를 불러오면 현재 데이터가 모두 덮어씌워집니다.
          </p>
        </div>
        
        ${backupListHTML}
        
        <form onsubmit="handleImportData(event)" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700">
              <i class="fas fa-file-upload mr-2"></i>파일에서 불러오기
            </label>
            <input type="file" name="importFile" accept=".json" 
                   class="w-full px-4 py-2 border-2 border-dashed rounded-lg hover:border-blue-400 transition-colors">
          </div>
          <div class="flex gap-2">
            <button type="submit" class="flex-1 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium">
              <i class="fas fa-file-import mr-2"></i>파일에서 불러오기
            </button>
            <button type="button" onclick="closeModal()" 
                    class="flex-1 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium">
              <i class="fas fa-times mr-2"></i>취소
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// 백업 선택 처리
function selectBackup(backupKey) {
  // 모든 라디오 버튼 해제
  document.querySelectorAll('input[name="backup"]').forEach(radio => {
    radio.checked = false;
  });
  
  // 선택한 백업의 라디오 버튼 체크
  const radio = document.querySelector(`input[value="${backupKey}"]`);
  if (radio) {
    radio.checked = true;
  }
}

// LocalStorage에서 백업 복원
async function restoreFromLocalStorage() {
  try {
    const selectedRadio = document.querySelector('input[name="backup"]:checked');
    
    if (!selectedRadio) {
      alert('복원할 백업을 선택해주세요.');
      return;
    }
    
    const backupKey = selectedRadio.value;
    const backupData = JSON.parse(localStorage.getItem(backupKey));
    
    if (!backupData || !backupData.data) {
      alert('백업 데이터를 불러올 수 없습니다.');
      return;
    }
    
    const importData = backupData.data;
    const metadata = backupData.metadata;
    const exportDate = new Date(metadata.exportDate);
    const dateStr = exportDate.toLocaleString('ko-KR');
    
    // 확인 메시지
    if (!confirm(
      `📅 ${dateStr} 백업을 복원하시겠습니까?\n\n` +
      `📊 포함된 데이터:\n` +
      `  • 거래 내역: ${metadata.transactionCount}건\n` +
      `  • 저축 계좌: ${metadata.savingsAccountCount}개\n` +
      `  • 고정 지출: ${metadata.fixedExpenseCount}개\n` +
      `  • 예산: ${metadata.budgetCount}개\n` +
      `  • 투자: ${metadata.investmentCount}개\n\n` +
      `⚠️ 현재 데이터가 모두 삭제됩니다.`
    )) {
      return;
    }
    
    // 데이터 복원 수행
    await performDataRestore(importData);
    
  } catch (error) {
    console.error('백업 복원 오류:', error);
    alert('백업 복원 중 오류가 발생했습니다.');
  }
}

async function handleImportData(event) {
  event.preventDefault();
  
  const fileInput = event.target.importFile;
  if (!fileInput.files.length) {
    alert('파일을 선택해주세요.');
    return;
  }
  
  const file = fileInput.files[0];
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const importData = JSON.parse(e.target.result);
      
      // 데이터 유효성 검사
      if (!importData.version || !importData.exportDate) {
        alert('올바른 백업 파일이 아닙니다.');
        return;
      }
      
      // 확인 메시지
      const exportDate = new Date(importData.exportDate);
      const dateStr = exportDate.toLocaleString('ko-KR');
      
      if (!confirm(`📅 ${dateStr} 백업 데이터를 불러오시겠습니까?\n\n⚠️ 현재 데이터가 모두 삭제됩니다.`)) {
        return;
      }
      
      // 데이터 복원 수행
      await performDataRestore(importData);
      
    } catch (error) {
      console.error('파일 불러오기 오류:', error);
      alert('데이터 불러오기 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
    }
  };
  
  reader.onerror = () => {
    alert('파일 읽기 중 오류가 발생했습니다.');
  };
  
  reader.readAsText(file);
}

// 데이터 복원 공통 로직 (LocalStorage 백업과 파일 백업 모두 사용)
async function performDataRestore(importData) {
  try {
    // 1단계: 기존 데이터 삭제
    console.log('기존 데이터 삭제 중...');
    
    // 기존 거래 삭제
    if (state.transactions && state.transactions.length > 0) {
      for (const t of state.transactions) {
        try {
          await axios.delete(`/api/transactions/${t.id}`);
        } catch (error) {
          console.error('거래 삭제 오류:', error);
        }
      }
    }
    
    // 기존 저축 계좌 삭제
    if (state.savingsAccounts && state.savingsAccounts.length > 0) {
      for (const sa of state.savingsAccounts) {
        try {
          await axios.delete(`/api/savings-accounts/${sa.id}`);
        } catch (error) {
          console.error('저축 계좌 삭제 오류:', error);
        }
      }
    }
    
    // 기존 고정지출 삭제
    if (state.fixedExpenses && state.fixedExpenses.length > 0) {
      for (const fe of state.fixedExpenses) {
        try {
          await axios.delete(`/api/fixed-expenses/${fe.id}`);
        } catch (error) {
          console.error('고정지출 삭제 오류:', error);
        }
      }
    }
    
    // 기존 예산 삭제
    if (state.budgets && state.budgets.length > 0) {
      for (const b of state.budgets) {
        try {
          await axios.delete(`/api/budgets/${encodeURIComponent(b.category)}`);
        } catch (error) {
          console.error('예산 삭제 오류:', error);
        }
      }
    }
    
    // 기존 투자 삭제
    if (state.investments && state.investments.length > 0) {
      for (const inv of state.investments) {
        try {
          await axios.delete(`/api/investments/${inv.id}`);
        } catch (error) {
          console.error('투자 삭제 오류:', error);
        }
      }
    }
    
    console.log('기존 데이터 삭제 완료');
    
    // 2단계: 새 데이터 복원
    console.log('새 데이터 복원 중...');
    
    // 설정 복원
    if (importData.settings) {
      await axios.put('/api/settings', importData.settings);
    }
    
    // 저축 계좌 먼저 복원 (거래가 참조할 수 있음)
    if (importData.savingsAccounts && importData.savingsAccounts.length > 0) {
      for (const sa of importData.savingsAccounts) {
        try {
          await axios.post('/api/savings-accounts', { name: sa.name });
        } catch (error) {
          console.error('저축 계좌 복원 오류:', error);
        }
      }
    }
    
    // 거래 내역 복원
    if (importData.transactions && importData.transactions.length > 0) {
      for (const t of importData.transactions) {
        try {
          // savings_account_id가 null이나 undefined면 제외
          const transactionData = {
            type: t.type,
            category: t.category,
            amount: t.amount,
            description: t.description,
            date: t.date,
            payment_method: t.payment_method || 'card'
          };
          
          // savings_account_id가 유효한 경우만 추가
          if (t.savings_account_id !== null && t.savings_account_id !== undefined) {
            transactionData.savings_account_id = t.savings_account_id;
          }
          
          await axios.post('/api/transactions', transactionData);
        } catch (error) {
          console.error('거래 복원 오류:', error);
        }
      }
    }
    
    // 고정지출 복원
    if (importData.fixedExpenses && importData.fixedExpenses.length > 0) {
      for (const fe of importData.fixedExpenses) {
        try {
          await axios.post('/api/fixed-expenses', {
            name: fe.name,
            category: fe.category,
            amount: fe.amount,
            frequency: fe.frequency,
            week_of_month: fe.week_of_month,
            day_of_week: fe.day_of_week,
            payment_day: fe.payment_day
          });
        } catch (error) {
          console.error('고정지출 복원 오류:', error);
        }
      }
    }
    
    // 예산 복원
    if (importData.budgets && importData.budgets.length > 0) {
      for (const b of importData.budgets) {
        try {
          await axios.put(`/api/budgets/${encodeURIComponent(b.category)}`, {
            monthly_budget: b.monthly_budget
          });
        } catch (error) {
          console.error('예산 복원 오류:', error);
        }
      }
    }
    
    // 투자 복원
    if (importData.investments && importData.investments.length > 0) {
      for (const inv of importData.investments) {
        try {
          await axios.post('/api/investments', {
            symbol: inv.symbol,
            name: inv.name,
            quantity: inv.quantity,
            purchase_price: inv.purchase_price,
            purchase_date: inv.purchase_date,
            notes: inv.notes
          });
        } catch (error) {
          console.error('투자 복원 오류:', error);
        }
      }
    }
    
    console.log('데이터 복원 완료');
    
    closeModal();
    alert('✅ 데이터가 성공적으로 복원되었습니다!');
    location.reload();
    
  } catch (error) {
    console.error('데이터 복원 오류:', error);
    alert('❌ 데이터 복원 중 오류가 발생했습니다: ' + error.message);
    throw error;
  }
}

// 초기화는 renderApp() 함수에서 처리됨


// ========== 고정지출 & 저축 통장 수정 기능 ==========

// 고정지출 수정 모달 열기
function openEditFixedExpenseModal(expenseData) {
  const modalContainer = document.getElementById('modal-container');
  
  const frequencyOptions = [
    { value: 'monthly_day', label: '매월 (특정 일자)', selected: expenseData.frequency === 'monthly_day' },
    { value: 'monthly', label: '매월 (특정 주/요일)', selected: expenseData.frequency === 'monthly' },
    { value: 'weekly', label: '매주', selected: expenseData.frequency === 'weekly' }
  ];
  
  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="closeModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">고정지출 수정</h3>
        <form onsubmit="handleEditFixedExpense(event, ${expenseData.id})" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">항목명</label>
            <input type="text" name="name" value="${expenseData.name}" required class="w-full px-4 py-2 border rounded">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">카테고리</label>
            <select name="category" required class="w-full px-4 py-2 border rounded">
              ${categories.expense.map(cat => `<option value="${cat}" ${cat === expenseData.category ? 'selected' : ''}>${cat}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">금액 (${CURRENCIES[state.settings.currency]?.symbol || '₩'})</label>
            <input type="number" name="amount" value="${expenseData.amount}" required min="0" step="1000" class="w-full px-4 py-2 border rounded">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">주기</label>
            <select name="frequency" required class="w-full px-4 py-2 border rounded" onchange="toggleFixedExpenseFields(this.value, 'edit')">
              ${frequencyOptions.map(opt => `<option value="${opt.value}" ${opt.selected ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
          </div>
          <div id="edit-monthly-day-field" style="display: ${expenseData.frequency === 'monthly_day' ? 'block' : 'none'}">
            <label class="block text-sm font-medium mb-1">일자</label>
            <input type="number" name="payment_day" value="${expenseData.payment_day || ''}" min="1" max="31" class="w-full px-4 py-2 border rounded">
          </div>
          <div id="edit-monthly-fields" style="display: ${expenseData.frequency === 'monthly' ? 'block' : 'none'}" class="space-y-2">
            <div>
              <label class="block text-sm font-medium mb-1">주차</label>
              <select name="week_of_month" class="w-full px-4 py-2 border rounded">
                <option value="1" ${expenseData.week_of_month === 1 ? 'selected' : ''}>첫째 주</option>
                <option value="2" ${expenseData.week_of_month === 2 ? 'selected' : ''}>둘째 주</option>
                <option value="3" ${expenseData.week_of_month === 3 ? 'selected' : ''}>셋째 주</option>
                <option value="4" ${expenseData.week_of_month === 4 ? 'selected' : ''}>넷째 주</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">요일</label>
              <select name="day_of_week_monthly" class="w-full px-4 py-2 border rounded">
                ${['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'].map((day, idx) => `<option value="${idx}" ${expenseData.day_of_week === idx ? 'selected' : ''}>${day}</option>`).join('')}
              </select>
            </div>
          </div>
          <div id="edit-weekly-field" style="display: ${expenseData.frequency === 'weekly' ? 'block' : 'none'}">
            <label class="block text-sm font-medium mb-1">요일</label>
            <select name="day_of_week_weekly" class="w-full px-4 py-2 border rounded">
              ${['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'].map((day, idx) => `<option value="${idx}" ${expenseData.day_of_week === idx ? 'selected' : ''}>${day}</option>`).join('')}
            </select>
          </div>
          <div class="flex gap-2">
            <button type="submit" class="flex-1 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium">
              수정
            </button>
            <button type="button" onclick="closeModal()" class="flex-1 py-3 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 font-medium">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// 고정지출 수정 처리
async function handleEditFixedExpense(event, id) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const frequency = formData.get('frequency');
  
  const data = {
    name: formData.get('name'),
    category: formData.get('category'),
    amount: parseInt(formData.get('amount')),
    frequency: frequency
  };
  
  // 주기에 따라 필요한 필드 추가
  if (frequency === 'monthly_day') {
    const paymentDay = parseInt(formData.get('payment_day'));
    const paymentDayValidation = validateInteger(paymentDay, 1, 31, '결제일');
    if (!paymentDayValidation.valid) {
      showValidationError(paymentDayValidation.error);
      return;
    }
    data.payment_day = paymentDayValidation.value;
  } else if (frequency === 'monthly') {
    data.week_of_month = parseInt(formData.get('week_of_month'));
    data.day_of_week = parseInt(formData.get('day_of_week_monthly'));
  } else if (frequency === 'weekly') {
    data.day_of_week = parseInt(formData.get('day_of_week_weekly'));
  }
  
  // 금액 검증
  const amountValidation = validateNumber(data.amount, 0, 10000000000, '금액');
  if (!amountValidation.valid) {
    showValidationError(amountValidation.error);
    return;
  }
  
  try {
    const response = await axios.put(`/api/fixed-expenses/${id}`, data);
    if (response.data.success) {
      closeModal();
      renderFixedExpensesView();
    }
  } catch (error) {
    alert(error.response?.data?.error || '고정지출 수정 중 오류가 발생했습니다.');
  }
}

// 저축 통장 이름 수정 모달 열기
function openEditSavingsAccountModal(id, name) {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="closeModal(event)">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <h3 class="text-xl font-bold mb-4">저축 통장 이름 수정</h3>
        <form onsubmit="handleEditSavingsAccount(event, ${id})" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">통장 이름</label>
            <input type="text" name="name" value="${name}" required class="w-full px-4 py-2 border rounded">
          </div>
          <div class="flex gap-2">
            <button type="submit" class="flex-1 py-3 bg-green-500 text-white rounded hover:bg-green-600 font-medium">
              수정
            </button>
            <button type="button" onclick="closeModal()" class="flex-1 py-3 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 font-medium">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// 저축 통장 이름 수정 처리
async function handleEditSavingsAccount(event, id) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const name = formData.get('name').trim();
  
  if (!name) {
    alert('통장 이름을 입력해주세요.');
    return;
  }
  
  try {
    const response = await axios.put(`/api/savings-accounts/${id}`, { name });
    if (response.data.success) {
      closeModal();
      renderSavingsView();
    }
  } catch (error) {
    alert(error.response?.data?.error || '저축 통장 수정 중 오류가 발생했습니다.');
  }
}

// ========== 영수증 관련 함수 (IndexedDB 저장) ==========

// IndexedDB 초기화
let receiptDB;
async function initReceiptDB() {
  if (receiptDB) return receiptDB;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BudgetLeeReceipts', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      receiptDB = request.result;
      resolve(receiptDB);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images', { keyPath: 'id' });
      }
    };
  });
}

// IndexedDB에 이미지 저장
async function saveImageToIndexedDB(receiptId, blob) {
  const db = await initReceiptDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    const request = store.put({ id: receiptId, blob: blob });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// IndexedDB에서 이미지 가져오기
async function getImageFromIndexedDB(receiptId) {
  const db = await initReceiptDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['images'], 'readonly');
    const store = transaction.objectStore('images');
    const request = store.get(receiptId);
    
    request.onsuccess = () => resolve(request.result?.blob);
    request.onerror = () => reject(request.error);
  });
}

// IndexedDB에서 이미지 삭제
async function deleteImageFromIndexedDB(receiptId) {
  const db = await initReceiptDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    const request = store.delete(receiptId);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 1) 클라이언트 압축 유틸 (캔버스 사용)
async function compressImageToWebp(file, maxDim = 1280, quality = 0.6) {
  const img = await readImageFile(file);
  const { canvas, w, h } = drawToCanvas(img, maxDim);
  const blob = await canvasToBlob(canvas, 'image/webp', quality);
  return { blob, width: w, height: h, mime: 'image/webp' };
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function drawToCanvas(img, maxDim) {
  let w = img.width;
  let h = img.height;
  const ratio = w > h ? maxDim / w : maxDim / h;
  if (ratio < 1) { w = Math.round(w * ratio); h = Math.round(h * ratio); }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, w, h };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 2) 영수증 업로드 + 저장 (Base64로 D1에 직접 저장)
async function handleReceiptSubmit(event) {
  event.preventDefault();

  const fd = new FormData(event.target);
  const file = fd.get('file');
  const merchant = fd.get('merchant') || '';
  const purchase_date = fd.get('purchase_date');
  const amount = Number(fd.get('amount'));
  const category = fd.get('category');
  const payment_method = fd.get('payment_method') || 'card';
  const notes = fd.get('notes') || '';
  const is_tax_deductible = fd.get('is_tax_deductible') === 'on';

  if (!file || !purchase_date || !amount || !category) {
    alert('파일/날짜/금액/항목은 필수입니다.');
    return;
  }

  try {
    // 1) 고품질로 압축 (최대 1600px, 품질 0.75 - 영수증 글씨 선명하게)
    console.log('[Receipt] Compressing image...');
    const { blob, width, height, mime } = await compressImageToWebp(file, 1600, 0.75);

    // 2) Blob을 Base64로 변환
    console.log('[Receipt] Converting to Base64...');
    const base64 = await blobToBase64(blob);
    
    // 크기 확인 (Base64는 원본보다 약 33% 큼)
    const sizeKB = Math.round(base64.length / 1024);
    console.log(`[Receipt] Image size: ${sizeKB} KB`);
    
    // 700KB 이상이면 경고 (D1 row limit는 1MB)
    if (sizeKB > 700) {
      if (!confirm(`이미지 크기가 ${sizeKB}KB로 큽니다. 업로드에 시간이 걸릴 수 있습니다. 계속하시겠습니까?`)) {
        return;
      }
    }

    // 3) 서버에 저장 (Base64 이미지 포함)
    console.log('[Receipt] Saving to server...');
    const response = await axios.post('/api/receipts', {
      image_data: base64,
      image_type: mime,
      merchant,
      purchase_date,
      amount,
      category,
      payment_method,
      notes,
      is_tax_deductible
    }, {
      timeout: 30000,  // 30초 타임아웃
      maxContentLength: 2 * 1024 * 1024,  // 2MB max
      maxBodyLength: 2 * 1024 * 1024
    });

    if (!response.data?.success) {
      console.error('Receipt save failed', response.data);
      alert('영수증 저장 실패: ' + (response.data.error || '알 수 없는 오류'));
      return;
    }

    // 완료
    alert('영수증 저장 및 거래내역 생성 완료!');
    event.target.reset();
    
    // 영수증 탭이 있다면 새로고침
    if (typeof renderReceiptsView === 'function') {
      renderReceiptsView();
    }
  } catch (error) {
    console.error('[Receipt] Error:', error);
    let errorMsg = '영수증 처리 중 오류가 발생했습니다.';
    
    if (error.response) {
      // 서버 응답이 있는 경우
      errorMsg = error.response.data?.error || `서버 오류 (${error.response.status})`;
      console.error('[Receipt] Server error:', error.response.status, error.response.data);
    } else if (error.request) {
      // 요청은 보냈지만 응답이 없는 경우
      errorMsg = '서버 응답 없음. 네트워크를 확인해주세요.';
      console.error('[Receipt] No response:', error.request);
    } else {
      // 요청 설정 중 에러
      errorMsg = error.message || errorMsg;
      console.error('[Receipt] Request error:', error.message);
    }
    
    alert(errorMsg);
  }
}

// 3) 영수증 목록 렌더링 (보기/다운로드/삭제는 하단 전역 바인딩 섹션에서 정의)
async function renderReceiptsView() {
  console.log('[Receipts] renderReceiptsView called');
  const currentMonth = window.formatMonth(state.currentMonth);
  const [yStr, mStr] = currentMonth.split('-');
  const y = Number(yStr);
  const m = Number(mStr); // 1~12
  
  // 시작/끝 날짜 계산 (끝=그 달의 마지막 날)
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate(); // m(1~12) 그대로 넣으면 '다음달 0일' = 해당월 말일
  const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  console.log('[Receipts] Fetching receipts for:', startDate, 'to', endDate);

  try {
    const response = await axios.get('/api/receipts', {
      params: { start_date: startDate, end_date: endDate }
    });

    const receipts = response.data.receipts || [];

    document.getElementById('content-area').innerHTML = `
      <div class="bg-white rounded-lg shadow-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-800">
            <i class="fas fa-receipt mr-2 text-blue-600"></i>영수증 관리
          </h2>
          <button onclick="showReceiptUploadModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <i class="fas fa-plus mr-2"></i>영수증 추가
          </button>
        </div>

        <!-- 월 선택 -->
        <div class="flex items-center gap-4 mb-6">
          <button onclick="changeReceiptMonth(-1)" class="p-2 hover:bg-gray-100 rounded">
            <i class="fas fa-chevron-left"></i>
          </button>
          <span class="text-lg font-medium">${y}년 ${m}월</span>
          <button onclick="changeReceiptMonth(1)" class="p-2 hover:bg-gray-100 rounded">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>

        <!-- 영수증 목록 -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${receipts.length === 0 ? `
            <div class="col-span-full text-center py-12 text-gray-500">
              <i class="fas fa-receipt text-5xl mb-4 opacity-20"></i>
              <p>등록된 영수증이 없습니다.</p>
            </div>
          ` : receipts.map(receipt => `
            <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex justify-between items-start mb-3">
                <div class="flex-1">
                  <div class="font-medium text-gray-900">${receipt.merchant || '상점명 없음'}</div>
                  <div class="text-sm text-gray-500">${receipt.purchase_date}</div>
                </div>
                <div class="text-right">
                  <div class="font-bold text-lg text-red-600">${formatCurrency(receipt.amount)}</div>
                  <div class="text-sm text-gray-500">${getCategoryIcon(receipt.category)} ${receipt.category}</div>
                </div>
              </div>
              
              ${receipt.notes ? `
                <div class="text-sm text-gray-600 mb-3 p-2 bg-gray-50 rounded">
                  ${receipt.notes}
                </div>
              ` : ''}
              
              <div class="flex gap-2">
                <button onclick="viewReceipt(${receipt.id})" class="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm">
                  <i class="fas fa-eye mr-1"></i>보기
                </button>
                <button onclick="downloadReceipt(${receipt.id})" class="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm">
                  <i class="fas fa-download mr-1"></i>저장
                </button>
                <button onclick="deleteReceipt(${receipt.id})" class="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('[Receipts] Render error:', error);
    const errorMsg = error?.response?.data?.error || error?.message || '알 수 없는 오류';
    document.getElementById('content-area').innerHTML = `
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">
          <i class="fas fa-receipt mr-2 text-blue-600"></i>영수증 관리
        </h2>
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-red-600 font-medium mb-2">영수증 목록을 불러오는데 실패했습니다.</p>
          <p class="text-sm text-red-500">오류: ${errorMsg}</p>
          <button onclick="safeRenderReceiptsView()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            <i class="fas fa-redo mr-2"></i>다시 시도
          </button>
        </div>
      </div>
    `;
  }
}

// 6) 영수증 업로드 모달
function showReceiptUploadModal() {
  const modal = document.createElement('div');
  modal.id = 'receiptUploadModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-bold">영수증 추가</h3>
        <button onclick="closeReceiptModal()" class="text-gray-500 hover:text-gray-700">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      
      <form onsubmit="handleReceiptSubmit(event)" class="space-y-4">
        <!-- 파일 -->
        <div>
          <label class="block text-sm font-medium mb-1">영수증 사진 *</label>
          <input type="file" name="file" accept="image/*" required
            class="w-full px-3 py-2 border rounded-lg">
          <p class="text-xs text-gray-500 mt-1">자동으로 압축되어 저장됩니다</p>
        </div>

        <!-- 날짜 -->
        <div>
          <label class="block text-sm font-medium mb-1">구매 날짜 *</label>
          <input type="date" name="purchase_date" required
            value="${new Date().toISOString().split('T')[0]}"
            class="w-full px-3 py-2 border rounded-lg">
        </div>

        <!-- 금액 -->
        <div>
          <label class="block text-sm font-medium mb-1">금액 *</label>
          <input type="number" name="amount" required min="0"
            class="w-full px-3 py-2 border rounded-lg">
        </div>

        <!-- 항목 (의식주 등) -->
        <div>
          <label class="block text-sm font-medium mb-1">항목 *</label>
          <select name="category" required class="w-full px-3 py-2 border rounded-lg">
            <option value="">선택하세요</option>
            <option value="식">식 (식비)</option>
            <option value="의">의 (의복비)</option>
            <option value="주">주 (주거비)</option>
            <option value="교통">교통</option>
            <option value="통신">통신</option>
            <option value="문화">문화</option>
            <option value="의료">의료</option>
            <option value="교육">교육</option>
            <option value="쇼핑">쇼핑</option>
            <option value="기타">기타</option>
          </select>
        </div>

        <!-- 상점명 -->
        <div>
          <label class="block text-sm font-medium mb-1">상점명</label>
          <input type="text" name="merchant" 
            class="w-full px-3 py-2 border rounded-lg">
        </div>

        <!-- 결제수단 -->
        <div>
          <label class="block text-sm font-medium mb-1">결제수단</label>
          <select name="payment_method" class="w-full px-3 py-2 border rounded-lg">
            <option value="card">카드</option>
            <option value="cash">현금</option>
            <option value="transfer">계좌이체</option>
          </select>
        </div>

        <!-- 메모 -->
        <div>
          <label class="block text-sm font-medium mb-1">메모</label>
          <textarea name="notes" rows="2"
            class="w-full px-3 py-2 border rounded-lg"></textarea>
        </div>

        <!-- 세액공제 -->
        <div class="flex items-center">
          <input type="checkbox" name="is_tax_deductible" id="taxDeductible"
            class="mr-2">
          <label for="taxDeductible" class="text-sm">세액공제 대상</label>
        </div>

        <!-- 버튼 -->
        <div class="flex gap-2 pt-4">
          <button type="button" onclick="closeReceiptModal()"
            class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100">
            취소
          </button>
          <button type="submit"
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            저장
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function closeReceiptModal() {
  const modal = document.getElementById('receiptUploadModal');
  if (modal) {
    modal.remove();
  }
}

// ========== 영수증 전역 바인딩 및 안전 함수 (중요!) ==========

// 1) 안전한 helper 함수 제공 (ReferenceError 방지)
if (typeof window.formatMonth !== 'function') {
  window.formatMonth = function formatMonth(date) {
    const y = date instanceof Date ? date.getFullYear() : Number(String(date).split('-')[0]);
    const mVal = date instanceof Date ? (date.getMonth() + 1) : Number(String(date).split('-')[1]);
    const m = String(mVal).padStart(2, '0');
    return `${y}-${m}`;
  };
}

if (typeof window.getCategoryIcon !== 'function') {
  window.getCategoryIcon = function getCategoryIcon(cat) {
    const map = {
      // 긴 형식
      '식비': '🍚', '의복비': '👕', '주거비': '🏠', '교통비': '🚌',
      '통신비': '📱', '의료비': '💊', '교육비': '🎓', '보험': '🛡️',
      '문화생활': '🎬', '쇼핑': '🛍️', '기타지출': '🧾',
      // 짧은 형식 (영수증용)
      '식': '🍚', '의': '👕', '주': '🏠', '교통': '🚌',
      '통신': '📱', '의료': '💊', '교육': '🎓',
      '문화': '🎬', '기타': '🧾'
    };
    return map[cat] || '🧾';
  };
}

// 2) 안전한 renderReceiptsView 래퍼
function safeRenderReceiptsView() {
  console.log('[Receipts] safeRenderReceiptsView called');
  try {
    return renderReceiptsView();
  } catch (err) {
    console.error('[Receipts] render error:', err);
    const area = document.getElementById('content-area');
    if (area) {
      area.innerHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6">
          <p class="text-red-600 font-semibold">영수증 화면 렌더링 중 오류</p>
          <pre class="mt-2 p-3 bg-red-50 text-xs overflow-auto rounded">${String(err?.message || err)}</pre>
          <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            새로고침
          </button>
        </div>`;
    }
  }
}

// 4) 영수증용 월 변경 함수 (전역 바인딩)
window.changeReceiptMonth = function changeReceiptMonth(delta) {
  const d = new Date(state.currentMonth);
  d.setMonth(d.getMonth() + Number(delta));
  state.currentMonth = d;
  safeRenderReceiptsView();
};

// 5) 영수증 함수들 전역 바인딩 (onclick 인라인 호출 지원)
window.renderReceiptsView = renderReceiptsView;
window.safeRenderReceiptsView = safeRenderReceiptsView;
window.showReceiptUploadModal = showReceiptUploadModal;
window.closeReceiptModal = closeReceiptModal;
window.handleReceiptSubmit = handleReceiptSubmit;
window.viewReceipt = async function(receiptId) {
  try {
    const response = await axios.get(`/api/receipts/${receiptId}`);
    if (!response.data.success || !response.data.receipt) {
      alert('영수증을 찾을 수 없습니다.');
      return;
    }
    
    const receipt = response.data.receipt;
    if (!receipt.image_data) {
      alert('이미지가 없습니다.');
      return;
    }
    
    // 앱 내에서 모달로 표시
    const modal = document.createElement('div');
    modal.id = 'receiptViewModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <!-- 헤더 -->
        <div class="flex justify-between items-center p-4 border-b">
          <div>
            <h3 class="text-lg font-bold">${receipt.merchant || '영수증'}</h3>
            <p class="text-sm text-gray-500">${receipt.purchase_date} · ${formatCurrency(receipt.amount)}</p>
          </div>
          <button onclick="closeReceiptViewModal()" class="text-gray-500 hover:text-gray-700 text-2xl">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <!-- 이미지 영역 -->
        <div class="flex-1 overflow-auto p-4 bg-gray-100 flex items-center justify-center">
          <img src="${receipt.image_data}" 
               alt="영수증 이미지" 
               class="max-w-full h-auto shadow-lg cursor-zoom-in"
               onclick="this.classList.toggle('scale-150'); this.classList.toggle('cursor-zoom-out'); this.classList.toggle('cursor-zoom-in');"
               style="transition: transform 0.3s;">
        </div>
        
        <!-- 버튼 영역 -->
        <div class="p-4 border-t bg-gray-50 flex gap-2 flex-wrap">
          <button onclick="downloadReceiptFromModal(${receiptId})" 
                  class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2">
            <i class="fas fa-download"></i>
            <span>다운로드</span>
          </button>
          <button onclick="editReceiptModal(${receiptId})" 
                  class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center gap-2">
            <i class="fas fa-edit"></i>
            <span>수정</span>
          </button>
          <button onclick="if(confirm('이 영수증을 삭제하시겠습니까?')) { deleteReceipt(${receiptId}); closeReceiptViewModal(); }" 
                  class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center gap-2">
            <i class="fas fa-trash"></i>
            <span>삭제</span>
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // ESC 키로 닫기
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeReceiptViewModal();
      }
    };
    document.addEventListener('keydown', escHandler);
    modal._escHandler = escHandler;
    
    // 배경 클릭으로 닫기
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeReceiptViewModal();
      }
    });
    
  } catch (error) {
    console.error('[Receipt] View error:', error);
    alert(error.response?.data?.error || '이미지 보기 실패');
  }
};
// 영수증 뷰 모달 닫기
window.closeReceiptViewModal = function() {
  const modal = document.getElementById('receiptViewModal');
  if (modal) {
    if (modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
    }
    modal.remove();
  }
};

// 모달에서 다운로드
window.downloadReceiptFromModal = async function(receiptId) {
  await downloadReceipt(receiptId);
};

// 영수증 수정 모달
window.editReceiptModal = async function(receiptId) {
  try {
    const response = await axios.get(`/api/receipts/${receiptId}`);
    if (!response.data.success || !response.data.receipt) {
      alert('영수증을 찾을 수 없습니다.');
      return;
    }
    
    const receipt = response.data.receipt;
    
    // 기존 뷰 모달 닫기
    closeReceiptViewModal();
    
    // 수정 모달 생성
    const modal = document.createElement('div');
    modal.id = 'receiptEditModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center p-4 border-b">
          <h3 class="text-xl font-bold">영수증 수정</h3>
          <button onclick="closeReceiptEditModal()" class="text-gray-500 hover:text-gray-700">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <form onsubmit="handleReceiptEdit(event, ${receiptId})" class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">상점명</label>
            <input type="text" name="merchant" value="${receipt.merchant || ''}"
              class="w-full px-3 py-2 border rounded-lg">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">구매 날짜 *</label>
            <input type="date" name="purchase_date" value="${receipt.purchase_date}" required
              class="w-full px-3 py-2 border rounded-lg">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">금액 *</label>
            <input type="number" name="amount" value="${receipt.amount}" required min="0"
              class="w-full px-3 py-2 border rounded-lg">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">항목 *</label>
            <select name="category" required class="w-full px-3 py-2 border rounded-lg">
              <option value="식" ${receipt.category === '식비' || receipt.category === '식' ? 'selected' : ''}>식 (식비)</option>
              <option value="의" ${receipt.category === '의복비' || receipt.category === '의' ? 'selected' : ''}>의 (의복비)</option>
              <option value="주" ${receipt.category === '주거비' || receipt.category === '주' ? 'selected' : ''}>주 (주거비)</option>
              <option value="교통" ${receipt.category === '교통비' || receipt.category === '교통' ? 'selected' : ''}>교통</option>
              <option value="통신" ${receipt.category === '통신비' || receipt.category === '통신' ? 'selected' : ''}>통신</option>
              <option value="문화" ${receipt.category === '문화생활' || receipt.category === '문화' ? 'selected' : ''}>문화</option>
              <option value="의료" ${receipt.category === '의료비' || receipt.category === '의료' ? 'selected' : ''}>의료</option>
              <option value="교육" ${receipt.category === '교육비' || receipt.category === '교육' ? 'selected' : ''}>교육</option>
              <option value="쇼핑" ${receipt.category === '쇼핑' ? 'selected' : ''}>쇼핑</option>
              <option value="기타" ${receipt.category === '기타지출' || receipt.category === '기타' ? 'selected' : ''}>기타</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">결제수단</label>
            <select name="payment_method" class="w-full px-3 py-2 border rounded-lg">
              <option value="card" ${receipt.payment_method === 'card' ? 'selected' : ''}>카드</option>
              <option value="cash" ${receipt.payment_method === 'cash' ? 'selected' : ''}>현금</option>
              <option value="transfer" ${receipt.payment_method === 'transfer' ? 'selected' : ''}>계좌이체</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">메모</label>
            <textarea name="notes" rows="2" class="w-full px-3 py-2 border rounded-lg">${receipt.notes || ''}</textarea>
          </div>
          
          <div class="flex items-center">
            <input type="checkbox" name="is_tax_deductible" id="editTaxDeductible" 
              ${receipt.is_tax_deductible ? 'checked' : ''} class="mr-2">
            <label for="editTaxDeductible" class="text-sm">세액공제 대상</label>
          </div>
          
          <div class="flex gap-2">
            <button type="button" onclick="closeReceiptEditModal()" 
              class="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
              취소
            </button>
            <button type="submit" 
              class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              저장
            </button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('[Receipt] Edit modal error:', error);
    alert('영수증 정보를 불러오는데 실패했습니다.');
  }
};

// 영수증 수정 모달 닫기
window.closeReceiptEditModal = function() {
  const modal = document.getElementById('receiptEditModal');
  if (modal) {
    modal.remove();
  }
};

// 영수증 수정 처리
window.handleReceiptEdit = async function(event, receiptId) {
  event.preventDefault();
  
  const fd = new FormData(event.target);
  const data = {
    merchant: fd.get('merchant') || '',
    purchase_date: fd.get('purchase_date'),
    amount: Number(fd.get('amount')),
    category: fd.get('category'),
    payment_method: fd.get('payment_method') || 'card',
    notes: fd.get('notes') || '',
    is_tax_deductible: fd.get('is_tax_deductible') === 'on'
  };
  
  try {
    const response = await axios.put(`/api/receipts/${receiptId}`, data);
    if (response.data.success) {
      alert('영수증이 수정되었습니다.');
      closeReceiptEditModal();
      // 목록 새로고침
      if (typeof safeRenderReceiptsView === 'function') {
        safeRenderReceiptsView();
      }
    } else {
      alert('수정 실패: ' + (response.data.error || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('[Receipt] Edit error:', error);
    alert(error.response?.data?.error || '영수증 수정 중 오류가 발생했습니다.');
  }
};

window.downloadReceipt = async function(receiptId) {
  try {
    const response = await axios.get(`/api/receipts/${receiptId}`);
    if (!response.data.success || !response.data.receipt) {
      alert('영수증을 찾을 수 없습니다.');
      return;
    }
    
    const receipt = response.data.receipt;
    if (!receipt.image_data) {
      alert('이미지가 없습니다.');
      return;
    }
    
    // Base64 data URL을 Blob으로 변환
    const base64Data = receipt.image_data.split(',')[1];
    const mimeType = receipt.image_type || 'image/webp';
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    
    // Blob을 다운로드
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const extension = mimeType.split('/')[1] || 'webp';
    a.download = `receipt-${receipt.merchant || receiptId}-${receipt.purchase_date}.${extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[Receipt] Download error:', error);
    alert(error.response?.data?.error || '다운로드 실패');
  }
};
window.deleteReceipt = async function(receiptId) {
  if (!confirm('이 영수증을 삭제하시겠습니까?')) return;
  try {
    const response = await axios.delete(`/api/receipts/${receiptId}`);
    if (response.data.success) {
      // 이미지는 DB에 저장되므로 별도 삭제 불필요
      alert('영수증이 삭제되었습니다.');
      safeRenderReceiptsView();
    }
  } catch (error) {
    console.error('[Receipt] Delete error:', error);
    alert(error.response?.data?.error || '영수증 삭제 실패');
  }
};

console.log('[Receipts] Global bindings initialized');

// ========== 사용방법 모달 ==========
window.showHelpModal = function() {
  const modal = document.createElement('div');
  modal.id = 'helpModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <div class="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
        <h2 class="text-2xl font-bold text-gray-800">
          <i class="fas fa-book text-blue-600 mr-2"></i>가계부 앱 사용 방법
        </h2>
        <button onclick="closeHelpModal()" class="text-gray-500 hover:text-gray-700 text-2xl">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="p-6 space-y-6">
        <!-- 시작하기 -->
        <section>
          <h3 class="text-xl font-bold text-blue-600 mb-3 flex items-center">
            <i class="fas fa-play-circle mr-2"></i>1. 시작하기
          </h3>
          <div class="bg-blue-50 p-4 rounded-lg space-y-2">
            <p class="text-sm"><strong>📱 앱 설치:</strong> 브라우저 메뉴에서 "홈 화면에 추가"를 선택하면 앱처럼 사용할 수 있습니다.</p>
            <p class="text-sm"><strong>💰 초기 설정:</strong> 설정 탭에서 통화와 초기 잔액을 입력하세요.</p>
            <p class="text-sm"><strong>🔐 자동 로그인:</strong> "로그인 상태 유지"를 체크하면 다음에 자동으로 로그인됩니다.</p>
          </div>
        </section>

        <!-- 거래 내역 관리 -->
        <section>
          <h3 class="text-xl font-bold text-green-600 mb-3 flex items-center">
            <i class="fas fa-exchange-alt mr-2"></i>2. 거래 내역 관리
          </h3>
          <div class="bg-green-50 p-4 rounded-lg space-y-3">
            <div>
              <p class="font-semibold text-sm mb-1">💵 수입/지출/저축 입력</p>
              <p class="text-sm ml-4">• 월별 탭의 달력에서 날짜를 클릭하면 거래를 추가할 수 있습니다.</p>
              <p class="text-sm ml-4">• 카테고리, 금액, 메모를 입력하세요.</p>
            </div>
            <div>
              <p class="font-semibold text-sm mb-1">✏️ 수정 및 삭제</p>
              <p class="text-sm ml-4">• 거래 내역 옆의 수정 버튼으로 정보를 변경할 수 있습니다.</p>
              <p class="text-sm ml-4">• 삭제 버튼으로 거래를 제거할 수 있습니다.</p>
            </div>
            <div>
              <p class="font-semibold text-sm mb-1">🔍 검색 및 필터</p>
              <p class="text-sm ml-4">• 홈 탭에서 유형, 카테고리, 설명으로 거래를 필터링할 수 있습니다.</p>
            </div>
          </div>
        </section>

        <!-- 저축 관리 -->
        <section>
          <h3 class="text-xl font-bold text-purple-600 mb-3 flex items-center">
            <i class="fas fa-piggy-bank mr-2"></i>3. 저축 관리
          </h3>
          <div class="bg-purple-50 p-4 rounded-lg space-y-3">
            <div>
              <p class="font-semibold text-sm mb-1">💳 저축 통장 추가</p>
              <p class="text-sm ml-4">• 저축 탭에서 "통장 추가" 버튼으로 새 저축 계좌를 만들 수 있습니다.</p>
              <p class="text-sm ml-4">• 비상금, 여행 자금 등 목적별로 통장을 분리 관리하세요.</p>
            </div>
            <div>
              <p class="font-semibold text-sm mb-1">🎯 저축 목표 설정</p>
              <p class="text-sm ml-4">• 각 통장마다 목표 금액을 설정할 수 있습니다.</p>
              <p class="text-sm ml-4">• 진행률 바로 달성 현황을 한눈에 확인하세요.</p>
            </div>
          </div>
        </section>

        <!-- 영수증 관리 -->
        <section>
          <h3 class="text-xl font-bold text-orange-600 mb-3 flex items-center">
            <i class="fas fa-receipt mr-2"></i>4. 영수증 관리
          </h3>
          <div class="bg-orange-50 p-4 rounded-lg space-y-3">
            <div>
              <p class="font-semibold text-sm mb-1">📸 영수증 촬영 및 업로드</p>
              <p class="text-sm ml-4">• 영수증 탭에서 카메라로 촬영하거나 갤러리에서 선택하세요.</p>
              <p class="text-sm ml-4">• 구매처, 금액, 카테고리를 입력하세요.</p>
            </div>
            <div>
              <p class="font-semibold text-sm mb-1">🔍 영수증 확인</p>
              <p class="text-sm ml-4">• 영수증 클릭 시 앱 내에서 확대하여 볼 수 있습니다.</p>
              <p class="text-sm ml-4">• 다운로드, 수정, 삭제 기능을 이용하세요.</p>
            </div>
            <div>
              <p class="font-semibold text-sm mb-1">💡 세금공제</p>
              <p class="text-sm ml-4">• 세금공제 대상 영수증을 체크하면 나중에 필터링할 수 있습니다.</p>
            </div>
          </div>
        </section>

        <!-- 고정지출 -->
        <section>
          <h3 class="text-xl font-bold text-red-600 mb-3 flex items-center">
            <i class="fas fa-redo mr-2"></i>5. 고정지출 관리
          </h3>
          <div class="bg-red-50 p-4 rounded-lg space-y-3">
            <div>
              <p class="font-semibold text-sm mb-1">📅 반복 지출 등록</p>
              <p class="text-sm ml-4">• 월세, 통신비, 구독료 등 정기적인 지출을 등록하세요.</p>
              <p class="text-sm ml-4">• 매월, 매주 등 반복 주기를 선택할 수 있습니다.</p>
            </div>
            <div>
              <p class="font-semibold text-sm mb-1">✅ 체크박스로 지불 처리</p>
              <p class="text-sm ml-4">• 고정지출 항목을 체크하면 자동으로 거래 내역에 추가됩니다.</p>
            </div>
          </div>
        </section>

        <!-- 예산 및 투자 -->
        <section>
          <h3 class="text-xl font-bold text-indigo-600 mb-3 flex items-center">
            <i class="fas fa-chart-line mr-2"></i>6. 예산 및 투자
          </h3>
          <div class="bg-indigo-50 p-4 rounded-lg space-y-3">
            <div>
              <p class="font-semibold text-sm mb-1">💰 예산 설정</p>
              <p class="text-sm ml-4">• 예산 탭에서 카테고리별 월 예산을 설정하세요.</p>
              <p class="text-sm ml-4">• 예산 대비 실제 지출을 색상으로 확인할 수 있습니다.</p>
            </div>
            <div>
              <p class="font-semibold text-sm mb-1">📈 투자 관리</p>
              <p class="text-sm ml-4">• 투자 탭에서 주식, 암호화폐 포트폴리오를 관리하세요.</p>
              <p class="text-sm ml-4">• 실시간 주가가 자동으로 업데이트됩니다.</p>
            </div>
          </div>
        </section>

        <!-- 데이터 관리 -->
        <section>
          <h3 class="text-xl font-bold text-gray-600 mb-3 flex items-center">
            <i class="fas fa-database mr-2"></i>7. 데이터 관리
          </h3>
          <div class="bg-gray-50 p-4 rounded-lg space-y-3">
            <div>
              <p class="font-semibold text-sm mb-1">📊 엑셀 내보내기</p>
              <p class="text-sm ml-4">• 설정 탭에서 모든 거래 내역을 CSV 파일로 내보낼 수 있습니다.</p>
              <p class="text-sm ml-4">• 엑셀, 구글 스프레드시트에서 열어 분석하세요.</p>
            </div>
            <div>
              <p class="font-semibold text-sm mb-1">💾 백업 및 복원</p>
              <p class="text-sm ml-4">• JSON 형식으로 전체 데이터를 백업할 수 있습니다.</p>
              <p class="text-sm ml-4">• 기기를 바꿔도 백업 파일로 데이터를 복원할 수 있습니다.</p>
            </div>
          </div>
        </section>

        <!-- 팁 -->
        <section>
          <h3 class="text-xl font-bold text-yellow-600 mb-3 flex items-center">
            <i class="fas fa-lightbulb mr-2"></i>8. 유용한 팁
          </h3>
          <div class="bg-yellow-50 p-4 rounded-lg space-y-2">
            <p class="text-sm">💡 매일 지출을 입력하면 정확한 재무 현황을 파악할 수 있습니다.</p>
            <p class="text-sm">💡 영수증은 사진으로 남겨두면 나중에 확인할 때 편리합니다.</p>
            <p class="text-sm">💡 월별 리포트를 보며 지출 패턴을 분석하고 개선하세요.</p>
            <p class="text-sm">💡 저축 목표를 설정하면 동기부여가 됩니다.</p>
            <p class="text-sm">💡 정기적으로 데이터를 백업하는 습관을 들이세요.</p>
          </div>
        </section>
      </div>
      
      <div class="sticky bottom-0 bg-white border-t p-4">
        <button onclick="closeHelpModal()" 
                class="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          <i class="fas fa-check mr-2"></i>확인
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // ESC 키로 닫기
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeHelpModal();
    }
  };
  document.addEventListener('keydown', escHandler);
  modal._escHandler = escHandler;
  
  // 배경 클릭으로 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeHelpModal();
    }
  });
};

window.closeHelpModal = function() {
  const modal = document.getElementById('helpModal');
  if (modal) {
    if (modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
    }
    modal.remove();
  }
};

// ========== 엑셀(CSV) 내보내기 ==========
window.exportToExcel = async function() {
  try {
    console.log('[Export] Starting CSV export...');
    
    // 모든 데이터 가져오기
    const [transactionsRes, savingsRes, settingsRes] = await Promise.all([
      axios.get('/api/transactions', {
        params: {
          start: '2020-01-01',
          end: '2099-12-31'
        }
      }),
      axios.get('/api/savings-accounts'),
      axios.get('/api/settings')
    ]);
    
    const transactions = transactionsRes.data.transactions || [];
    const savingsAccounts = savingsRes.data.accounts || [];
    const settings = settingsRes.data.settings || {};
    
    // CSV 헤더
    const csvRows = [];
    csvRows.push('가계부 재무 현황 - ' + new Date().toLocaleDateString('ko-KR'));
    csvRows.push('');
    
    // 요약 정보
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const totalSavings = transactions.filter(t => t.type === 'savings').reduce((sum, t) => sum + t.amount, 0);
    const currentBalance = (settings.initial_balance || 0) + totalIncome - totalExpense - totalSavings;
    
    csvRows.push('=== 재무 요약 ===');
    csvRows.push('항목,금액');
    csvRows.push(`초기 잔액,${settings.initial_balance || 0}`);
    csvRows.push(`총 수입,${totalIncome}`);
    csvRows.push(`총 지출,${totalExpense}`);
    csvRows.push(`총 저축,${totalSavings}`);
    csvRows.push(`현재 잔액,${currentBalance}`);
    csvRows.push('');
    
    // 저축 계좌 현황
    if (savingsAccounts.length > 0) {
      csvRows.push('=== 저축 계좌 현황 ===');
      csvRows.push('계좌명,잔액,목표 금액,진행률(%)');
      savingsAccounts.forEach(acc => {
        const balance = acc.balance || 0;
        const goal = acc.savings_goal || 0;
        const progress = goal > 0 ? ((balance / goal) * 100).toFixed(1) : 0;
        csvRows.push(`${acc.name},${balance},${goal},${progress}`);
      });
      csvRows.push('');
    }
    
    // 거래 내역
    csvRows.push('=== 전체 거래 내역 ===');
    csvRows.push('날짜,유형,카테고리,금액,설명');
    
    // 날짜순 정렬
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    transactions.forEach(t => {
      const typeLabel = t.type === 'income' ? '수입' : t.type === 'expense' ? '지출' : '저축';
      const description = (t.description || '').replace(/,/g, ' ').replace(/\n/g, ' ');
      csvRows.push(`${t.date},${typeLabel},${t.category},${t.amount},${description}`);
    });
    
    // 저축 통장별 상세 내역
    if (savingsAccounts.length > 0) {
      csvRows.push('=== 저축 통장별 입출금 내역 ===');
      savingsAccounts.forEach(acc => {
        const accTransactions = transactions.filter(t => 
          t.type === 'savings' && t.savings_account_id === acc.id
        );
        
        if (accTransactions.length > 0) {
          csvRows.push('');
          csvRows.push(`${acc.name} (잔액: ${acc.balance || 0})`);
          csvRows.push('날짜,금액,설명');
          accTransactions.forEach(t => {
            const description = (t.description || '').replace(/,/g, ' ');
            csvRows.push(`${t.date},${t.amount},${description}`);
          });
          
          const totalDeposits = accTransactions.reduce((sum, t) => sum + t.amount, 0);
          csvRows.push(`총 입금액,${totalDeposits},`);
        }
      });
      csvRows.push('');
    }
    
    // 월별 통계
    csvRows.push('=== 월별 통계 ===');
    csvRows.push('년월,수입,지출,저축,순수익,수입-지출,저축률(%)');
    
    // 월별 집계
    const monthlyData = {};
    transactions.forEach(t => {
      const yearMonth = t.date.substring(0, 7); // YYYY-MM
      if (!monthlyData[yearMonth]) {
        monthlyData[yearMonth] = { income: 0, expense: 0, savings: 0 };
      }
      if (t.type === 'income') monthlyData[yearMonth].income += t.amount;
      else if (t.type === 'expense') monthlyData[yearMonth].expense += t.amount;
      else if (t.type === 'savings') monthlyData[yearMonth].savings += t.amount;
    });
    
    Object.keys(monthlyData).sort().reverse().forEach(month => {
      const data = monthlyData[month];
      const netIncome = data.income - data.expense - data.savings;
      const incomeMinusExpense = data.income - data.expense;
      const savingsRate = data.income > 0 ? ((data.savings / data.income) * 100).toFixed(1) : 0;
      csvRows.push(`${month},${data.income},${data.expense},${data.savings},${netIncome},${incomeMinusExpense},${savingsRate}`);
    });
    
    // 월별 합계
    const totalMonthlyIncome = Object.values(monthlyData).reduce((sum, d) => sum + d.income, 0);
    const totalMonthlyExpense = Object.values(monthlyData).reduce((sum, d) => sum + d.expense, 0);
    const totalMonthlySavings = Object.values(monthlyData).reduce((sum, d) => sum + d.savings, 0);
    const totalNetIncome = totalMonthlyIncome - totalMonthlyExpense - totalMonthlySavings;
    const avgSavingsRate = totalMonthlyIncome > 0 ? ((totalMonthlySavings / totalMonthlyIncome) * 100).toFixed(1) : 0;
    csvRows.push(`합계,${totalMonthlyIncome},${totalMonthlyExpense},${totalMonthlySavings},${totalNetIncome},${totalMonthlyIncome - totalMonthlyExpense},${avgSavingsRate}`);
    
    // 카테고리별 지출 분석
    csvRows.push('');
    csvRows.push('=== 카테고리별 지출 분석 ===');
    csvRows.push('카테고리,총 지출액,건수,평균 금액,비율(%)');
    
    const categoryData = {};
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    
    expenseTransactions.forEach(t => {
      if (!categoryData[t.category]) {
        categoryData[t.category] = { total: 0, count: 0 };
      }
      categoryData[t.category].total += t.amount;
      categoryData[t.category].count += 1;
    });
    
    Object.entries(categoryData)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([category, data]) => {
        const avg = data.count > 0 ? Math.round(data.total / data.count) : 0;
        const percentage = totalExpense > 0 ? ((data.total / totalExpense) * 100).toFixed(1) : 0;
        csvRows.push(`${category},${data.total},${data.count},${avg},${percentage}`);
      });
    
    csvRows.push(`합계,${totalExpense},${expenseTransactions.length},,100.0`);
    
    // 주별 통계 (최근 12주)
    csvRows.push('');
    csvRows.push('=== 주별 통계 (최근 12주) ===');
    csvRows.push('주차,시작일,종료일,수입,지출,저축,순수익');
    
    const today = new Date();
    const weeks = [];
    
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7) - today.getDay());
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      
      const weekTransactions = transactions.filter(t => 
        t.date >= weekStartStr && t.date <= weekEndStr
      );
      
      const weekIncome = weekTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const weekExpense = weekTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const weekSavings = weekTransactions.filter(t => t.type === 'savings').reduce((sum, t) => sum + t.amount, 0);
      const weekNet = weekIncome - weekExpense - weekSavings;
      
      const weekLabel = `${weekStart.getMonth() + 1}월 ${Math.ceil(weekStart.getDate() / 7)}주차`;
      csvRows.push(`${weekLabel},${weekStartStr},${weekEndStr},${weekIncome},${weekExpense},${weekSavings},${weekNet}`);
    }
    
    // 채무 현황
    try {
      const debtsRes = await axios.get('/api/debts');
      const debts = debtsRes.data.debts || [];
      
      if (debts.length > 0) {
        csvRows.push('');
        csvRows.push('=== 채무 현황 ===');
        csvRows.push('채권자,카테고리,총 채무액,남은 금액,상환 완료,이자율(%),시작일,만기일,상태,메모');
        
        debts.forEach(debt => {
          const paid = debt.amount - debt.remaining_amount;
          const statusText = debt.status === 'paid' ? '상환완료' : (debt.status === 'overdue' ? '연체' : '진행중');
          csvRows.push(
            `${debt.creditor},${debt.category},${debt.amount},${debt.remaining_amount},${paid},${debt.interest_rate},${debt.start_date},${debt.due_date || '-'},${statusText},"${(debt.notes || '').replace(/"/g, '""')}"`
          );
        });
        
        // 채무 요약
        const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);
        const totalRemaining = debts.reduce((sum, d) => sum + d.remaining_amount, 0);
        const totalPaid = totalDebt - totalRemaining;
        const paymentProgress = totalDebt > 0 ? ((totalPaid / totalDebt) * 100).toFixed(1) : 0;
        
        csvRows.push('');
        csvRows.push('채무 요약');
        csvRows.push(`총 채무액,${totalDebt}`);
        csvRows.push(`상환 완료,${totalPaid}`);
        csvRows.push(`남은 금액,${totalRemaining}`);
        csvRows.push(`상환율(%),${paymentProgress}`);
        
        // 카테고리별 채무
        csvRows.push('');
        csvRows.push('카테고리별 채무');
        csvRows.push('카테고리,총 채무액,남은 금액,상환율(%)');
        
        const categoryDebts = {};
        debts.forEach(debt => {
          if (!categoryDebts[debt.category]) {
            categoryDebts[debt.category] = { total: 0, remaining: 0 };
          }
          categoryDebts[debt.category].total += debt.amount;
          categoryDebts[debt.category].remaining += debt.remaining_amount;
        });
        
        Object.entries(categoryDebts).forEach(([category, data]) => {
          const paid = data.total - data.remaining;
          const progress = data.total > 0 ? ((paid / data.total) * 100).toFixed(1) : 0;
          csvRows.push(`${category},${data.total},${data.remaining},${progress}`);
        });
        
        // 상환 내역
        csvRows.push('');
        csvRows.push('=== 채무별 상환 내역 ===');
        
        for (const debt of debts) {
          try {
            const paymentsRes = await axios.get(`/api/debts/${debt.id}/payments`);
            const payments = paymentsRes.data.payments || [];
            
            if (payments.length > 0) {
              csvRows.push('');
              csvRows.push(`${debt.creditor} - 상환 내역`);
              csvRows.push('날짜,금액,메모');
              
              payments.forEach(payment => {
                csvRows.push(`${payment.payment_date},${payment.amount},"${(payment.notes || '').replace(/"/g, '""')}"`);
              });
              
              const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
              csvRows.push(`총 상환액,${totalPayments}`);
            }
          } catch (err) {
            console.error(`Failed to fetch payments for debt ${debt.id}:`, err);
          }
        }
      }
    } catch (error) {
      console.error('[Export] Failed to fetch debts:', error);
      // Continue even if debt fetch fails
    }
    
    // CSV 파일 생성 및 다운로드
    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const filename = `가계부_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`✅ CSV 파일이 다운로드되었습니다!\n\n파일명: ${filename}\n\n엑셀이나 구글 스프레드시트에서 열어서 확인하세요.`);
    
  } catch (error) {
    console.error('[Export] CSV export error:', error);
    alert('CSV 내보내기 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
  }
};

console.log('[Help & Export] Functions initialized');

// 앱 초기화 - 페이지 로드 시 인증 확인 후 적절한 화면 렌더링
renderApp();
