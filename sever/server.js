
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const API_NINJAS_KEY = process.env.API_NINJAS_KEY;
const NEWS_FEEDS = [
  {
    name: "BBC Sport",
    url: "https://feeds.bbci.co.uk/sport/football/rss.xml"
  },
  {
    name: "Sky Sports",
    url: "https://www.skysports.com/rss/11095"
  }
];

const TRANSLATE_API =
  "https://api.mymemory.translated.net/get";
// API-FOOTBALL CONNECTION TEST
app.get("/api/test-football-api", async (req, res) => {
  try {
    if (!API_FOOTBALL_KEY) {
      return res.status(500).json({
        ok: false,
        message: "API_FOOTBALL_KEY is missing"
      });
    }

    const response = await fetch(
      "https://v3.football.api-sports.io/status",
      {
        headers: {
          "x-apisports-key": API_FOOTBALL_KEY
        }
      }
    );

    const data = await response.json();

    res.status(response.status).json({
      ok: response.ok,
      provider: "API-Football",
      response: data
    });

  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

// API-FOOTBALL LIVE MATCH TEST
app.get("/api/test-live-football-api", async (req, res) => {
  try {
    if (!API_FOOTBALL_KEY) {
      return res.status(500).json({
        ok: false,
        message: "API_FOOTBALL_KEY is missing"
      });
    }

    const response = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all",
      {
        headers: {
          "x-apisports-key": API_FOOTBALL_KEY
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    const data = await response.json();

    const hasErrors =
      data.errors &&
      Object.keys(data.errors).length > 0;

    res.status(response.status).json({
      ok: response.ok && !hasErrors,
      provider: "API-Football",
      totalLiveMatches: data.results ?? 0,
      errors: data.errors || [],
      matches: (data.response || [])
        .slice(0, 10)
        .map(item => ({
          id: item.fixture?.id,
          league: item.league?.name || "Unknown",
          country: item.league?.country || "",
          home: item.teams?.home?.name || "TBC",
          away: item.teams?.away?.name || "TBC",
          score:
            `${item.goals?.home ?? 0} - ${item.goals?.away ?? 0}`,
          status: item.fixture?.status?.short || "",
          statusText: item.fixture?.status?.long || "",
          minute: item.fixture?.status?.elapsed ?? null,
          date: item.fixture?.date || ""
        }))
    });

  } catch (error) {
    res.status(500).json({
      ok: false,
      provider: "API-Football",
      message: error.message
    });
  }
});

const demoMatches = [
  {
    date: "Demo data",
    competition: "Premier League",
    home: "Manchester United",
    away: "Opponent",
    score: "Connect API for live fixtures",
    status: "Preview"
  },
  {
    date: "Demo data",
    competition: "Premier League",
    home: "Opponent",
    away: "Manchester United",
    score: "Connect API for live fixtures",
    status: "Preview"
  }
];

const demoTable = [
  {
    position: 1,
    team: "Team data unavailable",
    played: "—",
    won: "—",
    drawn: "—",
    lost: "—",
    goalsFor: "—",
    goalsAgainst: "—",
    goalDifference: "—",
    points: "—"
  },
  {
    position: 2,
    team: "Manchester United",
    played: "—",
    won: "—",
    drawn: "—",
    lost: "—",
    goalsFor: "—",
    goalsAgainst: "—",
    goalDifference: "—",
    points: "—"
  }
];

// DATE HELPER
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

// FOOTBALL DATA API
async function football(pathname) {
  const response = await fetch(
    "https://api.football-data.org/v4" + pathname,
    {
      headers: {
        "X-Auth-Token": TOKEN
      }
    }
  );

  const body = await response.text();

  if (!response.ok) {
    let detail = body;

    try {
      const data = JSON.parse(body);
      detail = data.message || data.error || body;
    } catch (error) {}

    throw new Error(
      "football-data.org returned " +
      response.status + ": " + detail
    );
  }

  return JSON.parse(body);
}

// API NINJAS FOOTBALL TEST
app.get("/api/test-api-ninjas", async (req, res) => {
  try {
    if (!API_NINJAS_KEY) {
      return res.status(503).json({
        ok: false,
        message: "API_NINJAS_KEY is missing"
      });
    }

    const league = String(
      req.query.league || "epl"
    ).toLowerCase();

    if (!/^[a-z0-9]+$/.test(league)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid league code"
      });
    }

    const params = new URLSearchParams({
      league
    });

    if (req.query.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
        return res.status(400).json({
          ok: false,
          message: "Date must use YYYY-MM-DD"
        });
      }

      params.set("date", req.query.date);
    }

    const response = await fetch(
      "https://api.api-ninjas.com/v1/soccermatches?" +
      params.toString(),
      {
        headers: {
          "X-Api-Key": API_NINJAS_KEY
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      return res.status(response.status).json({
        ok: false,
        provider: "API Ninjas",
        league,
        error: data.error || data.message || data
      });
    }

    res.json({
      ok: true,
      provider: "API Ninjas",
      league,
      total: data.length,
      matches: data.slice(0, 20).map(item => ({
        id: item.game_id,
        date: item.date || "",
        startTime: item.start_time || "",
        home: item.home_team?.name || "TBC",
        away: item.away_team?.name || "TBC",
        homeScore: item.home_score ?? null,
        awayScore: item.away_score ?? null,
        status: item.status || "unknown",
        minute: item.clock || null
      }))
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "API Ninjas",
      error: error.message
    });
  }
});

// RSS XML HELPERS
function xmlValue(block, tag) {
  const re = new RegExp(
    "<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" +
    tag + ">",
    "i"
  );

  const match = block.match(re);

  return match ? match[1].trim() : "";
}

function cleanText(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    )
    .replace(/\s+/g, " ")
    .trim();
}

// ENGLISH TO MYANMAR TRANSLATION
async function translateText(text) {
  if (!text) return "";

  const shortText = text.slice(0, 300);

  try {
    const params = new URLSearchParams({
      q: shortText,
      langpair: "en|my"
    });

    const response = await fetch(
      TRANSLATE_API + "?" + params.toString()
    );

    if (!response.ok) {
      throw new Error("Translation service unavailable");
    }

    const data = await response.json();

    if (data.responseStatus !== 200) {
      throw new Error("Translation failed");
    }

    return (
      data.responseData?.translatedText || shortText
    );

  } catch (error) {
    console.error("Translation error:", error.message);
    return shortText;
  }
}

// NEWS CACHE
let newsCache = null;
let newsCacheTime = 0;

const NEWS_CACHE_MS = 15 * 60 * 1000;

// GET FOOTBALL NEWS
async function getNews() {
  if (
    newsCache &&
    Date.now() - newsCacheTime < NEWS_CACHE_MS
  ) {
    return newsCache;
  }

  const results = await Promise.allSettled(
    NEWS_FEEDS.map(async feed => {
      const response = await fetch(feed.url, {
        headers: {
          "User-Agent": "FOOTBALL-WORLD/1.0"
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(
          feed.name + " RSS returned " + response.status
        );
      }

      const xml = await response.text();

      const items = [
        ...xml.matchAll(
          /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi
        )
      ];

      return items.map(item => {
        const block = item[1];

        return {
          id:
            cleanText(xmlValue(block, "guid")) ||
            cleanText(xmlValue(block, "link")),

          title: cleanText(xmlValue(block, "title")),
          description: cleanText(
            xmlValue(block, "description")
          ),
          link: cleanText(xmlValue(block, "link")),
          pubDate: cleanText(xmlValue(block, "pubDate")),
          source: feed.name
        };
      });
    })
  );

  let news = results
    .filter(result => result.status === "fulfilled")
    .flatMap(result => result.value)
    .filter(item => item.title && item.link)
    .filter(item => item.link.startsWith("https://"));

  news = news.filter((item, index, array) =>
    array.findIndex(
      other => other.link === item.link
    ) === index
  );

  news.sort(
    (a, b) =>
      new Date(b.pubDate).getTime() -
      new Date(a.pubDate).getTime()
  );

  news = news.slice(0, 8);

  if (!news.length) {
    throw new Error(
      "All football news feeds are unavailable"
    );
  }

  for (const item of news) {
    item.myTitle = await translateText(item.title);

    item.myDescription = item.description
      ? await translateText(item.description)
      : "";
  }

  newsCache = news;
  newsCacheTime = Date.now();

  return news;
}

// HEALTH API
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mode: TOKEN ? "live" : "demo",
    provider: "football-data.org"
  });
});



// MATCHES API - FOOTBALL-DATA.ORG
const MATCHES_CACHE_TTL = 60 * 1000;
const matchesApiCache = new Map();

app.get("/api/matches", async (req, res) => {
  if (!TOKEN) {
    return res.status(503).json({
      mode: "error",
      error: "FOOTBALL_DATA_TOKEN is missing",
      matches: []
    });
  }

  try {
    const requestedDate = req.query.date;
    let dateFrom;
    let dateTo;

    if (requestedDate) {
      if (
        typeof requestedDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ) {
        return res.status(400).json({
          mode: "error",
          error: "Invalid date format. Use YYYY-MM-DD",
          matches: []
        });
      }

      const selected = new Date(
        requestedDate + "T00:00:00Z"
      );

      if (
        isNaN(selected.getTime()) ||
        selected.toISOString().slice(0, 10) !== requestedDate
      ) {
        return res.status(400).json({
          mode: "error",
          error: "Invalid calendar date",
          matches: []
        });
      }

      const timezoneOffset =
        req.query.timezoneOffset === undefined
          ? 0
          : Number(req.query.timezoneOffset);

      if (
        !Number.isInteger(timezoneOffset) ||
        timezoneOffset < -840 ||
        timezoneOffset > 840
      ) {
        return res.status(400).json({
          mode: "error",
          error: "Invalid timezone offset",
          matches: []
        });
      }

      const localStart = new Date(
        selected.getTime() + timezoneOffset * 60000
      );

      const localEnd = new Date(
        localStart.getTime() + 86400000
      );

      dateFrom = localStart.toISOString().slice(0, 10);
      dateTo = localEnd.toISOString().slice(0, 10);

    } else {
      const today = new Date();

      dateFrom = today.toISOString().slice(0, 10);

      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      dateTo = tomorrow.toISOString().slice(0, 10);
    }

    const cacheKey = `${dateFrom}_${dateTo}`;
    let data;
    let cacheHit = false;

    const cached = matchesApiCache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.time < MATCHES_CACHE_TTL
    ) {
      data = cached.data;
      cacheHit = true;

    } else {
      data = await football(
        `/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
      );

      matchesApiCache.set(cacheKey, {
        time: Date.now(),
        data
      });
    }

    const rawMatches = Array.isArray(data.matches)
      ? [...data.matches]
      : [];

    rawMatches.sort((a, b) =>
      new Date(a.utcDate).getTime() -
      new Date(b.utcDate).getTime()
    );

    const matches = rawMatches.map(item => {
      const statusCode = item.status || "SCHEDULED";

      let status = "SCHEDULED";

      if (statusCode === "IN_PLAY") {
        status = "IN_PLAY";
      } else if (statusCode === "PAUSED") {
        status = "HALF_TIME";
      } else if (statusCode === "FINISHED") {
        status = "FINISHED";
      } else if (
        ["SUSPENDED", "POSTPONED"].includes(statusCode)
      ) {
        status = "PAUSED";
      }

      const goals = item.goals || [];
      const lastGoal = goals.length
        ? goals[goals.length - 1]
        : null;

      const scoreData = item.score || {};

      let homeScore = null;
      let awayScore = null;

      if (status === "FINISHED") {
        homeScore = scoreData.fullTime?.home;
        awayScore = scoreData.fullTime?.away;
      } else if (
        status === "IN_PLAY" ||
        status === "HALF_TIME" ||
        status === "PAUSED"
      ) {
        homeScore =
          lastGoal?.score?.home ??
          scoreData.halfTime?.home ??
          0;

        awayScore =
          lastGoal?.score?.away ??
          scoreData.halfTime?.away ??
          0;
      }

      const kickoff = item.utcDate
        ? new Date(item.utcDate)
        : null;

      const hasScore =
        homeScore != null && awayScore != null;

      return {
        id: item.id,

        date:
          kickoff && !isNaN(kickoff.getTime())
            ? kickoff.toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "UTC"
              }) + " UTC"
            : "TBC",

        competition:
          item.competition?.name || "Competition",

        home: item.homeTeam?.name || "TBC",
        homeLogo: item.homeTeam?.crest || "",

        away: item.awayTeam?.name || "TBC",
        awayLogo: item.awayTeam?.crest || "",

        score: hasScore
          ? `${homeScore} - ${awayScore}`
          : "—",

        status,
        minute: item.minute ?? null,
        injuryTime: item.injuryTime ?? null
      };
    });

    res.json({
      mode: "live",
      source: "football-data.org",
      dateFrom,
      dateTo,
      total: matches.length,
      cacheHit,
      matches
    });

  } catch (error) {
    console.error(
      "Football Data Matches error:",
      error.message
    );

    res.status(502).json({
      mode: "error",
      source: "football-data.org",
      error: error.message,
      matches: []
    });
  }
});



// STANDINGS API
app.get("/api/standings", async (req, res) => {
  const leagues = {
    PL: "Premier League",
    PD: "LaLiga",
    SA: "Serie A",
    BL1: "Bundesliga",
    FL1: "Ligue 1"
  };

  const league = String(
    req.query.league || "PL"
  ).toUpperCase();

  if (!leagues[league]) {
    return res.status(400).json({
      mode: "error",
      message: "Invalid league code"
    });
  }

  if (!TOKEN) {
    return res.json({
      mode: "demo",
      league,
      leagueName: leagues[league],
      table: league === "PL" ? demoTable : [],
      message: "Live API token is required"
    });
  }

  try {
    const data = await football(
      `/competitions/${league}/standings?season=2026`
    );

    const standing =
      data.standings?.find(
        item => item.type === "TOTAL"
      ) || data.standings?.[0];

    const rows = standing?.table || [];

    const table = rows.map(item => ({
      position: item.position,
      team: item.team?.name || "TBC",
      played: item.playedGames,
      won: item.won,
      drawn: item.draw,
      lost: item.lost,
      goalsFor: item.goalsFor,
      goalsAgainst: item.goalsAgainst,
      goalDifference: item.goalDifference,
      points: item.points
    }));

    res.json({
      mode: "live",
      league,
      leagueName: leagues[league],
      table
    });

  } catch (error) {
    console.error(
      "Standings error:",
      league,
      error.message
    );

    res.status(500).json({
      mode: "error",
      league,
      leagueName: leagues[league],
      table: [],
      message: "Could not load league standings"
    });
  }
});

// ALL TEAMS API
app.get("/api/teams", async (req, res) => {
  if (!TOKEN) {
    return res.status(503).json({
      mode: "error",
      message: "Football API token is required"
    });
  }

  const leagues = ["PL", "PD", "SA", "BL1", "FL1"];
  const teamMap = new Map();

  try {
    for (const league of leagues) {
      try {
        const data = await football(
          `/competitions/${league}/teams`
        );

        (data.teams || []).forEach(team => {
          teamMap.set(team.id, {
            id: team.id,
            name: team.name || "",
            shortName: team.shortName || "",
            tla: team.tla || "",
            crest: team.crest || "",
            venue: team.venue || "",
            founded: team.founded || null
          });
        });

      } catch (error) {
        console.log(
          "League error:",
          league,
          error.message
        );
      }
    }

    res.json({
      mode: "live",
      count: teamMap.size,
      teams: [...teamMap.values()]
    });

  } catch (error) {
    res.status(502).json({
      mode: "error",
      message: error.message
    });
  }
});

// SINGLE TEAM PROFILE API
app.get("/api/team/:id", async (req, res) => {
  const teamId = Number(req.params.id);

  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({
      mode: "error",
      message: "Invalid team ID"
    });
  }

  if (!TOKEN) {
    return res.status(503).json({
      mode: "error",
      message: "Football API token is required"
    });
  }

  try {
    const data = await football(
      `/teams/${teamId}`
    );

    res.json({
      mode: "live",

      team: {
        id: data.id,
        name: data.name || "",
        shortName: data.shortName || "",
        tla: data.tla || "",
        crest: data.crest || "",
        address: data.address || "",
        website: data.website || "",
        founded: data.founded || null,
        clubColors: data.clubColors || "",
        venue: data.venue || "",
        coach: data.coach?.name || "Not available",

        squad: (data.squad || []).map(player => ({
          id: player.id,
          name: player.name || "",
          position: player.position || "",
          dateOfBirth: player.dateOfBirth || null,
          nationality: player.nationality || "",
          shirtNumber: player.shirtNumber ?? null
        }))
      }
    });

  } catch (error) {
    console.error(
      "Team profile error:",
      error.message
    );

    res.status(502).json({
      mode: "error",
      message: error.message
    });
  }
});

// FOOTBALL NEWS API
app.get("/api/news", async (req, res) => {
  try {
    const news = await getNews();

    res.json({
      mode: "live",
      source: "Global Football News",
      news
    });

  } catch (error) {
    console.error("News error:", error.message);

    res.status(502).json({
      mode: "error",
      error: "Official news is temporarily unavailable.",
      news: []
    });
  }
});

// STATIC FRONTEND
app.use(
  express.static(path.join(__dirname, "../public"))
);

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../public/index.html")
  );
});

// START SERVER
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `FOOTBALL WORLD listening on ${PORT}`
  );
});
