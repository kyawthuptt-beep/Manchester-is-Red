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
const demoMatches=[
 {date:"Demo data",competition:"Premier League",home:"Manchester United",away:"Opponent",score:"Connect API for live fixtures",status:"Preview"},
 {date:"Demo data",competition:"Premier League",home:"Opponent",away:"Manchester United",score:"Connect API for live fixtures",status:"Preview"}
];
const demoTable=[
 {position:1,team:"Team data unavailable",played:"—",won:"—",drawn:"—",lost:"—",points:"—"},
 {position:2,team:"Manchester United",played:"—",won:"—",drawn:"—",lost:"—",points:"—"}
];
async function football(pathname){
 const response=await fetch("https://api.football-data.org/v4"+pathname,{headers:{"X-Auth-Token":TOKEN}});
 if(!response.ok)throw new Error("football-data.org returned "+response.status);
 return response.json();
}
app.get("/api/health",(req,res)=>res.json({ok:true,mode:TOKEN?"live":"demo",provider:"football-data.org"}));
app.get("/api/matches",async(req,res)=>{
 if(!TOKEN)return res.json({mode:"demo",matches:demoMatches});
 try{
  const data=await football(`/teams/${TEAM_ID}/matches?status=SCHEDULED,FINISHED&limit=20`);
  const matches=(data.matches||[]).map(m=>({date:m.utcDate?new Date(m.utcDate).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"})+" UTC":"TBC",competition:m.competition?.name||"Competition",home:m.homeTeam?.name||"TBC",away:m.awayTeam?.name||"TBC",score:m.score?.fullTime?.home!=null?`${m.score.fullTime.home} - ${m.score.fullTime.away}`:m.status,status:m.status}));
  res.json({mode:"live",matches});
 }catch(e){res.status(502).json({mode:"error",error:e.message,matches:[]});}
});
app.get("/api/standings",async(req,res)=>{
 if(!TOKEN)return res.json({mode:"demo",table:demoTable});
 try{
  const data=await football("/competitions/PL/standings");
  const rows=data.standings?.[0]?.table||[];
  const table=rows.map(t=>({position:t.position,team:t.team?.name||"TBC",played:t.playedGames,won:t.won,drawn:t.draw,lost:t.lost,points:t.points}));
  res.json({mode:"live",table});
 }catch(e){res.status(502).json({mode:"error",error:e.message,table:[]});}
});
app.use(express.static(path.join(__dirname,"../public")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"../public/index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`MANCHESTER IS RED listening on ${PORT}`));
