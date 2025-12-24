# Poke Sleep Helper (MERN scaffold)

## Structure
- `client`: React + Vite
- `server`: Express + SQLite

## Getting started
1) Install dependencies from the repo root:
   - `npm install`
2) Configure environment:
   - `cp server/.env.example server/.env`
   - SQLite DB path defaults to `data/poke-sleep.sqlite`
3) Run the apps in separate terminals:
   - `npm run dev:server`
   - `npm run dev:client`

The API health check is at `http://localhost:4000/api/health`.
