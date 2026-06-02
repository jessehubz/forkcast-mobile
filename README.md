# Forkcast Mobile

Dark-themed, maroon fine-dining reservation app built with Expo + React Native.

---

## Quick Start

```bash
cd forkast-mobile
npx expo start
```

Then press `i` (iOS Simulator), `a` (Android), or scan the QR code with **Expo Go**.

---

## Project Structure

```
app/
  _layout.tsx              Root layout — auth guard, navigation setup
  (auth)/
    login.tsx              Sign in screen
    signup.tsx             Sign up with role picker (Diner / Owner)
  (diner)/
    _layout.tsx            Bottom tab navigator (4 tabs)
    index.tsx              Discover — restaurant list + search + cuisine filter
    map.tsx                Map — dark map, maroon pins, bottom sheet on tap
    reservations.tsx       My Bookings — Upcoming / Past / Waitlists tabs
    profile.tsx            Profile — stats, settings link, sign out
  (owner)/
    _layout.tsx            Bottom tab navigator (5 tabs)
    dashboard.tsx          Dashboard — AI insights, stat cards, today's reservations
    floor.tsx              Live Floor Map — real-time via Supabase Realtime
    reservations.tsx       All Reservations — Approve / Reject / Counter flow
    insights.tsx           Analytics — heatmap, AI recommendations, charts
    setup.tsx              Setup — restaurant info + drag-and-drop table builder
    add-reservation.tsx    Manual booking form for phone reservations
  restaurant/
    [id].tsx               Restaurant detail — heatmap, AI insight, reserve button
    [id]/book.tsx          Booking flow — date/time → floor map → confirm + deposit
  reservation/
    [id].tsx               Reservation detail — status, cancel, owner notes
  review/
    [id].tsx               Leave a review (stars + sub-ratings)
  settings.tsx             Edit profile, password, notification prefs, avatar upload

components/
  RestaurantCard.tsx       Reusable restaurant list card
  ui/
    Button.tsx             primary / outline / ghost / danger variants
    Input.tsx              Labeled input with maroon focus border
    Badge.tsx              Status pill (maroon / success / warning / danger / info)
    Card.tsx               Surface card with optional onPress
    SkeletonLoader.tsx     Pulsing skeleton for loading states
    EmptyState.tsx         Icon + title + subtitle + optional action button
    StarRating.tsx         1–5 star rating (readonly or interactive)

lib/
  supabase.ts              Supabase JS client (AsyncStorage session persistence)
  api.ts                   All Supabase query helpers
  types.ts                 Shared TypeScript types (Profile, Restaurant, Table, etc.)

constants/
  theme.ts                 Color tokens + statusColor/statusLabel helpers
```

---

## Environment Setup

Copy and fill in `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_ANTHROPIC_KEY=sk-ant-...   # Optional — powers AI insight cards
```

The `EXPO_PUBLIC_ANTHROPIC_KEY` is only needed for the AI insight cards on the restaurant detail page and owner dashboard/insights screens. Everything else works without it.

---

## Database

This app uses the same Supabase database as the `forkast/` Next.js project. Run the schema push and seed from there:

```bash
cd ../forkast
npx prisma db push
npm run db:seed
```

Tables used: `Profile`, `Restaurant`, `Table`, `Reservation`, `Waitlist`, `Review`

---

## Supabase Realtime (Live Floor Map)

The owner floor map subscribes to real-time updates on the `Reservation` table. Enable it in:

> Supabase → **Database → Replication** → toggle INSERT / UPDATE / DELETE on the `Reservation` table

---

## Color Theme

All colors are defined in [constants/theme.ts](constants/theme.ts):

| Token | Value | Used for |
|-------|-------|----------|
| `bg` | `#0D0507` | Screen backgrounds |
| `surface` | `#160A0C` | Cards, list items |
| `surfaceRaised` | `#1F0E11` | Inputs, elevated elements |
| `border` | `#2E1418` | All borders |
| `maroon` | `#8B1A2A` | Primary buttons, active states |
| `maroonLight` | `#B02337` | Highlights, tab active color |
| `cream` | `#F5EDE8` | Primary text, headings |
| `creamMuted` | `#C4A99F` | Labels, secondary text |
| `creamDim` | `#7A6059` | Placeholder, inactive text |

---

## Feature Checklist

- [x] Dark maroon fine dining theme across all screens
- [x] Auth — login, signup with Diner / Owner role picker
- [x] Diner: Discover screen with search + cuisine chips
- [x] Diner: Full-screen dark map with maroon pins + bottom card
- [x] Diner: Bookings — upcoming, past, waitlists
- [x] Diner: 3-step booking flow (date/time → SVG floor map → confirm)
- [x] Diner: Dynamic deposit warning on peak-hour bookings
- [x] Diner: Special requests field on booking
- [x] Diner: Leave a review after completed reservation
- [x] Diner: Cancel reservation (>24h before only)
- [x] Owner: Dashboard with AI insight card + stat grid
- [x] Owner: Live floor map with Supabase Realtime
- [x] Owner: Mark seated / complete / no-show from floor map
- [x] Owner: Reservation approval flow (Approve / Reject / Counter)
- [x] Owner: Counter-offer message saved to ownerNotes
- [x] Owner: Insights — crowd heatmap, AI recommendations, day chart
- [x] Owner: Drag-and-drop floor plan builder
- [x] Owner: Manual reservation form (phone bookings)
- [x] Settings: Edit profile, avatar upload, password change, notification toggles
- [x] Skeleton loading states everywhere
- [x] Empty states with icons on all list screens
- [x] No-show warning badge (⚠️) on high-risk diners

---

## Running on a Physical Device

1. Install **Expo Go** from the App Store or Google Play
2. Run `npx expo start` in this directory
3. Scan the QR code in the terminal with your camera (iOS) or Expo Go (Android)

> **Note:** `react-native-maps` requires a native build for full functionality. For quick testing on a device use Expo Go, but for production or map testing use `npx expo run:ios` or `npx expo run:android` (requires Xcode / Android Studio).
