# AI_PROJECT_CONTEXT.md

## Project Vision & Core Stack
This project serves as a highly reusable, Play Store compliant, premium Android boilerplate. It provides a robust foundation for modern Android applications, prioritizing seamless user experience, strict policy compliance (GDPR/CCPA via UMP), scalable monetization, and high-quality UI/UX.

**Definitive Tech Stack:**
*   **Language:** 100% Kotlin
*   **UI Toolkit:** Jetpack Compose (Material 3)
*   **Architecture:** MVVM (Model-View-ViewModel) + Clean Architecture principles
*   **Dependency Injection:** Dagger Hilt
*   **Navigation:** Jetpack Navigation Compose
*   **Networking:** Retrofit + OkHttp
*   **Local Storage:** Jetpack DataStore (Preferences)
*   **Asynchronous Programming:** Kotlin Coroutines & Flow

## Architectural Rules
To maintain code quality and consistency, any AI or human contributor must adhere to the following strict rules:
1.  **UI:** Always use Jetpack Compose for UI. XML layouts are strictly forbidden.
2.  **State Management:** ViewModels must expose state via `StateFlow`. All Kotlin Flows in the UI layer MUST be collected using `collectAsStateWithLifecycle()` to prevent background battery drain and memory leaks. Utilize the custom `UiState<T>` sealed interface for handling Loading, Success, and Error states uniformly.
3.  **Local Storage:** Never use deprecated `SharedPreferences`. Always use `Preferences DataStore` via `UserPreferencesManager`.
4.  **Dependency Injection:** Always inject dependencies via Hilt. Enforce strict dependency scoping. Avoid `@Singleton` unless globally required; prefer `@ViewModelScoped` or `@ActivityScoped` where appropriate to prevent memory bloat.
5.  **Aesthetics:** Strict adherence to the established Premium Material 3 agency styling. Avoid harsh black drop shadows; use tonal elevation and organic, large, rounded corners (e.g., 16dp to 24dp+). Utilize the custom `PremiumButton`, `SoftElevatedCard`, and `GlassTopBar` components.
6.  **Concurrency:** All background work must be done using Coroutines. Expose reactive streams using `Flow`. Never launch un-scoped coroutines. Always tie them strictly to `viewModelScope` or `lifecycleScope`.
7.  **Monetization Compliance:** Never bypassing the `ConsentManager` (Google UMP SDK). AdMob integration (`AdsManager`) must only initialize *after* explicit user consent. Interstitial ads must respect the `COOLDOWN_MILLIS` timer to prevent ad spam policy violations.

## Module Breakdown (What exists so far)

### Monetization & Compliance
*   **`ConsentManager.kt` & `AdsManager.kt`:** Securely synchronized to ensure interstitials will absolutely never load before UMP consent is resolved. `ConsentManager` handles GDPR/CCPA, and `AdsManager` implements safe caching and strict cooldowns for Ad Spam compliance.
*   **`BillingManager.kt`:** Manages in-app subscriptions and purchases using Google Play Billing Library v6+. Uses state flows to expose premium access universally.

### UX & Play Core
*   **`UserPreferencesManager.kt`:** Replaces `SharedPreferences`. Uses DataStore to securely manage lightweight user state (e.g., onboarding status, premium flags, theme preferences).
*   **`AppUpdateHandler.kt`:** Wraps the Play Core App Update API, making it easy to force immediate updates or recommend flexible updates.
*   **`ReviewHandler.kt`:** Wraps the Play Core In-App Review API. Safely requests user reviews after high-value conversion actions without spamming.

### UI System
*   **Theme & Styling:** A highly customized Material 3 setup (`Color.kt`, `Type.kt`, `Shape.kt`, `Theme.kt`). Uses deep organic colors, tailored sans-serif typography, large rounded corners, and tonal surface containers.
*   **Edge-to-Edge:** Native setup to draw UI behind the system status and navigation bars for an immersive experience.
*   **`AgencyComponents.kt`:** Contains premium reusable components like `PremiumButton` (with subtle shrink animation), `SoftElevatedCard` (tonal elevation instead of harsh shadows), and `GlassTopBar` (translucent blur effect).
*   **`BaseScreen.kt` & `UiState.kt`:** Provides a standard wrapper for UI screens that automatically handles `Loading` (spinners) and `Error` (snackbar/retry) states.

