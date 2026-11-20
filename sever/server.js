
require("dotenv").config();
const KICKOFF_API_KEY = process.env.KICKOFF_API_KEY;
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
  const headers = {
    "X-Auth-Token": TOKEN
  };

  // MATCH EVENTS
  if (pathname.includes("/matches")) {
    headers["X-Unfold-Bookings"] = "true";
    headers["X-Unfold-Goals"] = "true";
  }

  const response = await fetch(
    "https://api.football-data.org/v4" + pathname,
    {
      headers
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

// KICKOFF API LEAGUE SEARCH TEST
app.get("/api/test-kickoff", async (req, res) => {
  try {
    if (!KICKOFF_API_KEY) {
      return res.status(503).json({
        ok: false,
        message: "KICKOFF_API_KEY is missing"
      });
    }

    const search = String(
      req.query.search || "AFCON"
    ).trim();

    if (!search || search.length > 80) {
      return res.status(400).json({
        ok: false,
        message: "Invalid search term"
      });
    }

    const params = new URLSearchParams({
      search,
      limit: "20"
    });

    const response = await fetch(
      "https://api.kickoffapi.com/api/v2/leagues?" +
      params.toString(),
      {
        headers: {
          "x-api-key": KICKOFF_API_KEY
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        provider: "KickoffAPI",
        error: data.error || data.message || data
      });
    }

    const leagues = Array.isArray(data.data)
      ? data.data
      : [];

    res.json({
      ok: true,
      provider: "KickoffAPI",
      search,
      total: leagues.length,
      leagues: leagues.map(item => ({
        id: item.id,
        name: item.name,
        country: item.country || ""
      }))
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "KickoffAPI",
      error: error.message
    });
  }
});

// KICKOFF API PREMIER LEAGUE SEASON FIXTURES
app.get("/api/test-kickoff-fixtures", async (req, res) => {
  try {
    if (!KICKOFF_API_KEY) {
      return res.status(503).json({
        ok: false,
        message: "KICKOFF_API_KEY is missing"
      });
    }

    const league = String(
      req.query.league || "lg_LxmgPz3lWqFz"
    ).trim();

    const season = Number(req.query.season) || 2026;

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 200, 1),
      2000
    );

    const cursor = Math.max(
      Number(req.query.cursor) || 0,
      0
    );

    if (!/^[A-Za-z0-9_-]+$/.test(league)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid league ID"
      });
    }

    const params = new URLSearchParams({
      league,
      season: String(season),
      limit: String(limit),
      cursor: String(cursor)
    });

    const from = req.query.from
      ? String(req.query.from).trim()
      : "";

    const to = req.query.to
      ? String(req.query.to).trim()
      : "";

    const validDate = value =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value));

    if ((from && !validDate(from)) ||
        (to && !validDate(to))) {
      return res.status(400).json({
        ok: false,
        message: "Date must use YYYY-MM-DD"
      });
    }

    if (Boolean(from) !== Boolean(to)) {
      return res.status(400).json({
        ok: false,
        message: "Both from and to dates are required"
      });
    }

    if (from && to) {
      if (from > to) {
        return res.status(400).json({
          ok: false,
          message: "from date must not be after to date"
        });
      }

      params.set("from", from);
      params.set("to", to);
    }

    const response = await fetch(
      "https://api.kickoffapi.com/api/v2/fixtures?" +
      params.toString(),
      {
        headers: {
          "x-api-key": KICKOFF_API_KEY
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    const body = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        provider: "KickoffAPI",
        error: body.error || body.message || body
      });
    }

    const fixtures = Array.isArray(body.data)
      ? body.data
      : [];

    // FIXTURE DATA DIAGNOSTICS
    const groups = {};

    for (const item of fixtures) {
      const date = String(item.date || "").slice(0, 10);
      const home = String(item.home?.name || "TBC").toLowerCase().trim();
      const away = String(item.away?.name || "TBC").toLowerCase().trim();

      const key = `${date}|${home}|${away}`;

      if (!groups[key]) {
        groups[key] = {
          date,
          home,
          away,
          count: 0,
          ids: [],
          statuses: [],
          leagueIds: []
        };
      }

      groups[key].count++;

      if (item.id) groups[key].ids.push(item.id);

      groups[key].statuses.push(
        item.status?.short || "UNKNOWN"
      );

      if (item.league?.id) {
        groups[key].leagueIds.push(item.league.id);
      }
    }

    const duplicateMatches = Object.values(groups)
      .filter(item => item.count > 1);

    const statusConflicts = Object.values(groups)
      .filter(item => new Set(item.statuses).size > 1);

    const leagueIds = [
      ...new Set(
        fixtures
          .map(item => item.league?.id)
          .filter(Boolean)
      )
    ];

    const diagnostics = {
      totalFixtures: fixtures.length,
      uniqueMatchGroups: Object.keys(groups).length,
      duplicateMatches,
      statusConflicts,
      returnedLeagueIds: leagueIds
    };

        res.json({
      ok: true,
      provider: "KickoffAPI",
      league,
      season,
      total: fixtures.length,

      meta: body.meta || {},

      fixtures: fixtures.map(item => ({
        id: item.id,
        date: item.date || "",

        league: item.league?.name || "",

        homeId: item.home?.id || "",
        home: item.home?.name || "TBC",
        homeLogo: item.home?.logo || "",

        awayId: item.away?.id || "",
        away: item.away?.name || "TBC",
        awayLogo: item.away?.logo || "",

        homeScore: item.score?.home ?? null,
        awayScore: item.score?.away ?? null,

        status: item.status?.short || "UNKNOWN",
        statusLong: item.status?.long || "",
        minute: item.status?.elapsed ?? null,

        source: item.source || ""
      })),

          rawSample: fixtures.slice(0, 3),

      diagnostics
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "KickoffAPI",
      error: error.message
    });
  }
});


