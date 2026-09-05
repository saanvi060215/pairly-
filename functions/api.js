import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import { initDb } from '../server/db.js';
import apiRoutes from '../server/routes/api.js';
import urlScraperRoutes from '../server/routes/urlScraper.js';
import uploadRoutes from '../server/routes/upload.js';

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

const router = express.Router();
router.use('/', apiRoutes);
router.use('/', urlScraperRoutes);
router.use('/', uploadRoutes);

app.use('/.netlify/functions/api', router);
app.use('/api', router);
app.use('/', router);

const serverlessApp = serverless(app);

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  return await serverlessApp(event, context);
};

export default handler;
