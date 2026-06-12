# CLAUDE.md — Mobile App (React Native / Flutter)

## Project Overview

<!-- FILL IN -->

**Stack:** <!-- React Native 0.73+ with Expo / Flutter 3.x -->
**Platforms:** iOS <!-- version --> , Android <!-- version -->
**Status:** <!-- Active development / Production / Maintenance -->

---

## Tech Stack

### React Native / Expo
| Layer | Technology |
|---|---|
| Framework | React Native 0.73+, Expo SDK 50+ |
| Language | TypeScript (strict) |
| Navigation | Expo Router (file-based) |
| State | Zustand (local), TanStack Query (server) |
| Styling | NativeWind (Tailwind for RN) or StyleSheet |
| Forms | React Hook Form + Zod |
| Storage | Expo SecureStore (sensitive), MMKV (fast KV) |
| Testing | Jest, React Native Testing Library |
| OTA Updates | Expo EAS Update |

### Flutter
| Layer | Technology |
|---|---|
| Framework | Flutter 3.x |
| Language | Dart 3.x |
| Navigation | GoRouter |
| State | Riverpod / BLoC |
| HTTP | Dio |
| Storage | flutter_secure_storage, shared_preferences |
| Testing | flutter_test, integration_test |

---

## Project Structure

### Expo Router (React Native)
```
app/                          # File-based routing (Expo Router)
├── (auth)/                   # Unauthenticated routes
│   ├── login.tsx
│   └── signup.tsx
├── (tabs)/                   # Tab navigator
│   ├── _layout.tsx
│   ├── home.tsx
│   └── profile.tsx
└── _layout.tsx               # Root layout (providers)
src/
├── components/
│   ├── ui/                   # Primitive components
│   └── features/             # Feature-specific components
├── hooks/                    # Custom hooks
├── lib/
│   ├── api.ts                # API client (axios/ky instance)
│   └── storage.ts            # Storage wrapper
├── store/                    # Zustand stores
└── types/                    # Shared types
```

---

## Development Commands

### React Native / Expo
```bash
pnpm install              # Install dependencies
npx expo start            # Start Expo dev server
npx expo start --ios      # Start with iOS simulator
npx expo start --android  # Start with Android emulator

pnpm test                 # Jest tests
pnpm test:watch           # Jest watch mode
pnpm typecheck            # TypeScript check
pnpm lint                 # ESLint

npx expo prebuild         # Generate native projects
npx eas build --platform ios      # Build for iOS (EAS)
npx eas build --platform android  # Build for Android (EAS)
npx eas update            # Push OTA update
```

### Flutter
```bash
flutter pub get           # Install dependencies
flutter run               # Run on connected device/emulator
flutter test              # All tests
flutter analyze           # Static analysis
flutter build apk         # Android release build
flutter build ipa         # iOS release build
```

---

## Architecture & Key Patterns

### State management rules (React Native)
- **Server state** (API data): TanStack Query — handles caching, refetching, loading/error states
- **Client state** (UI, user preferences): Zustand — no boilerplate, easy to colocate
- **Form state**: React Hook Form — never manage form state manually
- **Never use** `useEffect` + `useState` for data fetching — always TanStack Query

### Navigation rules
- All authenticated routes inside `(tabs)/` or `(app)/` route groups
- Auth state check at the root `_layout.tsx` — redirect to `(auth)/` if not authenticated
- Pass minimal data via route params — fetch fresh data on navigation, don't serialize full objects

### Component rules
- Platform-specific files: `Button.ios.tsx` / `Button.android.tsx` for non-trivial differences
- Use `Platform.select` only for minor style differences, not for logic branches
- All touchable elements use `Pressable` — not `TouchableOpacity` or `TouchableHighlight`
- Keyboard-aware layouts use `KeyboardAvoidingView` — test on both platforms

### Offline support
- Use TanStack Query's persistence plugin for offline-first data
- Queue mutations when offline, replay when connection restores
- Never assume network availability — handle `NetInfo.fetch()` states explicitly

---

## Testing Requirements

- **Unit tests**: Hooks, utilities, store logic (mocked API)
- **Component tests**: Rendering and interaction with React Native Testing Library
- **Integration tests**: Screen-level flows with mocked navigation and API
- Snapshot tests are discouraged — they break constantly and provide little signal

### Test utilities
```typescript
// Standard test wrapper with providers
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  )
}
```

---

## Security Requirements

- **Never** store tokens in `AsyncStorage` — use `Expo SecureStore` or `flutter_secure_storage`
- **Never** hardcode API URLs, keys, or secrets — use `expo-constants` + EAS environment variables
- Validate all deep link URLs before processing — deep links are an injection surface
- Certificate pinning for sensitive apps (banking, healthcare)
- Disable screenshot capture on sensitive screens (auth, payment) on Android

```typescript
// React Native: secure storage pattern
import * as SecureStore from 'expo-secure-store'
await SecureStore.setItemAsync('auth_token', token)
const token = await SecureStore.getItemAsync('auth_token')
```

---

## Performance Guidelines

- Use `FlashList` instead of `FlatList` for long lists (10x more performant)
- Memoize expensive renders with `React.memo` and `useMemo` — but profile first with Flipper
- Avoid anonymous functions in JSX — they cause unnecessary re-renders
- Image optimization: use `expo-image` (better caching, blurhash placeholders) not `<Image>`
- Keep JS bundle size lean — use `import cost` and watch for accidental large imports
- Enable Hermes engine — it's significantly faster on Android

---

## Platform-Specific Notes

### iOS
- Test on a real device before release — simulator doesn't reflect memory pressure
- Permissions (camera, location, push) must be declared in `app.json` Info.plist entries
- Push notifications require APN certificate configuration in EAS

### Android
- Test on API level 26+ (Android 8) as the minimum supported target
- `android:usesCleartextTraffic="false"` in production — all API calls must be HTTPS
- Back button behavior must be handled — Android users expect the back button to work

---

## Environment Variables (Expo)

```bash
# app.config.ts picks these up via process.env
EXPO_PUBLIC_API_URL=https://api.example.com
EXPO_PUBLIC_APP_ENV=development

# Server-side only (EAS secrets — not exposed to app bundle)
# Configure via: eas secret:create
```

---

## AI Agent Behavior

- Test UI changes on both platforms — behavior diverges more than you expect
- `pnpm typecheck` after every change — TypeScript errors in RN are often runtime crashes
- When adding a new screen, update navigation types in the root `_layout.tsx`
- Expo SDK upgrades require careful dependency audit — check the Expo SDK changelog
- Never use `require()` for images in a loop — pre-require them as constants
