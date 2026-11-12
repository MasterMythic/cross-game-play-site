(() => {
  const backend = 'https://cross-game-patent-docket.buzmythic.chatgpt.site';
  const verifierKey = 'cgp.docket.verifier';
  const tokenKey = 'cgp.docket.owner';
  const dashboardPath = '/dashboard/';
  const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  let ownerToken;

  async function request(path, method, data, token) {
    const headers = {};
    if (data) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    let response;
    try {
      response = await fetch(backend + path, { method, headers, credentials: 'omit', redirect: 'error',
        ...(data ? { body: JSON.stringify(data) } : {}) });
    } catch {
      throw new Error('Could not reach the docket. Try again in a moment.');
    }
    let result;
    try { result = await response.json(); } catch { throw new Error('The docket could not complete this request.'); }
    if (!response.ok) throw Object.assign(new Error(result.error || 'The docket could not complete this request.'), { status: response.status });
    return result;
  }

  function open(records) {
    document.querySelector('#website-lock').hidden = true;
    document.querySelector('#website-dashboard').hidden = false;
    document.body.classList.remove('login-page');
    startDashboard(records);
  }

  function showError(error) {
    const alert = document.querySelector('#login-error');
    alert.textContent = error.message;
    alert.hidden = false;
  }

  function returnToLock(fragment = '') {
    history.replaceState(null, '', dashboardPath + fragment);
    location.reload();
  }

  window.docketWebsite = {
    async connect() {
      try {
        const verifier = hex(crypto.getRandomValues(new Uint8Array(32)));
        const challenge = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
        sessionStorage.setItem(verifierKey, verifier);
        const url = new URL('/connect-dashboard', backend);
        url.search = new URLSearchParams({ site: location.origin, challenge });
        location.assign(url);
      } catch {
        if (document.querySelector('#website-lock').hidden) {
          returnToLock('#owner-unavailable');
        } else showError(new Error('Enable browser session storage to sign in as owner.'));
      }
    },
    async lock() {
      const token = ownerToken;
      try {
        if (token) {
          sessionStorage.removeItem(tokenKey);
          await request('/api/website/session', 'DELETE', undefined, token);
        }
      } finally {
        ownerToken = undefined;
        returnToLock();
      }
    },
    async api(path, method, data) {
      try { return await request('/api/website/' + path.slice('/api/'.length), method, data, ownerToken); }
      catch (error) {
        if (error.status === 401) {
          sessionStorage.removeItem(tokenKey);
          returnToLock('#owner-expired');
        }
        throw error;
      }
    },
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const form = document.querySelector('#unlock-form');
    const password = document.querySelector('#password');
    const toggle = document.querySelector('#show-password');
    const unlock = form.querySelector('[type=submit]');
    toggle.addEventListener('click', () => {
      const show = password.type === 'password';
      password.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Hide' : 'Show';
      toggle.setAttribute('aria-pressed', String(show));
      password.focus();
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      unlock.disabled = true;
      document.querySelector('#login-error').hidden = true;
      try {
        const { filings } = await request('/api/guest/filings', 'POST', { password: password.value });
        password.value = '';
        open(filings.map(record => ({ ...record, id: record.publication, kind: 'filing',
          status: /B[12]$/.test(record.publication) ? 'Granted' : 'Published' })));
      } catch (error) {
        showError(error);
        password.select();
      } finally { unlock.disabled = false; }
    });

    const fragment = location.hash.slice(1);
    if (fragment.startsWith('owner-')) history.replaceState(null, '', dashboardPath);
    try {
      if (fragment.startsWith('owner-code=')) {
        const verifier = sessionStorage.getItem(verifierKey);
        sessionStorage.removeItem(verifierKey);
        const { token } = await request('/api/website/session', 'POST', { code: fragment.slice('owner-code='.length), verifier });
        sessionStorage.setItem(tokenKey, token);
      }
      ownerToken = sessionStorage.getItem(tokenKey);
      if (ownerToken) open();
      else if (fragment === 'owner-denied') showError(new Error('Sign in with the ChatGPT account that owns the docket.'));
      else if (fragment === 'owner-expired') showError(new Error('Your owner session expired. Sign in again.'));
      else if (fragment === 'owner-unavailable') showError(new Error('Enable browser session storage to sign in as owner.'));
    } catch (error) {
      if (fragment.startsWith('owner-')) showError(error);
    } finally { form.hidden = false; }
  });
})();