// KICKOFF API ENGLAND TEAMS TEST
app.get("/api/test-kickoff-teams", async (req, res) => {
  try {
    if (!KICKOFF_API_KEY) {
      return res.status(503).json({
        ok: false,
        message: "KICKOFF_API_KEY is missing"
      });
    }

   const country = req.query.country
  ? String(req.query.country).trim()
  : ""; 

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 200, 1),
      2000
    );

    const cursor = Math.max(
      Number(req.query.cursor) || 0,
      0
    );

    const params = new URLSearchParams({
  limit: String(limit),
  cursor: String(cursor)
});

if (country) {
  params.set("country", country);
}

    const response = await fetch(
      "https://api.kickoffapi.com/api/v2/teams?" +
      params.toString(),
      {
        headers: {
          "x-api-key": KICKOFF_API_KEY
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    const body = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        provider: "KickoffAPI",
        error: body.error || body.message || body
      });
    }

    const teams = Array.isArray(body.data)
      ? body.data
      : [];

    res.json({
      ok: true,
      provider: "KickoffAPI",
      country,
      total: teams.length,
      meta: body.meta || {},
      teams: teams.map(item => ({
        id: item.id || "",
        name: item.name || "",
        country: item.country || "",
        logo: item.logo || ""
      }))
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "KickoffAPI",
      error: error.message
    });
  }
});

// KICKOFF API TEAM SQUAD TEST
app.get("/api/test-kickoff-team-squad/:id", async (req, res) => {
  try {
    if (!KICKOFF_API_KEY) {
      return res.status(503).json({
        ok: false,
        message: "KICKOFF_API_KEY is missing"
      });
    }

    const teamId = String(req.params.id || "").trim();

    if (!teamId.startsWith("tm_")) {
      return res.status(400).json({
        ok: false,
        message: "Invalid KickoffAPI team ID"
      });
    }

    const response = await fetch(
      `https://api.kickoffapi.com/api/v2/teams/${encodeURIComponent(teamId)}/squad`,
      {
        headers: {
          "x-api-key": KICKOFF_API_KEY
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    const body = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        provider: "KickoffAPI",
        error: body.error || body.message || body
      });
    }

    res.json({
      ok: true,
      provider: "KickoffAPI",
      teamId,
      meta: body.meta || {},
      squad: Array.isArray(body.data) ? body.data : []
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "KickoffAPI",
      error: error.message
    });
  }
});

// KICKOFF API RAW TEAM FIELDS DIAGNOSTIC TEST
app.get("/api/test-kickoff-raw-fields", async (req, res) => {
  try {
    if (!KICKOFF_API_KEY) {
      return res.status(503).json({
        ok: false,
        message: "KICKOFF_API_KEY is missing"
      });
    }

    const params = new URLSearchParams({
      limit: "3",
      cursor: "0"
    });

    const response = await fetch(
      "https://api.kickoffapi.com/api/v2/teams?" +
      params.toString(),
      {
        headers: {
          "x-api-key": KICKOFF_API_KEY
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    const body = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        provider: "KickoffAPI",
        error: body.error || body.message || body
      });
    }

    const teams = Array.isArray(body.data)
      ? body.data
      : [];

    res.json({
      ok: true,
      provider: "KickoffAPI",
      totalReturned: teams.length,
      meta: body.meta || {},

      dataFields: teams.length > 0
        ? Object.keys(teams[0])
        : [],

      sampleTeams: teams

    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "KickoffAPI",
      error: error.message
    });
  }
});

