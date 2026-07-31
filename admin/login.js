/* ============================================
   LOGIN — Authentication logic
   Demo credentials: admin@domingo.in / domingo123
   Replace with Firebase Auth later.
   ============================================ */

const DEMO_USER = {
  email: 'admin@domingo.in',
  password: 'domingo123',
  name: 'Admin',
};

(function () {
  // Already logged in? Redirect.
  const auth = JSON.parse(localStorage.getItem('ss_auth') || 'null');
  if (auth && auth.loggedIn) {
    window.location.href = 'dashboard.html';
    return;
  }

  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('password');
  const errorEl = document.getElementById('formError');
  const loginBtn = document.getElementById('loginBtn');
  const toggleBtn = document.getElementById('togglePass');
  const rememberCheck = document.getElementById('remember');
  const forgotLink = document.getElementById('forgotLink');

  // Restore remembered email
  const remembered = localStorage.getItem('ss_rememberEmail');
  if (remembered) {
    emailInput.value = remembered;
    rememberCheck.checked = true;
  }

  // Toggle password visibility
  toggleBtn.addEventListener('click', () => {
    const isPass = passInput.type === 'password';
    passInput.type = isPass ? 'text' : 'password';
    toggleBtn.innerHTML = isPass
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  });

  // Forgot password
  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    showError('Reset the password in config.js or contact the developer.');
  });

  // Form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    hideError();

    const email = emailInput.value.trim().toLowerCase();
    const password = passInput.value;

    if (!email || !password) {
      showError('Please fill in all fields.');
      return;
    }

    // Show spinner
    loginBtn.querySelector('.login-btn__text').style.display = 'none';
    loginBtn.querySelector('.login-btn__spinner').style.display = 'block';
    loginBtn.disabled = true;

    // Simulate network delay
    setTimeout(() => {
      if (email === DEMO_USER.email && password === DEMO_USER.password) {
        const authData = {
          loggedIn: true,
          email: DEMO_USER.email,
          name: DEMO_USER.name,
          loginTime: new Date().toISOString(),
        };
        localStorage.setItem('ss_auth', JSON.stringify(authData));

        if (rememberCheck.checked) {
          localStorage.setItem('ss_rememberEmail', email);
        } else {
          localStorage.removeItem('ss_rememberEmail');
        }

        window.location.href = 'dashboard.html';
      } else {
        showError('Invalid email or password. Try the demo credentials below.');
        loginBtn.querySelector('.login-btn__text').style.display = 'inline';
        loginBtn.querySelector('.login-btn__spinner').style.display = 'none';
        loginBtn.disabled = false;
      }
    }, 800);
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('show');
  }

  function hideError() {
    errorEl.classList.remove('show');
  }
})();
