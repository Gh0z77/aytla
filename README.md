# Aytla

A speaking-first language course for Uzbek, Russian and Turkish speakers: English, Russian, Turkish or Uzbek as the language being learned. One codebase runs as a **web app**, an **Android app** and an **iOS app** (Expo SDK 57 + React Native + react-native-web), backed by a small API for accounts, cloud sync, weekly leagues and AI conversation practice.

## What makes it different

- **Every lesson ends in speaking.** The last three exercises of each lesson and review are `say` exercises: the learner says (or, without a microphone, types) what they just learned.
- **One course, four target languages.** Every word and sentence is authored in English with uz / ru / tr translations, so the same content runs as an English, Russian, Turkish or Uzbek course (`courseFor(target)` in `src/content/course.ts`; ids are prefixed per course, e.g. `ru-u01-l1`, so progress stays separate). The interface language can never be the course language. Grading, the voice and speech recognition follow the target (`src/core/text.ts` knows Turkish casing); the English grammar tips are shown only on the English course. Strings name the target language through `{lang}` / `{Lang}` placeholders filled by `translate` (`src/i18n/index.ts`).
- **The path starts from a goal.** Onboarding asks why the learner needs the language (everyday, travel, work, study); `src/core/goals.ts` moves the matching units to the front and shows an estimated number of weeks. Each goal also has a unit nobody else sees, right after Base Camp: u19 *Border and help* (travel), u20 *Job interview* (work), u21 *Speaking exam* (study), u22 *Small talk and plans* (everyday).
- **A placement test instead of a guess.** Learners who know some English take a three-minute test (`src/core/placement.ts`): the path is checked two units at a time, two questions per check with a tie-break, and it stops at the first failed check. "I don't know" is always one tap away.
- **Word-level speaking feedback.** After a spoken answer the sentence is shown with the words that were not heard underlined, even when the answer passed.
- **Mistakes are remembered.** Spaced repetition tracks every word and sentence, corrections from the AI guide are kept and fed back into later conversations, and the weekly report shows what the learner now gets right.
- **No punishment.** There are no hearts: a wrong answer comes back later in the lesson, it never locks the learner out.
- **Games that are review.** *Uchish* (fly Ayti into the lane with the right translation) and *Avalanche* (tap falling words in order to build the sentence) draw on the words and sentences the learner has met and feed the same spaced repetition.

## Run it

```bash
npm install                      # once (first-time scaffolding: node scripts/setup.mjs)
npm --prefix server install      # once, for the API

npx expo start --port 8081       # the app: open http://localhost:8081, or scan the QR code with Expo Go
node server/src/index.ts         # the API on http://localhost:8787 (optional: the app works offline as a guest)
```

The app finds the API at `EXPO_PUBLIC_API_URL` (default `http://localhost:8787`). On a phone, set it to your computer's LAN address, e.g. `EXPO_PUBLIC_API_URL=http://192.168.1.20:8787`.

| Command | What it does |
| --- | --- |
| `npx tsc --noEmit` | type-check the app |
| `npx vitest run` | unit tests: core rules + every course unit |
| `npm --prefix server test` | API tests (in-memory database) |
| `npx tsc -p server/tsconfig.json --noEmit` | type-check the API |
| `node scripts/walkthrough.mjs <outDir>` | (`scripts/walkthrough.config.json` `{"units": ["u05", …]}` plays one lesson of each listed unit instead of the main flow) |
| `node scripts/walkthrough.mjs <outDir>` | end-to-end run in Edge with screenshots: landing, onboarding, a full lesson, tabs, both games, and (when the API is up) sign-up, sync, league, AI chat |
| `npx expo export -p web` | production web build into `dist/` |
| `npx eas build -p android --profile preview` | installable Android APK (needs a free Expo account: `npx eas login`) |
| `npx eas build -p ios --profile production` | iOS build (needs an Apple Developer account) |

### API environment

| Variable | Meaning |
| --- | --- |
| `PORT` | default `8787` |
| `DATABASE_URL` | a `postgresql://` URL (Supabase) for production; when set, SQLite is not used. The schema is created and migrated on start |
| `DATABASE_FILE` | SQLite file for local runs, default `server/data/aytla.db` |
| `CLERK_PUBLISHABLE_KEY` | turns on "sign in with Google" through Clerk (the same publishable key as the app) |
| `CORS_ORIGINS` | comma-separated allow-list; default any origin (bearer tokens, no cookies) |
| `ANTHROPIC_API_KEY` | turns on AI conversation practice; without credentials `/coach/chat` answers 503 |
| `COACH_MODEL` | Claude model for the coach, default `claude-opus-5` |
| `GEMINI_API_KEY` | AI conversation practice through Gemini, used when there are no Anthropic credentials |
| `GEMINI_MODEL` | Gemini model for the coach, default `gemini-2.5-flash` |
| `TELEGRAM_BOT_TOKEN` | turns on "sign in with Telegram" and Telegram reminders; without it the button is hidden |