### Data & Observability
*   **Data Strategy:** `NetworkBoundResource.kt` provides an offline-first caching strategy utilizing Kotlin Flow. It queries the local DB, fetches network data, updates the DB, and emits UI states consecutively. It includes hardened, graceful error handling for dropped connections.
*   **Networking Layer:** `NetworkModule.kt` configures OkHttp and Retrofit. Includes interceptors for injecting Auth tokens and HTTP logging (debug only). Integrators should connect their REST API, Firebase Auth, or Supabase backend here.
*   **Observability:** Abstracted `AnalyticsManager` and `CrashReportingManager` interfaces ensure the app is not hard-coupled to one analytics SDK. Concrete Firebase implementations are provided, alongside Timber setup logic.
*   **Security & R8/ProGuard:** Preconfigured `network_security_config.xml` blocks cleartext traffic. `proguard-rules.pro` ensures Retrofit, Compose, and Coroutines survive release minification.

## Directory Structure
\`\`\`text
com.yourcompany.app
├── core/
│   ├── consent/               # Google UMP SDK setup
│   ├── datastore/             # UserPreferencesManager
│   ├── di/                    # Hilt Modules (NetworkModule, AppModule)
│   ├── monetization/          # AdsManager, BillingManager
│   ├── network/               # NetworkBoundResource inline function
│   ├── observability/         # AnalyticsManager, CrashReportingManager
│   ├── playcore/              # AppUpdateHandler, ReviewHandler
│   ├── theme/                 # Premium Material 3 System (Color, Type, Shape, Theme)
│   └── ui/                    # BaseScreen, UiState, Premium Reusable Components
├── data/
│   ├── local/                 # Room DAOs, Entities (Offline Cache) -> [Implementation Pending]
│   ├── remote/                # Retrofit APIs, DTOs
│   └── repository/            # Concrete implementations of Domain repositories
├── domain/
│   ├── model/                 # Pure Kotlin Data Models
│   ├── repository/            # Abstract interfaces
│   └── usecase/               # Single-responsibility business logic
├── feature/
│   ├── auth/                  # Authentication UI & ViewModels -> [Implementation Pending]
│   ├── home/                  # Main Dashboard UI & ViewModels
│   ├── paywall/               # Subscription/Billing UI
│   └── settings/              # User preferences, UMP Revocation hook
└── MainActivity.kt            # Entry point, Dagger Hilt injection, App initialization
\`\`\`

## Pending Roadmap (Next Steps)
While this boilerplate contains a robust foundation, a future integration or AI agent should address these standard features depending on the specific product:
*   **[ ] Authentication Flows:** Implement Login/Signup UI and integrate with Firebase Auth, Supabase Auth, or a custom OAuth backend.
*   **[ ] Local Database Implementation:** Add Room Database setup with basic Entities and DAOs to integrate with `NetworkBoundResource`.
*   **[ ] Push Notifications:** Integrate Firebase Cloud Messaging (FCM) or OneSignal and build a notification handling service.
*   **[ ] CI/CD Pipeline Setup:** Create GitHub Actions (`.github/workflows`) or Bitrise YAML configs for automated building, testing, and Play Store publishing.
*   **[ ] Unit & UI Testing:** Implement baseline tests using JUnit, MockK, and Compose Test Rule for critical core components like `BillingManager` and `NetworkBoundResource`.

## Changelog & Audit History
*   **v1.2 - Phase 8 CI/CD & Testing:** Engineered automated release pipeline via GitHub Actions to Google Play. Integrated unified testing harness (JUnit, MockK, Turbine) for high-fidelity state validation.
*   **v1.1 - Phase 6 QA Audit:** Analyzed architecture, fixing lifecycle safety (forced `collectAsStateWithLifecycle`), tightened Hilt cohesion (scoping rules), and enforced strict Play Store policy compliance (Consent/Ad synchronization).
*   **v1.0 - Core Foundation:** Initial layout of Android Boilerplate with Jetpack Compose, MVVM, Hilt, UMP, AdMob, Play Billing, and DataStore.
