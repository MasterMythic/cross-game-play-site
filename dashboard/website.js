(() => {
  const backend = 'https://cross-game-patent-docket.buzmythic.chatgpt.site';
  const tokenKey = 'cgp.docket.owner';
  const sessionPath = '/api/website/session';
  let sessionToken;

  function saveSession(token) {
    sessionToken = token;
    try {
      if (token) sessionStorage.setItem(tokenKey, token);
      else sessionStorage.removeItem(tokenKey);
    } catch {
      // The current page can stay unlocked when browser storage is disabled.
    }
  }

  async function request(path, method, data, token) {
    const headers = {};
    if (data) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    let response;
    try {
      response = await fetch(backend + path, { method, headers, credentials: 'omit', redirect: 'error',
        signal: AbortSignal.timeout(15000),
        ...(data ? { body: JSON.stringify(data) } : {}) });
    } catch {
      throw new Error('Could not reach the docket. Try again in a moment.');
    }
    let result;
    try { result = await response.json(); } catch { throw new Error('The docket could not complete this request.'); }
    if (!response.ok) throw Object.assign(new Error(result.error || 'The docket could not complete this request.'), { status: response.status });
    return result;
  }

  function open() {
    document.querySelector('#website-lock').hidden = true;
    document.querySelector('#website-dashboard').hidden = false;
    document.body.classList.remove('login-page');
    startDashboard();
  }

  function showError(error) {
    const alert = document.querySelector('#login-error');
    alert.textContent = error.message;
    alert.hidden = false;
  }

  function returnToLock() {
    location.reload();
  }

  window.docketWebsite = {
    async lock() {
      const token = sessionToken;
      saveSession();
      const editor = document.querySelector('#record-editor');
      if (editor.open) editor.close();
      document.querySelector('#website-dashboard').hidden = true;
      try {
        if (token) await request(sessionPath, 'DELETE', undefined, token);
      } finally {
        returnToLock();
      }
    },
    async api(path, method, data) {
      try { return await request('/api/website/' + path.slice('/api/'.length), method, data, sessionToken); }
      catch (error) {
        if (error.status === 401) {
          saveSession();
          returnToLock();
        }
        throw error;
      }
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
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
        const { token } = await request('/api/website/login', 'POST', { password: password.value });
        saveSession(token);
        password.value = '';
        open();
      } catch (error) {
        showError(error);
        password.select();
      } finally { unlock.disabled = false; }
    });

    try {
      sessionToken = sessionStorage.getItem(tokenKey);
    } catch {
      // Browser storage is optional for password access.
    }
    if (sessionToken) open();
    form.hidden = false;
  });
})();
