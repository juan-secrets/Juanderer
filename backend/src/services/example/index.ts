import express from 'express';
import { services } from '../../config';
import { pool } from './db';

const app = express();
app.use(express.json());

// Kept in memory: resets to 0 every time the service restarts
let counter = 0;

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ service: 'example', database: 'connected' });
  } catch {
    res.json({ service: 'example', database: 'disconnected' });
  }
});

app.get('/counter', (_req, res) => {
  res.json({ value: counter });
});

app.post('/counter/increment', (_req, res) => {
  counter += 1;
  res.json({ value: counter });
});

app.listen(services.example.port, () => {
  console.log(`example service listening on http://localhost:${services.example.port}`);
});
