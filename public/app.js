
/* =========================================
   FOOTBALL WORLD
   ONE WORLD. ONE GAME.
   Main Application
========================================= */

const $ = s => document.querySelector(s);

const API_BASE = 'https://manchester-is-red-1.onrender.com/api';

let lang = localStorage.getItem('mir-lang') || 'my';
let stories = [];
let saved = JSON.parse(localStorage.getItem('mir-saved') || '[]');
let followedTeams = JSON.parse(localStorage.getItem('fw-following') || '[]');

let allMatches = [];
let selectedDate = null;
let scoreRefreshBusy = false;

const demoStories = [
  {
    id: 'official-news',
    category: 'official',
    title: 'Official football news',
    my: 'တရားဝင်ဘောလုံးသတင်းများ',
    desc: 'Official club announcements and football news.',
    mydesc: 'ကလပ်အသင်းများ၏ တရားဝင်ကြေညာချက်များနှင့် ဘောလုံးသတင်းများ။',
    source: 'Official Football News',
    url: 'https://www.fifa.com/'
  }
];


/* =========================================
   LANGUAGE
========================================= */

function t(my, en) {
  return lang === 'my' ? my : en;
}

function setLang(v) {
  lang = v;

  localStorage.setItem('mir-lang', v);
  document.documentElement.lang = v;

  document.querySelectorAll('[data-my][data-en]').forEach(e => {
    e.textContent = e.dataset[v];
  });

  const langBtn = $('#langBtn');

  if (langBtn) {
    langBtn.textContent = v === 'my' ? 'EN' : 'မြန်မာ';
  }

  renderStories();
  renderSaved();
  renderFollowing();
}

if ($('#langBtn')) {
  $('#langBtn').addEventListener('click', () => {
    setLang(lang === 'my' ? 'en' : 'my');
  });
}


/* =========================================
   HELPERS
========================================= */

function esc(v = '') {
  return String(v).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function safeUrl(u) {
  try {
    const x = new URL(u);

    return x.protocol === 'https:' ? x.href : '#';

  } catch {
    return '#';
  }
}

function label(c) {
  return c === 'official'
    ? 'OFFICIAL'
    : c === 'reported'
      ? 'REPORTED'
      : 'RUMOUR';
}

function stamp() {
  const el = $('#lastChecked');

  if (!el) return;

  const d = new Date();

  el.textContent = d.toLocaleString();
  el.title = d.toISOString();
}

function localClock() {
  const el = $('#localTime');

  if (el) {
    const d = new Date();

    el.textContent = d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  setTimeout(localClock, 30000);
}


/* =========================================
   NEWS
========================================= */

function card(s) {
  const date = s.pubDate
    ? new Date(s.pubDate).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Yangon'
      }) + ' (MMT)'
    : '';

  const isSaved = saved.some(x => String(x.id) === String(s.id));

  return `
    <article class="story">

      <div class="story-top">
        <span class="tag ${esc(s.category)}">
          ${label(s.category)}
        </span>

        <span class="small muted">
          ${esc(s.source || 'Source')}
        </span>
      </div>

      <h3>${esc(lang === 'my' ? (s.my || s.title) : s.title)}</h3>

      <p>
        ${esc(lang === 'my'
          ? (s.mydesc || s.desc || '')
          : (s.desc || ''))}
      </p>

      <div class="small muted">
        ${esc(date)}
      </div>

      <div class="story-foot">

        <a href="${safeUrl(s.url)}"
           target="_blank"
           rel="noopener noreferrer">
          OPEN SOURCE ↗
        </a>

        <button class="save" data-save="${esc(s.id)}">
          ${isSaved ? '★ SAVED' : '☆ SAVE'}
        </button>

      </div>
    </article>
  `;
}


function renderStories() {
  const list = $('#newsList');

  if (!list) return;

  const search = ($('#newsSearch')?.value || '').toLowerCase();
  const filter = $('#newsFilter')?.value || 'all';

  const filtered = stories.filter(s => {
    const matchesFilter =
      filter === 'all' || s.category === filter;

    const text = `
      ${s.title}
      ${s.my || ''}
      ${s.desc || ''}
      ${s.mydesc || ''}
      ${s.source || ''}
    `.toLowerCase();

    return matchesFilter && text.includes(search);
  });

  list.innerHTML = filtered.length
    ? filtered.map(card).join('')
    : '<div class="empty">No matching stories / သတင်းမတွေ့ပါ။</div>';
}


