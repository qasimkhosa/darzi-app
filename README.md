# Darzi

Darzi is a localized hyper-local tailor-finding app built with Expo, React Native, NativeWind, React Navigation, and Supabase.

## Setup

1. Install dependencies:
   ```powershell
   npm install
   ```

2. Create `.env.local` from `.env.example` and add the public Supabase project values:
   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Run the app:
   ```powershell
   npm run start
   ```

4. Run TypeScript verification:
   ```powershell
   npm run lint
   ```

## Supabase

Run [supabase/schema.sql](C:/Users/qasim/Documents/Darzi/supabase/schema.sql) in the Supabase SQL editor. It creates:

- `profiles`
- `tailor_profiles`
- `measurement_vault`
- `orders`

The schema enables RLS and includes customer/tailor policies for profile ownership, public tailor discovery, private measurement vault access, and participant-only order access.

## Deep Links

The app scheme is `darziapp`.

- Tailor QR: `darziapp://tailor/567`
- Order QR: `darziapp://order/<order_uuid>`

Helpers live in [src/utils/deepLinks.ts](C:/Users/qasim/Documents/Darzi/src/utils/deepLinks.ts).
