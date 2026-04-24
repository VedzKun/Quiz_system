const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const statusBadge = document.getElementById('status-badge');
const logsContainer = document.getElementById('logs-container');
const leaderboardContainer = document.getElementById('leaderboard-container');
const pollingContainer = document.getElementById('polling-container');
const pollingPanel = document.getElementById('polling-panel');
const mainContent = document.querySelector('.main-content');
const mockToggle = document.getElementById('mock-toggle');
const modeLabel = document.getElementById('mode-label');
const infoBox = document.querySelector('.info-box');

mockToggle.addEventListener('change', (e) => {
  modeLabel.textContent = e.target.checked ? 'Mode: SIMULATION' : 'Mode: REAL API';
  modeLabel.style.color = e.target.checked ? '#c084fc' : '#4ade80';
});

let pollInterval = null;


const api = {
  start: (useMock) => fetch('/api/start', { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ useMock })
  }).then(r => r.json()),
  status: () => fetch('/api/status').then(r => r.json()),
  logs: () => fetch('/api/logs').then(r => r.json()),
  reset: () => fetch('/api/reset', { method: 'POST' }).then(r => r.json()),
};

startBtn.addEventListener('click', async () => {
  try {
    startBtn.disabled = true;
    resetBtn.disabled = true;
    mockToggle.disabled = true;
    if (infoBox) infoBox.style.display = 'none';


    await api.start(mockToggle.checked);


    startPollingUI();
  } catch (err) {
    console.error('Failed to start:', err);
    startBtn.disabled = false;
  }
});

resetBtn.addEventListener('click', async () => {
  try {
    const res = await api.reset();
    if (res.reset) {
      updateStatusBadge('idle');
      leaderboardContainer.innerHTML = '<p class="placeholder-text">Waiting for data...</p>';
      pollingContainer.innerHTML = '<p class="placeholder-text">Click "Start Processing" to begin.</p>';
      pollingPanel.classList.remove('hidden');
      mainContent.classList.remove('done-state');
      logsContainer.innerHTML = '';
      startBtn.disabled = false;
      mockToggle.disabled = false;
      if (infoBox) infoBox.style.display = 'block';
    }
  } catch (err) {
    console.error('Failed to reset:', err);
  }
});

function startPollingUI() {
  if (pollInterval) clearInterval(pollInterval);

  // Initial render
  renderState();

  // Poll every 1 second
  pollInterval = setInterval(renderState, 1000);
}

async function renderState() {
  try {
    const [statusData, logsData] = await Promise.all([api.status(), api.logs()]);


    updateStatusBadge(statusData.status);


    renderLogs(logsData.logs);


    if (statusData.status === 'polling') {

      renderPollingProgress(statusData.pollProgress);


      if (statusData.result && statusData.result.leaderboard.length > 0) {
        leaderboardContainer.innerHTML = getLeaderboardHTML(statusData.result);
      } else {
        leaderboardContainer.innerHTML = '<p class="placeholder-text">Waiting for first poll...</p>';
      }
    } else if (statusData.status === 'processing' || statusData.status === 'submitting') {
      leaderboardContainer.innerHTML = `<div style="text-align:center"><div class="loading-spinner"></div><p>Finalising...</p></div>`;
    } else if (statusData.status === 'done' && statusData.result) {

      leaderboardContainer.innerHTML = getLeaderboardHTML(statusData.result);

      pollingPanel.classList.add('hidden');
      mainContent.classList.add('done-state');
      clearInterval(pollInterval);
      resetBtn.disabled = false;
    } else if (statusData.status === 'error') {
      // Still show leaderboard if we computed one before the error
      if (statusData.result && statusData.result.leaderboard.length > 0) {
        leaderboardContainer.innerHTML = getLeaderboardHTML(statusData.result);
      } else {
        leaderboardContainer.innerHTML = `<p style="color:#f87171">Error: ${statusData.error}</p>`;
      }
      pollingPanel.classList.add('hidden');
      mainContent.classList.add('done-state');
      clearInterval(pollInterval);
      resetBtn.disabled = false;
    }

  } catch (err) {
    console.error('Error fetching state:', err);
  }
}

function updateStatusBadge(status) {
  statusBadge.textContent = `Status: ${status.toUpperCase()}`;
  statusBadge.className = `badge ${status}`;
}

function renderLogs(logs) {
  logsContainer.innerHTML = logs.map(log => `<div>${log}</div>`).join('');

  logsContainer.scrollTop = logsContainer.scrollHeight;
}

function renderPollingProgress(progress) {
  if (!progress || progress.length === 0) {
    pollingContainer.innerHTML = `<div style="text-align: center;"><div class="loading-spinner"></div><p>Waiting for first poll...</p></div>`;
    return;
  }

  const totalReceived = progress.reduce((sum, p) => sum + p.count, 0);
  const completed = progress.length;
  const pct = Math.round((completed / 10) * 100);

  let html = `
    <div style="margin-bottom: 16px;">
      <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-secondary); margin-bottom:6px;">
        <span>Polls: ${completed} / 10</span>
        <span>${pct}%</span>
      </div>
      <div style="background:rgba(255,255,255,0.08); border-radius:4px; height:8px; overflow:hidden;">
        <div style="height:100%; width:${pct}%; background: linear-gradient(90deg, #6366f1, #a855f7); border-radius:4px; transition: width 0.4s ease;"></div>
      </div>
      <p style="text-align:center; margin-top:12px; font-size:0.9rem; color:var(--text-secondary);">
        Raw records so far: <strong style="color:#f8fafc">${totalReceived}</strong>
      </p>
    </div>
    <table style="width:100%">
      <thead><tr><th>Poll</th><th>Records</th><th>Status</th></tr></thead>
      <tbody>`;

  progress.forEach(p => {
    html += `<tr><td>Poll ${p.pollIndex}</td><td>${p.count}</td><td style="color:#4ade80">Done</td></tr>`;
  });


  for (let i = completed; i < 10; i++) {
    html += `<tr style="opacity:0.35"><td>Poll ${i}</td><td>-</td><td>Pending</td></tr>`;
  }

  html += `</tbody></table>`;
  pollingContainer.innerHTML = html;
}

function getLeaderboardHTML(result) {
  let html = `
    <div class="total-score-card">
      Overall System Total Score: ${result.totalScore}
    </div>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Participant</th>
          <th>Total Score</th>
        </tr>
      </thead>
      <tbody>
  `;

  result.leaderboard.forEach((entry, index) => {
    const isTop = index === 0;
    const rankDisplay = isTop ? '1' : `#${entry.rank}`;
    const participantDisplay = isTop ? `<strong>${entry.participant}</strong>` : entry.participant;
    const rowClass = isTop ? 'class="top-performer"' : '';

    html += `
      <tr ${rowClass}>
        <td>${rankDisplay}</td>
        <td>${participantDisplay}</td>
        <td><strong>${entry.totalScore}</strong></td>
      </tr>
    `;
  });

  html += `</tbody></table>`;

  return html;
}
