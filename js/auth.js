// ========================================
// Authentication UI Module
// ========================================

import * as state from './state.js';
import * as dom from './dom.js';
import { register, login, logout } from './api.js';

// ========================================
// Auth Modal Functions
// ========================================

// Show auth modal
export function showAuthModal(mode = 'login') {
    if (!dom.authModal) return;

    dom.authModal.classList.add('open');
    setAuthMode(mode);
    clearAuthError();
    clearAuthForm();

    // Focus username field
    if (dom.authUsernameInput) {
        setTimeout(() => dom.authUsernameInput.focus(), 100);
    }
}

// Hide auth modal
export function hideAuthModal() {
    if (!dom.authModal) return;
    dom.authModal.classList.remove('open');
    clearAuthError();
    clearAuthForm();
}

// Set auth mode (login or register)
export function setAuthMode(mode) {
    if (!dom.authModal) return;

    const isRegister = mode === 'register';
    dom.authModal.dataset.mode = mode;

    if (dom.authModalTitle) {
        dom.authModalTitle.textContent = isRegister ? 'Create Account' : 'Login';
    }
    if (dom.authSubmitBtn) {
        dom.authSubmitBtn.textContent = isRegister ? 'Create Account' : 'Login';
    }
    if (dom.authToggleText) {
        dom.authToggleText.innerHTML = isRegister
            ? 'Already have an account? <a href="#" class="auth-toggle-link">Login</a>'
            : 'Need an account? <a href="#" class="auth-toggle-link">Create one</a>';
    }
}

// Toggle between login and register modes
export function toggleAuthMode() {
    if (!dom.authModal) return;
    const currentMode = dom.authModal.dataset.mode || 'login';
    setAuthMode(currentMode === 'login' ? 'register' : 'login');
    clearAuthError();
}

// Show auth error message
export function showAuthError(message) {
    if (!dom.authError) return;
    dom.authError.textContent = message;
    dom.authError.style.display = 'block';
}

// Clear auth error message
export function clearAuthError() {
    if (!dom.authError) return;
    dom.authError.textContent = '';
    dom.authError.style.display = 'none';
}

// Clear auth form inputs
export function clearAuthForm() {
    if (dom.authUsernameInput) dom.authUsernameInput.value = '';
    if (dom.authPasswordInput) dom.authPasswordInput.value = '';
}

// ========================================
// Auth Form Handlers
// ========================================

// Handle auth form submission
export async function handleAuthSubmit(e) {
    if (e) e.preventDefault();

    const username = dom.authUsernameInput?.value?.trim();
    const password = dom.authPasswordInput?.value;

    if (!username || !password) {
        showAuthError('Please enter username and password');
        return;
    }

    const mode = dom.authModal?.dataset.mode || 'login';
    const submitBtn = dom.authSubmitBtn;

    // Disable button during request
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = mode === 'register' ? 'Creating...' : 'Logging in...';
    }

    try {
        if (mode === 'register') {
            // Register with current UUID
            await register(username, password, state.currentUser);
            hideAuthModal();
            updateAuthUI();
        } else {
            // Login
            const result = await login(username, password);
            hideAuthModal();

            // Check if we have a redirect param
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUUID = urlParams.get('redirect');

            if (redirectUUID && result.uuid === redirectUUID) {
                // Redirect to the protected decklist
                window.location.href = `/${redirectUUID}`;
            } else if (result.uuid) {
                // Redirect to user's decklist
                window.location.href = `/${result.uuid}`;
            } else {
                updateAuthUI();
            }
        }
    } catch (err) {
        showAuthError(err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = mode === 'register' ? 'Create Account' : 'Login';
        }
    }
}

// Handle logout
export function handleLogout() {
    logout();
    updateAuthUI();
    // Redirect to landing page
    window.location.href = '/';
}

// ========================================
// Auth UI Updates
// ========================================

// Update auth-related UI elements
export function updateAuthUI() {
    const isAuth = state.isAuthenticated;
    const username = state.currentUsername;

    // Update header buttons
    if (dom.createAccountBtn) {
        dom.createAccountBtn.style.display = isAuth ? 'none' : 'flex';
    }
    if (dom.loginBtn) {
        dom.loginBtn.style.display = isAuth ? 'none' : 'flex';
    }
    if (dom.logoutBtn) {
        dom.logoutBtn.style.display = isAuth ? 'flex' : 'none';
    }
    if (dom.usernameDisplay) {
        dom.usernameDisplay.style.display = isAuth ? 'flex' : 'none';
        dom.usernameDisplay.textContent = username || '';
    }

    // Update mobile header buttons
    if (dom.mobileCreateAccountBtn) {
        dom.mobileCreateAccountBtn.style.display = isAuth ? 'none' : 'block';
    }
    if (dom.mobileLoginBtn) {
        dom.mobileLoginBtn.style.display = isAuth ? 'none' : 'block';
    }
    if (dom.mobileLogoutBtn) {
        dom.mobileLogoutBtn.style.display = isAuth ? 'block' : 'none';
    }
    if (dom.mobileUsernameDisplay) {
        dom.mobileUsernameDisplay.style.display = isAuth ? 'block' : 'none';
        dom.mobileUsernameDisplay.textContent = username ? `Logged in as ${username}` : '';
    }

    // Hide bookmark warning if authenticated
    if (dom.bookmarkWarning) {
        dom.bookmarkWarning.style.display = isAuth ? 'none' : 'flex';
    }
}

// ========================================
// Initialization
// ========================================

export function initAuth() {
    // Auth modal close button
    if (dom.authModalClose) {
        dom.authModalClose.onclick = hideAuthModal;
    }

    // Auth modal backdrop click
    if (dom.authModal) {
        dom.authModal.onclick = (e) => {
            if (e.target === dom.authModal) {
                hideAuthModal();
            }
        };
    }

    // Auth form submission
    if (dom.authForm) {
        dom.authForm.onsubmit = handleAuthSubmit;
    }

    // Auth mode toggle
    if (dom.authToggleText) {
        dom.authToggleText.onclick = (e) => {
            if (e.target.classList.contains('auth-toggle-link')) {
                e.preventDefault();
                toggleAuthMode();
            }
        };
    }

    // Desktop header buttons
    if (dom.createAccountBtn) {
        dom.createAccountBtn.onclick = () => showAuthModal('register');
    }
    if (dom.loginBtn) {
        dom.loginBtn.onclick = () => showAuthModal('login');
    }
    if (dom.logoutBtn) {
        dom.logoutBtn.onclick = handleLogout;
    }

    // Mobile header buttons
    if (dom.mobileCreateAccountBtn) {
        dom.mobileCreateAccountBtn.onclick = () => showAuthModal('register');
    }
    if (dom.mobileLoginBtn) {
        dom.mobileLoginBtn.onclick = () => showAuthModal('login');
    }
    if (dom.mobileLogoutBtn) {
        dom.mobileLogoutBtn.onclick = handleLogout;
    }

    // Landing page login button
    if (dom.landingLoginBtn) {
        dom.landingLoginBtn.onclick = () => showAuthModal('login');
    }

    // Initial UI update
    updateAuthUI();
}
