'use strict';

/**
 * The bridge between a finished game and the record a helper can come back for.
 *
 * All four tables share this, because the alternative — four slightly different
 * ideas of what a win is — is how "You 7 · Ana 5" ends up meaning something
 * different at Sudoku than at UNO.
 *
 * Two jobs:
 *
 *   `attachRecords(players, game)` puts each player's lifetime record on the
 *   player object, so it rides along in the state the client already receives.
 *   It is one query per room, called on join and again when a game ends — not
 *   on every SSE tick, which would put a database read inside the frame loop.
 *
 *   `recordFinish({ game, room, winnerId })` writes the result once. The guard
 *   is the round number: `room.round` advances every round at UNO, Big Two and
 *   Word Match, so the same round can never be written twice even if a finish
 *   handler is reached from two paths. Sudoku has no rounds, so its room records
 *   exactly once, which is right — a Sudoku room is one board.
 *
 * Identity: the device id comes from the client (`cb_device`, the same key the
 * app uses for quizzes), and is validated here rather than trusted. A malformed
 * id is treated as no id: the player still plays, she just has no record to
 * attach to yet.
 */

const store = require('./db');

// Same shape the app mints: 'dev_' + 36 hex characters. Deliberately loose on
// length (16–64) so a future change to the generator does not silently start
// discarding records, but strict on the prefix and character set so nothing
// else can be smuggled into a public_id column.
const DEVICE_RE = /^dev_[a-f0-9]{16,64}$/;

/** The device id on a request body, or null. Never throws, never guesses. */
function deviceIdFrom(body) {
  const raw = body && (body.deviceId || body.device_id);
  if (!raw) return null;
  const id = String(raw).trim().toLowerCase();
  return DEVICE_RE.test(id) ? id : null;
}

/**
 * Attach each player's record for this game. A player with no device id gets
 * `record: null`, which the client renders as nothing at all — an empty "0 wins"
 * badge would be a small lie about someone the server cannot identify.
 */
function attachRecords(players, game) {
  if (!Array.isArray(players) || !players.length) return;
  const map = store.gameRecordsForDevices(players.map((p) => p.deviceId), game);
  for (const p of players) {
    p.record = p.deviceId ? (map.get(p.deviceId) || { wins: 0, played: 0 }) : null;
  }
}

/**
 * Record a finished game, once. Returns how many rows were written (0 if this
 * round was already recorded, or if no player had an identity).
 *
 * Records are then re-attached so the end-of-game screen can show the updated
 * score — the moment the number changes is the moment it is worth showing.
 */
function recordFinish({ game, room, winnerId }) {
  if (!room || !Array.isArray(room.players)) return 0;
  const round = room.round == null ? 0 : room.round;
  if (room.recordedRound === round) return 0;
  room.recordedRound = round;

  const written = store.recordGameResults({
    game,
    roomCode: room.code,
    players: room.players.map((p) => ({
      deviceId: p.deviceId,
      name: p.name,
      won: !!winnerId && p.id === winnerId,
    })),
  });

  // A finished game pays one credit a day, to every identified player, win or
  // lose. Paying only the winner would teach her that losing costs her the
  // sticker, which is the opposite of what a game played with friends is for.
  //
  // Inside the round guard on purpose: the award is idempotent per day anyway
  // (credit_events has UNIQUE(public_id, kind, day)), but a finish handler that
  // runs twice should not look like two games were played.
  for (const p of room.players) {
    if (p.deviceId) store.awardDailyCredit({ publicId: p.deviceId, kind: 'game' });
  }

  attachRecords(room.players, game);
  return written;
}

/**
 * A tie is not a win for anybody, and it must still be recorded — otherwise a
 * helper who played four games and drew all of them has no record at all, and
 * the app has quietly forgotten she was there.
 */
function recordDraw({ game, room }) {
  return recordFinish({ game, room, winnerId: null });
}

module.exports = { deviceIdFrom, attachRecords, recordFinish, recordDraw, DEVICE_RE };
