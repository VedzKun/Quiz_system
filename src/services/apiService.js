/**
 * Outbound HTTP communication with the external quiz API.
 */

const axios = require('axios');

const BASE_URL = process.env.QUIZ_API_BASE_URL || 'https://devapigw.vidalhealthtpa.com/srm-quiz-task';
const REG_NO = process.env.QUIZ_REG_NO || '2024CS101';
const POLL_DELAY_MS = parseInt(process.env.POLL_DELAY_MS || '5000', 10);
const TOTAL_POLLS = 10; // poll values 0 through 9

// Generates fake poll responses, injecting duplicates and edge cases.
function mockApi(pollIndex) {
  const participants = ["Alice", "Bob", "Charlie", "Diana", "Eve"];
  const events = participants.map(p => ({
    roundId: "R" + (pollIndex % 3),
    participant: p,
    score: Math.floor(Math.random() * 20) + 5
  }));

  // Simulation data injection for testing
  if (Math.random() < 0.3 && events.length > 0) {
    events.push({ ...events[0] });
    console.log(`[Mock API] Injected exact duplicate into poll ${pollIndex}: ${events[0].participant} for round ${events[0].roundId}`);
  }

  // Edge Case Hardcoding on specific polls
  if (pollIndex === 2) {
    // Tricky Case 1: Exact Duplicate
    events.push({ roundId: "R1", participant: "Alice", score: 10 });
    events.push({ roundId: "R1", participant: "Alice", score: 10 });
    console.log(`[Mock API] Injected hardcoded duplicate edge case (Alice R1) into poll 2`);
  }
  if (pollIndex === 4) {
    // Tricky Case 2: Same participant, different round (Valid — should NOT be deduped)
    events.push({ roundId: "R1", participant: "Diana", score: 12 });
    events.push({ roundId: "R2", participant: "Diana", score: 18 });
    console.log(`[Mock API] Injected hardcoded multi-round edge case (Diana R1 & R2) into poll 4`);
  }

  return { events };
}

/**
 * Fetches quiz messages for a given poll index.
 * @param {boolean} useMock - Whether to use the simulation
 * @param {number} pollIndex - Integer from 0 to 9
 * @returns {Promise<Array>} - Array of message objects from the API
 */
async function fetchMessages(useMock, pollIndex, retries = 3) {
  if (useMock) {
    console.log(`[API] (SIMULATION) Fetching mock data for poll=${pollIndex} ...`);
    const mockData = mockApi(pollIndex);
    return mockData.events;
  }

  const url = `${BASE_URL}/quiz/messages`;
  console.log(`[API] Polling /quiz/messages with poll=${pollIndex} ...`);

  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        params: { regNo: REG_NO, poll: pollIndex },
        timeout: 10000,
      });

      const data = response.data;
      const messages = data.events || [];
      console.log(`[API] Poll ${pollIndex} → received ${messages.length} record(s)`);
      return messages;
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data || err.message;
      console.error(`[API] Poll ${pollIndex} attempt ${i + 1} failed (status=${status}):`, detail);
      
      if (i === retries - 1) {
        console.error(`[API] Poll ${pollIndex} exhausted all retries. Skipping.`);
        // Return empty array so processing can continue with remaining polls
        return [];
      }
      
      console.log(`[API] Retrying poll ${pollIndex} in 1 second...`);
      await sleep(1000); // 1-second delay before retry
    }
  }
}

/**
 * Polls /quiz/messages TOTAL_POLLS times, with POLL_DELAY_MS between each call.
 * @param {boolean} useMock - Whether to use the simulation
 * @param {Function} [onPollComplete] - Optional callback(pollIndex, messages) after each poll
 * @returns {Promise<Array>} - Flat array of all message objects collected
 */
async function pollAllMessages(useMock, onPollComplete) {
  const allMessages = [];

  for (let i = 0; i < TOTAL_POLLS; i++) {
    const messages = await fetchMessages(useMock, i);
    allMessages.push(...messages);

    if (typeof onPollComplete === 'function') {
      onPollComplete(i, messages);
    }

    // Wait before next poll (skip delay after the final poll)
    if (i < TOTAL_POLLS - 1) {
      const delay = useMock ? 500 : POLL_DELAY_MS;
      console.log(`[API] Waiting ${delay}ms before next poll...`);
      await sleep(delay);
    }
  }

  console.log(`[API] Polling complete. Total raw records collected: ${allMessages.length}`);
  return allMessages;
}

/**
 * Submits the final leaderboard result to /quiz/submit.
 */
async function submitResult(payload) {
  const url = `${BASE_URL}/quiz/submit`;
  
  // Format exactly as required by validator
  const submitPayload = {
    regNo: REG_NO,
    totalScore: payload.totalScore,
    leaderboard: payload.leaderboard.map(entry => ({
      participant: entry.participant,
      totalScore: entry.totalScore
    }))
  };

  console.log(`[API] Submitting result to /quiz/submit ...`);
  console.log(`[API] Payload preview: totalScore=${submitPayload.totalScore}, participants=${submitPayload.leaderboard.length}`);

  const response = await axios.post(url, submitPayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });

  console.log(`[API] Submission response (status=${response.status}):`, response.data);
  return response.data;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  pollAllMessages,
  submitResult,
  TOTAL_POLLS,
  POLL_DELAY_MS,
};