// KICKOFF API PREMIER LEAGUE STANDINGS TEST
app.get("/api/test-kickoff-standings", async (req, res) => {
  try {
    if (!KICKOFF_API_KEY) {
      return res.status(503).json({
        ok: false,
        message: "KICKOFF_API_KEY is missing"
      });
    }

    const league = String(
      req.query.league || "lg_LxmgPz3lWqFz"
    ).trim();

    const season = Number(req.query.season) || 2026;

    const params = new URLSearchParams({
      league,
      season: String(season)
    });

    const response = await fetch(
      "https://api.kickoffapi.com/api/v2/standings?" +
      params.toString(),
      {
        headers: {
          "x-api-key": KICKOFF_API_KEY
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    const body = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        provider: "KickoffAPI",
        error: body.error || body.message || body
      });
    }

    const standings = Array.isArray(body.data)
      ? body.data
      : [];

    res.json({
      ok: true,
      provider: "KickoffAPI",
      league,
      season,
      total: standings.length,
      meta: body.meta || {},
      rawSample: standings.slice(0, 5),
      standings
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "KickoffAPI",
      error: error.message
    });
  }
});
// KICKOFF API LEAGUE DATA SOURCE TEST
app.get("/api/test-kickoff-source", async (req, res) => {
  try {
    const league = "lg_LxmgPz3lWqFz";

    const response = await fetch(
      `https://api.kickoffapi.com/api/v2/leagues/${league}/source`,
      {
        headers: { "x-api-key": KICKOFF_API_KEY },
        signal: AbortSignal.timeout(15000)
      }
    );

    const body = await response.json();

    res.status(response.status).json({
      ok: response.ok,
      provider: "KickoffAPI",
      data: body
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error.message
    });
  }
});

// OPENFOOTBALL ORIGINAL DATA TEST
app.get("/api/test-openfootball", async (req, res) => {
  try {
    const url =
      "https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/en.1.json";

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`OpenFootball HTTP ${response.status}`);
    }

    const body = await response.json();
    const matches = body.matches || [];

    const keys = matches.map(match =>
      `${match.date}|${match.team1}|${match.team2}`.toLowerCase()
    );

    const duplicates = keys.length - new Set(keys).size;

    res.json({
      ok: true,
      source: "OpenFootball",
      league: body.name,
      totalMatches: matches.length,
      duplicateMatches: duplicates,
      firstFiveMatches: matches.slice(0, 5)
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error.message
    });
  }
});

 // OPENFOOTBALL STANDINGS TEST
