# Components

Reusable UI used across the app.

## Root-level

| Component | Purpose |
|-----------|---------|
| `AuthBackground` | App-wide gradient background (warm parchment). Also exported as `AppBackground`. |
| `AnimatedTabBarButton` | Tab bar item with press scale animation. |
| `ScreenHeader` | `ScreenHeaderTitle` and `HeaderIconButton` for screen headers. |

## `home/`

Components used exclusively on the Home screen.

| Component | Purpose |
|-----------|---------|
| `AnimationPullUp` | Bouncing bee button that opens the chat modal. |
| `BeeChat` | Full chat UI: list, conversation, voice input, settings. |
| `RecoveryMomentsCard` | "Recharge Windows" card — music and box-breathing suggestions. |

## `ui/`

Primitive UI components importable from `@/components/ui`.

| Component | Purpose |
|-----------|---------|
| `Button` | Primary / secondary / ghost button variants. |
| `Card` | Surface container with optional shadow. |
| `Chip` | Small label chip. |
| `GlassInput` | Labelled text input (thin wrapper over `TextField`). |
| `IconButton` | Pressable icon with border. |
| `ListRow` | Standard list row with leading/trailing slots. |
| `SectionHeader` | Section divider label. |
| `TextField` | Styled text input with label. |

## `calendar/`

Calendar feature components. Import from `@/components/calendar`.

| Component | Purpose |
|-----------|---------|
| `DayView` / `WeekView` / `MonthView` | Calendar view modes. |
| `AddTaskSheet` | Bottom sheet for creating tasks/events. |
| `EventDetailSheet` | Bottom sheet for viewing event detail. |
| `ViewTasksSheet` | Bottom sheet listing tasks for a day. |
| `ConnectedCalendarsSheet` | Bottom sheet for calendar integrations. |
