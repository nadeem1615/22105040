const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');

const app = express();
const PORT = 9876;
const WINDOW_SIZE = 10;

const pool = new Pool({
  user: '',
  host: 'localhost',
  database: 'postgres',
  password: 'nadeem',
  port: 5432,
});

const localApiEndpoints = {
  p: 'http://localhost:9876/mock/primes',
  f: 'http://localhost:9876/mock/fibo',
  e: 'http://localhost:9876/mock/even',
  r: 'http://localhost:9876/mock/random'
};

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

app.get('/mock/primes', (req, res) => {
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
  const count = getRandomInt(3, 7);
  const randomPrimes = Array.from({ length: count }, () => primes[getRandomInt(0, primes.length - 1)]);
  res.json({ numbers: randomPrimes });
});

app.get('/mock/fibo', (req, res) => {
  const fibs = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  const count = getRandomInt(3, 7);
  const randomFibs = Array.from({ length: count }, () => fibs[getRandomInt(0, fibs.length - 1)]);
  res.json({ numbers: randomFibs });
});

app.get('/mock/even', (req, res) => {
  const count = getRandomInt(3, 7);
  const randomEvens = Array.from({ length: count }, () => getRandomInt(1, 50) * 2);
  res.json({ numbers: randomEvens });
});

app.get('/mock/random', (req, res) => {
  const count = getRandomInt(3, 7);
  const randoms = Array.from({ length: count }, () => getRandomInt(1, 100));
  res.json({ numbers: randoms });
});

function calculateAverage(arr) {
  if (!arr.length) return 0;
  return Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2));
}

async function fetchNumbers(numberid) {
  try {
    const response = await axios.get(localApiEndpoints[numberid], { timeout: 500 });
    if (response.status === 200 && Array.isArray(response.data.numbers)) {
      return response.data.numbers;
    }
  } catch (error) {}
  return [];
}

async function getWindow() {
  const res = await pool.query('SELECT num FROM number_window ORDER BY added_at ASC, id ASC');
  return res.rows.map(row => row.num);
}

async function addNumber(num) {
  try {
    await pool.query('INSERT INTO number_window (num) VALUES ($1) ON CONFLICT DO NOTHING', [num]);
  } catch (e) {}
}

async function removeOldestIfNeeded() {
  const res = await pool.query('SELECT id FROM number_window ORDER BY added_at ASC, id ASC');
  while (res.rows.length > WINDOW_SIZE) {
    const oldestId = res.rows[0].id;
    await pool.query('DELETE FROM number_window WHERE id = $1', [oldestId]);
    res.rows.shift();
  }
}

app.get('/numbers/:numberid', async (req, res) => {
  const { numberid } = req.params;
  if (!['p', 'f', 'e', 'r'].includes(numberid)) {
    return res.status(400).json({ error: 'Invalid number ID' });
  }
  const windowPrevState = await getWindow();
  const numbers = await fetchNumbers(numberid);
  for (const num of numbers) {
    await addNumber(num);
    await removeOldestIfNeeded();
  }
  const windowCurrState = await getWindow();
  const avg = calculateAverage(windowCurrState);
  res.json({
    windowPrevState,
    windowCurrState,
    numbers,
    avg
  });
});

pool.connect()
  .then(() => {
    console.log('Connected to PostgreSQL database');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('PostgreSQL connection error:', err);
  });
