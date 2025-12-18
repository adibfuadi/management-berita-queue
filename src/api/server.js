const express = require('express');
const newsRoutes = require('./routes/news.routes');
const { connectRabbit } = require('../config/rabbit');

const app = express();

app.use(express.json());

(async () => {
  await connectRabbit();
})();

app.use('/api', newsRoutes);

app.get('/check', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'News API Queue Service' });
});

module.exports = app;
