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
   Set `EXPO_PUBLIC_DARZI_WHATSAPP_NUMBER` to your WhatsApp Business number in international format without `+`, for example `923001234567`.

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
- `posts`
- `whatsapp_auth_challenges`

The schema enables RLS and includes customer/tailor policies for profile ownership, public tailor discovery, private measurement vault access, and participant-only order access.

## WhatsApp Login

The app supports a zero-SMS-cost, user-initiated WhatsApp login handoff:

1. The app creates a short-lived challenge in `whatsapp_auth_challenges`.
2. The customer taps `Sign in with WhatsApp (Free)`.
3. WhatsApp opens with a pre-filled Darzi login code sent to your business number.
4. A trusted WhatsApp Business webhook must verify the inbound message and update the challenge row to `verified`.
5. The app polls `get_whatsapp_auth_challenge_status` and continues once verified.

Until the webhook is connected, SMS OTP and demo mode remain available.

## Deep Links

The app scheme is `darzi`.

- Tailor QR: `darzi://tailor/567`
- Order QR: `darzi://order/<order_uuid>`

Helpers live in [src/utils/deepLinks.ts](C:/Users/qasim/Documents/Darzi/src/utils/deepLinks.ts).