async function loadOfficialNews() {
  const list = $('#newsList');

  if (list) {
    list.innerHTML =
      '<div class="empty">ဘောလုံးသတင်းများ ရယူနေသည်... / Loading news...</div>';
  }

  try {
    const r = await fetch(API_BASE + '/news', {
      cache: 'no-store'
    });

    if (!r.ok) {
      throw Error('News API: ' + r.status);
    }

    const j = await r.json();

    if (j.mode !== 'live' || !Array.isArray(j.news)) {
      throw Error('News unavailable');
    }

    stories = j.news.map(n => ({
      id: n.id,
      category: 'official',
      title: n.title,
      my: n.myTitle || n.title,
      desc: n.description || '',
      mydesc: n.myDescription || n.description || '',
      source: n.source || 'Football News',
      url: n.link,
      pubDate: n.pubDate
    }));

    renderStories();
    renderSaved();

  } catch (e) {
    console.error('News loading error:', e);

    if (list) {
      list.innerHTML =
        '<div class="empty">သတင်းရယူမှု မအောင်မြင်ပါ။ ခဏနေ ပြန်စမ်းကြည့်ပါ။ / News unavailable.</div>';
    }
  }
}


if ($('#newsSearch')) {
  $('#newsSearch').addEventListener('input', renderStories);
}

if ($('#newsFilter')) {
  $('#newsFilter').addEventListener('change', renderStories);
}


/* =========================================
   MATCH DATE HELPERS
========================================= */

function getMatchDate(value) {
  if (!value) return null;

  const match = String(value).match(
    /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),\s+(\d{2}):(\d{2})\s+UTC$/
  );

  if (!match) return null;

  const months = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3,
    May: 4, Jun: 5, Jul: 6, Aug: 7,
    Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };

  const month = months[match[2]];

  if (month === undefined) return null;

  return new Date(Date.UTC(
    Number(match[3]),
    month,
    Number(match[1]),
    Number(match[4]),
    Number(match[5])
  ));
}


function formatMatchDate(value) {
  const d = getMatchDate(value);

  if (!d) return value || 'Date TBC';

  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  }) + ' UTC';
}


function dateKey(d) {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0')
  ].join('-');
}


function todayKey() {
  return dateKey(new Date());
}


function updateDateLabel() {
  const el = $('#selectedMatchDate');

  if (!el) return;

  if (!selectedDate) {
    el.textContent = 'All Matches';
    return;
  }

  const d = new Date(selectedDate + 'T12:00:00Z');

  const today = todayKey();

  let label = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });

  if (selectedDate === today) {
    label = 'Today • ' + label;
  }

  el.textContent = label;
}


function changeMatchDate(amount) {
  const current = selectedDate || todayKey();

  const d = new Date(current + 'T12:00:00Z');

  d.setUTCDate(d.getUTCDate() + amount);

  selectedDate = dateKey(d);

  updateDateLabel();
  renderMatches();
}


if ($('#datePrevBtn')) {
  $('#datePrevBtn').addEventListener('click', () => {
    changeMatchDate(-1);
  });
}

if ($('#dateNextBtn')) {
  $('#dateNextBtn').addEventListener('click', () => {
    changeMatchDate(1);
  });
}

if ($('#dateTodayBtn')) {
  $('#dateTodayBtn').addEventListener('click', () => {
    selectedDate = todayKey();
    updateDateLabel();
    renderMatches();
  });
}


/* =========================================
   MATCHES
========================================= */

function isLiveMatch(m) {
  return [
    'IN_PLAY',
    'PAUSED',
    'HALF_TIME',
    'LIVE'
  ].includes(String(m.status || '').toUpperCase());
}


function isFinishedMatch(m) {
  return String(m.status || '').toUpperCase() === 'FINISHED';
}


function isFollowed(name) {
  return followedTeams.some(
    x => x.toLowerCase() === String(name).toLowerCase()
  );
}


function renderMatch(m) {
  const home = String(m.home || 'TBC');
  const away = String(m.away || 'TBC');

  const homeFollowed = isFollowed(home);
  const awayFollowed = isFollowed(away);

  const status = String(m.status || 'SCHEDULED').toUpperCase();

  const statusClass = isLiveMatch(m)
    ? 'live'
    : isFinishedMatch(m)
      ? 'finished'
      : 'scheduled';

  return `
    <article class="match">

      <div class="match-head">
        <span>${esc(m.competition || 'MATCH')}</span>
        <span class="${statusClass}">
          ${esc(status)}
        </span>
      </div>

      <div class="match-teams">
        <b>${esc(home)}</b>

        <span class="score">
          ${esc(m.score || '—')}
        </span>

        <b>${esc(away)}</b>
      </div>

      <small>${esc(formatMatchDate(m.date))}</small>

      <div class="match-follow-actions">

        <button
          class="save"
          data-follow="${esc(home)}">
          ${homeFollowed ? '★ Following' : '+ Follow'}
        </button>

        <button
          class="save"
          data-follow="${esc(away)}">
          ${awayFollowed ? '★ Following' : '+ Follow'}
        </button>

      </div>

    </article>
  `;
}


