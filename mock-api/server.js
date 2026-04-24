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

// A pre-defined set of mock data introducing duplicates across different polls
const mockData = [
  // Poll 0
  [{ roundId: 1, participant: 'Alice', score: 10 }, { roundId: 1, participant: 'Bob', score: 8 }],
  // Poll 1 (Alice duplicate from round 1, plus new Charlie)
  [{ roundId: 1, participant: 'Alice', score: 10 }, { roundId: 1, participant: 'Charlie', score: 5 }],
  // Poll 2
  [{ roundId: 2, participant: 'Bob', score: 15 }, { roundId: 2, participant: 'Diana', score: 12 }],
  // Poll 3 (Bob duplicate from round 2)
  [{ roundId: 2, participant: 'Bob', score: 15 }],
  // Poll 4
  [{ roundId: 3, participant: 'Alice', score: 20 }, { roundId: 3, participant: 'Eve', score: 25 }],
  // Poll 5
  [{ roundId: 3, participant: 'Charlie', score: 10 }],
  // Poll 6
  [{ roundId: 4, participant: 'Diana', score: 18 }],
  // Poll 7 (Diana duplicate from round 4)
  [{ roundId: 4, participant: 'Diana', score: 18 }, { roundId: 4, participant: 'Alice', score: 5 }],
  // Poll 8
  [{ roundId: 5, participant: 'Bob', score: 10 }, { roundId: 5, participant: 'Eve', score: 15 }],
  // Poll 9
  [{ roundId: 5, participant: 'Charlie', score: 8 }]
];

app.get('/quiz/messages', (req, res) => {
  const pollIndex = parseInt(req.query.poll, 10);
  
  if (isNaN(pollIndex) || pollIndex < 0 || pollIndex > 9) {
    return res.status(400).json({ error: 'Invalid poll index. Must be 0-9.' });
  }

  const messages = mockData[pollIndex] || [];
  res.json({ events: messages });
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
