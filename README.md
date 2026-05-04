# EMZ — Wellness & Productivity

Mobile app for wellbeing, calendar, tasks, and an AI chat assistant. Built with **Expo** (React Native) and **expo-router**.

---

## Quick start

```bash
npm install
npm start
```

Then open in Expo Go (iOS/Android) or run `npm run ios` / `npm run android`.

---

## Project structure

```
emz/
├── app/                    # Routes (expo-router file-based)
│   ├── _layout.tsx        # Root: SafeArea, StatusBar, Stack (auth → main)
│   ├── (auth)/            # Auth group: login, signup
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── signup.tsx
│   └── (main-screens)/    # Main app: tabs
│       ├── _layout.tsx    # Tabs + AppBackground, ChatProvider
│       ├── index.tsx      # Home
│       ├── calendar.tsx   # Calendar + connected integrations
│       └── settings.tsx   # User profile, calendars, wearables (no tab; opens from Home)
│
├── components/            # Reusable UI
│   ├── AuthBackground.tsx # App-wide gradient background
│   ├── AnimationPullUp.tsx# Chat entry (bouncing bee + sheet)
│   ├── BeeChat.tsx        # Chat UI (list, thread, voice, settings)
│   ├── PrimaryButton.tsx
│   ├── SecondaryButton.tsx
│   ├── GlassInput.tsx
│   ├── AnimatedTabBarButton.tsx
│   └── calendar/          # Calendar feature
│       ├── index.ts       # Re-exports
│       ├── DayView.tsx
│       ├── WeekView.tsx
│       ├── MonthView.tsx
│       ├── AddTaskSheet.tsx
│       ├── EventDetailSheet.tsx
│       ├── ViewTasksSheet.tsx
│       └── ConnectedCalendarsSheet.tsx
│
├── context/               # React context
│   ├── AuthContext.tsx    # Session, user, Google/Apple OAuth, sign out
│   └── ChatContext.tsx    # Chat sessions, messages, persistence
│
├── constants/             # Design tokens & types
│   ├── theme.ts           # colors, spacing, borderRadius, typography
│   └── calendarTypes.ts   # Calendar-related types
│
├── assets/
│   └── images/            # bee.png, logo.png, etc.
│
└── .cursor/rules/         # Design system (wellness-productivity-ui.mdc)
```

---

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm start`    | Start Expo dev server     |
| `npm run ios`  | Run on iOS simulator      |
| `npm run android` | Run on Android device/simulator |

---

## Design

- **Tabs:** Home · Calendar (Settings accessible via profile icon on Home)
- **Chat:** Opened from Home via the bee pull-up (`AnimationPullUp` → `BeeChat`).
- **Theme:** Light-first; brand colours and glass-style surfaces (see `constants/theme.ts` and `.cursor/rules/`).
