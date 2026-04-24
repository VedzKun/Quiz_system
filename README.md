# Quiz Leaderboard System

This is a backend-heavy architecture implementation of a Quiz Leaderboard.

## Architecture & Approach

The project is split into two primary Node.js applications:
1. **Mock API** (`mock-api/server.js`): Simulates the external API endpoints (`/quiz/messages` and `/quiz/submit`). It deliberately serves duplicate data across different poll indices to test the deduplication logic.
2. **Main Backend** (`src/server.js`): An Express server that orchestrates the polling, processing, and frontend serving.

- **`apiService.js`**: Handles outbound HTTP calls. It encapsulates the `axios` requests to poll the external API 10 times with a 5-second delay.
- **`processingService.js`**: A pure JavaScript module handling the business logic. It handles deduplication, score aggregation, and leaderboard sorting.
- **`quizController.js`**: Orchestrates the workflow and maintains an in-memory state of the current run. This allows the frontend to poll for real-time status and logs without blocking the process.

### Backend Pipeline Flow
The backend operates as an asynchronous state machine:
1.  **Poll & Stream**: The `quizController` initiates 10 sequential HTTP requests to the external API. As data arrives, it is appended to a "raw message" buffer.
2.  **Continuous Processing**: To provide a responsive UI, the processing service is triggered after *every* poll. The leaderboard is recalculated from scratch using the current buffer, providing a live "streaming" experience.
3.  **Final Aggregation**: Once all 10 polls are complete, a final deduplication pass ensures the data is clean before the submission phase.
4.  **Submission**: The clean leaderboard is POSTed to the `/quiz/submit` endpoint.

### Dual-Mode Support
To facilitate both rapid testing and production-like validation, the system supports two modes:
-   **Simulation Mode**: Uses an internal data generator with a 500ms delay. It injects random and hardcoded duplicates (e.g., exact record repeats, valid same-participant different-round entries) to prove the robustness of the logic.
-   **Real API Mode**: Connects to the external endpoint via standard HTTP. It enforces a strict 5-second polling delay and uses real network I/O, demonstrating the system's integration capabilities.

### Deduplication Logic
Deduplication is handled efficiently in `processingService.js` using a `Map`.
- As raw messages are ingested, we create a composite key: `roundId::participant`.
- This guarantees O(N) deduplication time complexity and ensures each participant's score for a specific round is only counted once.

### Error Resilience & Idempotency
-   **Graceful Failures**: The system is designed to be fault-tolerant. If the final submission fails (e.g., a 400 error from a dead external API), the backend logs the warning but marks the run as complete. This ensures the user still sees the computed results.
-   **Retry Logic**: The `apiService` implements a 3-retry mechanism with a 1-second delay for failed polls, preventing temporary network blips from crashing the pipeline.
-   **Idempotency Guard**: A `submittedAt` timestamp prevents multiple submissions for the same processing run, even if the user triggers the UI multiple times.

## How to Run

### Prerequisites
- Node.js (v14 or higher)

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

### Running the Project
For convenience, you can start both the Mock API (port 4000) and the Main Server (port 3000) simultaneously using:
```bash
npm run dev
```

Alternatively, you can run them in separate terminals:
```bash
# Terminal 1: Start Mock API
npm run mock-api

# Terminal 2: Start Main Backend
npm start
```

### Accessing the UI
Once the servers are running, open your browser and navigate to:
**http://localhost:3000**

Click "Start Processing" to watch the backend poll the API in real-time, deduplicate the records, build the leaderboard, and submit the final results. You can view the live logs directly in the UI.