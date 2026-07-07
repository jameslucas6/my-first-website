const PREMIER_LEAGUE_ID = 39;
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_SEASON_ATTEMPTS = 5;

let cache = { data: null, fetchedAt: 0 };

function currentSeasonYear() {
  const now = new Date();
  const year = now.getUTCFullYear();
  // Premier League seasons start in August, so before July still use last year's season.
  return now.getUTCMonth() < 6 ? year - 1 : year;
}

function hasApiErrors(payload) {
  const errors = payload?.errors;
  if (!errors) return false;
  return Array.isArray(errors) ? errors.length > 0 : Object.keys(errors).length > 0;
}

async function fetchStandingsForSeason(season, apiKey) {
  const response = await fetch(
    `https://v3.football.api-sports.io/standings?league=${PREMIER_LEAGUE_ID}&season=${season}`,
    { headers: { "x-apisports-key": apiKey } }
  );

  if (!response.ok) {
    throw new Error(`Upstream API responded with ${response.status}`);
  }

  const payload = await response.json();

  // A plan restriction (e.g. free tier only allows certain seasons) or an
  // empty result means this season isn't available - let the caller try an earlier one.
  if (hasApiErrors(payload) || !payload.response?.length) {
    return null;
  }

  const table = payload.response[0]?.league?.standings?.[0];
  if (!Array.isArray(table)) {
    return null;
  }

  return {
    season,
    standings: table.map((entry) => ({
      rank: entry.rank,
      team: entry.team.name,
      logo: entry.team.logo,
      played: entry.all.played,
      win: entry.all.win,
      draw: entry.all.draw,
      lose: entry.all.lose,
      goalsDiff: entry.goalsDiff,
      points: entry.points
    }))
  };
}

module.exports = async function (context, req) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    context.res = {
      status: 502,
      body: { error: "API_FOOTBALL_KEY is not configured on the server." }
    };
    return;
  }

  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    context.res = { status: 200, body: cache.data };
    return;
  }

  const startSeason = currentSeasonYear();

  try {
    let result = null;
    for (let i = 0; i < MAX_SEASON_ATTEMPTS && !result; i++) {
      result = await fetchStandingsForSeason(startSeason - i, apiKey);
    }

    if (!result) {
      throw new Error("No season with available standings data was found.");
    }

    cache = { data: result.standings, fetchedAt: Date.now() };
    context.res = { status: 200, body: result.standings };
  } catch (err) {
    context.res = {
      status: 502,
      body: { error: "Failed to fetch Premier League standings.", detail: err.message }
    };
  }
};
