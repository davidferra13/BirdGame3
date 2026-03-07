#!/usr/bin/env bash
# Bird Game 3D - Online Session Launcher
# Starts the game server, opens a Cloudflare tunnel, and redeploys the frontend.

set -e

SITE_ID="ea02ba27-b055-4495-884b-0e22ce04c94d"
WORLD_ID="global-1"
SERVER_PORT=3300

# Colours
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

printf "\n"
printf "${BOLD}============================================${NC}\n"
printf "${BOLD}   Bird Game 3D — Online Session Launcher  ${NC}\n"
printf "${BOLD}============================================${NC}\n"
printf "\n"

# Kill any existing server on the port
if lsof -ti :$SERVER_PORT >/dev/null 2>&1; then
  printf "${YELLOW}Killing existing process on port $SERVER_PORT...${NC}\n"
  lsof -ti :$SERVER_PORT | xargs kill -9 2>/dev/null || true
  sleep 1
fi

printf "${CYAN}Starting game server on port $SERVER_PORT...${NC}\n"
pnpm run server &
SERVER_PID=$!

TUNNEL_LOG=$(mktemp)

cleanup() {
  printf "\n"
  printf "${YELLOW}Shutting down...${NC}\n"
  kill "$SERVER_PID" 2>/dev/null || true
  kill "$TUNNEL_PID" 2>/dev/null || true
  rm -f "$TUNNEL_LOG"
  exit 0
}
trap cleanup SIGINT SIGTERM

sleep 2
printf "${CYAN}Opening Cloudflare tunnel...${NC}\n"
cloudflared tunnel --url "localhost:$SERVER_PORT" --protocol http2 >"$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

printf "${CYAN}Waiting for tunnel URL"
TUNNEL_URL=""
for i in $(seq 1 60); do
  TUNNEL_URL=$(grep -A2 "Your quick Tunnel has been created" "$TUNNEL_LOG" 2>/dev/null | grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | head -1 || true)
  if [ -n "$TUNNEL_URL" ]; then
    printf "${NC}\n"
    break
  fi
  printf "."
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  printf "\n"
  printf "ERROR: Could not get tunnel URL. Cloudflared log:\n"
  cat "$TUNNEL_LOG"
  cleanup
  exit 1
fi

WSS_URL="${TUNNEL_URL/https:\/\//wss://}"
printf "${GREEN}Tunnel live: $WSS_URL${NC}\n"
printf "\n"
printf "${CYAN}Building frontend with live server URL...${NC}\n"
VITE_WS_URL="$WSS_URL" VITE_WORLD_ID="$WORLD_ID" pnpm run build

printf "\n"
printf "${CYAN}Deploying to Netlify...${NC}\n"
netlify deploy --dir=dist --prod --site="$SITE_ID"

printf "\n"
printf "${BOLD}${GREEN}============================================${NC}\n"
printf "${BOLD}${GREEN}  READY! Share this link with your friend:  ${NC}\n"
printf "${BOLD}${GREEN}  https://bird-game-3d.netlify.app          ${NC}\n"
printf "${BOLD}${GREEN}============================================${NC}\n"
printf "\n"
printf "${YELLOW}Keep this window open while playing!${NC}\n"
printf "${YELLOW}Press Ctrl+C to stop the server when done.${NC}\n"
printf "\n"

wait "$TUNNEL_PID"