app.get("/api/test-openfootball-standings", async (req, res) => {
  try {
    const url =
      "https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/en.1.json";

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = await response.json();
    const matches = body.matches || [];
    const table = {};

    let completedMatches = 0;

    for (const match of matches) {
      const home = match.team1;
      const away = match.team2;
      const score = match.score?.ft;

      if (!home || !away) continue;

      for (const name of [home, away]) {
        if (!table[name]) {
          table[name] = {
            team: name,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalsDiff: 0,
            points: 0
          };
        }
      }

      if (
        !Array.isArray(score) ||
        score.length !== 2 ||
        !score.every(Number.isFinite)
      ) continue;

      const [hg, ag] = score;
      const h = table[home];
      const a = table[away];

      completedMatches++;

      h.played++;
      a.played++;

      h.goalsFor += hg;
      h.goalsAgainst += ag;
      a.goalsFor += ag;
      a.goalsAgainst += hg;

      if (hg > ag) {
        h.won++;
        h.points += 3;
        a.lost++;
      } else if (hg < ag) {
        a.won++;
        a.points += 3;
        h.lost++;
      } else {
        h.drawn++;
        a.drawn++;
        h.points++;
        a.points++;
      }
    }

    const standings = Object.values(table)
      .map(team => ({
        ...team,
        goalsDiff: team.goalsFor - team.goalsAgainst
      }))
      .sort((a, b) =>
        b.points - a.points ||
        b.goalsDiff - a.goalsDiff ||
        b.goalsFor - a.goalsFor
      )
      .map((team, index) => ({
        rank: index + 1,
        ...team
      }));

    res.json({
      ok: true,
      source: "OpenFootball",
      league: body.name,
      totalFixtures: matches.length,
      completedMatches,
      totalTeams: standings.length,
      standings
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
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


/* =========================================
   MATCHES API
   Date / League / Season / Team Fixtures
========================================= */

app.get("/api/matches", async (req, res) => {
  if (!TOKEN) {
    return res.status(503).json({
      mode: "error",
      error: "FOOTBALL_DATA_TOKEN is missing",
      matches: []
    });
  }

  try {
    const {
      date,
      dateFrom: requestedFrom,
      dateTo: requestedTo,
      competition,
      season,
      teamId
    } = req.query;

    const isValidDate = value =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value;

    let endpoint = "";

    
    const params = new URLSearchParams();

    if (date && (requestedFrom || requestedTo)) {
      return res.status(400).json({
        mode: "error",
        error: "Use date OR dateFrom/dateTo, not both",
        matches: []
      });
    }

    if (competition && teamId !== undefined) {
      return res.status(400).json({
        mode: "error",
        error: "Use competition OR teamId, not both",
        matches: []
      });
    }

    let dateFrom = null;
    let dateTo = null;

    const hasExplicitDate = Boolean(
      date || requestedFrom || requestedTo
    );

    if (date) {
      if (!isValidDate(date)) {
        return res.status(400).json({
          mode: "error",
          error: "Invalid date format",
          matches: []
        });
      }

      dateFrom = date;
      dateTo = date;

    } else if (requestedFrom || requestedTo) {
      if (
        (requestedFrom && !isValidDate(requestedFrom)) ||
        (requestedTo && !isValidDate(requestedTo))
      ) {
        return res.status(400).json({
          mode: "error",
          error: "Invalid date range",
          matches: []
        });
      }

      dateFrom = requestedFrom || requestedTo;
      dateTo = requestedTo || requestedFrom;

      if (dateFrom > dateTo) {
        return res.status(400).json({
          mode: "error",
          error: "dateFrom cannot be after dateTo",
          matches: []
        });
      }
    }

    if (season !== undefined) {
      if (!/^\d{4}$/.test(String(season))) {
        return res.status(400).json({
          mode: "error",
          error: "Invalid season",
          matches: []
        });
      }

      if (!competition || teamId !== undefined) {
        return res.status(400).json({
          mode: "error",
          error: "Full season requires a competition code",
          matches: []
        });
      }

      params.set("season", String(season));
    }

    if (competition) {
      if (!/^[A-Za-z0-9_-]+$/.test(String(competition))) {
        return res.status(400).json({
          mode: "error",
          error: "Invalid competition code",
          matches: []
        });
      }
    }

    if (hasExplicitDate) {
      params.set("dateFrom", dateFrom);
      params.set("dateTo", dateTo);

    } else if (season === undefined) {
      const today = new Date();

      dateFrom = today.toISOString().slice(0, 10);

      const nextWeek = new Date(today);
      nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

      dateTo = nextWeek.toISOString().slice(0, 10);

      params.set("dateFrom", dateFrom);
      params.set("dateTo", dateTo);
    }

    if (teamId !== undefined) {
      if (!/^\d+$/.test(String(teamId))) {
        return res.status(400).json({
          mode: "error",
          error: "Invalid teamId",
          matches: []
        });
      }

      endpoint =
        `/teams/${teamId}/matches?${params.toString()}`;

    } else if (competition) {
      endpoint =
        `/competitions/${encodeURIComponent(competition)}/matches?${params.toString()}`;

    } else {
      endpoint = `/matches?${params.toString()}`;
    }

    const cacheKey = `matches_${endpoint}`;

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
      data = await football(endpoint);

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
      } else if (
        statusCode === "PAUSED" ||
        statusCode === "HALF_TIME"
      ) {
        status = "HALF_TIME";
      } else if (statusCode === "FINISHED") {
        status = "FINISHED";
      } else if (
        ["SUSPENDED", "POSTPONED"].includes(statusCode)
      ) {
        status = "PAUSED";
      }

      const scoreData = item.score || {};

      const homeScore =
        status === "FINISHED"
          ? scoreData.fullTime?.home
          : scoreData.fullTime?.home ??
            scoreData.halfTime?.home;

      const awayScore =
        status === "FINISHED"
          ? scoreData.fullTime?.away
          : scoreData.fullTime?.away ??
            scoreData.halfTime?.away;

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

        home:
          item.homeTeam?.name || "TBC",

        homeLogo:
          item.homeTeam?.crest || "",

        away:
          item.awayTeam?.name || "TBC",

        awayLogo:
          item.awayTeam?.crest || "",

        score:
          hasScore
            ? `${homeScore} - ${awayScore}`
            : "—",

        
status,
minute: item.minute ?? null,
injuryTime: item.injuryTime ?? null,

// GOAL EVENTS
goals: (item.goals || []).map(goal => ({
  minute: goal.minute ?? null,
  injuryTime: goal.injuryTime ?? null,
  team: goal.team?.name || "",
  scorer: goal.scorer?.name || "",
  type: goal.type || "REGULAR"
})),

// RED CARD EVENTS ONLY
redCards: (item.bookings || [])
  .filter(card =>
    card.card === "RED" ||
    card.card === "YELLOW_RED"
  )
  .map(card => ({
    minute: card.minute ?? null,
    team: card.team?.name || "",
    player: card.player?.name || "",
    card: card.card
  }))

      };
    });

    res.json({
      mode: "live",
      source: "football-data.org",
      dateFrom,
      dateTo,
      season: season ? Number(season) : null,
      competition: competition || null,
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

// KICKOFF API V1 STANDINGS TEST
app.get("/api/test-kickoff-v1-standings", async (req, res) => {
  try {
    const url =
      "https://api.kickoffapi.com/api/v1/standings?league=39&season=2026";

    const response = await fetch(url, {
      headers: { "x-api-key": KICKOFF_API_KEY },
      signal: AbortSignal.timeout(15000)
    });

    const body = await response.json();

    res.status(response.status).json({
      ok: response.ok,
      provider: "KickoffAPI",
      version: "v1",
      league: 39,
      season: 2026,
      total: body.results || 0,
      standings: (body.response || []).map(row => ({
        rank: row.rank,
        team: row.team,
        points: row.points,
        played: row.allPlayed,
        won: row.allWin,
        drawn: row.allDraw,
        lost: row.allLose,
        goalsFor: row.allGoalsFor,
        goalsAgainst: row.allGoalsAgainst,
        goalsDiff: row.goalsDiff,
        form: row.form,
        source: row.source
      }))
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error.message
    });
  }
});

// KICKOFF API V2 FULL STANDINGS TEST
app.get("/api/test-kickoff-v2-standings", async (req, res) => {
  try {
    const league = "lg_LxmgPz3lWqFz";
    const season = 2026;

    const url = new URL(
      "https://api.kickoffapi.com/api/v2/standings"
    );

    url.searchParams.set("league", league);
    url.searchParams.set("season", season);

    const response = await fetch(url, {
      headers: { "x-api-key": KICKOFF_API_KEY },
      signal: AbortSignal.timeout(12000)
    });

    const text = await response.text();

    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { rawResponse: text.slice(0, 2000) };
    }

    res.status(response.status).json({
      ok: response.ok,
      provider: "KickoffAPI",
      version: "v2",
      httpStatus: response.status,
      requestedLeague: league,
      season,
      meta: body.meta || {},
      total: body.data?.length || 0,
      standings: body.data || [],
      error: body.error || null
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "KickoffAPI",
      error: error.message
    });
  }
});

// KICKOFF API V2 STANDINGS SOURCE TEST
app.get("/api/test-kickoff-v2-source", async (req, res) => {
  try {
    const league = "lg_LxmgPz3lWqFz";

    const url = new URL(
      `https://api.kickoffapi.com/api/v2/leagues/${league}/source`
    );

    const response = await fetch(url, {
      headers: { "x-api-key": KICKOFF_API_KEY },
      signal: AbortSignal.timeout(12000)
    });

    const body = await response.json();

    res.status(response.status).json({
      ok: response.ok,
      provider: "KickoffAPI",
      test: "standings-source",
      httpStatus: response.status,
      sourceData: body.data || null,
      meta: body.meta || {},
      error: body.error || null
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "KickoffAPI",
      error: error.message
    });
  }
});

// OPENFOOTBALL SCORE FORMAT VALIDATION TEST
app.get("/api/test-openfootball-score-formats", async (req, res) => {
  try {
    const url =
      "https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/en.1.json";

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`OpenFootball HTTP ${response.status}`);
    }

    const body = await response.json();
    const matches = body.matches || [];

    const stats = {};
    const scoreFormats = {
      ftObject: 0,
      scoreArray: 0,
      missingScore: 0,
      other: 0
    };

    for (const match of matches) {
      for (const team of [match.team1, match.team2]) {
        if (!stats[team]) {
          stats[team] = {
            team,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0
          };
        }
      }

      let score = null;
      let format = "missing";

      if (
        Array.isArray(match.score?.ft) &&
        match.score.ft.length === 2
      ) {
        score = match.score.ft;
        format = "ftObject";
      } else if (
        Array.isArray(match.score) &&
        match.score.length === 2 &&
        match.score.every(Number.isFinite)
      ) {
        score = match.score;
        format = "scoreArray";
      } else if (match.score) {
        format = "other";
      }

      scoreFormats[format]++;

      if (!score) continue;

      const [homeGoals, awayGoals] = score;

      const home = stats[match.team1];
      const away = stats[match.team2];

      home.played++;
      away.played++;

      home.goalsFor += homeGoals;
      home.goalsAgainst += awayGoals;

      away.goalsFor += awayGoals;
      away.goalsAgainst += homeGoals;

      if (homeGoals > awayGoals) {
        home.won++;
        home.points += 3;
        away.lost++;
      } else if (homeGoals < awayGoals) {
        away.won++;
        away.points += 3;
        home.lost++;
      } else {
        home.drawn++;
        away.drawn++;
        home.points++;
        away.points++;
      }
    }

    const standings = Object.values(stats)
      .map(team => ({
        ...team,
        goalsDiff: team.goalsFor - team.goalsAgainst
      }))
      .sort((a, b) =>
        b.points - a.points ||
        b.goalsDiff - a.goalsDiff ||
        b.goalsFor - a.goalsFor
      )
      .map((team, index) => ({
        rank: index + 1,
        ...team
      }));

    res.json({
      ok: true,
      source: "OpenFootball",
      season: "2026-27",
      totalFixtures: matches.length,
      scoreFormats,
      calculatedMatches:
        scoreFormats.ftObject + scoreFormats.scoreArray,
      standings,
      warning:
        "Array scores are counted as results for diagnostic comparison; verify their meaning before production use."
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      source: "OpenFootball",
      error: error.message
    });
  }
});

// OPENFOOTBALL ZERO SCORE MATCH INSPECTION
app.get("/api/test-openfootball-zero-score-matches", async (req, res) => {
  try {
    const url =
      "https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/en.1.json";

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`OpenFootball HTTP ${response.status}`);
    }

    const body = await response.json();
    const matches = body.matches || [];

    const zeroScoreMatches = matches.filter(match =>
      Array.isArray(match.score) &&
      match.score.length === 2 &&
      match.score[0] === 0 &&
      match.score[1] === 0
    );

    res.json({
      ok: true,
      source: "OpenFootball",
      season: "2026-27",
      totalZeroScoreMatches: zeroScoreMatches.length,
      matches: zeroScoreMatches
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error.message
    });
  }
});

// KICKOFF API V2 FIXTURES QUALITY TEST
app.get("/api/test-kickoff-v2-fixtures-quality", async (req, res) => {
  try {
    const league = "lg_LxmgPz3lWqFz";
    const season = 2026;

    const url = new URL(
      "https://api.kickoffapi.com/api/v2/fixtures"
    );

    url.searchParams.set("league", league);
    url.searchParams.set("season", season);
    url.searchParams.set("limit", "200");

    const response = await fetch(url, {
      headers: { "x-api-key": KICKOFF_API_KEY },
      signal: AbortSignal.timeout(15000)
    });

    const text = await response.text();

    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { rawResponse: text.slice(0, 2000) };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        provider: "KickoffAPI",
        httpStatus: response.status,
        error: body.error || body.rawResponse || "API request failed"
      });
    }

    const fixtures = body.data || [];

    const statusCounts = {};
    const duplicateGroups = {};
    const issues = [];

    for (const fx of fixtures) {
      const status = fx.status?.short || "UNKNOWN";

      statusCounts[status] = (statusCounts[status] || 0) + 1;

      const home = fx.home?.name || "UNKNOWN";
      const away = fx.away?.name || "UNKNOWN";
      const date = fx.date?.slice(0, 10) || "NO_DATE";

      const key = `${date}|${home}|${away}`;

      if (!duplicateGroups[key]) {
        duplicateGroups[key] = [];
      }

      duplicateGroups[key].push({
        id: fx.id,
        date: fx.date,
        status,
        score: fx.score
      });

      if (fx.league?.id !== league) {
        issues.push({
          type: "WRONG_LEAGUE_ID",
          fixtureId: fx.id,
          actualLeague: fx.league?.id || null
        });
      }

      if (!fx.home?.id || !fx.away?.id) {
        issues.push({
          type: "MISSING_TEAM_ID",
          fixtureId: fx.id,
          home: fx.home?.name,
          away: fx.away?.name
        });
      }

      if (
        ["FT", "AET", "PEN"].includes(status) &&
        (
          !Number.isFinite(fx.score?.home) ||
          !Number.isFinite(fx.score?.away)
        )
      ) {
        issues.push({
          type: "MISSING_FINISHED_SCORE",
          fixtureId: fx.id,
          home,
          away,
          status
        });
      }
    }

    const duplicates = Object.entries(duplicateGroups)
      .filter(([key, rows]) => rows.length > 1)
      .map(([key, rows]) => ({ key, rows }));

    const completedMatches = fixtures.filter(fx =>
      ["FT", "AET", "PEN"].includes(fx.status?.short)
    );

    res.json({
      ok: true,
      provider: "KickoffAPI",
      test: "v2-fixtures-quality",
      httpStatus: response.status,
      requestedLeague: league,
      season,
      pageSize: 200,
      totalReturned: fixtures.length,
      completedMatches: completedMatches.length,
      meta: body.meta || {},
      statusCounts,
      duplicateGroups: duplicates.length,
      duplicates,
      issueCount: issues.length,
      issues: issues.slice(0, 30),
      sampleFinishedMatches: completedMatches.slice(0, 10).map(fx => ({
        id: fx.id,
        date: fx.date,
        home: fx.home?.name,
        away: fx.away?.name,
        homeId: fx.home?.id || null,
        awayId: fx.away?.id || null,
        score: fx.score,
        status: fx.status?.short,
        source: fx.source || null
      }))
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "KickoffAPI",
      error: error.message
    });
  }
});

