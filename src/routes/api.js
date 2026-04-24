const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');


router.post('/start', (req, res) => {
  const useMock = req.body.useMock === true;
  const result = quizController.startQuizRun(useMock);
  res.json(result);
});


router.get('/status', (req, res) => {
  const status = quizController.getStatus();
  res.json(status);
});


router.get('/logs', (req, res) => {
  const logs = quizController.getLogs();
  res.json({ logs });
});


router.post('/reset', (req, res) => {
  const result = quizController.resetRun();
  if (!result.reset) {
    return res.status(400).json(result);
  }
  res.json(result);
});

module.exports = router;
