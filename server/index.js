import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { initDb } from './db.js';
import apiRoutes from './routes/api.js';
import urlScraperRoutes from './routes/urlScraper.js';
import uploadRoutes from './routes/upload.js';
import { setupSocketHandler } from './socketHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize SQLite database
initDb();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

app.use('/api', apiLimiter);

const uploadsDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

app.use('/api', apiRoutes);
app.use('/api', urlScraperRoutes);
app.use('/api', uploadRoutes);

// Serve Client Static Files in Production / Local Host
const clientBuildDir = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildDir));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(clientBuildDir, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Pairly Server Running. Please run "npm run build" inside client folder.');
    }
  });
});

setupSocketHandler(io);

// Function to get local Wi-Fi / LAN IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  const localIp = getLocalIpAddress();
  console.log(`=======================================================`);
  console.log(`✨ Pairly Local & Cross-Device Server Running`);
  console.log(`=======================================================`);
  console.log(` 💻 Local Computer Access:  http://localhost:${PORT}`);
  console.log(` 📱 Mobile / Wi-Fi Access:  http://${localIp}:${PORT}`);
  console.log(`=======================================================`);
});