// KICKOFF API V2 LEAGUE ID CHECK
app.get("/api/test-kickoff-v2-league-id-check", async (req, res) => {
  try {
    const url = new URL(
      "https://api.kickoffapi.com/api/v2/fixtures"
    );

    url.searchParams.set("league", "39");
    url.searchParams.set("season", "2026");
    url.searchParams.set("limit", "10");

    const response = await fetch(url, {
      headers: { "x-api-key": KICKOFF_API_KEY },
      signal: AbortSignal.timeout(15000)
    });

    const body = await response.json();

    res.status(response.status).json({
      ok: response.ok,
      test: "legacy-league-id-check",
      requestedLeague: "39",
      totalReturned: body.data?.length || 0,
      meta: body.meta || {},
      leagueIdsReturned: [
        ...new Set(
          (body.data || []).map(fx => fx.league?.id || "MISSING")
        )
      ],
      sample: (body.data || []).slice(0, 5).map(fx => ({
        id: fx.id,
        date: fx.date,
        league: fx.league,
        home: fx.home?.name,
        away: fx.away?.name,
        status: fx.status?.short,
        score: fx.score
      })),
      error: body.error || null
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error.message
    });
  }
});

// KICKOFF API GLOBAL LEAGUES TEST
app.get("/api/test-kickoff-leagues", async (req, res) => {
  try {
    if (!KICKOFF_API_KEY) {
      return res.status(503).json({
        ok: false,
        message: "KICKOFF_API_KEY is missing"
      });
    }

    const params = new URLSearchParams({
      limit: "2000",
      cursor: "0"
    });

    const response = await fetch(
      "https://api.kickoffapi.com/api/v2/leagues?" +
      params.toString(),
      {
        headers: {
          "x-api-key": KICKOFF_API_KEY
        },
        signal: AbortSignal.timeout(20000)
      }
    );

    const body = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        provider: "KickoffAPI",
        error: body.error || body.message || body
      });
    }

    const leagues = Array.isArray(body.data)
      ? body.data
      : [];

    const countries = [
      ...new Set(
        leagues
          .map(item => item.country || "")
          .filter(Boolean)
      )
    ];

    const types = [
      ...new Set(
        leagues
          .map(item => item.type || "")
          .filter(Boolean)
      )
    ];

    res.json({
      ok: true,
      provider: "KickoffAPI",
      total: leagues.length,
      meta: body.meta || {},
      countryCount: countries.length,
      competitionTypes: types,
      dataFields: leagues.length > 0
        ? Object.keys(leagues[0])
        : [],
      sampleLeagues: leagues.slice(0, 3).map(item => ({
        id: item.id || "",
        name: item.name || "",
        country: item.country || "",
        type: item.type || "",
        logo: item.logo || ""
      }))
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "KickoffAPI",
      error: error.message
    });
  }
});

 // KICKOFF API LEAGUE TEAMS RELATIONSHIP TEST
