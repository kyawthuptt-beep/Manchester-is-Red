
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

// MATCHES API

app.get("/api/matches", async (req, res) => {
  if (!TOKEN) {
    return res.json({
      mode: "demo",
      matches: demoMatches
    });
  }

  try {
    const requestedDate = req.query.date;

    let dateFrom;
    let dateTo;
    let localStart = null;
    let localEnd = null;

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

      // Browser timezone offset: UTC - local time, in minutes
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

      // Convert selected local day into UTC boundaries
      localStart = new Date(
        selected.getTime() + timezoneOffset * 60000
      );

      localEnd = new Date(
        localStart.getTime() + 86400000
      );

      dateFrom = formatDate(localStart);

      // football-data.org dateTo is exclusive.
      // Include the final UTC calendar date in the search.
      dateTo = formatDate(
        new Date(Date.UTC(
          localEnd.getUTCFullYear(),
          localEnd.getUTCMonth(),
          localEnd.getUTCDate() + 1
        ))
      );

    } else {
      const today = new Date();

      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - 5);

      const to = new Date(today);
      to.setUTCDate(to.getUTCDate() + 5);

      dateFrom = formatDate(from);
      dateTo = formatDate(to);
    }

    const matchesPath =
      `/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

    const data = await football(matchesPath);

const liveMatches = (data.matches || []).filter(m =>
  ["IN_PLAY", "PAUSED", "HALFTIME"].includes(m.status)
);


console.log(
  "ALL MATCHES MINUTE CHECK:",
  JSON.stringify(
    (data.matches || []).map(m => ({
      id: m.id,
      home: m.homeTeam?.name,
      away: m.awayTeam?.name,
      status: m.status,
      minute: m.minute,
      score: m.score
    })),
    null,
    2
  )
);


    let rawMatches = [...(data.matches || [])];

    // Filter exact local-day boundaries
    if (localStart && localEnd) {
      rawMatches = rawMatches.filter(m => {
        if (!m.utcDate) return false;

        const kickoff = new Date(m.utcDate);

        return (
          kickoff >= localStart &&
          kickoff < localEnd
        );
      });
    }

    // Sort by UTC kickoff time
    rawMatches.sort((a, b) => {
      return (
        new Date(a.utcDate || 0).getTime() -
        new Date(b.utcDate || 0).getTime()
      );
    });

    const matches = rawMatches.map(m => ({
      id: m.id,

      date: m.utcDate
        ? new Date(m.utcDate).toLocaleString("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC"
          }) + " UTC"
        : "TBC",

      competition:
        m.competition?.name || "Competition",

      home: m.homeTeam?.name || "TBC",
      homeLogo: m.homeTeam?.crest || "",

      away: m.awayTeam?.name || "TBC",
      awayLogo: m.awayTeam?.crest || "",

      score:
        m.score?.fullTime?.home != null &&
        m.score?.fullTime?.away != null
          ? `${m.score.fullTime.home} - ${m.score.fullTime.away}`
          : m.status,

      status: m.status,
      minute: m.minute ?? null,
      injuryTime: m.injuryTime ?? null
    }));

    res.json({
      mode: "live",
      source: "Global Football Matches",
      dateFrom,
      dateTo,
      total: matches.length,
      matches
    });

  } catch (error) {
    console.error("Matches error:", error.message);

    res.status(502).json({
      mode: "error",
      error: error.message,
      matches: []
    });
  }
});


// LIVE MATCH TEST
app.get("/api/live-test", async (req, res) => {
  try {
    const data = await football("/matches?status=LIVE");

    const matches = (data.matches || []).map(m => ({
      id: m.id,

      competition:
        m.competition?.name || "Competition",

      home: m.homeTeam?.name || "TBC",
      homeLogo: m.homeTeam?.crest || "",

      away: m.awayTeam?.name || "TBC",
      awayLogo: m.awayTeam?.crest || "",

      score:
        m.score?.fullTime?.home != null &&
        m.score?.fullTime?.away != null
          ? `${m.score.fullTime.home} - ${m.score.fullTime.away}`
          : "—",

      status: m.status,
      minute: m.minute ?? null,
      injuryTime: m.injuryTime ?? null
    }));

    res.json({
      mode: "live",
      source: "football-data.org LIVE Filter",
      count: matches.length,
      matches
    });

  } catch (error) {
    console.error("Live test error:", error.message);

    res.status(502).json({
      mode: "error",
      error: error.message,
      matches: []
    });
  }
});

// DATE TEST
app.get("/api/date-test", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const data = await football(
      `/matches?date=${today}`
    );

    res.json({
      mode: "live",
      testDate: today,
      filters: data.filters || {},
      resultSet: data.resultSet || {},
      count: (data.matches || []).length,

      matches: (data.matches || []).map(m => ({
        id: m.id,
        date: m.utcDate,
        competition: m.competition?.name,
        home: m.homeTeam?.name,
        away: m.awayTeam?.name,
        status: m.status
      }))
    });

  } catch (error) {
    res.status(502).json({
      mode: "error",
      error: error.message
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
