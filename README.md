# Pairly 💫

**Pairly** is a modern, simple, and premium 2-person communication platform built around **dual permanent private URLs** (`/p/:token`) and **canonical 1-to-1 spaces**. 

Users set up their profile with their display name and avatar once, receive their permanent private space URL once, share it once with their friend, and forever return to the exact same 1-to-1 conversation with complete message history, files, images, shared links, and co-browsing content preserved.

---

## ✨ Features

- 🔒 **Zero Names or Handles in URLs**: Private URLs contain strictly secure, random, non-guessable 10-character tokens (e.g., `/p/bae24f7115` & `/p/a5332a8a67`).
- 🔗 **Dual Permanent Tokens Per Conversation**: Each 1-to-1 conversation is assigned two permanent tokens (`token_a` and `token_b`) that permanently map to the exact same space in SQLite.
- 🚫 **No Re-generation of Links**: URLs are created once during setup and shared once. No "Create Chat", "Create Room", or "Generate Link" actions after setup.
- ⚡ **Real-Time Engine**: Instant bi-directional Socket.io messaging, typing indicators (`Alex is typing...`), online/offline status badges, and audio chime alerts.
- ✔️ **Persisted Read Receipts**: Cyan double checkmarks with `read_at` timestamps.
- 😃 **Rich Message Actions**: Emoji reactions (👍, ❤️, 😂, 🔥, 🎉, 😯, 👏), quoted replies, inline editing, soft deletion, and message pinning.
- 🌐 **View Together Co-Browsing**: Embedded split view panel to co-view and discuss shared web content together in real-time.
- 🛡️ **SSRF-Protected URL Scraper**: Safely fetches OpenGraph metadata (title, thumbnail, description, site domain) while blocking SSRF attacks against local/internal network IPs.
- 📁 **Media & File Sharing**: Image attachments with full-screen Lightbox modal, document attachments with download cards, and drag-and-drop support.
- 🗑️ **Real-Time Clear Chat**: Prominent menu option allowing either participant to permanently wipe all conversation history for both users in real-time after confirmation.
- 📱 **LAN Wi-Fi Multi-Device Testing**: Server binds to `0.0.0.0:5000` and automatically detects your computer's Wi-Fi IPv4 address when copying share links on desktop.
- 🌙 **Dark & Light Themes**: Persistent theme toggle saved in `localStorage`.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Socket.io, `better-sqlite3`, Multer, Cheerio, Axios, CORS, Express Rate Limit.
- **Frontend**: React, Vite, Tailwind CSS, Lucide React Icons.
- **Database**: SQLite (WAL mode enabled).

---

## 🚀 Quick Setup & Local Development

### 1. Install Dependencies
Run from the project root directory:

```bash
npm run install:all
```

### 2. Build Frontend & Start Server
Build the client assets and start the server:

```bash
npm run build:client
npm start
```

The application will start on port `5000`:
- **Local Computer**: `http://localhost:5000`
- **Mobile / Wi-Fi**: `http://<Your-LAN-IP>:5000`

---

## 📱 Desktop + Mobile Local Wi-Fi Testing

1. **On Computer**:
   - Open `http://localhost:5000` in your desktop browser.
   - Enter your display name (e.g. **Sai**) and select an avatar.
   - Click **"Create Permanent Private Space"**.
   - Click **"Share Link"** in the top header menu. (The application automatically formats the link using your computer's LAN IP e.g. `http://192.168.1.15:5000/p/a5332a8a67`).

2. **On Mobile Phone** (connected to the same Wi-Fi):
   - Open the copied URL on your mobile phone's browser (`http://192.168.1.15:5000/p/a5332a8a67`).
   - Enter your mobile name (e.g. **Alex**) and select an avatar.
   - Click **"Enter Private Space"**.

3. **Real-Time Cross-Device Communication**:
   - Both devices join the exact same private conversation.
   - Test instant messaging, typing indicators, read receipts, image/file attachments, reactions, pins, and **View Together** split view co-browsing.
   - Test **Clear Chat History** to confirm real-time synchronized clearing for both devices.

---

## 📁 Repository Structure

```
duosync/
├── client/                 # React + Vite + Tailwind CSS Frontend
│   ├── public/             # Static public assets & _redirects rules
│   └── src/                # Components, hooks, utilities & styling
├── server/                 # Express + Socket.io + SQLite Backend
│   ├── middleware/         # Authorization middleware
│   ├── routes/             # REST API routes (users, chat, scraper, uploads)
│   ├── uploads/            # Uploaded files directory (.gitkeep)
│   ├── db.js               # SQLite database setup & migrations
│   ├── index.js            # Express server initialization & static serving
│   └── socketHandler.js    # Socket.io real-time event handlers
├── .env.example            # Environment variables placeholder
├── .gitignore              # Git ignore rules for node_modules, DB, uploads
├── package.json            # Root scripts & configuration
└── README.md               # Documentation & setup guide
```

---

## 👤 Author

Developed by **[@saanvi060215](https://github.com/saanvi060215)**.
