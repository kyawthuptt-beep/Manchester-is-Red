

require("dotenv").config();
const express=require("express");
const cors=require("cors");
const path=require("path");

const app=express();
app.use(cors());
app.use(express.json());

const PORT=process.env.PORT||3000;
const TOKEN=process.env.FOOTBALL_DATA_TOKEN;
const TEAM_ID=66;

const NEWS_FEEDS=[
 {
  name:"BBC Sport",
  url:"https://feeds.bbci.co.uk/sport/football/rss.xml"
 },
 {
  name:"Sky Sports",
  url:"https://www.skysports.com/rss/11095"
 }
];
const TRANSLATE_API="https://api.mymemory.translated.net/get";

const demoMatches=[
 {date:"Demo data",competition:"Premier League",home:"Manchester United",away:"Opponent",score:"Connect API for live fixtures",status:"Preview"},
 {date:"Demo data",competition:"Premier League",home:"Opponent",away:"Manchester United",score:"Connect API for live fixtures",status:"Preview"}
];

const demoTable=[
 {position:1,team:"Team data unavailable",played:"—",won:"—",drawn:"—",lost:"—",points:"—"},
 {position:2,team:"Manchester United",played:"—",won:"—",drawn:"—",lost:"—",points:"—"}
];

async function football(pathname){
 const response=await fetch("https://api.football-data.org/v4"+pathname,{
  headers:{"X-Auth-Token":TOKEN}
 });
 if(!response.ok)throw new Error("football-data.org returned "+response.status);
 return response.json();
}

// RSS XML helpers

function xmlValue(block,tag){
 const re=new RegExp("<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)</"+tag+">","i");
 const match=block.match(re);
 return match?match[1].trim():"";
}


function cleanText(value){
 return value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
  .replace(/<[^>]*>/g," ")
  .replace(/&amp;/g,"&")
  .replace(/&quot;/g,'"')
  .replace(/&apos;/g,"'")
  .replace(/&lt;/g,"<")
  .replace(/&gt;/g,">")
  .replace(/&#39;/g,"'")
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
  .replace(/\s+/g," ")
  .trim();
}

// MyMemory English to Myanmar
async function translateText(text){
 if(!text)return "";

 const shortText=text.slice(0,300);

 try{
  const params=new URLSearchParams({
   q:shortText,
   langpair:"en|my"
  });

  const response=await fetch(TRANSLATE_API+"?"+params.toString());

  if(!response.ok)throw new Error("Translation service unavailable");

  const data=await response.json();

  if(data.responseStatus!==200)throw new Error("Translation failed");

  return data.responseData?.translatedText||shortText;

 }catch(error){
  console.error("Translation error:",error.message);
  return shortText;
 }
}

// News cache
let newsCache=null;
let newsCacheTime=0;
const NEWS_CACHE_MS=15*60*1000;


async function getNews(){
 if(newsCache && Date.now()-newsCacheTime<NEWS_CACHE_MS){
  return newsCache;
 }

 const results=await Promise.allSettled(
  NEWS_FEEDS.map(async feed=>{
   const response=await fetch(feed.url,{
    headers:{"User-Agent":"FOOTBALL-WORLD/1.0"},
    signal:AbortSignal.timeout(15000)
   });

   if(!response.ok){
    throw new Error(feed.name+" RSS returned "+response.status);
   }

   const xml=await response.text();

   const items=[
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)
   ];

   return items.map(item=>{
    const block=item[1];

    return {
     id:cleanText(xmlValue(block,"guid")) ||
        cleanText(xmlValue(block,"link")),
     title:cleanText(xmlValue(block,"title")),
     description:cleanText(xmlValue(block,"description")),
     link:cleanText(xmlValue(block,"link")),
     pubDate:cleanText(xmlValue(block,"pubDate")),
     source:feed.name
    };
   });
  })
 );

 let news=results
  .filter(x=>x.status==="fulfilled")
  .flatMap(x=>x.value)
  .filter(n=>n.title && n.link)
  .filter(n=>n.link.startsWith("https://"));

 news=news.filter((n,i,arr)=>
  arr.findIndex(x=>x.link===n.link)===i
 );

 news.sort((a,b)=>
  new Date(b.pubDate).getTime()-
  new Date(a.pubDate).getTime()
 );

 news=news.slice(0,8);

 if(!news.length){
  throw new Error("All football news feeds are unavailable");
 }

 for(const item of news){
  item.myTitle=await translateText(item.title);
  item.myDescription=item.description
   ?await translateText(item.description)
   :"";
 }

 newsCache=news;
 newsCacheTime=Date.now();

 return news;
}
app.get("/api/health",(req,res)=>{
 res.json({
  ok:true,
  mode:TOKEN?"live":"demo",
  provider:"football-data.org"
 });
});