app.get("/api/test-kickoff-league-teams/:leagueId", async (req, res) => {
  try {
    if (!KICKOFF_API_KEY) {
      return res.status(503).json({
        ok: false,
        message: "KICKOFF_API_KEY is missing"
      });
    }

    const leagueId = String(req.params.leagueId || "").trim();

    if (!leagueId.startsWith("lg_")) {
      return res.status(400).json({
        ok: false,
        message: "Invalid KickoffAPI league ID"
      });
    }

    const params = new URLSearchParams({
      league: leagueId,
      limit: "10",
      cursor: "0"
    });

    const response = await fetch(
      "https://api.kickoffapi.com/api/v2/teams?" +
      params.toString(),
      {
        headers: {
          "x-api-key": KICKOFF_API_KEY
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    const body = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        provider: "KickoffAPI",
        error: body.error || body.message || body
      });
    }

    const teams = Array.isArray(body.data)
      ? body.data
      : [];

    res.json({
      ok: true,
      provider: "KickoffAPI",
      requestedLeague: leagueId,
      totalReturned: teams.length,
      meta: body.meta || {},
      dataFields: teams.length > 0
        ? Object.keys(teams[0])
        : [],
      sampleTeams: teams.slice(0, 5)
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "KickoffAPI",
      error: error.message
    });
  }
});

