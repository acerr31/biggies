// Tab switching
const loginTab = document.getElementById('login-tab');
const createAccountTab = document.getElementById('create-account-tab');
const logonForm = document.getElementById('logon-form');
const createAccountForm = document.getElementById('create-account-form');
const messageEl = document.getElementById('message');

// ---- Phone helpers ----
function digitsOnly(value) {
  return value.replace(/\D/g, '');
}

function formatPhoneForDisplay(digits) {
  // US-style formatting if exactly 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // Otherwise show raw digits (good for 11–15 digit intl)
  return digits;
}

// Auto-format phone number as the user types (Create Account form)
const phoneInput = document.getElementById('create-phone-number');
if (phoneInput) {
  phoneInput.addEventListener('input', (e) => {
    const digits = digitsOnly(e.target.value).slice(0, 15); // max 15 digits
    e.target.value = formatPhoneForDisplay(digits);
  });
}

loginTab.addEventListener('click', () => {
    logonForm.classList.add('active-form');
    createAccountForm.classList.remove('active-form');
    loginTab.classList.add('active');
    createAccountTab.classList.remove('active');
});

createAccountTab.addEventListener('click', () => {
    createAccountForm.classList.add('active-form');
    logonForm.classList.remove('active-form');
    createAccountTab.classList.add('active');
    loginTab.classList.remove('active');
});

// Logon form submission
logonForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const result = await response.json();
        if (response.ok) {
            localStorage.setItem('jwtToken', result.token);
            window.location.href = '/home.html';
        } else {
            messageEl.textContent = result.message;
            messageEl.classList.add('error');
        }
    } catch (error) {
        console.error('Error:', error);
        messageEl.textContent = 'An error occurred. Please try again later.';
        messageEl.classList.add('error');
    }
});

// Create account form submission
createAccountForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('create-email').value.trim();

// Basic email format check (requires something@something.something)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
if (!emailRegex.test(email)) {
  messageEl.textContent = 'Please enter a valid email address (example: name@email.com).';
  messageEl.classList.add('error');
  return;
}
    const username = document.getElementById('create-username').value.trim();
    const password = document.getElementById('create-password').value;
    const first_name = document.getElementById('create-first-name').value.trim();
    const last_name = document.getElementById('create-last-name').value.trim();
    const phone_number = digitsOnly(document.getElementById('create-phone-number').value);

if (!/^\d{10,15}$/.test(phone_number)) {
  messageEl.textContent = 'Phone number must be 10–15 digits (numbers only).';
  messageEl.classList.add('error');
  return;
}
    try {
        const response = await fetch('/api/create-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password, first_name, last_name, phone_number }),
        });

        const result = await response.json();
        if (response.ok) {
            messageEl.textContent = 'Account created successfully! You can now log in.';
            messageEl.classList.add('success');
            document.getElementById('login-email').value = email;
            document.getElementById('login-password').value = password;
            logonForm.classList.add('active-form');
            createAccountForm.classList.remove('active-form');
            loginTab.classList.add('active');
            createAccountTab.classList.remove('active');
        } else {
            messageEl.textContent = result.message;
            messageEl.classList.add('error');
        }
    } catch (error) {
        console.error('Error:', error);
        messageEl.textContent = 'An error occurred. Please try again later.';
        messageEl.classList.add('error');
    }
});