app.get("/api/matches",async(req,res)=>{
 if(!TOKEN)return res.json({mode:"demo",matches:demoMatches});

 try{
  const data=await football(`/teams/${TEAM_ID}/matches?status=SCHEDULED,FINISHED&limit=20`);

  const matches=(data.matches||[]).map(m=>({
   date:m.utcDate
    ?new Date(m.utcDate).toLocaleString("en-GB",{
      dateStyle:"medium",
      timeStyle:"short",
      timeZone:"UTC"
     })+" UTC"
    :"TBC",
   competition:m.competition?.name||"Competition",
   home:m.homeTeam?.name||"TBC",
   away:m.awayTeam?.name||"TBC",
   score:m.score?.fullTime?.home!=null
    ?`${m.score.fullTime.home} - ${m.score.fullTime.away}`
    :m.status,
   status:m.status
  }));

  res.json({mode:"live",matches});

 }catch(e){
  res.status(502).json({mode:"error",error:e.message,matches:[]});
 }
});


app.get("/api/standings",async(req,res)=>{
 const leagues={
  PL:"Premier League",
  PD:"LaLiga",
  SA:"Serie A",
  BL1:"Bundesliga",
  FL1:"Ligue 1"
 };

 const league=String(req.query.league||"PL").toUpperCase();

 if(!leagues[league]){
  return res.status(400).json({
   mode:"error",
   message:"Invalid league code"
  });
 }

 if(!TOKEN){
  return res.json({
   mode:"demo",
   league,
   leagueName:leagues[league],
   table:league==="PL"?demoTable:[],
   message:"Live API token is required"
  });
 }

 try{
  const data=await football(
   `/competitions/${league}/standings`
  );

  const standing=
   data.standings?.find(s=>s.type==="TOTAL")
   ||data.standings?.[0];

  const rows=standing?.table||[];

  const table=rows.map(t=>({
   position:t.position,
   team:t.team?.name||"TBC",
   played:t.playedGames,
   won:t.won,
   drawn:t.draw,
   lost:t.lost,
   points:t.points
  }));

  res.json({
   mode:"live",
   league,
   leagueName:leagues[league],
   table
  });

 }catch(error){
  console.error("Standings error:",league,error.message);

  res.status(500).json({
   mode:"error",
   league,
   leagueName:leagues[league],
   table:[],
   message:"Could not load league standings"
  });
 }
});


// NEW: Manchester United Official News
app.get("/api/news",async(req,res)=>{
 try{
  const news=await getNews();

  res.json({
   mode:"live",
   source:"Global Football News",
   news
  });

 }catch(e){
  console.error("News error:",e.message);

  res.status(502).json({
   mode:"error",
   error:"Official news is temporarily unavailable.",
   news:[]
  });
 }
});

app.use(express.static(path.join(__dirname,"../public")));

app.get("*",(req,res)=>{
 res.sendFile(path.join(__dirname,"../public/index.html"));
});

app.listen(PORT,"0.0.0.0",()=>{
 console.log(`MANCHESTER IS RED listening on ${PORT}`);
});
