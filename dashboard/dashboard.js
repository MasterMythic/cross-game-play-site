const endpoint = 'https://cross-game-patent-docket.buzmythic.chatgpt.site/api/guest/filings';
const form = document.querySelector('#unlock-form');
const password = document.querySelector('#password');
const unlock = form.querySelector('button');
const errorMessage = document.querySelector('#unlock-error');
const locked = document.querySelector('#guest-lock');
const register = document.querySelector('#guest-register');
const search = document.querySelector('#filing-search');
const count = document.querySelector('#filing-count');
const list = document.querySelector('#filings');
let filings = [];

function renderFilings() {
  const query = search.value.trim().toLowerCase();
  const matches = filings.filter(filing => Object.values(filing).join(' ').toLowerCase().includes(query));
  count.textContent = `${matches.length} ${matches.length === 1 ? 'filing' : 'filings'}`;
  list.replaceChildren(...matches.map(filing => {
    const row = document.createElement('li');
    const details = document.createElement('div');
    const name = document.createElement('p');
    name.className = 'filing-name mono';
    name.textContent = [filing.name, filing.type, filing.serial, filing.filingDate].filter(Boolean).join(' · ');
    const title = document.createElement('p');
    title.className = 'filing-title';
    title.textContent = filing.title;
    details.append(name, title);
    const link = document.createElement('a');
    link.className = 'mono';
    link.href = 'https://patents.google.com/patent/' + encodeURIComponent(filing.publication) + '/en';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = filing.publication + ' ↗';
    row.append(details, link);
    return row;
  }));
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  unlock.disabled = true;
  errorMessage.hidden = true;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value }),
    });
    const result = await response.json();
    if (!response.ok) {
      errorMessage.textContent = result.error || 'Could not unlock the dashboard.';
      errorMessage.hidden = false;
      password.select();
      return;
    }
    filings = result.filings.sort((left, right) => right.filingDate.localeCompare(left.filingDate));
    password.value = '';
    renderFilings();
    locked.hidden = true;
    register.hidden = false;
    document.querySelector('#register-heading').focus();
  } catch {
    errorMessage.textContent = 'Could not reach the docket. Try again in a moment.';
    errorMessage.hidden = false;
  } finally {
    unlock.disabled = false;
  }
});

search.addEventListener('input', renderFilings);
document.querySelector('#lock-register').addEventListener('click', () => {
  filings = [];
  search.value = '';
  renderFilings();
  register.hidden = true;
  locked.hidden = false;
  password.focus();
});

form.hidden = false;
