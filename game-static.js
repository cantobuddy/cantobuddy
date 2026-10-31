'use strict';
/**
 * CantoBuddy — static game server.
 *
 * Three of the four new games (Memory Match, Mahjong Solitaire, Solitaire) are
 * entirely CLIENT-SIDE: no room, no opponent, no server state. They still need
 * to live at /games/<name> for the same URL shape as the live tables, and a
 * shared link like /games/memorymatch/X must still open the game rather than a
 * 404. This is a tiny factory that serves one game's folder from
 * public/<name>/, exactly like the `serveClient` in sudoku.js — minus the room
 * routes, because there are none.
 *
 * It is mounted ONCE per game in server.js:
 *   app.use('/games/memorymatch', require('./game-static')('memorymatch').handle);
 * and deliberately placed BEFORE express.json() for symmetry with the other
 * game mounts, even though it reads no body.
 */
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

module.exports = function makeStaticGame(dirName) {
  const PUBLIC = path.join(__dirname, 'public', dirName);

  function serveClient(req, res, pathname) {
    let rel = decodeURIComponent(pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.join(PUBLIC, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('forbidden'); }
    fs.readFile(file, (err, buf) => {
      if (err) {
        // Anything that is not a real file (a stray path, a shared-code typo)
        // falls back to the client so the game always opens.
        return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, html) => {
          if (e2) { res.writeHead(404); return res.end('not found'); }
          res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
          res.end(html);
        });
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(buf);
    });
  }

  function handle(req, res) {
    let url;
    try {
      url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    } catch (e) {
      res.writeHead(400); return res.end('bad request');
    }
    const p = url.pathname;

    if (p === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: true, game: dirName, static: true }));
    }
    if (req.method === 'GET') return serveClient(req, res, p);
    res.writeHead(405);
    res.end('method not allowed');
  }

  return { handle };
};