function renderMatches() {
  const list = $('#matchList');

  if (!list) return;

  let arr = [...allMatches];

  if (selectedDate) {
    arr = arr.filter(m => {
      const d = getMatchDate(m.date);

      return d && dateKey(d) === selectedDate;
    });
  }

  if (!arr.length) {
    list.innerHTML = `
      <div class="empty">
        <span>⚽</span>
        <p>
          ${selectedDate
            ? 'ဒီနေ့အတွက် ပြသနိုင်သော ပွဲစဉ်မရှိသေးပါ။ / No matches for this date.'
            : 'လက်ရှိပြသနိုင်သော ပွဲစဉ်မရှိသေးပါ။ / No matches available.'}
        </p>
      </div>
    `;

    return;
  }

  const liveMatches = arr.filter(isLiveMatch);
  const otherMatches = arr.filter(m => !isLiveMatch(m));

  const leagues = {};

  otherMatches.forEach(m => {
    const league = m.competition || 'OTHER MATCHES';

    if (!leagues[league]) {
      leagues[league] = [];
    }

    leagues[league].push(m);
  });

  let html = '';

  if (liveMatches.length) {
    html += `
      <section class="match-group">
        <h3>🔴 LIVE MATCHES</h3>
        ${liveMatches.map(renderMatch).join('')}
      </section>
    `;
  }

  Object.keys(leagues).forEach(league => {
    html += `
      <section class="match-group">
        <h3>${esc(league)}</h3>
        ${leagues[league].map(renderMatch).join('')}
      </section>
    `;
  });

  list.innerHTML = html;
}


async function loadMatches(base) {
  const r = await fetch(base + '/matches', {
    cache: 'no-store'
  });

  if (!r.ok) {
    throw Error('Matches API: ' + r.status);
  }

  const j = await r.json();

  if (j.mode === 'error') {
    throw Error(j.error || 'Matches API error');
  }

  allMatches = Array.isArray(j.matches) ? j.matches : [];

  renderMatches();
}


/* =========================================
   LEAGUE TABLE
========================================= */

