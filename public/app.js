const $=s=>document.querySelector(s);
let lang=localStorage.getItem('mir-lang')||'my', stories=[], saved=JSON.parse(localStorage.getItem('mir-saved')||'[]');
const demoStories=[
{id:'official-news',category:'official',title:'Official club news and announcements',my:'အသင်း၏ တရားဝင်သတင်းနှင့် ကြေညာချက်များ',desc:'Go to the club website for original statements, player news and club announcements.',mydesc:'တရားဝင်ကြေညာချက်၊ ကစားသမားသတင်းနှင့် အသင်းသတင်းများကို မူရင်းရင်းမြစ်တွင် ဖတ်ရှုပါ။',source:'Manchester United',url:'https://www.manutd.com/en/news'},
{id:'transfer-check',category:'reported',title:'Verify transfer reports before sharing',my:'အပြောင်းအရွှေ့သတင်းများကို မျှဝေမီ အတည်ပြုပါ',desc:'Compare reports with official club statements. A journalist report is not the same as a completed transfer.',mydesc:'သတင်းဌာန၏ ဖော်ပြချက်သည် အပြောင်းအရွှေ့ပြီးဆုံးကြောင်း တရားဝင်ကြေညာချက်နှင့် မတူပါ။',source:'Verification guide',url:'https://www.manutd.com/en/news'},
{id:'rumour-check',category:'rumour',title:'Rumour is not confirmation',my:'ကောလာဟလသည် အတည်ပြုချက်မဟုတ်ပါ',desc:'Unconfirmed claims should remain labelled as rumours until the club announces the deal.',mydesc:'ကလပ်အသင်းက မကြေညာမချင်း အတည်မပြုရသေးသော သတင်းအဖြစ်သာ သတ်မှတ်ပါ။',source:'MIR editorial policy',url:'https://www.manutd.com/en/news'}
];
function t(my,en){return lang==='my'?my:en}
function setLang(v){lang=v;localStorage.setItem('mir-lang',v);document.documentElement.lang=v;document.querySelectorAll('[data-my][data-en]').forEach(e=>e.textContent=e.dataset[v]);$('#langBtn').textContent=v==='my'?'EN':'မြန်မာ';renderStories();renderSaved()}
$('#langBtn').onclick=()=>setLang(lang==='my'?'en':'my');
function label(c){return c==='official'?'OFFICIAL':c==='reported'?'REPORTED':'RUMOUR'}
function card(s){return `<article class="story"><div class="story-top"><span class="tag ${s.category}">${label(s.category)}</span><span class="small muted">${esc(s.source||'Source')}</span></div><h3>${esc(lang==='my'?(s.my||s.title):s.title)}</h3><p>${esc(lang==='my'?(s.mydesc||s.desc||''): (s.desc||''))}</p><div class="story-foot"><a href="${safeUrl(s.url)}" target="_blank" rel="noopener">OPEN SOURCE ↗</a><button class="save" data-save="${esc(s.id)}">${saved.some(x=>x.id===s.id)?'★ SAVED':'☆ SAVE'}</button></div></article>`}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safeUrl(u){try{let x=new URL(u);return ['https:'].includes(x.protocol)?x.href:'#'}catch{return '#'}}
function renderStories(){let q=($('#newsSearch').value||'').toLowerCase(),f=$('#newsFilter').value;let list=stories.filter(s=>(f==='all'||s.category===f)&&(`${s.title} ${s.my||''} ${s.desc||''}`).toLowerCase().includes(q));$('#newsList').innerHTML=list.length?list.map(card).join(''):`<div class="empty">No matching stories / သတင်းမတွေ့ပါ။</div>`}
function renderSaved(){let el=$('#savedList');el.innerHTML=saved.length?saved.map(card).join(''):`<div class="empty">${t('သိမ်းထားသောသတင်း မရှိသေးပါ။','No saved stories yet.')}</div>`}
document.addEventListener('click',e=>{let b=e.target.closest('[data-save]');if(!b)return;let id=b.dataset.save,s=stories.find(x=>x.id===id)||saved.find(x=>x.id===id);if(!s)return;if(saved.some(x=>x.id===id))saved=saved.filter(x=>x.id!==id);else saved.unshift(s);localStorage.setItem('mir-saved',JSON.stringify(saved));renderStories();renderSaved()});
$('#newsSearch').addEventListener('input',renderStories);$('#newsFilter').addEventListener('change',renderStories);
function localClock(){const d=new Date();$('#localTime').textContent=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});setTimeout(localClock,30000)}
function stamp(){let d=new Date();$('#lastChecked').textContent=d.toLocaleString();$('#lastChecked').title=d.toISOString()}


