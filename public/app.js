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

  try {
    const r = await fetch(apiBase + '/health', {
      cache: 'no-store'
    });

    if (!r.ok) throw Error('API unavailable');

    const h = await r.json();

    if (h.mode !== 'live') throw Error('No provider token');

    $('#apiDot').classList.add('ok');
    $('#apiStatus').textContent =
      t('Live data API ချိတ်ဆက်ထားသည်', 'LIVE DATA API CONNECTED');
    $('#dataMode').textContent = 'LIVE';

  } catch (e) {
    $('#apiDot').classList.remove('ok');
    $('#apiStatus').textContent = 'API CONNECTION ERROR';
    $('#dataMode').textContent = 'DEMO';
    stamp();
    return;
  }

  const results = await Promise.allSettled([
    loadMatches(apiBase),
    loadTable(apiBase)
  ]);

  if (results[0].status === 'rejected') {
    $('#matchList').innerHTML =
      '<div class="empty">Fixtures loading failed.</div>';
  }

  if (results[1].status === 'rejected') {
    $('#tableWrap').innerHTML =
      '<div class="empty">League table loading failed.</div>';
  }

  stamp();
}

async function loadMatches(base) {
  let r = await fetch(base + '/matches');
  if (!r.ok) throw Error('matches failed');

  let j = await r.json();
  let arr = j.matches || [];

  $('#matchList').innerHTML = arr.length
    ? arr.map(m => `
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
        <small>${esc(m.date || 'Date TBC')}</small>
      </article>
    `).join('')
    : '<div class="empty">No fixtures returned.</div>';
}

async function loadTable(base) {
  let r = await fetch(base + '/standings');
  if (!r.ok) throw Error('table failed');

  let j = await r.json();
  let rows = j.table || [];

  $('#tableWrap').innerHTML = rows.length
    ? `
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
              <td>${x.position}</td>
              <td>${esc(x.team)}</td>
              <td>${x.played}</td>
              <td>${x.won}</td>
              <td>${x.drawn}</td>
              <td>${x.lost}</td>
              <td><b>${x.points}</b></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<div class="empty">No table data returned.</div>';
}

$('#refreshBtn').onclick=()=>loadLive();
$('#notifyBtn').onclick=async()=>{if(!('Notification'in window)){alert('Browser notifications are not supported.');return}let p=await Notification.requestPermission();alert(p==='granted'?'Permission granted. Alerts can only be shown while this app is active in this version.':'Notification permission not granted.')};
let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#installBtn').classList.add('hidden')};
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
stories=demoStories;setLang(lang);renderStories();renderSaved();localClock();loadLive();