The website's "Pro" card collects emails into the `pro_interest` table (`POST /pro/interest`, one row per email) so the people who asked can be told when Pro ships; nothing is sold yet. Footer social links appear only when `EXPO_PUBLIC_SOCIAL_TELEGRAM` / `_INSTAGRAM` / `_YOUTUBE` are set in the app's `.env`, so the page never points at an account that does not exist.

`npm --prefix server start` loads `server/.env` if it exists (git-ignored): keep the secrets there. `server/.env.example` and `.env.example` list every variable.

### Database (Supabase)

Locally the API uses a SQLite file and needs nothing. In production set `DATABASE_URL` to the project's **Session pooler** connection string (Supabase → Connect → Session pooler, port 5432: `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`). The direct host `db.<ref>.supabase.co` only has an IPv6 address, so it fails from most laptops and many hosts. Tables are created on first start and the same code runs on both databases (`server/src/db.ts`), so the API tests keep using an in-memory SQLite.

### Sign in with Google (Clerk)

1. Create an application at [clerk.com](https://clerk.com) with **Google** enabled as a social connection (Clerk's shared Google credentials are fine for development; add your own Google OAuth client for production).
2. Copy the **publishable key** (`pk_test_…` / `pk_live_…`) into both `.env` as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (the app) and `server/.env` as `CLERK_PUBLISHABLE_KEY` (the API). No secret key is needed: the API verifies Clerk's session tokens against Clerk's public keys (`server/src/clerk.ts`) and then issues its own bearer token (`POST /auth/clerk`), so the rest of the API does not depend on Clerk.
3. In the Clerk dashboard allow the redirect URLs: `aytla://sso-callback` for the phone apps and `https://<your web domain>/sso-callback` (plus `http://localhost:8081/sso-callback` for development).
4. Without the key the Google button is hidden and nothing from Clerk is loaded.

### Telegram sign-in and reminders

1. In Telegram, talk to **@BotFather**: `/newbot`, choose a name and a username. It answers with a token.
2. Put the token in the API's environment as `TELEGRAM_BOT_TOKEN` (never in the app, never in git) and restart the API. Nothing else to configure: the bot uses long polling, so it works without a public webhook, also on a laptop. Run one API process per token.
3. The account screen now shows "Sign in with Telegram". The learner is sent to the bot, confirms with one button, and the app logs in by itself (`server/src/telegram.ts` explains the flow and why a leaked link is not enough to take a session).
4. Learners with a Telegram account can pick a reminder hour in Profile also in the browser: the bot writes to them in that hour if they have not practised that day (`server/src/reminders.ts`). Phones keep using their own local notification.

None of this has been run against the real Telegram API yet: it type-checks and has tests (`server/test/telegram.test.ts`, `reminders.test.ts`), but needs a token to try.

## Deploy

Nothing is deployed yet. The pieces are ready; each needs an account that only the founder can create.

1. **API** (first, because the app needs its URL): build `server/Dockerfile` on any host that offers a persistent disk, mount the disk at `/data`, and set `ANTHROPIC_API_KEY` and `CORS_ORIGINS=https://<your web domain>`. `GET /health` answers `{"ok":true,"coach":true}` when it is up and the AI guide has credentials. The Docker image has not been built or run yet.
2. **Web**: import the repository in Vercel. `vercel.json` already sets the build (`npx expo export -p web` into `dist/`, verified locally) and the single-page rewrite. Set the environment variable `EXPO_PUBLIC_API_URL=https://<your API domain>` before building: it is baked into the bundle.
3. **Android**: `npx eas login`, then `npx eas build -p android --profile preview` gives an installable APK; `--profile production` gives the bundle for Google Play. Set `EXPO_PUBLIC_API_URL` in `eas.json` first.
4. **iOS**: the same with `-p ios`, and an Apple Developer account.

Before a store release:

- replace the default Expo icons and splash in `assets/images/` by running `node scripts/brand-icons.mjs` after any change to the icon shapes (they are code-rendered: Cho'qqi, the mountain guide, on cream);
- review `src/features/legal/LegalScreen.tsx` (privacy policy and terms, shown at `/privacy` and `/terms`): it describes what the code does but is not legal advice; add the publisher's legal name and a contact address in `LEGAL_CONTACT`. Both stores ask for the privacy policy URL: it is `https://<your web domain>/privacy`;
- in-app account deletion (required by both stores) is in Profile → "Delete account" and calls `DELETE /me`;
- `public/index.html` holds the page title and the description used by search engines and link previews; add an `og:image` once the site has a domain.

## How it is built

```
app/                 routes (expo-router): landing, welcome, tabs, lesson player, result, guidebook, account, AI chat
src/core/            the product rules, pure TypeScript, fully unit-tested
  exercises.ts         generates every exercise from words + sentences
  grading.ts           typo-tolerant grading, contractions, alternatives
  session.ts           lesson state machine (re-queues mistakes)
  progress.ts          XP, streak + freezes, quests, achievements, shop, spaced repetition, weekly report
  goals.ts             goal-based unit order, goal-only units and the weeks-to-goal estimate
  placement.ts         placement test rules (checkpoints, verdicts, where the learner lands)
  path.ts              the learning path (lessons, chests, unit reviews)
  validate.ts          content validator
src/content/units/   the course: one JSON file per unit (words + sentences in en / uz / ru / tr)
src/features/        screens (landing/HeroStage.web.tsx plays the Remotion hero on the web)
src/i18n/            interface strings (uz is the source of truth for keys)
src/state/           store.ts: learner state, offline-first · account.ts: sign-in and auto-sync
src/lib/             api client, speech, haptics, local reminders
src/ui/mascot/       draw.ts: the crew as vector drawings (one source for the app and the videos)
remotion/            the videos: HeroLoop (website hero), CrewIntro (story), SentenceOfDay, Reactions
server/              Hono + node:sqlite API: accounts, last-write-wins sync, league cohorts, AI coach
scripts/             setup.mjs (first-time scaffold) · walkthrough.mjs (end-to-end check) · brand-icons.mjs (icons)
```

### The crew and the videos

The six characters are drawn in code (`src/ui/mascot/draw.ts`: gradients and shapes in a 100×100 box) and rendered twice: with react-native-svg in the app (`src/ui/Mascot.tsx`, where `AnimatedMascot` adds breathing, blinking and the reactions to right and wrong answers) and as plain SVG in Remotion (`remotion/MascotSvg.tsx`). Open `/crew` in the web app to see every character in every mood.

The videos for social media live in `remotion/`:

| Command | What it does |
| --- | --- |
| `npm run video:studio` | opens the Remotion studio to preview and tweak the compositions |
| `npm run video:render` | renders `out/intro.mp4` (9:16 story), `out/sentence.mp4` and `out/reactions.mp4` (1:1 posts) |
| `npx remotion render SentenceOfDay out/x.mp4 --props='{"sentence":"...","translation":"...","label":"..."}'` | a sentence-of-the-day post with your own text |

Rendering uses an installed Chrome or Edge (`remotion.config.ts`), so no browser download is needed. The website hero plays the `HeroLoop` composition live through `@remotion/player`.

### Adding a unit

1. Copy `src/content/units/u04.json` to `uNN.json` and fill it in (5 lessons, 8 sentences each).
2. `npx vitest run src/content/__tests__/units.test.ts -t uNN` until it passes with no warnings.
3. Import it in `src/content/course.ts` and add it to the `UNITS` array.

Content rules that the exercise generator relies on:

- ids: `uNN.w.<slug>` for words, `uNN.s.NN` for sentences, `uNN-lN` for lessons;
- inside one unit no two words share a translation in any language (otherwise "pick the word" is ambiguous);
- `altEn` / `altNative` list every equally correct answer; `altEnFor` lists English answers that are only valid from one language (Uzbek "u" and Turkish "o" mean both *he* and *she*).

## Known gaps

- Units u05–u22 were drafted with AI assistance and still need a read-through by native Uzbek, Russian and Turkish speakers.
- The hearts rules are still in `src/core/progress.ts` (and its tests) but no screen uses them.
- Native builds have not been run on a device yet; the web build is what the walkthrough verifies.
- Session tokens are kept in AsyncStorage; move them to `expo-secure-store` before a store release.
- The league needs real learners: a cohort fills up as people earn XP in the same week.
