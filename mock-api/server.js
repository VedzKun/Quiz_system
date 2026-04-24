/**
 * Mock External API Server
 * Simulates the /quiz/messages and /quiz/submit endpoints.
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

app.get('/quiz/messages', (req, res) => {
  const pollIndex = parseInt(req.query.poll, 10);
  
  if (isNaN(pollIndex) || pollIndex < 0 || pollIndex > 9) {
    return res.status(400).json({ error: 'Invalid poll index. Must be 0-9.' });
  }

  // Dynamically generate 5 participants per poll so "Test Mode" has 5 users
  const participants = ["Alice", "Bob", "Charlie", "Diana", "Eve"];
  const events = participants.map(p => ({
    roundId: "R" + (pollIndex % 3),
    participant: p,
    score: Math.floor(Math.random() * 20) + 5
  }));

  // Duplicate Injection (30% chance)
  if (Math.random() < 0.3) {
    events.push({ ...events[0] }); // Inject duplicate
  }

  // Hardcode edge cases to test deduplication
  if (pollIndex === 2) {
    events.push({ roundId: "R1", participant: "Alice", score: 10 });
    events.push({ roundId: "R1", participant: "Alice", score: 10 });
  }
  if (pollIndex === 4) {
    events.push({ roundId: "R1", participant: "Diana", score: 12 });
    events.push({ roundId: "R2", participant: "Diana", score: 18 });
  }

  res.json({ events });
});

app.post('/quiz/submit', (req, res) => {
  const { leaderboard, totalScore } = req.body;
  
  if (!leaderboard || totalScore === undefined) {
    return res.status(400).json({ error: 'Invalid submission payload' });
  }

  console.log('--- RECEIVED FINAL SUBMISSION ---');
  console.log('Total Score:', totalScore);
  console.log('Leaderboard:', leaderboard);
  console.log('---------------------------------');

  res.json({ success: true, message: 'Result successfully recorded!', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[Mock API] Listening on http://localhost:${PORT}`);
  console.log(`[Mock API] Expecting polling on /quiz/messages?poll=0...9`);
});
