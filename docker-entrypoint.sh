#!/bin/sh
#
# CantoBuddy container entrypoint.
#
# The app moved from a JSON file to SQLite. A deployed instance may still hold a
# populated /data/db.json from the previous version, so it must be imported into
# SQLite BEFORE the server starts serving — otherwise the app would come up with
# an empty database and the content would look lost.
#
# The marker file makes this idempotent: it runs on the first boot after the
# upgrade and never again.
set -e

DATA_DIR="${DATA_DIR:-/data}"
LEGACY="$DATA_DIR/db.json"
MARKER="$DATA_DIR/.migrated-from-json"

if [ -f "$LEGACY" ] && [ ! -f "$MARKER" ]; then
  echo "[entrypoint] Legacy db.json found — importing into SQLite (one time)."
  # --force is safe here: the marker guarantees this block runs at most once,
  # and at this moment db.json is the authoritative copy.
  if node migrate.js --force; then
    touch "$MARKER"
    echo "[entrypoint] Migration complete."
  else
    echo "[entrypoint] MIGRATION FAILED — refusing to start with incomplete data."
    echo "[entrypoint] db.json is untouched; the previous deploy stays live."
    exit 1
  fi
fi

exec "$@"
