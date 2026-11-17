
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
let followedPlayers = JSON.parse(
  localStorage.getItem('fw-following-players') || '[]'
);
let allMatches = [];
let currentStandings = [];
let currentLeague = 'PL';
// MATCH FILTER SETTINGS
let currentMatchType = 'ALL';
let currentMatchLeague = '';
let currentMatchSeason = '';
let currentMatchTeam = '';
let matchFiltersInitialized = false;
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
  renderPlayerFollowing();
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

function isOfflineError(error) {
  return !navigator.onLine || error instanceof TypeError;
}

function offlineMessage() {
  return t(
    'အင်တာနက်ချိတ်ဆက်မှု မရှိပါ။ အင်တာနက်ပြန်ရရှိပါက အလိုအလျောက် ပြန်လည်ရယူပါမည်။',
    'No internet connection. Data will reload when you are back online.'
  );
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
      list.innerHTML = isOfflineError(e)
        ? '<div class="empty">' + esc(offlineMessage()) + '</div>'
        : '<div class="empty">သတင်းရယူမှု မအောင်မြင်ပါ။ ခဏနေ ပြန်စမ်းကြည့်ပါ။ / News unavailable.</div>';
    }
  }
}



/* =========================================
   MATCH DATE HELPERS
========================================= */


function getMatchDate(value) {
  if (!value) return null;

  const d = new Date(value);

  return Number.isNaN(d.getTime()) ? null : d;
}



function formatMatchDate(value) {
  const d = getMatchDate(value);

  if (!d) return value || 'Date TBC';

  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}




function dateKey(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
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

  const d = new Date(current + 'T12:00:00');

  d.setDate(d.getDate() + amount);

  selectedDate = dateKey(d);

  updateDateLabel();
  loadMatches(API_BASE);
}


// MATCH DATE BUTTONS

const datePrevBtn = document.getElementById('datePrevBtn');
const dateTodayBtn = document.getElementById('dateTodayBtn');
const dateNextBtn = document.getElementById('dateNextBtn');

// Previous day
if (datePrevBtn) {
  datePrevBtn.addEventListener('click', () => {
    changeMatchDate(-1);
  });
}

// Today
if (dateTodayBtn) {
  dateTodayBtn.addEventListener('click', () => {
    selectedDate = todayKey();
    updateDateLabel();
    loadMatches(API_BASE);
  });
}