// KICKOFF API COUNTRY TEAMS FILTER TEST
app.get("/api/test-kickoff-country-teams", async (req, res) => {
  try {
    if (!KICKOFF_API_KEY) {
      return res.status(503).json({
        ok: false,
        message: "KICKOFF_API_KEY is missing"
      });
    }

    const country = String(
      req.query.country || "Lithuania"
    ).trim();

    const cursor = String(
  req.query.cursor || "0"
).trim();

const params = new URLSearchParams({
  country,
  limit: "10",
  cursor
});

    const response = await fetch(
      "https://api.kickoffapi.com/api/v2/teams?" +
      params.toString(),
      {
        headers: {
          "x-api-key": KICKOFF_API_KEY
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    const body = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        provider: "KickoffAPI",
        error: body.error || body.message || body
      });
    }

    const teams = Array.isArray(body.data)
      ? body.data
      : [];

    res.json({
      ok: true,
      provider: "KickoffAPI",
      requestedCountry: country,
      totalReturned: teams.length,
      meta: body.meta || {},
      returnedCountries: [
        ...new Set(
          teams.map(team => team.country || "MISSING")
        )
      ],
      dataFields: teams.length > 0
        ? Object.keys(teams[0])
        : [],
      sampleTeams: teams.slice(0, 5).map(team => ({
        id: team.id || "",
        name: team.name || "",
        country: team.country || "",
        logo: team.logo || "",
        source: team.source || ""
      }))
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "KickoffAPI",
      error: error.message
    });
  }
});