async function loadTable(base) {
  const league =
    $('.league-tab.active')?.dataset.league || 'PL';

  const r = await fetch(
    base + '/standings?league=' + encodeURIComponent(league),
    { cache: 'no-store' }
  );

  if (!r.ok) {
    throw Error('Standings API: ' + r.status);
  }

  const j = await r.json();

  const rows = Array.isArray(j.table) ? j.table : [];

  if (!rows.length) {
    $('#tableWrap').innerHTML =
      '<div class="empty">No league table data.</div>';

    return;
  }

  $('#tableWrap').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>TEAM</th>
          <th>P</th>
          <th>W</th>
          <th>D</th>
          <th>L</th>
          <th>PTS</th>
        </tr>
      </thead>

      <tbody>
        ${rows.map(x => `
          <tr>
            <td>${esc(x.position)}</td>
            <td>${esc(x.team)}</td>
            <td>${esc(x.played)}</td>
            <td>${esc(x.won)}</td>
            <td>${esc(x.drawn)}</td>
            <td>${esc(x.lost)}</td>
            <td><b>${esc(x.points)}</b></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}


/* =========================================
   API CONNECTION
========================================= */

async function loadLive() {
  $('#matchList').innerHTML =
    '<div class="empty">ပွဲစဉ်များ ရယူနေသည်... / Loading fixtures...</div>';

  $('#tableWrap').innerHTML =
    '<div class="empty">အမှတ်ပေးဇယား ရယူနေသည်... / Loading table...</div>';

  $('#apiDot').classList.remove('ok');
  $('#apiStatus').textContent = 'CHECKING API...';
  $('#dataMode').textContent = 'CHECKING';

  try {
    const r = await fetch(API_BASE + '/health', {
      cache: 'no-store'
    });

    if (!r.ok) {
      throw Error('Health API error: ' + r.status);
    }

    const h = await r.json();

    if (h.mode !== 'live') {
      throw Error('API is not live');
    }

    const results = await Promise.allSettled([
      loadMatches(API_BASE),
      loadTable(API_BASE)
    ]);

    const matchesOK = results[0].status === 'fulfilled';
    const tableOK = results[1].status === 'fulfilled';

    if (matchesOK && tableOK) {
      $('#apiDot').classList.add('ok');

      $('#apiStatus').textContent =
        t('Live Data ချိတ်ဆက်ထားသည်', 'LIVE DATA CONNECTED');

      $('#dataMode').textContent = 'LIVE';

    } else {
      $('#apiDot').classList.remove('ok');

      $('#apiStatus').textContent = 'PARTIAL API ERROR';
      $('#dataMode').textContent = 'PARTIAL';

      if (!matchesOK) {
        $('#matchList').innerHTML =
          '<div class="empty">Fixtures Error: ' +
          esc(results[0].reason?.message || 'Unknown error') +
          '</div>';
      }

      if (!tableOK) {
        $('#tableWrap').innerHTML =
          '<div class="empty">Standings Error: ' +
          esc(results[1].reason?.message || 'Unknown error') +
          '</div>';
      }
    }

  } catch (e) {
    console.error('API connection error:', e);

    $('#apiDot').classList.remove('ok');
    $('#apiStatus').textContent = 'API CONNECTION ERROR';
    $('#dataMode').textContent = 'ERROR';

    $('#matchList').innerHTML =
      '<div class="empty">API Error: ' + esc(e.message) + '</div>';

    $('#tableWrap').innerHTML =
      '<div class="empty">API Error: ' + esc(e.message) + '</div>';
  }

  stamp();
}


/* =========================================
   AUTO REFRESH
========================================= */

async function autoRefreshScores() {
  if (scoreRefreshBusy) return;

  scoreRefreshBusy = true;

  try {
    await loadMatches(API_BASE);

    console.log('FOOTBALL WORLD: SCORES UPDATED');

  } catch (e) {
    console.error('Score refresh error:', e);

  } finally {
    scoreRefreshBusy = false;
  }
}

setInterval(() => {
  if (!document.hidden) {
    autoRefreshScores();
  }
}, 60000);


/* =========================================
   FOLLOWING TEAMS
========================================= */

function saveFollowing() {
  localStorage.setItem(
    'fw-following',
    JSON.stringify(followedTeams)
  );
}


function toggleFollowing(team) {
  team = String(team).trim();

  if (!team || team === 'TBC') return;

  const index = followedTeams.findIndex(
    x => x.toLowerCase() === team.toLowerCase()
  );

  if (index >= 0) {
    followedTeams.splice(index, 1);
  } else {
    followedTeams.push(team);
  }

  saveFollowing();

  renderMatches();
  renderFollowing();
}


function renderFollowing() {
  const container = $('#following .feature-placeholder');

  if (!container) return;

  if (!followedTeams.length) {
    container.innerHTML = `
      <div class="feature-icon">⭐</div>

      <h3>
        ${t('သင်နှစ်သက်သော အသင်းများ', 'Your Favourite Teams')}
      </h3>

      <p>
        ${t(
          'ပွဲစဉ်များထဲမှ + Follow ကိုနှိပ်ပြီး အသင်းများကို ရွေးချယ်ပါ။',
          'Tap + Follow on any match to add your favourite teams.'
        )}
      </p>
    `;

    return;
  }

  container.innerHTML = `
    <div class="feature-icon">⭐</div>

    <h3>
      ${t('Follow လုပ်ထားသော အသင်းများ', 'Your Following Teams')}
    </h3>

    <div class="following-list">
      ${followedTeams.map(team => `
        <div class="following-team">
          <strong>${esc(team)}</strong>

          <button
            class="save"
            data-unfollow="${esc(team)}">
            ${t('မလိုက်တော့ပါ', 'Unfollow')}
          </button>
        </div>
      `).join('')}
    </div>
 let followedPlayers = JSON.parse(
  localStorage.getItem('fw-following-players') || '[]'
);
  `;
}


/* =========================================
   SAVED STORIES
========================================= */

function renderSaved() {
  const list = $('#savedList');

  if (!list) return;

  list.innerHTML = saved.length
    ? saved.map(s => card(s)).join('')
    : '<div class="empty">သိမ်းထားသောသတင်း မရှိသေးပါ။ / No saved stories yet.</div>';
}


function toggleSaved(id) {
  const story = stories.find(
    s => String(s.id) === String(id)
  );

  const index = saved.findIndex(
    s => String(s.id) === String(id)
  );

  if (index >= 0) {
    saved.splice(index, 1);

  } else if (story) {
    saved.push(story);

  } else {
    return;
  }

  localStorage.setItem(
    'mir-saved',
    JSON.stringify(saved)
  );

  renderStories();
  renderSaved();
}



/* =========================================
   BOTTOM NAVIGATION
   FOOTBALL WORLD
========================================= */

const navItems = document.querySelectorAll('.nav-item');

function setActiveNav(id) {
  navItems.forEach(item => {
    const isActive = item.getAttribute('href') === '#' + id;

    item.classList.toggle('active', isActive);
  });
}

// Navigation Click
navItems.forEach(item => {

  item.addEventListener('click', () => {

    const targetId = item.getAttribute('href').slice(1);

    const target = document.getElementById(targetId);

    if (!target) return;

    setActiveNav(targetId);

  });

});

// Automatic Active Navigation on Scroll
if ('IntersectionObserver' in window) {

  const navObserver = new IntersectionObserver(entries => {

    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) =>
        b.intersectionRatio - a.intersectionRatio
      );

    if (visible.length) {
      setActiveNav(visible[0].target.id);
    }

  }, {
    root: null,
    rootMargin: '-15% 0px -55% 0px',
    threshold: [0, 0.1, 0.25, 0.5]
  });

  navItems.forEach(item => {

    const id = item.getAttribute('href').slice(1);
    const section = document.getElementById(id);

    if (section) {
      navObserver.observe(section);
    }

  });

}



/* =========================================
   MAIN CLICK HANDLER
========================================= */

document.addEventListener('click', e => {

  const saveBtn = e.target.closest('[data-save]');

  if (saveBtn) {
    toggleSaved(saveBtn.dataset.save);
    return;
  }

  const followBtn = e.target.closest('[data-follow]');

  if (followBtn) {
    toggleFollowing(followBtn.dataset.follow);
    return;
  }

  const unfollowBtn = e.target.closest('[data-unfollow]');

  if (unfollowBtn) {
    toggleFollowing(unfollowBtn.dataset.unfollow);
    return;
  }

});


/* =========================================
   LEAGUE TABS
========================================= */

document.querySelectorAll('.league-tab').forEach(tab => {

  tab.addEventListener('click', async () => {

    document.querySelectorAll('.league-tab').forEach(item => {
      item.classList.remove('active');
    });

    tab.classList.add('active');

    $('#tableWrap').innerHTML =
      '<div class="empty">Loading league table...</div>';

    try {
      await loadTable(API_BASE);

    } catch (e) {
      console.error(e);

      $('#tableWrap').innerHTML =
        '<div class="empty">Could not load league table.</div>';
    }

  });

});


/* =========================================
   REFRESH BUTTON
========================================= */

if ($('#refreshBtn')) {
  $('#refreshBtn').addEventListener('click', () => {
    loadLive();
    loadOfficialNews();
  });
}


/* =========================================
   NOTIFICATIONS
========================================= */

if ($('#notifyBtn')) {
  $('#notifyBtn').addEventListener('click', async () => {

    if (!('Notification' in window)) {
      alert('Browser notifications are not supported.');
      return;
    }

    const permission = await Notification.requestPermission();

    alert(
      permission === 'granted'
        ? 'Permission granted. Notifications can be added in a future update.'
        : 'Notification permission not granted.'
    );

  });
}


/* =========================================
   PWA INSTALL
========================================= */

let installPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();

  installPrompt = e;

  $('#installBtn')?.classList.remove('hidden');
});

if ($('#installBtn')) {
  $('#installBtn').addEventListener('click', async () => {

    if (!installPrompt) return;

    installPrompt.prompt();

    await installPrompt.userChoice;

    installPrompt = null;

    $('#installBtn').classList.add('hidden');
  });
}


/* =========================================
   SERVICE WORKER
========================================= */

if (
  'serviceWorker' in navigator &&
  location.protocol.startsWith('http')
) {
  navigator.serviceWorker
    .register('./sw.js')
    .catch(e => console.error('Service Worker:', e));
}


/* =========================================
   APP STARTUP
========================================= */

setLang(lang);

renderStories();
renderSaved();
renderFollowing();

updateDateLabel();
localClock();

loadLive();
loadOfficialNews();

console.log('FOOTBALL WORLD APP STARTED');