// Next day
if (dateNextBtn) {
  dateNextBtn.addEventListener('click', () => {
    changeMatchDate(1);
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
const liveMinute = isLiveMatch(m) && m.minute != null
  ? `${m.minute}${m.injuryTime ? `+${m.injuryTime}` : ''}′`
  : '';
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
  ${liveMinute ? ' • ' + esc(liveMinute) : ''}
</span>
      </div>

      <div class="match-teams">

  <div class="match-team">
    ${m.homeLogo ? `
      <img
        src="${safeUrl(m.homeLogo)}"
        alt="${esc(home)}"
        class="team-logo">
    ` : ''}

    <b>${esc(home)}</b>
  </div>

  <span class="score">
    ${esc(m.score || '—')}
  </span>

  <div class="match-team">
    ${m.awayLogo ? `
      <img
        src="${safeUrl(m.awayLogo)}"
        alt="${esc(away)}"
        class="team-logo">
    ` : ''}

    <b>${esc(away)}</b>
  </div>

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

  // FILTER BY MATCH TYPE
  if (currentMatchType === 'LIVE') {
    arr = arr.filter(isLiveMatch);

  } else if (currentMatchType === 'FINISHED') {
    arr = arr.filter(isFinishedMatch);

  } else if (currentMatchType === 'UPCOMING') {
    arr = arr.filter(m =>
      !isLiveMatch(m) && !isFinishedMatch(m)
    );
  }

// FILTER BY SELECTED DATE (LOCAL TIMEZONE)
if (selectedDate) {
  arr = arr.filter(m => {
    const d = getMatchDate(m.date);

    if (!d) return false;

    const localDate = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');

    return localDate === selectedDate;
  });
}

  // SEPARATE MATCH TYPES
  const liveMatches = arr.filter(isLiveMatch);

  const finishedMatches = arr.filter(isFinishedMatch);

  const upcomingMatches = arr.filter(m =>
    !isLiveMatch(m) && !isFinishedMatch(m)
  );

  // GROUP MATCHES BY LEAGUE
  function groupByLeague(matches) {
    const groups = {};

    matches.forEach(m => {
      const league = m.competition || 'OTHER MATCHES';

      if (!groups[league]) {
        groups[league] = [];
      }

      groups[league].push(m);
    });

    return groups;
  }

  // RENDER LEAGUE GROUPS
  function renderLeagueGroups(matches, emptyText) {
    if (!matches.length) {
      return `
        <div class="empty match-empty">
          <span>⚽</span>
          <p>${emptyText}</p>
        </div>
      `;
    }

    const groups = groupByLeague(matches);

    return Object.keys(groups).map(league => `
      <section class="match-group">
        <h3>${esc(league)}</h3>
        ${groups[league].map(renderMatch).join('')}
      </section>
    `).join('');
  }

  // ALWAYS SHOW ALL THREE CATEGORIES
  const html = `

    <section class="match-category live-category">
      <h2>🔴 LIVE MATCHES</h2>
      ${renderLeagueGroups(
        liveMatches,
        'လက်ရှိ တိုက်ရိုက်ကစားနေသောပွဲ မရှိသေးပါ။ / No live matches.'
      )}
    </section>

    <section class="match-category finished-category">
      <h2>🏁 FINISHED RESULTS</h2>
      ${renderLeagueGroups(
        finishedMatches,
        'ပြီးဆုံးသွားသောပွဲ မရှိသေးပါ။ / No finished results.'
      )}
    </section>

    <section class="match-category upcoming-category">
      <h2>⏳ UPCOMING FIXTURES</h2>
      ${renderLeagueGroups(
        upcomingMatches,
        'လာမည့်ပွဲစဉ် မရှိသေးပါ။ / No upcoming fixtures.'
      )}
    </section>

  `;

  list.innerHTML = html;
}


function setupMatchFilters() {
  if (matchFiltersInitialized) return;

  const typeFilter = $('#matchTypeFilter');
  const leagueFilter = $('#leagueFilter');
  const seasonFilter = $('#seasonFilter');
  const teamFilter = $('#teamFilter');

  if (typeFilter) {
    typeFilter.addEventListener('change', () => {
      currentMatchType = typeFilter.value;
      loadMatches(API_BASE);
    });
  }

  if (leagueFilter) {
    leagueFilter.addEventListener('change', () => {
      currentMatchLeague = leagueFilter.value;
      currentMatchSeason = '';

      if (seasonFilter) seasonFilter.value = '';

      loadMatches(API_BASE);
    });
  }

  if (seasonFilter) {
    seasonFilter.addEventListener('change', () => {
      currentMatchSeason = seasonFilter.value;
      loadMatches(API_BASE);
    });
  }

  if (teamFilter) {
    teamFilter.addEventListener('change', () => {
      currentMatchTeam = teamFilter.value;
      loadMatches(API_BASE);
    });
  }

  matchFiltersInitialized = true;
}


async function loadMatches(base) {
  const url = new URL(base + '/matches');

  // FULL SEASON: do not send selected date
  if (!currentMatchSeason && selectedDate) {
    url.searchParams.set('date', selectedDate);
  }

  // LEAGUE FILTER
  if (currentMatchLeague && !currentMatchTeam) {
    url.searchParams.set('competition', currentMatchLeague);
  }

  // FULL SEASON FILTER
  if (currentMatchSeason) {
    url.searchParams.set('season', currentMatchSeason);
  }

  // TEAM FILTER
  if (currentMatchTeam) {
    url.searchParams.set('teamId', currentMatchTeam);
  }

  // DEVICE TIMEZONE OFFSET
  url.searchParams.set(
    'timezoneOffset',
    String(new Date().getTimezoneOffset())
  );

  const r = await fetch(url.toString(), {
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
    const errorText = await r.text();

    throw Error(
      'Standings API: ' +
      r.status +
      ' - ' +
      errorText
    );
  }

  const j = await r.json();

  const rows = Array.isArray(j.table) ? j.table : [];

  currentStandings = rows;
  currentLeague = league;

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
          <th>GF</th>
          <th>GA</th>
          <th>GD</th>
          <th>PTS</th>
        </tr>
      </thead>

      <tbody>
        ${rows.map(x => `
          <tr>
            <td>${esc(x.position)}</td>

            <td>
              <button
                class="team-profile-link"
                data-open-team="${esc(x.team)}">
                ${esc(x.team)}
              </button>
            </td>

            <td>${esc(x.played)}</td>
            <td>${esc(x.won)}</td>
            <td>${esc(x.drawn)}</td>
            <td>${esc(x.lost)}</td>
            <td>${esc(x.goalsFor)}</td>
            <td>${esc(x.goalsAgainst)}</td>
            <td>${esc(x.goalDifference)}</td>
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



async function loadLive() {  setupMatchFilters();
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
        const error = results[0].reason;

        $('#matchList').innerHTML =
          '<div class="empty">' +
          esc(isOfflineError(error)
            ? offlineMessage()
            : 'Fixtures unavailable. Please try again.') +
          '</div>';
      }

      if (!tableOK) {
        const error = results[1].reason;

        $('#tableWrap').innerHTML =
          '<div class="empty">' +
          esc(isOfflineError(error)
            ? offlineMessage()
            : 'Standings unavailable. Please try again.') +
          '</div>';
      }
    }

  } catch (e) {
    console.error('API connection error:', e);

    $('#apiDot').classList.remove('ok');

    if (isOfflineError(e)) {
      $('#apiStatus').textContent = 'OFFLINE';
      $('#dataMode').textContent = 'OFFLINE';

      $('#matchList').innerHTML =
        '<div class="empty">' + esc(offlineMessage()) + '</div>';

      $('#tableWrap').innerHTML =
        '<div class="empty">' + esc(offlineMessage()) + '</div>';

    } else {
      $('#apiStatus').textContent = 'API CONNECTION ERROR';
      $('#dataMode').textContent = 'ERROR';

      $('#matchList').innerHTML =
        '<div class="empty">Fixtures unavailable. Please try again.</div>';

      $('#tableWrap').innerHTML =
        '<div class="empty">Standings unavailable. Please try again.</div>';
    }
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

          <button
            class="team-profile-link"
            data-open-team="${esc(team)}">
            ⚽ ${esc(team)}
            <span>›</span>
          </button>

          <button
            class="save"
            data-unfollow="${esc(team)}">
            ${t('မလိုက်တော့ပါ', 'Unfollow')}
          </button>

        </div>
      `).join('')}
    </div>
  `;
}

/* =========================================
   TEAM PROFILE
========================================= */

async function openTeamProfile(team) {

  const followingSection = $('#following');
  const profileSection = $('#teamProfile');

  if (!followingSection || !profileSection) return;

  const teamName = String(team || '').trim();

  $('#teamProfileName').textContent = teamName;

  $('#teamProfileInfo').textContent =
    'FOOTBALL WORLD • Team Profile';

  const normalize = value =>
    String(value || '').trim().toLowerCase();
// TEAM PROFILE API CONNECTION

const teamLogo = $('#teamProfileLogo');

try {

  // LOAD TEAM DIRECTORY
  if (!openTeamProfile.teamDirectory) {

    const response = await fetch(
      `${API_BASE}/teams`
    );

    const result = await response.json();

    if (!response.ok || result.mode !== 'live') {
      throw new Error('Could not load teams');
    }

    openTeamProfile.teamDirectory =
      result.teams || [];
  }

  // FIND TEAM ID
  const cleanName = value =>
  normalize(value).replace(/\s+fc$/i, '');

const teamData = openTeamProfile.teamDirectory.find(x =>
  cleanName(x.name) === cleanName(teamName) ||
  normalize(x.shortName) === normalize(teamName) ||
  normalize(x.tla) === normalize(teamName)
);

  if (!teamData) {
    throw new Error('Team not found');
  }

  // LOAD FULL TEAM PROFILE
  const response = await fetch(
    `${API_BASE}/team/${teamData.id}`
  );

  const result = await response.json();

  if (!response.ok || result.mode !== 'live') {
    throw new Error('Could not load team profile');
  }

  const profile = result.team;

  // TEAM LOGO
  if (teamLogo) {
    teamLogo.src = safeUrl(
      profile.crest || teamData.crest
    );
    teamLogo.hidden = false;
  }

  // TEAM INFORMATION
  $('#teamProfileInfo').innerHTML = `
    <p>Founded: ${esc(profile.founded || 'N/A')}</p>
    <p>Stadium: ${esc(profile.venue || 'N/A')}</p>
    <p>Manager: ${esc(profile.coach || 'N/A')}</p>
    <p>Club Colors: ${esc(profile.clubColors || 'N/A')}</p>
  `;

} catch (error) {

  console.error('Team Profile:', error);

  if (teamLogo) {
    teamLogo.hidden = true;
  }

  $('#teamProfileInfo').textContent =
    'Team information is temporarily unavailable.';
}
  // TEAM MATCHES
  const teamMatches = allMatches.filter(m =>
    normalize(m.home) === normalize(teamName) ||
    normalize(m.away) === normalize(teamName)
  );

  const pastMatches = teamMatches.filter(isFinishedMatch);

  const upcomingMatches = teamMatches.filter(m =>
    !isFinishedMatch(m)
  );

  // UPCOMING FIXTURES
  $('#teamUpcomingMatches').innerHTML =
    upcomingMatches.length
      ? upcomingMatches.map(renderMatch).join('')
      : '<p>No upcoming fixtures available.</p>';

  // PAST RESULTS
  $('#teamPastResults').innerHTML =
    pastMatches.length
      ? pastMatches.map(renderMatch).join('')
      : '<p>No past results available.</p>';

  // LEAGUE POSITION
  const standing = currentStandings.find(x =>
    normalize(x.team) === normalize(teamName)
  );

  $('#teamLeaguePosition').innerHTML =
    standing
      ? `
        <strong>${esc(teamName)}</strong>
        <p>
          Position: ${esc(standing.position)} |
          Points: ${esc(standing.points)}
        </p>
        <p>League: ${esc(currentLeague)}</p>
      `
      : '<p>League position is not available in the currently selected league.</p>';

  // TEAM NEWS
  const teamStories = stories.filter(s => {
    const content = [
      s.title,
      s.my,
      s.desc,
      s.description
    ].join(' ');

    return normalize(content).includes(normalize(teamName));
  });

  $('#teamNews').innerHTML =
    teamStories.length
      ? teamStories.slice(0, 5).map(s => `
          <div class="team-news-item">
            <strong>${esc(s.title || s.my || 'Football News')}</strong>
            <p>${esc(s.desc || s.description || '')}</p>
          </div>
        `).join('')
      : '<p>No matching team news available.</p>';

  followingSection.hidden = true;
  profileSection.hidden = false;

  profileSection.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}


// CLOSE TEAM PROFILE
function closeTeamProfile() {

  $('#teamProfile').hidden = true;
  $('#following').hidden = false;

  $('#following').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

}
/* =========================================
   PLAYER FOLLOWING
========================================= */

function saveFollowingPlayers() {
  localStorage.setItem(
    'fw-following-players',
    JSON.stringify(followedPlayers)
  );
}

function togglePlayerFollowing(player) {
  player = String(player).trim();

  if (!player || player === 'TBC') return;

  const index = followedPlayers.findIndex(
    x => x.toLowerCase() === player.toLowerCase()
  );

  if (index >= 0) {
    followedPlayers.splice(index, 1);
  } else {
    followedPlayers.push(player);
  }

  saveFollowingPlayers();
  renderPlayerFollowing();
}

function renderPlayerFollowing() {
  const container = $('#playerFollowingList');

  if (!container) return;

  if (!followedPlayers.length) {
    container.innerHTML = `
      <div class="feature-icon">⚽</div>

      <h3>
        ${t('ကစားသမား မရွေးချယ်ရသေးပါ', 'No Players Followed Yet')}
      </h3>

      <p>
        ${t(
          'နှစ်သက်သော ကစားသမားများကို Follow လုပ်နိုင်ပါမယ်။',
          'Follow your favourite football players.'
        )}
      </p>
    `;

    return;
  }

  container.innerHTML = `
    <div class="feature-icon">⚽</div>

    <h3>
      ${t('Follow လုပ်ထားသော ကစားသမားများ', 'Your Favourite Players')}
    </h3>

    <div class="following-list">
      ${followedPlayers.map(player => `
        <div class="following-team">
          <strong>${esc(player)}</strong>

          <button
            class="save"
            data-unfollow-player="${esc(player)}">
            ${t('မလိုက်တော့ပါ', 'Unfollow')}
          </button>
        </div>
      `).join('')}
    </div>
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

  // OPEN TEAM PROFILE
  const teamProfileBtn =
    e.target.closest('[data-open-team]');

  if (teamProfileBtn) {
    openTeamProfile(teamProfileBtn.dataset.openTeam);
    return;
  }

  // CLOSE TEAM PROFILE
  const closeTeamBtn =
    e.target.closest('[data-close-team]');

  if (closeTeamBtn) {
    closeTeamProfile();
    return;
  }

  // SAVE NEWS
  const saveBtn = e.target.closest('[data-save]');

  if (saveBtn) {
    toggleSaved(saveBtn.dataset.save);
    return;
  }

  // FOLLOW TEAM
  const followBtn = e.target.closest('[data-follow]');

  if (followBtn) {
    toggleFollowing(followBtn.dataset.follow);
    return;
  }

  // UNFOLLOW TEAM
  const unfollowBtn = e.target.closest('[data-unfollow]');

  if (unfollowBtn) {
    toggleFollowing(unfollowBtn.dataset.unfollow);
    return;
  }

  // UNFOLLOW PLAYER
  const unfollowPlayerBtn =
    e.target.closest('[data-unfollow-player]');

  if (unfollowPlayerBtn) {
    togglePlayerFollowing(
      unfollowPlayerBtn.dataset.unfollowPlayer
    );
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
renderPlayerFollowing();
updateDateLabel();
localClock();


loadLive();
loadOfficialNews();

window.addEventListener('online', () => {
  console.log('FOOTBALL WORLD: Internet restored');

  loadLive();
  loadOfficialNews();
});

window.addEventListener('offline', () => {
  $('#apiDot')?.classList.remove('ok');

  if ($('#apiStatus')) {
    $('#apiStatus').textContent = 'OFFLINE';
  }

  if ($('#dataMode')) {
    $('#dataMode').textContent = 'OFFLINE';
  }
});

console.log('FOOTBALL WORLD APP STARTED');