// KICKOFF API LEAGUE FIXTURES TEST
app.get("/api/test-kickoff-league-fixtures/:leagueId", async (req, res) => {
  try {
    if (!KICKOFF_API_KEY) {
      return res.status(503).json({
        ok: false,
        message: "KICKOFF_API_KEY is missing"
      });
    }

    const leagueId = String(req.params.leagueId || "").trim();
    const season = String(req.query.season || "2026").trim();
    const cursor = String(req.query.cursor || "0").trim();

    const params = new URLSearchParams({
      league: leagueId,
      season,
      limit: "10",
      cursor
    });

    const response = await fetch(
      "https://api.kickoffapi.com/api/v2/fixtures?" +
      params.toString(),
      {
        headers: {
          "x-api-key": KICKOFF_API_KEY
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    const body = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        provider: "KickoffAPI",
        error: body.error || body.message || body
      });
    }

    const fixtures = Array.isArray(body.data)
      ? body.data
      : [];

    const teams = new Map();

    fixtures.forEach(fixture => {
      [fixture.home, fixture.away].forEach(team => {
        if (team && team.id) {
          teams.set(team.id, {
            id: team.id,
            name: team.name || "",
            logo: team.logo || ""
          });
        }
      });
    });

    res.json({
      ok: true,
      provider: "KickoffAPI",
      requestedLeague: leagueId,
      requestedSeason: season,
      totalReturned: fixtures.length,
      meta: body.meta || {},
      dataFields: fixtures.length > 0
        ? Object.keys(fixtures[0])
        : [],
      leagueInfo: fixtures.length > 0
        ? fixtures[0].league || null
        : null,
      uniqueTeamsFound: teams.size,
      sampleTeams: [...teams.values()].slice(0, 10),
      sampleFixtures: fixtures.slice(0, 3).map(fixture => ({
        id: fixture.id || "",
        date: fixture.date || "",
        home: fixture.home || null,
        away: fixture.away || null,
        status: fixture.status || null,
        league: fixture.league || null
      }))
    });

  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: "KickoffAPI",
      error: error.message
    });
  }
});

// STATIC FRONTEND
app.use(
  express.static(path.join(__dirname, "../public"))
);

// FRONTEND FALLBACK
app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../public/index.html")
  );
});

// START SERVER — MUST BE LAST
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `FOOTBALL WORLD listening on ${PORT}`
  );
});