async function loadLive() {
  const apiBase = 'https://manchester-is-red-1.onrender.com/api';

  $('#matchList').innerHTML =
    '<div class="empty">ပွဲစဉ်များ ရယူနေသည်... / Loading fixtures...</div>';

  $('#tableWrap').innerHTML =
    '<div class="empty">အမှတ်ပေးဇယား ရယူနေသည်... / Loading table...</div>';

  try {
    const r = await fetch(apiBase + '/health', {
      cache: 'no-store'
    });

    if (!r.ok) throw Error('Health API error: ' + r.status);

    const h = await r.json();

    if (h.mode !== 'live') throw Error('API is not live');

    $('#apiDot').classList.add('ok');
    $('#apiStatus').textContent =
      t('Live Data ချိတ်ဆက်ထားသည်', 'LIVE DATA CONNECTED');
    $('#dataMode').textContent = 'LIVE';

  } catch (e) {
    $('#apiDot').classList.remove('ok');
    $('#apiStatus').textContent = 'API CONNECTION ERROR';
    $('#dataMode').textContent = 'DEMO';

    $('#matchList').innerHTML =
      '<div class="empty">API Error: ' + esc(e.message) + '</div>';

    $('#tableWrap').innerHTML =
      '<div class="empty">API Error: ' + esc(e.message) + '</div>';

    stamp();
    return;
  }

  const results = await Promise.allSettled([
    loadMatches(apiBase),
    loadTable(apiBase)
  ]);

  if (results[0].status === 'rejected') {
    $('#matchList').innerHTML =
      '<div class="empty">Fixtures Error: ' +
      esc(results[0].reason.message) + '</div>';
  }

  if (results[1].status === 'rejected') {
    $('#tableWrap').innerHTML =
      '<div class="empty">Standings Error: ' +
      esc(results[1].reason.message) + '</div>';
  }

  stamp();
}

async function loadMatches(base) {
  const r = await fetch(base + '/matches', {
    cache: 'no-store'
  });

  if (!r.ok) throw Error('Matches API: ' + r.status);

  const j = await r.json();
  const arr = Array.isArray(j.matches) ? j.matches : [];

  if (!arr.length) {
    $('#matchList').innerHTML =
      '<div class="empty">No fixtures available.</div>';
    return;
  }

  function formatMatchDate(value) {
    if (!value) return 'Date TBC';

    const match = String(value).match(
      /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),\s+(\d{2}):(\d{2})\s+UTC$/
    );

    if (!match) return String(value);

    const months = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3,
      May: 4, Jun: 5, Jul: 6, Aug: 7,
      Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };

    const [, day, month, year, hour, minute] = match;

    const d = new Date(Date.UTC(
      Number(year),
      months[month],
      Number(day),
      Number(hour),
      Number(minute)
    ));

    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Yangon'
    }) + ' (MMT)';
  }

  $('#matchList').innerHTML = arr.map(m => `
    <article class="match">
      <div class="match-head">
        <span>${esc(m.competition || 'MATCH')}</span>
        <span>${esc(m.status || 'SCHEDULED')}</span>
      </div>

      <div class="match-teams">
        <b>${esc(m.home || 'TBC')}</b>
        <span class="score">${esc(m.score || '—')}</span>
        <b>${esc(m.away || 'TBC')}</b>
      </div>

      <small>${esc(formatMatchDate(m.date))}</small>
    </article>
  `).join('');
}

async function loadTable(base) {
  const r = await fetch(base + '/standings', {
    cache: 'no-store'
  });

  if (!r.ok) throw Error('Standings API: ' + r.status);

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
          <tr style="${String(x.team).includes('Manchester United') ? 'background:#fff0f2;font-weight:800;color:#bd001e;' : ''}">
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

$('#refreshBtn').onclick=()=>loadLive();
$('#notifyBtn').onclick=async()=>{if(!('Notification'in window)){alert('Browser notifications are not supported.');return}let p=await Notification.requestPermission();alert(p==='granted'?'Permission granted. Alerts can only be shown while this app is active in this version.':'Notification permission not granted.')};
let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#installBtn').classList.add('hidden')};
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
stories=demoStories;setLang(lang);renderStories();renderSaved();localClock();loadLive();
