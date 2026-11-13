// ========================================
// Accounts in Decklister: the header's Protect / Log in / Log out, the landing
// page's account section, and what happens when a link is protected.
//
// The account logic and the sign-in dialog are the shared module in ./accounts/
// (server half: src/accounts). This file is only Decklister's use of them.
// ========================================

import * as state from './state.js';
import * as dom from './dom.js';
import * as accounts from './accounts/accounts.js';
import { openAccountDialog } from './accounts/dialog.js';

const LOCKED_TEXT = {
    title: 'This decklist is protected',
    intro: 'Sign in as its owner to open it.',
};
const PROTECT_TEXT = {
    title: 'Protect this decklist',
    intro: 'Only you will be able to open this link, on any device, once signed in. Sign in or create an account to protect it.',
};

/** This page, to come back to after signing in. */
const here = () => location.pathname + location.search;

// Trap focus within a modal element (the share modal uses this)
export function trapFocus(modalOverlay, modalContent) {
    const focusableSelector = 'input, button, a[href], [tabindex]:not([tabindex="-1"])';
    modalOverlay.onkeydown = (e) => {
        if (e.key !== 'Tab') return;
        const focusable = [...modalContent.querySelectorAll(focusableSelector)]
            .filter(el => !el.disabled && el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };
}

/** Back to the landing page without it sending us straight back here. */
function goHome() {
    sessionStorage.setItem('decklister_intentional_home', 'true');
    location.assign('/');
}

// ========================================
// A protected link
// ========================================

/**
 * The link is protected and this browser isn't its owner's session. A browser that
 * last signed in with GAuth goes straight back to GAuth (its session just expired);
 * otherwise, the dialog.
 */
export async function handleLocked({ otherAccount = false, error = null } = {}) {
    if (!otherAccount && !error && accounts.mayAutoSignIn()) {
        accounts.autoSignIn(here());
        return;
    }
    const result = await openAccountDialog({
        mode: 'locked',
        linkId: state.currentUser,
        next: here(),
        otherAccount,
        error,
        text: LOCKED_TEXT,
    });
    if (result.signedIn) location.reload();
    else goHome();
}

// ========================================
// Protecting this link
// ========================================

async function protectThisLink() {
    const id = state.currentUser;
    if (!id || state.isShareMode) return;
    if (state.account.signedIn) {
        try {
            await accounts.protect(id);
        } catch (e) {
            alert(e.message);
            return;
        }
        state.setLinkProtected(true);
        state.setAccount(await accounts.me());
        updateAuthUI();
        return;
    }
    const result = await openAccountDialog({ mode: 'protect', linkId: id, next: here(), text: PROTECT_TEXT });
    if (!result.signedIn) return;
    if (result.error) alert(result.error);
    state.setLinkProtected(!!result.protected);
    state.setAccount(await accounts.me());
    updateAuthUI();
}

/**
 * Back from GAuth, having set off to protect this link (only this tab can have):
 * protect it now.
 */
export async function finishPendingProtect() {
    const id = state.currentUser;
    if (!id || !accounts.takePendingProtect(id) || state.linkProtected || !state.account.signedIn) return;
    try {
        await accounts.protect(id);
        state.setLinkProtected(true);
        state.setAccount(await accounts.me());
    } catch (e) {
        alert(e.message);
    }
}

// ========================================
// Signing in and out
// ========================================

async function logIn() {
    const result = await openAccountDialog({ mode: 'signin', next: here() });
    if (!result.signedIn) return;
    state.setAccount(await accounts.me());
    updateAuthUI();
}

async function logOut() {
    await accounts.signOut();
    // A protected link would only ask to sign in again: don't reopen it from the landing page.
    if (state.linkProtected) localStorage.removeItem('decklister_user_id');
    goHome();
}

// ========================================
// Header
// ========================================

const show = (el, visible, display = 'flex') => {
    if (el) el.style.display = visible ? display : 'none';
};

export function updateAuthUI() {
    const signedIn = !!state.account.signedIn;
    const owned = state.linkProtected;
    const name = signedIn ? state.account.user.name : '';

    show(dom.protectBtn, !owned);
    show(dom.protectedBadge, owned);
    show(dom.loginBtn, !signedIn);
    show(dom.logoutBtn, signedIn);
    show(dom.usernameDisplay, signedIn);
    if (dom.usernameDisplay) dom.usernameDisplay.textContent = name;

    show(dom.mobileProtectBtn, !owned, 'block');
    show(dom.mobileProtectedNote, owned, 'block');
    show(dom.mobileLoginBtn, !signedIn, 'block');
    show(dom.mobileLogoutBtn, signedIn, 'block');
    show(dom.mobileUsernameDisplay, signedIn, 'block');
    if (dom.mobileUsernameDisplay) dom.mobileUsernameDisplay.textContent = signedIn ? `Logged in as ${name}` : '';

    // A protected link doesn't need bookmarking to be found again.
    show(dom.bookmarkWarning, !owned);
}

export function initAuth() {
    for (const btn of [dom.protectBtn, dom.mobileProtectBtn]) if (btn) btn.onclick = protectThisLink;
    for (const btn of [dom.loginBtn, dom.mobileLoginBtn]) if (btn) btn.onclick = logIn;
    for (const btn of [dom.logoutBtn, dom.mobileLogoutBtn, dom.landingLogoutBtn]) if (btn) btn.onclick = logOut;
}

// ========================================
// Landing page
// ========================================

/** A new decklist link: protected straight away for a signed-in account. */
export async function newLink() {
    const id = crypto.randomUUID();
    if (state.account.signedIn) {
        try {
            await accounts.protect(id);
        } catch {
            // Still usable, just not protected; the header offers it again.
        }
    }
    localStorage.setItem('decklister_user_id', id);
    location.assign('/' + id);
}

/** Signed in from the landing page: open the account's decklist, or list them. */
async function openAccountHome() {
    const me = await accounts.me();
    state.setAccount(me);
    if (!me.signedIn) return renderLandingAccount();
    if (me.links.length === 1) return location.assign(me.links[0].path);
    if (me.links.length === 0) return newLink();
    renderLandingAccount();
}

function renderLandingAccount() {
    const me = state.account;
    if (!dom.landingAccount) return;
    dom.landingAccount.hidden = !me.signedIn;
    if (dom.landingLoginBtn) dom.landingLoginBtn.style.display = me.signedIn ? 'none' : '';
    if (!me.signedIn) return;
    dom.landingAccountName.textContent = me.user.name;
    dom.landingLinks.replaceChildren(...me.links.map((link) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = link.path;
        a.className = 'landing-link';
        a.textContent = link.label || 'Untitled decklist';
        const when = document.createElement('span');
        when.className = 'landing-link-date';
        when.textContent = `protected ${new Date(link.protectedAt).toLocaleDateString()}`;
        li.append(a, when);
        return li;
    }));
}

/** The landing page's account part. `error` is a GAuth sign-in that just failed. */
export async function initLandingAccount(error) {
    if (dom.landingLoginBtn) {
        dom.landingLoginBtn.onclick = async () => {
            // Back from GAuth, /?signed-in opens the account's decklist.
            const result = await openAccountDialog({ mode: 'signin', next: '/?signed-in' });
            if (result.signedIn) openAccountHome();
        };
    }
    const params = new URLSearchParams(location.search);
    if (params.has('signed-in')) {
        history.replaceState(null, '', '/');
        return openAccountHome();
    }
    state.setAccount(await accounts.me());
    renderLandingAccount();
    if (error) {
        const result = await openAccountDialog({ mode: 'signin', next: '/?signed-in', error });
        if (result.signedIn) openAccountHome();
    }
}
