# Grace · the GraceHalla Discord bot

Profiles, search and live ranked, in the same look as the site. Slash commands only, no privileged intents.

| Command | What it does |
|---|---|
| `/link id:` | Link your Discord to your Brawlhalla ID |
| `/unlink` | Remove the link |
| `/profile` | Your profile (or `user:` a linked member, or `id:` anyone). Tabs: Overview · Ranked · Legends · Combat |
| `/search name:` | Find a ranked player by name |
| `/live [mode] [region]` | Live ranked queue from the site |
| `/livepanel start / stop` | *(Manage Server)* A live panel that edits itself every ~2 min |

## Deploy on Render (free)

1. Put this folder in a GitHub repo (the files at the repo root, or set **Root Directory = bot** on Render).
2. Render → **New + → Web Service** → pick the repo.
   - Runtime **Node**, Build Command `npm install`, Start Command `npm start`, Instance Type **Free**.
   - Advanced → Health Check Path `/health`.
3. **Environment** tab: add `DISCORD_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `GRACEHALLA_URL`, `DAIR_API_BASE` (see `.env.example`).
4. Deploy. On first start the bot registers its commands and sets its avatar by itself.
5. Keep it awake: free Render services sleep after 15 min without visitors. Create a free job on <https://cron-job.org> (or UptimeRobot) that opens `https://YOUR-SERVICE.onrender.com/health` every 10 minutes. The bot also pings itself as a backup.

Free tier = 750 instance hours/month per workspace. One service running 24/7 uses ~744, so keep it as your only free web service.

## Invite

`https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot%20applications.commands&permissions=19456`

## Local run

`npm install`, copy `.env.example` to `.env`, `npm run dev`. Tests: `npm test`.

## Good to know

- Linking uses the public Brawlhalla ID only; nothing proves who owns an ID.
- Profiles are 1v1 ranked only (dair.api). `/search` only finds players with ranked 1v1 games.
- Live data is whatever the site already tracks. Legend pictures come from the site.
