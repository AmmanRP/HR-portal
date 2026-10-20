# PatrolDesk

PatrolDesk is an early-stage Discord-connected employee onboarding and duty portal for a roleplay public-safety community. The dashboard reads employee, application, and shift records from the database; it does not seed or display example personnel. Some workflows, including clock actions and Discord account linking, still need implementation before production use.

## Requirements

- Node.js 20.9 or newer and npm
- A Discord application and bot token for bot development

## Local setup

1. Copy `.env.example` to `.env` and replace secrets locally. Never commit `.env`.
2. Install dependencies with `npm install`.
3. Generate the Prisma client and create the local schema with `npm run db:generate` and `npm run db:push`.
4. Run `npm run dev` and open the local URL printed by Next.js.
5. Run the bot separately with `npm run bot` after setting `DISCORD_BOT_TOKEN`.

Open `/signup` to register an Employee or request an HR account, or `/login` to sign in. Employee accounts are active immediately. HR account requests remain pending until an administrator approves the initial HR account. Employees request FTO or Supervisor access from the employee portal; HR reviews those requests in `/hr`. Approved users can switch to `/fto` or `/supervisor` from the employee portal.

Useful checks: `npm run typecheck`, `npm run lint`, and `npm run build`.

## Current foundation

- Responsive department operations dashboard with authenticated, uncached database-backed roster, shift, application, and review totals; empty data is shown as empty rather than replaced with fixtures.
- Department ladders, baseline application requirements, unique badge-number generation, callsign formatting, signature normalization, and server-time record helper in `src/lib/policy.ts`.
- Prisma models for employees, applications, duty shifts, and strikes.
- Minimal Discord.js bot entry point with an ephemeral `/portal` response.
- Username/password signup and login using scrypt password hashes and signed, HTTP-only session cookies.
- Employee and HR signup; HR accounts start pending approval, while FTO and Supervisor access must be requested from the employee portal.
- Employee-submitted FTO and Supervisor access requests, HR review decisions, and separate access-gated `/hr`, `/fto`, and `/supervisor` portals.

## Important integration and safety notes

- A typed signature is an acknowledgement record, not a cryptographic or legal signature. Persist the normalized value with a server-generated timestamp; do not trust a client-provided clock.
- A two-hour shift duration alone does not prove in-game playtime. Promotion eligibility must use verified activity events from a game/server integration, and the sample policy helper only enforces a supplied activity-seconds value.
- Roblox avatar display needs a Roblox username-to-user/avatar lookup service. Roblox account ownership/linking needs a verification flow; a username alone does not prove identity.
- Interview answers should be stored with access controls and reviewed by HR. Add a configured AI provider only with an explicit privacy policy, retention limits, human review, and a non-automatic appeal path. Do not deny applicants solely on a model response.
- High-command assignments, strikes, demotion, and termination are consequential actions. Require role-based authorization, an audit log, and a human confirmation step. An activity-sync dry run should show a preview before any action is committed.
- Before production, replace the development session secret with a unique secret of at least 32 characters, add login/signup rate limiting, CSRF protections, a durable audit log, full role-based access control, database backups, and retention/deletion policies. Discord OAuth/account linking is also not implemented.
- Bootstrap the first HR account only from a trusted local database administrator: create an HR account at `/signup`, run `npm run db:studio`, and change that employee's `accountStatus` to `ACTIVE`. Afterward, HR approvals are handled in the HR portal and recorded with reviewer and timestamp. HR cannot approve their own access request.

## Discord setup

Create a Discord application and bot in the Discord Developer Portal. Set `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`, and `PORTAL_URL` in `.env`; set `DISCORD_GUILD_ID` while testing so `/portal` is registered immediately in that server. Leave the guild ID blank for global registration, which can take time to appear. Invite the bot using the `bot` and `applications.commands` OAuth2 scopes; it needs no privileged gateway intents or broad server permissions for `/portal`. Start it with `npm run bot`. The command replies privately with a button to the configured signup page. Use an HTTPS `PORTAL_URL` outside local development. Never place bot tokens in source code or expose them to browser code.

## Roblox and activity integration

Configure Roblox credentials only on the server. Add a verified game event adapter that reports player identity and activity duration, then reconcile those events with employee records. The current project cannot query private server playtime by itself and does not claim to do so.