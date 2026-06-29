const SUPABASE_REST_URL =
  "https://xletejbcfylwplhnlbjo.supabase.co/rest/v1";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_xsFEuz9LK0ZoQsMpxvgP-A_WHmTziL7";
const LEADERBOARD_TABLE = "leaderboard_entries";
const LEADERBOARD_LIMIT = 10;

const SUPABASE_HEADERS = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
};

const getLeaderboardUrl = () => {
  const url = new URL(`${SUPABASE_REST_URL}/${LEADERBOARD_TABLE}`);
  url.searchParams.set("select", "id,display_name,score,created_at");
  url.searchParams.set("order", "score.desc,created_at.asc");
  url.searchParams.set("limit", String(LEADERBOARD_LIMIT));

  return url;
};

const normalizeScore = (score) => {
  const value = Number(score);

  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
};

export const normalizeName = (name) => {
  const value = String(name ?? "").trim();

  return value.length > 0 ? value.slice(0, 32) : "Anonymous";
};

const normalizeLeaderboardEntry = (entry) => ({
  id: String(entry.id),
  name: normalizeName(entry.display_name),
  score: normalizeScore(entry.score),
  createdAt:
    typeof entry.created_at === "string"
      ? entry.created_at
      : new Date().toISOString(),
});

const readJson = async (response) => {
  const text = await response.text();

  return text.length > 0 ? JSON.parse(text) : null;
};

const assertOk = async (response, fallbackMessage) => {
  if (response.ok) {
    return;
  }

  let message = fallbackMessage;

  try {
    const body = await readJson(response);
    message = body?.message || body?.hint || message;
  } catch {
    // Keep the generic message if Supabase returns a non-JSON body.
  }

  throw new Error(message);
};

export const fetchLeaderboardEntries = async () => {
  const response = await fetch(getLeaderboardUrl(), {
    headers: SUPABASE_HEADERS,
  });

  await assertOk(response, "Failed to load leaderboard");

  const rows = await readJson(response);

  return Array.isArray(rows) ? rows.map(normalizeLeaderboardEntry) : [];
};

export const upsertLeaderboardEntry = async ({ name, score }) => {
  const displayName = normalizeName(name);
  const normalizedScore = normalizeScore(score);

  const response = await fetch(
    `${SUPABASE_REST_URL}/rpc/upsert_leaderboard_entry`,
    {
      method: "POST",
      headers: {
        ...SUPABASE_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_display_name: displayName,
        p_score: normalizedScore,
      }),
    },
  );

  await assertOk(response, "Failed to submit score");

  const result = await readJson(response);

  return normalizeLeaderboardEntry(
    result ?? {
      id: crypto.randomUUID(),
      display_name: displayName,
      score: normalizedScore,
      created_at: new Date().toISOString(),
    },
  );
};
