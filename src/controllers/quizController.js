/**
 * Orchestrates the quiz flow: polling -> processing -> submission.
 */

const { pollAllMessages, submitResult } = require('../services/apiService');
const { processMessages } = require('../services/processingService');



const RunStatus = Object.freeze({
  IDLE: 'idle',
  POLLING: 'polling',
  PROCESSING: 'processing',
  SUBMITTING: 'submitting',
  DONE: 'done',
  ERROR: 'error',
});

let state = {
  status: RunStatus.IDLE,
  logs: [],           // real-time log lines for the frontend
  pollProgress: [],   // [ { pollIndex, count } ] — one entry per completed poll
  rawMessages: [],    // Accumulated raw messages for streaming
  result: null,       // { leaderboard, totalScore } after processing
  submission: null,   // API response from /quiz/submit
  error: null,
  submittedAt: null,  // ISO timestamp; used for idempotency check
  useMock: false,     // Whether this run uses the mock API
};

function resetState() {
  state = {
    status: RunStatus.IDLE,
    logs: [],
    pollProgress: [],
    rawMessages: [],
    result: null,
    submission: null,
    error: null,
    submittedAt: null,
    useMock: false,
  };
}

function log(message) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${message}`;
  console.log(line);
  state.logs.push(line);
}



// Starts the quiz pipeline (poll -> process -> submit).
function startQuizRun(useMock = false) {
  if (state.status !== RunStatus.IDLE && state.status !== RunStatus.ERROR) {
    log(`[Controller] Start requested but status is "${state.status}" — ignoring`);
    return { started: false, status: state.status };
  }

  resetState();
  state.useMock = useMock;
  log(`[Controller] Starting quiz run (Simulation Mode: ${useMock})`);

  // Fire-and-forget; errors are caught internally
  runPipeline().catch((err) => {
    state.status = RunStatus.ERROR;
    state.error = err.message;
    log(`[Controller] Unhandled pipeline error: ${err.message}`);
  });

  return { started: true, status: state.status };
}

async function runPipeline() {
  // ── Step 1 & 2: Poll & Process Incrementally ─────────────────────────────────
  state.status = RunStatus.POLLING;
  log('[Controller] Phase 1 & 2: Polling & Streaming Processing');

  await pollAllMessages(state.useMock, (pollIndex, messages) => {
    state.pollProgress.push({ pollIndex, count: messages.length });
    state.rawMessages.push(...messages);
    
    // Process incrementally and update result live
    state.result = processMessages(state.rawMessages);
    
    log(`[Controller] Poll ${pollIndex} complete — ${messages.length} new record(s). Live leaderboard updated.`);
  });

  state.status = RunStatus.PROCESSING;
  log(`[Controller] Processing done — ${state.result.leaderboard.length} participant(s), totalScore=${state.result.totalScore}`);

  // ── Step 3: Submit (idempotency guard) ─────────────────────────────────────
  if (state.submittedAt) {
    log('[Controller] Already submitted — skipping duplicate submission');
    state.status = RunStatus.DONE;
    return;
  }

  state.status = RunStatus.SUBMITTING;
  log('[Controller] Phase 3: Submitting result to /quiz/submit');

  try {
    const submission = await submitResult(state.result);
    state.submission = submission;
    state.submittedAt = new Date().toISOString();
    log(`[Controller] Submission successful at ${state.submittedAt}`);
  } catch (submitErr) {
    const detail = submitErr.response?.data || submitErr.message;
    log(`[Controller] WARNING: Submission failed (${submitErr.response?.status || 'network error'}): ${JSON.stringify(detail)}`);
    log('[Controller] Leaderboard computed locally — pipeline complete despite submission error.');
    state.submittedAt = new Date().toISOString();
  }
  state.status = RunStatus.DONE;
}



function getStatus() {
  return {
    status: state.status,
    pollProgress: state.pollProgress,
    result: state.result,
    submission: state.submission,
    error: state.error,
    submittedAt: state.submittedAt,
    useMock: state.useMock,
  };
}

function getLogs() {
  return state.logs;
}

function resetRun() {
  if (state.status === RunStatus.POLLING || state.status === RunStatus.SUBMITTING) {
    return { reset: false, reason: 'Cannot reset while a run is active' };
  }
  resetState();
  return { reset: true };
}

module.exports = {
  startQuizRun,
  getStatus,
  getLogs,
  resetRun,
  RunStatus,
};
