# EVEREST AI

A gamified English course for Uzbek, Russian and Turkish speakers. One codebase runs as a **web app**, an **Android app** and an **iOS app** (Expo + React Native + react-native-web).

## First-time setup

```bash
node scripts/setup.mjs
```

This scaffolds the Expo configuration for the installed SDK, copies the brand images from `../assets`, installs dependencies and makes the first git commit.

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run check` | type-check and run the unit tests |
| `npm run web` | open the web app in the browser |
| `npx expo start` | dev server; scan the QR code with **Expo Go** (Android / iOS) |
| `npx expo export -p web` | production web build into `dist/` |
| `npx eas build -p android --profile preview` | installable Android APK (needs a free Expo account: `npx eas login`) |
| `npx eas build -p ios --profile production` | iOS build (needs an Apple Developer account) |

## How it is built

```
app/                 routes (expo-router): landing, welcome, tabs, lesson player, result, guidebook
src/core/            the product rules, pure TypeScript, fully unit-tested
  exercises.ts         generates every exercise from words + sentences
  grading.ts           typo-tolerant grading, contractions, alternatives
  session.ts           lesson state machine (re-queues mistakes)
  progress.ts          XP, hearts, streak + freezes, quests, achievements, shop, spaced repetition
  path.ts              the learning path (lessons, chests, unit reviews)
  validate.ts          content validator
src/content/units/   the course: one JSON file per unit (words + sentences in en / uz / ru / tr)
src/features/        screens
src/i18n/            interface strings (uz is the source of truth for keys)
src/state/store.ts   persisted learner state (AsyncStorage / localStorage), offline-first
```

### Adding a unit

1. Copy `src/content/units/u01.json` to `uNN.json` and fill it in (5 lessons, 8 sentences each).
2. Import it in `src/content/course.ts` and add it to the `UNITS` array.
3. `npm run content:check`.

Content rules that the exercise generator relies on:

- ids: `uNN.w.<slug>` for words, `uNN.s.NN` for sentences, `uNN-lN` for lessons;
- inside one unit no two words share a translation in any language (otherwise "pick the word" is ambiguous);
- `altEn` / `altNative` list every equally correct answer; `altEnFor` lists English answers that are only valid from one language (Uzbek "u" and Turkish "o" mean both *he* and *she*).

## Roadmap

- Units u04–u18 (the section plan is in `src/content/course.ts`).
- Accounts, cloud sync and weekly leagues (API server).
- AI conversation practice with the guides.
- Push reminders for the streak.
