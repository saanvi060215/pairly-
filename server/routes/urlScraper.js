import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { authorizeConversationAccess } from '../middleware/auth.js';

const router = express.Router();

function isInternalHost(hostname) {
  const host = hostname.toLowerCase();
  
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '169.254.169.254' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  const privateIpRegexes = [
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
    /^192\.168\.\d{1,3}\.\d{1,3}$/,
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^169\.254\.\d{1,3}\.\d{1,3}$/
  ];

  return privateIpRegexes.some((regex) => regex.test(host));
}

function sanitizeText(str) {
  if (!str) return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim().slice(0, 500);
}

router.post('/url-metadata', authorizeConversationAccess, async (req, res) => {
  const { url: targetUrl } = req.body;

  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).json({ error: 'Valid target URL string is required' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only HTTP and HTTPS protocols are allowed' });
  }

  if (isInternalHost(parsedUrl.hostname)) {
    return res.status(403).json({ error: 'Access to local/internal network resources is restricted' });
  }

  try {
    const response = await axios.get(parsedUrl.toString(), {
      timeout: 5000,
      maxContentLength: 2 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PairlyBot/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return res.json({
        url: parsedUrl.toString(),
        domain: parsedUrl.hostname,
        title: parsedUrl.hostname,
        description: `Direct resource file (${contentType.split(';')[0]})`,
        image: null
      });
    }

    const $ = cheerio.load(response.data);

    let title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      parsedUrl.hostname;

    let description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    let image =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('link[rel="apple-touch-icon"]').attr('href') ||
      $('link[rel="icon"]').attr('href') ||
      null;

    let siteName =
      $('meta[property="og:site_name"]').attr('content') ||
      parsedUrl.hostname;

    if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
      try {
        image = new URL(image, parsedUrl.origin).toString();
      } catch (e) {
        image = null;
      }
    }

    const metadata = {
      url: parsedUrl.toString(),
      domain: sanitizeText(parsedUrl.hostname),
      siteName: sanitizeText(siteName),
      title: sanitizeText(title),
      description: sanitizeText(description),
      image: image ? image.trim() : null
    };

    return res.json(metadata);
  } catch (error) {
    return res.json({
      url: parsedUrl.toString(),
      domain: sanitizeText(parsedUrl.hostname),
      title: sanitizeText(parsedUrl.hostname),
      description: 'Shared link',
      image: null
    });
  }
});

export default router;
