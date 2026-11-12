const $=s=>document.querySelector(s);
let lang=localStorage.getItem('mir-lang')||'my', stories=[], saved=JSON.parse(localStorage.getItem('mir-saved')||'[]');
const demoStories=[
{id:'official-news',category:'official',title:'Official club news and announcements',my:'အသင်း၏ တရားဝင်သတင်းနှင့် ကြေညာချက်များ',desc:'Go to the club website for original statements, player news and club announcements.',mydesc:'တရားဝင်ကြေညာချက်၊ ကစားသမားသတင်းနှင့် အသင်းသတင်းများကို မူရင်းရင်းမြစ်တွင် ဖတ်ရှုပါ။',source:'Manchester United',url:'https://www.manutd.com/en/news'},
{id:'transfer-check',category:'reported',title:'Verify transfer reports before sharing',my:'အပြောင်းအရွှေ့သတင်းများကို မျှဝေမီ အတည်ပြုပါ',desc:'Compare reports with official club statements. A journalist report is not the same as a completed transfer.',mydesc:'သတင်းဌာန၏ ဖော်ပြချက်သည် အပြောင်းအရွှေ့ပြီးဆုံးကြောင်း တရားဝင်ကြေညာချက်နှင့် မတူပါ။',source:'Verification guide',url:'https://www.manutd.com/en/news'},
{id:'rumour-check',category:'rumour',title:'Rumour is not confirmation',my:'ကောလာဟလသည် အတည်ပြုချက်မဟုတ်ပါ',desc:'Unconfirmed claims should remain labelled as rumours until the club announces the deal.',mydesc:'ကလပ်အသင်းက မကြေညာမချင်း အတည်မပြုရသေးသော သတင်းအဖြစ်သာ သတ်မှတ်ပါ။',source:'MIR editorial policy',url:'https://www.manutd.com/en/news'}
];
function t(my,en){return lang==='my'?my:en}
function setLang(v){lang=v;localStorage.setItem('mir-lang',v);document.documentElement.lang=v;document.querySelectorAll('[data-my][data-en]').forEach(e=>e.textContent=e.dataset[v]);$('#langBtn').textContent=v==='my'?'EN':'မြန်မာ';renderStories();renderSaved()}
$('#refreshBtn').onclick=()=>{
 loadLive();
 loadOfficialNews();
};
function label(c){return c==='official'?'OFFICIAL':c==='reported'?'REPORTED':'RUMOUR'}
function card(s){
 const date=s.pubDate
  ?new Date(s.pubDate).toLocaleString('en-GB',{
    day:'2-digit',
    month:'short',
    year:'numeric',
    hour:'2-digit',
    minute:'2-digit',
    timeZone:'Asia/Yangon'
   })+' (MMT)'
  :'';

 return `
 <article class="story">
  <div class="story-top">
   <span class="tag ${s.category}">${label(s.category)}</span>
   <span class="small muted">${esc(s.source||'Source')}</span>
  </div>

  <h3>${esc(lang==='my'?(s.my||s.title):s.title)}</h3>

  <p>${esc(lang==='my'?(s.mydesc||s.desc||''):(s.desc||''))}</p>

  <div class="small muted">${esc(date)}</div>

  <div class="story-foot">
   <a href="${safeUrl(s.url)}" target="_blank" rel="noopener">OPEN SOURCE ↗</a>
   <button class="save" data-save="${esc(s.id)}">
    ${saved.some(x=>x.id===s.id)?'★ SAVED':'☆ SAVE'}
   </button>
  </div>
 </article>`;
}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safeUrl(u){try{let x=new URL(u);return ['https:'].includes(x.protocol)?x.href:'#'}catch{return '#'}}
function renderStories(){
 let q=$('#newsSearch').value.toLowerCase();
 let f=$('#newsFilter').value;

 let list=stories.filter(s=>
  (f==='all'||s.category===f)&&
  (`${s.title} ${s.my||''} ${s.desc||''} ${s.mydesc||''}`)
   .toLowerCase().includes(q)
 );

 $('#newsList').innerHTML=list.length
  ?list.map(card).join('')
  :`<div class="empty">No matching stories / သတင်းမတွေ့ပါ။</div>`;
}
async function loadOfficialNews(){
 const apiBase='https://manchester-is-red-1.onrender.com/api';

 $('#newsList').innerHTML=
  '<div class="empty">တရားဝင်သတင်းများ ရယူနေသည်... / Loading official news...</div>';

 try{
  const r=await fetch(apiBase+'/news',{
   cache:'no-store'
  });

  if(!r.ok)throw Error('News API: '+r.status);

  const j=await r.json();

  if(j.mode!=='live'||!Array.isArray(j.news)){
   throw Error('Official news unavailable');
  }

  stories=j.news.map(n=>({
   id:n.id,
   category:'official',
   title:n.title,
   my:n.myTitle||n.title,
   desc:n.description||'',
   mydesc:n.myDescription||n.description||'',
   source:n.source||'Manchester United Official',
   url:n.link,
   pubDate:n.pubDate
  }));

  renderStories();
  renderSaved();

 }catch(e){
  console.error('News loading error:',e);

  $('#newsList').innerHTML=
   '<div class="empty">သတင်းရယူမှု မအောင်မြင်ပါ။ ခဏနေ ပြန်စမ်းကြည့်ပါ။ / News unavailable. Please try again.</div>';
 }
}
$('#newsSearch').addEventListener('input',renderStories);$('#newsFilter').addEventListener('change',renderStories);
function localClock(){const d=new Date();$('#localTime').textContent=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});setTimeout(localClock,30000)}
function stamp(){let d=new Date();$('#lastChecked').textContent=d.toLocaleString();$('#lastChecked').title=d.toISOString()}

