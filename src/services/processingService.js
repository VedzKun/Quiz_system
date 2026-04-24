/**
 * Core business logic: deduplication, score aggregation, and leaderboard generation.
 */

// Deduplicates raw messages using the composite key (roundId + participant).
function deduplicateMessages(rawMessages) {
  /** @type {Map<string, Object>} */
  const seen = new Map();
  let duplicateCount = 0;

  for (const msg of rawMessages) {
    const roundId = msg.roundId ?? msg.round_id ?? msg.round;
    const participant = msg.participant ?? msg.user ?? msg.name;

    if (roundId === undefined || participant === undefined) {
      console.warn('[Processing] Skipping malformed message (missing roundId or participant):', msg);
      continue;
    }

    const key = `${roundId}::${participant}`;

    if (seen.has(key)) {
      duplicateCount++;
      console.log(`[Processing] Duplicate skipped → key="${key}"`);
    } else {
      seen.set(key, { roundId, participant, score: Number(msg.score ?? 0) });
    }
  }

  const unique = Array.from(seen.values());
  console.log(
    `[Processing] Deduplication: ${rawMessages.length} raw → ${unique.length} unique (${duplicateCount} duplicate(s) dropped)`
  );
  return unique;
}

// Aggregates total scores per participant.
function aggregateScores(uniqueMessages) {
  /** @type {Map<string, number>} */
  const scoreMap = new Map();

  for (const { participant, score } of uniqueMessages) {
    const current = scoreMap.get(participant) ?? 0;
    scoreMap.set(participant, current + score);
  }

  console.log(`[Processing] Aggregated scores for ${scoreMap.size} participant(s)`);
  return scoreMap;
}

// Builds a sorted leaderboard from the score map.
function buildLeaderboard(scoreMap) {
  const sorted = Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1]) // descending by totalScore
    .map(([participant, totalScore], index) => ({
      rank: index + 1,
      participant,
      totalScore,
    }));

  const totalScore = sorted.reduce((sum, entry) => sum + entry.totalScore, 0);

  console.log(`[Processing] Leaderboard built. Overall totalScore=${totalScore}`);
  sorted.forEach(({ rank, participant, totalScore: ts }) => {
    console.log(`[Processing]   #${rank} ${participant}: ${ts}`);
  });

  return { leaderboard: sorted, totalScore };
}

// Main processing pipeline.
function processMessages(rawMessages) {
  console.log(`[Processing] Starting pipeline with ${rawMessages.length} raw message(s)`);
  const unique = deduplicateMessages(rawMessages);
  const scoreMap = aggregateScores(unique);
  return buildLeaderboard(scoreMap);
}

module.exports = {
  deduplicateMessages,
  aggregateScores,
  buildLeaderboard,
  processMessages,
};
