#!/bin/bash
# Push local MongoDB → server MongoDB
# Usage: ./scripts/push_db.sh [user@host]
#
# Requires: local Docker container 'mongodb' running
#           server Docker container 'mongodb' running (docker compose up)

set -e

SERVER=${1:-"root@194.135.119.74"}
SSH_KEY=${SSH_KEY:-"$HOME/.ssh/server_key"}
SSH="ssh -i $SSH_KEY"
DB=flashcards_deepseek
LOCAL_CONTAINER=mongodb
REMOTE_CONTAINER=mongodb

echo "==> Waiting for MongoDB on $SERVER to be ready..."
until $SSH "$SERVER" "docker exec $REMOTE_CONTAINER mongo --quiet --eval 'db.runCommand({ping:1})'" >/dev/null 2>&1; do
  echo "   ...still starting, retrying in 3s"
  sleep 3
done

echo "==> Checking local DB has data..."
LOCAL_COUNT=$(docker exec "$LOCAL_CONTAINER" mongo --quiet --eval "db.getSiblingDB('$DB').reels.count()" 2>/dev/null || \
              docker exec "$LOCAL_CONTAINER" mongosh --quiet --eval "db.getSiblingDB('$DB').reels.countDocuments()" 2>/dev/null)
if [ -z "$LOCAL_COUNT" ] || [ "$LOCAL_COUNT" -eq 0 ]; then
  echo "ERROR: local reels collection is empty or MongoDB is not running. Aborting."
  exit 1
fi
echo "==> Local reels: $LOCAL_COUNT. Dumping and restoring..."

docker exec "$LOCAL_CONTAINER" mongodump --archive --db "$DB" \
  | $SSH "$SERVER" "docker exec -i $REMOTE_CONTAINER mongorestore --archive --drop --db $DB"

echo "==> Done."
