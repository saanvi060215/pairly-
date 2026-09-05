import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import { initDb } from '../../server/db.js';
import apiRoutes from '../../server/routes/api.js';
import urlScraperRoutes from '../../server/routes/urlScraper.js';
import uploadRoutes from '../../server/routes/upload.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initDb();
      dbInitialized = true;
    } catch (e) {
      console.error('Database cold start init error:', e);
    }
  }
  next();
});

app.use('/api', apiRoutes);
app.use('/api', urlScraperRoutes);
app.use('/api', uploadRoutes);

export const handler = serverless(app);
