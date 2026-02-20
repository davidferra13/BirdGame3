# Railway Terms Compliance

This project is intended to run a real-time multiplayer game server and static game client only.

## Prohibited Use Confirmation

The deployment and runtime behavior for this repository must never be used for:

- Mirrors or userbots
- Crypto miners
- Hosting DMCA-protected content without rights
- Torrent aggregator services
- VNC or virtual desktop services
- Any illegal activity

## Project Scope

Permitted use for this repository:

- Browser game client hosting
- WebSocket game server hosting
- Supabase-backed game data APIs
- Standard observability logs and diagnostics for the game

## Pre-Deploy Checklist (Railway)

Before each Railway deployment, verify:

- No crypto mining software, mining pools, or mining scripts are included
- No torrent indexing, magnet crawling, or P2P aggregation features exist
- No mirror/userbot automation services are exposed
- No VNC/remote desktop daemons are installed or started
- No copyrighted third-party assets are distributed without permission
- Environment variables and runtime commands are only for the game stack

## Ongoing Compliance

- Keep dependencies and scripts scoped to the game only
- Remove any package or process that could be interpreted as prohibited abuse
- Audit pull requests for policy violations before merge
