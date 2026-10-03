/**
 * SQLite-backed session store for express-session.
 *
 * Why this matters: express-session's default MemoryStore is not for production
 * — it leaks memory and drops every session on restart, so a redeploy logs the
 * admin out. Now that SQLite is present, sessions can live on the same disk.
 */
const session = require('express-session');
const store = require('./db');

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 h — must match the cookie maxAge

class SqliteSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.ttl = options.ttl || DEFAULT_TTL;

    // Housekeeping so expired rows do not accumulate. unref() keeps this timer
    // from holding the process open.
    this.cleanup = setInterval(() => {
      try {
        const removed = store.purgeExpiredSessions();
        if (removed) console.log(`[session] purged ${removed} expired session(s)`);
      } catch (err) {
        console.error('[session] purge failed:', err.message);
      }
    }, 15 * 60 * 1000);
    if (this.cleanup.unref) this.cleanup.unref();
  }

  get(sid, cb) {
    try {
      const row = store.getSessionRow(sid);
      if (!row) return cb(null, null);
      if (row.expires_at < Date.now()) {
        store.dropSessionRow(sid);
        return cb(null, null);
      }
      let parsed;
      try {
        parsed = JSON.parse(row.data);
      } catch {
        store.dropSessionRow(sid); // corrupt payload — drop rather than 500
        return cb(null, null);
      }
      return cb(null, parsed);
    } catch (err) {
      return cb(err);
    }
  }

  set(sid, sess, cb) {
    try {
      const maxAge = sess && sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : this.ttl;
      store.putSessionRow(sid, JSON.stringify(sess), Date.now() + maxAge);
      return cb && cb(null);
    } catch (err) {
      return cb && cb(err);
    }
  }

  touch(sid, sess, cb) {
    try {
      const row = store.getSessionRow(sid);
      if (!row) return cb && cb(null);
      const maxAge = sess && sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : this.ttl;
      store.putSessionRow(sid, row.data, Date.now() + maxAge);
      return cb && cb(null);
    } catch (err) {
      return cb && cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      store.dropSessionRow(sid);
      return cb && cb(null);
    } catch (err) {
      return cb && cb(err);
    }
  }

  length(cb) {
    try {
      const { db } = store;
      return cb(null, db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n);
    } catch (err) {
      return cb(err);
    }
  }

  clear(cb) {
    try {
      store.db.exec('DELETE FROM sessions');
      return cb && cb(null);
    } catch (err) {
      return cb && cb(err);
    }
  }
}

module.exports = SqliteSessionStore;
