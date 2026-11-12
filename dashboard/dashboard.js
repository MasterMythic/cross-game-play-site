const sections = { overview: 'Overview', register: 'Patent register', deadlines: 'Deadlines', ideas: 'Idea lab' };
const filingTypes = ['Foundational utility', 'Utility', 'Continuation', 'Continuation-in-part', 'Divisional', 'Provisional', 'PCT', 'National phase', 'Other'];
const filingStatuses = ['Filed', 'Published', 'Under examination', 'Office action', 'Allowed', 'Granted', 'Abandoned', 'Expired', 'Unverified'];
const ideaTypes = ['Foundational patent', 'CIP candidate', 'Continuation candidate', 'Divisional candidate', 'Undecided'];
const ideaStatuses = ['Exploring', 'Drafting', 'Counsel review', 'Ready to file', 'Filed', 'Parked'];
const tones = { Granted: 'green', Allowed: 'purple', Published: 'blue', Filed: 'blue', 'Under examination': 'blue',
  'Office action': 'amber', Unverified: 'gray', Abandoned: 'gray', Expired: 'gray', Exploring: 'blue',
  Drafting: 'purple', 'Counsel review': 'amber', 'Ready to file': 'green', Parked: 'gray' };
const node = selector => document.querySelector(selector);
const content = node('#content');
const editor = node('#record-editor');
const form = node('#record-form');
const toast = node('#toast');
const website = window.docketWebsite;
const dateParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit', day: '2-digit' });
const longDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const dayMs = 86_400_000;
let records = [];
let loading = true;
let loadError = '';
let editing;
let saving = false;
let toastTimeout;
let returnFocus;
let readOnly = false;
let started = false;
let filters = { search: '', status: '', type: '' };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function activeTab() {
  const value = location.hash.slice(1).split('?')[0];
  return Object.hasOwn(sections, value) ? value : 'overview';
}
function isoToday() {
  const parts = Object.fromEntries(dateParts.formatToParts().map(p => [p.type, p.value]));
  return [parts.year, parts.month, parts.day].join('-');
}
function until(value) {
  return Math.round((Date.parse(value) - Date.parse(isoToday())) / dayMs);
}
function formatDate(value, format = longDate) {
  return value ? format.format(new Date(value + 'T00:00:00Z')) : '—';
}
function status(value) {
  return '<span class="pill" data-tone="' + (tones[value] || 'gray') + '">' + esc(value) + '</span>';
}
function linkButton(text, tab) {
  return '<a class="text-button" href="#' + tab + '">' + esc(text) + ' <span aria-hidden="true">→</span></a>';
}
function rowButton(record, heading, subtitle, aside) {
  return '<li><button class="list-row" type="button" data-edit="' + esc(record.id) + '"><span><strong>' +
    esc(heading) + '</strong><span class="row-sub">' + esc(subtitle) + '</span></span><span class="row-aside">' +
    aside + '<span aria-hidden="true">›</span></span></button></li>';
}
function panel(name, description, action, rows, empty) {
  return '<section class="panel"><header class="panel-header"><div><h2>' + esc(name) + '</h2>' +
    (description ? '<p class="panel-description">' + esc(description) + '</p>' : '') +
    '</div>' + action + '</header>' + (rows ? '<ul class="record-list">' + rows + '</ul>' : '<p class="empty">' + esc(empty) + '</p>') + '</section>';
}
function filings() {
  return records.filter(r => r.kind === 'filing');
}
function ideas() {
  return records.filter(r => r.kind === 'idea');
}
function allDeadlines() {
  return filings().filter(r => r.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline));
}
function stat(icon, label, value, note) {
  return '<div class="stat"><div class="stat-label"><span class="stat-icon" aria-hidden="true">' + icon + '</span>' +
    esc(label) + '</div><div class="stat-value">' + value + '</div><div class="stat-note">' + esc(note) + '</div></div>';
}
function overview() {
  const items = filings();
  const deadlines = allDeadlines();
  const soon = deadlines.filter(r => until(r.deadline) >= 0 && until(r.deadline) <= 90);
  const late = deadlines.filter(r => until(r.deadline) < 0);
  const allowed = items.filter(r => r.status === 'Allowed').length;
  const priorityRank = { Allowed: 0, Granted: 1 };
  const highlights = items.filter(r => r.status !== 'Unverified').sort((a, b) =>
    (priorityRank[a.status] ?? 2) - (priorityRank[b.status] ?? 2) ||
    b.filingDate.localeCompare(a.filingDate)).slice(0, 5);
  const pattern = '<div class="technical-pattern" aria-hidden="true"><i></i><i></i><i></i><i></i></div>';
  const hero = '<section class="hero"><div><p class="eyebrow">CROSS GAME PLAY</p><h1>Patent ' +
    (website ? '<em>portfolio</em>' : 'portfolio') + '</h1><p>' +
    (readOnly ? 'Browse the published applications and granted patents.' : 'Track filings, prosecution deadlines and new inventions.') + '</p></div>' + pattern + '</section>';
  const stats = '<section class="stats" aria-label="Portfolio totals">' +
    stat('▤', readOnly ? 'Published filings' : 'Verified filings', items.filter(r => r.status !== 'Unverified').length, 'Applications and issued patents') +
    stat('✓', 'Granted', items.filter(r => r.status === 'Granted').length, readOnly ? 'Issued patents' : allowed + ' allowed, awaiting issue') +
    (readOnly ? '' :
    stat('◇', 'Invention ideas', ideas().length, 'Foundational ideas and follow-ons') +
    stat('◷', 'Upcoming deadlines', soon.length, late.length ? late.length + ' past due' : 'Next 90 days')) + '</section>';
  const recent = panel('Portfolio highlights', '', linkButton('View register', 'register'), highlights.map(r =>
    rowButton(r, r.name, r.title, status(r.status))).join(''), 'Add a filing to start your register.');
  if (readOnly) return hero + stats + recent;
  const verification = items.filter(r => r.status === 'Unverified');
  const unverified = panel('Needs verification', '', linkButton('See matters', 'register?unverified'), verification.slice(0, 3).map(r =>
    rowButton(r, r.name, r.title, '')).join(''), 'Every tracked filing has a verified status.');
  const calendar = panel('Docket deadlines', '', linkButton('All dates', 'deadlines'), [...late, ...deadlines.filter(r => until(r.deadline) >= 0)].slice(0, 4).map(r =>
    rowButton(r, r.deadlineLabel || 'Deadline', r.name, '<span class="date-line">' + formatDate(r.deadline, shortDate) + '</span>')).join(''), 'Add a next deadline to any matter.');
  return hero + stats + '<div class="overview-grid"><div class="stack">' + recent + '</div><div class="stack">' + calendar + unverified + '</div></div>';
}
function pageHeading(title, description) {
  return '<header class="page-heading"><h1>' + esc(title) + '</h1><p>' + esc(description) + '</p></header>';
}
function options(values, current, placeholder = '') {
  const entries = placeholder ? [['', placeholder], ...values.map(v => [v, v])] : values.map(v => [v, v]);
  return entries.map(([value, label]) => '<option value="' + esc(value) + '"' + (value === current ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
}
function register() {
  return pageHeading('Patent register', readOnly ? 'Search published applications and grants.' : 'Search and edit applications, continuations, CIPs and provisionals.') +
    '<section class="panel"><div class="filters"><div class="filter-search"><label for="filter-search" class="sr-only">Search the register</label><input type="search" id="filter-search" placeholder="Search by title, docket or serial number" value="' + esc(filters.search) + '"></div>' +
    '<label class="sr-only" for="filter-status">Status</label><select id="filter-status">' + options(readOnly ? ['Published', 'Granted'] : filingStatuses, filters.status, 'All statuses') + '</select>' +
    '<label class="sr-only" for="filter-type">Filing type</label><select id="filter-type">' + options(filingTypes, filters.type, 'All filing types') + '</select>' +
    '<button class="button secondary" data-action="reset" type="button">Clear</button></div>' +
    '<div class="table-scroll" role="region" tabindex="0" aria-label="Patent register results"><table><thead><tr><th scope="col">Matter</th><th scope="col">Application / publication</th><th scope="col">Type</th><th scope="col">Filed</th><th scope="col">Status</th></tr></thead><tbody id="filing-rows"></tbody></table></div><p class="table-caption" id="result-count" aria-live="polite"></p></section>';
}
function renderRegisterRows() {
  const term = filters.search.trim().toLowerCase();
  const matching = filings().filter(r =>
    (!filters.status || r.status === filters.status) && (!filters.type || r.type === filters.type) &&
    (!term || [r.name, r.title, r.serial, r.publication, r.docket, r.counsel, r.notes].some(value => value?.toLowerCase().includes(term))));
  matching.sort((a, b) => (a.status === 'Unverified') - (b.status === 'Unverified') ||
    (a.filingDate || '9999').localeCompare(b.filingDate || '9999') || a.name.localeCompare(b.name));
  node('#filing-rows').innerHTML = matching.length ? matching.map(r => '<tr><td><button class="matter-link" type="button" data-edit="' + esc(r.id) + '">' +
    esc(r.name) + '</button><span class="row-sub">' + esc(r.title) + '</span></td><td><span class="mono">' + esc(r.serial || '—') +
    '</span>' + (r.publication ? '<span class="row-sub mono">' + esc(r.publication) + '</span>' : '') + '</td><td>' + esc(r.type) +
    '</td><td><time datetime="' + esc(r.filingDate) + '">' + formatDate(r.filingDate) + '</time></td><td>' + status(r.status) + '</td></tr>').join('') :
    '<tr><td colspan="5"><p class="empty">No filings match your filters.</p></td></tr>';
  node('#result-count').textContent = matching.length + ' of ' + filings().length + ' tracked matters';
}
function deadlinesPage() {
  const entries = allDeadlines();
  const cards = entries.map(r => {
    const days = until(r.deadline);
    const countdown = days < 0 ? 'Past due' : days === 0 ? 'Due today' : days + (days === 1 ? ' day' : ' days');
    const tone = days < 0 ? 'red' : days <= 30 ? 'amber' : 'blue';
    const date = new Date(r.deadline + 'T00:00:00Z');
    const month = date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
    return '<button class="panel deadline-card" type="button" data-edit="' + esc(r.id) + '"><time class="calendar-date" datetime="' +
      esc(r.deadline) + '"><b>' + date.getUTCDate() + '</b><span>' + month + '</span></time><span><strong>' + esc(r.deadlineLabel || 'Docket deadline') +
      '</strong><span class="row-sub">' + esc(r.name) + ' · ' + formatDate(r.deadline) + '</span></span><span class="pill" data-tone="' +
      tone + '">' + countdown + '</span></button>';
  }).join('');
  return pageHeading('Deadlines', 'Review the next docketed action for each matter. Open a deadline to update it.') +
    (cards ? '<div class="deadline-list">' + cards + '</div>' : '<section class="panel"><p class="empty">There are no dates on the docket yet.</p></section>');
}
function ideaPage() {
  const items = ideas();
  const card = (title, prompt, action) => '<section class="panel idea-template"><h2>' + esc(title) + '</h2><p>' + esc(prompt) + '</p><button class="text-button" type="button" data-action="' + action + '">Start an idea <span aria-hidden="true">→</span></button></section>';
  const template = '<div class="idea-intro">' +
    card('Foundational patent', 'Describe the technical problem, your mechanism and what you need to verify.', 'new-foundational') +
    card('Continuation-in-part', 'Link a parent case and identify the material you would add to its disclosure.', 'new-cip') + '</div>';
  const grid = items.map(r => '<button class="panel idea-card" type="button" data-edit="' + esc(r.id) + '"><span class="idea-type">' + esc(r.type) +
    '</span><h2>' + esc(r.title) + '</h2>' + status(r.status) + '<p>' + esc((r.problem || r.mechanism || '').slice(0, 190)) +
    '</p>' + (r.parent ? '<span class="row-sub">Related case · ' + esc(r.parent) + '</span>' : '') + '</button>').join('');
  return pageHeading('Idea lab', 'Develop invention ideas and decide what to take to counsel.') + template +
    (grid ? '<div class="idea-grid">' + grid + '</div>' : '<section class="panel"><p class="empty">Your saved ideas will appear here.</p></section>');
}
function render() {
  if (!started) return;
  const tab = activeTab();
  node('#section-name').textContent = sections[tab];
  const create = node('#top-create');
  create.dataset.action = tab === 'ideas' ? 'new-idea' : 'new-filing';
  create.innerHTML = '<span aria-hidden="true">＋</span> ' + (tab === 'ideas' ? 'New idea' : 'Add filing');
  document.querySelectorAll('nav a[data-tab]').forEach(a => {
    a.setAttribute('aria-label', sections[a.dataset.tab]);
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (loading) return;
  if (loadError) {
    content.innerHTML = '<section class="panel"><p class="empty" role="alert">' + esc(loadError) + ' <button class="text-button" data-action="retry" type="button">Retry</button></p></section>';
    return;
  }
  if (readOnly && (tab === 'deadlines' || tab === 'ideas')) {
    content.innerHTML = pageHeading(sections[tab], 'Open the owner workspace to use this section.') +
      '<section class="panel"><p class="empty"><button class="button primary" type="button" data-action="owner-connect">Owner sign-in</button></p></section>';
    return;
  }
  const page = { overview, register, deadlines: deadlinesPage, ideas: ideaPage };
  content.innerHTML = page[tab]();
  if (tab === 'register') renderRegisterRows();
}
async function api(path, method = 'GET', data) {
  if (website) return website.api(path, method, data);
  const response = await fetch(path, { method, ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}) });
  if (response.status === 401) {
    window.location.replace('/');
    throw new Error('The docket was locked.');
  }
  let payload;
  try { payload = await response.json(); } catch { throw new Error('The docket could not complete this request.'); }
  if (!response.ok) throw new Error(payload.error || 'The docket could not complete this request.');
  return payload;
}
async function refresh() {
  try {
    const result = await api('/api/records');
    records = result.records;
    loadError = '';
  } catch (error) {
    loadError = error.message;
  } finally {
    loading = false;
    render();
  }
}
function control(record, key, label, config = {}) {
  const { values, format = 'text', full = false, required = false, help = '', placeholder = '', max = 180 } = config;
  const id = 'field-' + key;
  const value = record[key] || '';
  const desc = help ? ' aria-describedby="' + id + '-help"' : '';
  const must = required ? ' required' : '';
  const attributes = ' id="' + id + '" name="' + key + '"' + desc + must;
  let element;
  if (values) element = '<select' + attributes + '>' + options(values, value) + '</select>';
  else if (format === 'textarea') element = '<textarea' + attributes + ' maxlength="' + max + '" rows="3" placeholder="' + esc(placeholder) + '">' + esc(value) + '</textarea>';
  else element = '<input type="' + format + '"' + attributes + ' value="' + esc(value) + '" maxlength="' + max + '" placeholder="' + esc(placeholder) + '">';
  return '<div class="field' + (full ? ' full' : '') + '"><label for="' + id + '">' + esc(label) + (required ? ' *' : '') + '</label>' +
    element + (help ? '<small id="' + id + '-help">' + esc(help) + '</small>' : '') + '</div>';
}
function openEditor(record) {
  editing = record;
  returnFocus = document.activeElement;
  const isFiling = record.kind === 'filing';
  const editingExisting = Boolean(record.id);
  node('#editor-kind').textContent = isFiling ? 'Filing record' : 'Invention idea';
  node('#editor-title').textContent = editingExisting ? (record.name || record.title) : (isFiling ? 'Add filing' : 'New idea');
  const meta = node('#editor-meta');
  meta.textContent = record.serial ? 'Application ' + record.serial : '';
  meta.hidden = !meta.textContent;
  if (readOnly) {
    node('#editor-body').innerHTML = '<div class="field full"><strong>' + esc(record.title) + '</strong><p>' +
      esc(record.type) + ' · ' + formatDate(record.filingDate) + '</p>' + status(record.status) +
      '<a class="text-button" href="https://patents.google.com/patent/' + encodeURIComponent(record.publication) + '/en" target="_blank" rel="noopener noreferrer">' +
      esc(record.publication) + ' ↗</a></div>';
    editor.showModal();
    return;
  }
  node('#save-record').textContent = isFiling ? 'Save filing' : 'Save idea';
  const c = (key, label, options) => control(record, key, label, options);
  let fields = c('title', isFiling ? 'Short title' : 'Working title', { required: true, full: true });
  if (isFiling) {
    fields = c('name', 'Matter name', { required: true, full: true, max: 150, placeholder: 'e.g. CGP01 CIP-E' }) + fields +
      c('type', 'Filing type', { values: filingTypes, required: true }) +
      c('status', 'Status', { values: filingStatuses, required: true }) +
      c('serial', 'Application number', { max: 90 }) + c('publication', 'Publication or grant number', { max: 90 }) +
      c('filingDate', 'Filing date', { format: 'date' }) + c('jurisdiction', 'Jurisdiction', { max: 65 }) +
      c('counsel', 'Counsel', { max: 220 }) + c('docket', 'Counsel docket') +
      c('parent', 'Parent application number', { full: true }) +
      c('deadline', 'Next deadline', { format: 'date' }) + c('deadlineLabel', 'Deadline action', { max: 140, placeholder: 'e.g. Issue fee' });
  } else {
    fields += c('type', 'Filing approach', { values: ideaTypes, required: true }) +
      c('status', 'Status', { values: ideaStatuses, required: true }) +
      c('parent', 'Parent or related application', { full: true, help: 'Use the application number if there is a parent case.' }) +
      c('problem', 'Technical problem', { format: 'textarea', full: true, max: 4000, placeholder: 'What fails today, and under what conditions?' }) +
      c('mechanism', 'Proposed mechanism or new matter', { format: 'textarea', full: true, max: 7000, placeholder: 'Describe how it works and what you would add to any existing disclosure.' }) +
      c('nextAction', 'Next action', { format: 'textarea', full: true, max: 2000 });
  }
  fields += c('notes', 'Notes', { format: 'textarea', full: true, max: 12000 }) +
    c('source', 'Source or reference URL', { format: 'url', full: true, max: 2000, placeholder: 'https://…' });
  if (record.source && /^https?:\/\//i.test(record.source)) {
    fields += '<p class="editor-source"><a class="text-button" href="' + esc(record.source) + '" target="_blank" rel="noopener noreferrer">Open source ↗</a></p>';
  }
  node('#editor-body').innerHTML = fields;
  node('#editor-error').hidden = true;
  editor.showModal();
  form.querySelector('input').focus();
}
function newFiling() {
  openEditor({ kind: 'filing', type: 'Utility', status: 'Filed', jurisdiction: 'US' });
}
function newIdea(type = 'Undecided') {
  openEditor({ kind: 'idea', type, status: 'Exploring' });
}
function notify(message) {
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.hidden = false;
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 4200);
}
function findRecord() {
  if (activeTab() !== 'register') location.hash = 'register';
  setTimeout(() => node('#filter-search')?.focus(), 60);
}
function useLocationFilters() {
  if (location.hash === '#register?unverified') {
    filters = { search: '', status: 'Unverified', type: '' };
    history.replaceState(null, '', '#register');
  }
}
window.addEventListener('hashchange', () => {
  useLocationFilters();
  render();
  window.scrollTo(0, 0);
});
document.addEventListener('keydown', event => {
  if (started && event.key === '/' && !editor.open && !event.ctrlKey && !event.metaKey &&
    !event.target.closest('input, textarea, select, [contenteditable]')) {
    event.preventDefault();
    findRecord();
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'filter-search') {
    filters.search = event.target.value;
    renderRegisterRows();
  }
});
document.addEventListener('change', event => {
  const key = { 'filter-status': 'status', 'filter-type': 'type' }[event.target.id];
  if (key) {
    filters[key] = event.target.value;
    renderRegisterRows();
  }
});
document.addEventListener('click', async event => {
  const trigger = event.target.closest('button');
  if (!trigger) return;
  if (trigger.dataset.action === 'owner-connect') {
    await website.connect();
    return;
  }
  if (!started) return;
  if (trigger.dataset.edit) {
    const record = records.find(r => r.id === trigger.dataset.edit);
    if (record) openEditor(record);
    return;
  }
  switch (trigger.dataset.action) {
    case 'new-filing': if (!readOnly) newFiling(); break;
    case 'new-idea': if (!readOnly) newIdea(); break;
    case 'new-foundational': if (!readOnly) newIdea('Foundational patent'); break;
    case 'new-cip': if (!readOnly) newIdea('CIP candidate'); break;
    case 'search': findRecord(); break;
    case 'close': if (!saving) editor.close(); break;
    case 'retry': await refresh(); break;
    case 'reset': filters = { search: '', status: '', type: '' }; render(); node('#filter-search').focus(); break;
    case 'logout':
      try {
        if (website) {
          await website.lock();
          break;
        }
        await api('/api/logout', 'POST');
        location.replace('/');
      } catch (error) {
        notify(error.message);
      }
      break;
  }
});
editor.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
editor.addEventListener('close', () => { if (returnFocus?.isConnected) returnFocus.focus(); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (readOnly || saving || !form.reportValidity()) return;
  const draft = Object.fromEntries(new FormData(form));
  const submit = node('#save-record');
  const message = node('#editor-error');
  submit.disabled = true;
  saving = true;
  message.hidden = true;
  try {
    const original = editing;
    const result = original.id ?
      await api('/api/records/' + encodeURIComponent(original.id), 'PATCH', { ...draft, revision: original.revision }) :
      await api('/api/records', 'POST', { ...draft, kind: original.kind });
    records = original.id ? records.map(r => r.id === original.id ? result.record : r) : [...records, result.record];
    editor.close();
    render();
    notify(original.kind === 'filing' ? 'Filing saved.' : 'Idea saved.');
  } catch (error) {
    message.textContent = error.message;
    message.hidden = false;
  } finally {
    saving = false;
    submit.disabled = false;
  }
});
function startDashboard(guestRecords) {
  started = true;
  readOnly = Boolean(guestRecords);
  if (readOnly) {
    records = guestRecords;
    loading = false;
    node('#top-create').hidden = true;
    node('#save-record').hidden = true;
    editor.querySelector('.editor-actions [data-action=close]').textContent = 'Close';
    node('.private-status').lastChild.textContent = 'Guest access';
  }
  useLocationFilters();
  render();
  if (!readOnly) refresh();
}

if (!website) startDashboard();