async function loadLive() {
  const apiBase = 'https://manchester-is-red-1.onrender.com/api';

  $('#matchList').innerHTML =
    '<div class="empty">ပွဲစဉ်များ ရယူနေသည်... / Loading fixtures...</div>';

  $('#tableWrap').innerHTML =
    '<div class="empty">အမှတ်ပေးဇယား ရယူနေသည်... / Loading table...</div>';

  $('#apiDot').classList.remove('ok');
  $('#apiStatus').textContent = 'CHECKING API...';
  $('#dataMode').textContent = 'CHECKING';

  try {
    const r = await fetch(apiBase + '/health', {
      cache: 'no-store'
    });

    if (!r.ok) throw Error('Health API error: ' + r.status);

    const h = await r.json();

    if (h.mode !== 'live') {
      throw Error('API is not live');
    }

    const results = await Promise.allSettled([
      loadMatches(apiBase),
      loadTable(apiBase)
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
  const league = $('#leagueSelect')?.value || 'PL';

  const r = await fetch(
    base + '/standings?league=' + encodeURIComponent(league),
    { cache: 'no-store' }
  );

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


$('#refreshBtn').onclick=()=>{
 loadLive();
 loadOfficialNews();
};
$('#notifyBtn').onclick=async()=>{if(!('Notification'in window)){alert('Browser notifications are not supported.');return}let p=await Notification.requestPermission();alert(p==='granted'?'Permission granted. Alerts can only be shown while this app is active in this version.':'Notification permission not granted.')};
let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#installBtn').classList.add('hidden')};
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});

function renderSaved(){
 const list=$('#savedList');
 if(!list) return;

 list.innerHTML=saved.length
  ?saved.map(s=>card(s)).join('')
  :'<div class="empty">သိမ်းထားသောသတင်း မရှိသေးပါ။</div>';
}

document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-save]');
 if(!btn) return;

 const id=btn.dataset.save;
 const story=stories.find(s=>String(s.id)===String(id));

 if(!story) return;

 const index=saved.findIndex(s=>String(s.id)===String(id));

 if(index>=0){
  saved.splice(index,1);
 }else{
  saved.push(story);
 }

 localStorage.setItem('mir-saved',JSON.stringify(saved));
 renderStories();
 renderSaved();
});

$('#leagueSelect')?.addEventListener('change', async () => {
  const base = 'https://manchester-is-red-1.onrender.com/api';

  try {
    await loadTable(base);
  } catch (e) {
    console.error(e);

    $('#tableWrap').innerHTML =
      '<div class="empty">Could not load league table.</div>';
  }
});

stories=[];setLang(lang);renderStories();renderSaved();localClock();loadLive();loadOfficialNews();
