const wrapper = document.querySelector('.wrapper');
const loginLink = document.querySelector('.login-link');
const registerLink = document.querySelector('.register-link');
const btnPopup = document.querySelector('.btnLogin-popup');
const iconClose = document.querySelector('.icon-close');
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const loginEmail = document.querySelector('#login-email');
const loginPassword = document.querySelector('#login-password');
const loginFeedback = document.querySelector('#login-feedback');
const registerFeedback = document.querySelector('#register-feedback');
let navSwitchTimeout;

const updateNavSwitch = () => {
    const showingRegister = wrapper.classList.contains('active');
    const label = btnPopup.querySelector('.nav-label');
    const icon = btnPopup.querySelector('ion-icon');
    const nextView = showingRegister ? 'Login' : 'Register';

    btnPopup.setAttribute('aria-label', `Switch to ${nextView.toLowerCase()}`);

    if (label.textContent === nextView) return;

    btnPopup.classList.add('switching');
    window.clearTimeout(navSwitchTimeout);
    navSwitchTimeout = window.setTimeout(() => {
        label.textContent = nextView;
        icon.setAttribute('name', showingRegister ? 'log-in-outline' : 'person-add-outline');
        btnPopup.classList.remove('switching');
    }, 160);
};

updateNavSwitch();

const setAuthFeedback = (element, message, state = 'error') => {
    element.textContent = message;
    element.dataset.state = state;
};

registerLink.addEventListener('click', () => {
    loginFeedback.textContent = '';
    registerFeedback.textContent = '';
    wrapper.classList.add('active');
    updateNavSwitch();
});

loginLink.addEventListener('click', () => {
    loginFeedback.textContent = '';
    registerFeedback.textContent = '';
    wrapper.classList.remove('active');
    updateNavSwitch();
});

iconClose.addEventListener('click', () => wrapper.classList.remove('active-popup'));

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginFeedback.textContent = '';

    try {
        const email = loginEmail.value.trim().toLowerCase();
        const accounts = window.monitorStorage.getAccounts();
        let account = accounts.find(candidate => candidate.email === email);
        if (!account && window.monitorStorage.isAdminEmail(email)) {
            if (loginPassword.value.length < 8) {
                throw new Error('Choose an admin password with at least 8 characters.');
            }

            const passwordRecord = await window.monitorStorage.createPasswordRecord(loginPassword.value);
            account = {
                id: crypto.randomUUID(),
                username: 'Admin',
                email,
                role: 'admin',
                createdAt: new Date().toISOString(),
                passwordSalt: passwordRecord.salt,
                passwordHash: passwordRecord.hash
            };
            accounts.push(account);
            window.monitorStorage.saveAccounts(accounts);
        }
        if (!account || !await window.monitorStorage.verifyPassword(loginPassword.value, account.passwordSalt, account.passwordHash)) {
            throw new Error('Email or password is incorrect.');
        }

        const isAdmin = window.monitorStorage.isAdminEmail(account.email);
        window.monitorStorage.setCurrentUser({ id: account.id, username: account.username, email: account.email, role: isAdmin ? 'admin' : 'user' });
        window.location.assign(isAdmin ? 'admin.html' : 'app.html');
    } catch (error) {
        setAuthFeedback(loginFeedback, error.message || 'Could not log in.');
    }
});

registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    registerFeedback.textContent = '';

    const formData = new FormData(registerForm);
    const username = formData.get('username').trim();
    const email = formData.get('email').trim().toLowerCase();
    const password = formData.get('password');

    try {
        const accounts = window.monitorStorage.getAccounts();
        if (accounts.some(account => account.email === email)) {
            throw new Error('An account with this email already exists on this device.');
        }

        const passwordRecord = await window.monitorStorage.createPasswordRecord(password);
        const isAdmin = window.monitorStorage.isAdminEmail(email);
        accounts.push({
            id: crypto.randomUUID(),
            username,
            email,
            role: isAdmin ? 'admin' : 'user',
            createdAt: new Date().toISOString(),
            passwordSalt: passwordRecord.salt,
            passwordHash: passwordRecord.hash
        });
        window.monitorStorage.saveAccounts(accounts);
        registerForm.reset();
        wrapper.classList.remove('active');
        updateNavSwitch();
        loginEmail.value = email;
        const message = isAdmin
            ? 'Account created. This email has admin access on this device. Log in now.'
            : 'Account created. You can log in now.';
        setAuthFeedback(loginFeedback, message, 'success');
    } catch (error) {
        setAuthFeedback(registerFeedback, error.message || 'Could not create your account.');
    }
});

btnPopup.addEventListener('click', () => {
    wrapper.classList.add('active-popup');
    wrapper.classList.toggle('active');
    updateNavSwitch();
});

document.querySelectorAll('.toggle-password').forEach(toggle => {
    const togglePassword = () => {
        const input = toggle.parentElement.querySelector('input');
        const icon = toggle.querySelector('ion-icon');
        const show = input.type === 'password';

        input.type = show ? 'text' : 'password';
        icon.setAttribute('name', show ? 'eye-outline' : 'eye-off-outline');
        toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    };

    toggle.addEventListener('click', togglePassword);
    toggle.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            togglePassword();
        }
    });
});
