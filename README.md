# ReflectAI - User-Authenticated AI Journaling & Reflection Workspace

ReflectAI is a full-stack, user-authenticated journaling and reflective thought partner application powered by the **Gemini 3.6 Flash API** and **Google Cloud Firestore**, hosted on **Google Cloud Run**.

The application features multi-turn conversation modes (Deep Reflection, Brainstorming, Executive Summary, Action Items), automated takeaway extraction, and strictly isolated per-user persistence backed by Firebase Authentication and Firestore Security Rules.

---

## Key Features & Capabilities

- 🧠 **Multi-Turn Reflection Studio**: Diverse reflective modalities tailored to user focus:
  - **Deep Reflection**: Uncovers deeper insights, emotional clarity, cognitive reframing, and gratitude.
  - **Brainstorming**: Generates structured ideas, creative angles, and iterative pathways.
  - **Executive Summary**: Distills stream-of-consciousness entries into succinct takeaways.
  - **Action Items**: Extracts concrete, prioritized next steps and micro-habits.
  - **Freeform Chat**: Interactive dialogue for exploratory thought partner conversations.
- 🔍 **Semantic Vector Search (KNN)**: 768-dimensional embeddings generated via `gemini-embedding-001` with native Google Cloud Firestore vector search (`findNearest` KNN) and seamless in-memory cosine similarity fallback.
- 💡 **AI Growth Recommendations**: Server-side analysis of past reflection themes delivering personalized prompts and focus practices mapped to a curated, safe resource allowlist (zero hallucinated URLs).
- 🗺️ **Interactive Geotagged Journal Map**: Optional, privacy-conscious Google Maps JS SDK integration to visualize reflection moments geographically with rounded coordinate precision.
- 📊 **Insights & Momentum Dashboard**: Tracks reflection streaks, weekly velocity, entry distributions, and recurring intellectual themes.
- 🛡️ **Dual-Mode Privacy**: Seamless trial guest mode for instant onboarding and isolated user-scoped cloud persistence upon Google Authentication.

---

## Tech Stack

- **Frontend**: React 19 (SPA), TypeScript, Vite 6, Tailwind CSS v4, Lucide React, Framer Motion (`motion`), `@googlemaps/js-api-loader`, `canvas-confetti`.
- **Backend**: Node.js & Express runtime, `@google/genai` (Google Gen AI SDK), `firebase-admin` (Auth, Firestore, App Check).
- **Cloud Infrastructure**: Google Cloud Run, Google Cloud Firestore, Google Cloud Secret Manager, Firebase Authentication & App Check.

---

## Architecture & Security Model

```
┌─────────────────┐       HTTPS / Google Auth       ┌──────────────────────────────┐
│  React 19 SPA   │ ──────────────────────────────> │ Firebase Auth & Firestore DB │
│ (Vite+Tailwind) │ <────────────────────────────── │ (User-isolated security path)│
│ + Maps JS SDK   │                                 └──────────────────────────────┘
└────────┬────────┘                                                ▲
         │                                                         │
         │ POST /api/gemini/* (Bearer <idToken>)                   │ Verify Token &
         ▼                                                         │ Fetch Reflections
┌─────────────────────────┐   Secret Manager Auth   ┌──────────────┴───────────────┐
│ Express Server Runtime  │ ──────────────────────> │    Gemini 3.6 Flash API      │
│ (Firebase Admin SDK)    │                         │ (Model Fallback Chain Ladder)│
└─────────────────────────┘                         └──────────────────────────────┘
```

### Gemini Model Resilience & Fallback Ladder

To ensure zero downtime during traffic spikes or rate limits, ReflectAI implements a 4-tier model fallback ladder with automated exponential backoff:

1. `gemini-3.1-flash-lite` (Ultra-low latency, cost-optimized)
2. `gemini-3.6-flash` (High-fidelity balanced reflection)
3. `gemini-flash-latest` (General release stability)
4. `gemini-3.7-flash` (Advanced reasoning fallback)
5. **Heuristic Synthesis**: Offline structured markdown synthesis ensuring uninterrupted user journaling if external APIs are unreachable.

Embeddings utilize `gemini-embedding-001` (768 dimensions) with `gemini-embedding-2-preview` fallback.

---

## 1. Prerequisites & API Configuration

Ensure the following Google Cloud APIs are enabled in your GCP project:

```bash
# Set your project ID
export PROJECT_ID="YOUR_PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable required Google Cloud Services
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com \
  maps-backend.googleapis.com
```

### Git Credentials Hygiene & Environment File (.env)

All credential files and secrets are strictly excluded from version control via `.gitignore`:
- `firebase-applet-config.json` and `service-account*.json` are excluded from git.
- When cloning the repository, configure a local `.env` file based on `.env.example`:

```bash
cp .env.example .env
# Populate VITE_FIREBASE_* client configuration and GEMINI_API_KEY in .env
```

### Environment Variable Reference

| Variable | Scope | Required | Description |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Server | **Yes** | API key for Gemini models (managed in Secret Manager on Cloud Run). |
| `APP_URL` | Server | **Yes** (Cloud Run) | Canonical hosting URL (injected by Cloud Run for CORS and redirect origins). |
| `VITE_GOOGLE_MAPS_API_KEY` | Client | Optional | Client-side Google Maps JavaScript API key for the geotagged map view. |
| `VITE_FIREBASE_API_KEY` | Client | **Yes** | Firebase Web SDK API Key. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Client | **Yes** | Firebase Auth domain (e.g., `<project-id>.firebaseapp.com`). |
| `VITE_FIREBASE_PROJECT_ID` | Client | **Yes** | Firebase / GCP Project ID for client connections. |
| `VITE_FIREBASE_STORAGE_BUCKET` | Client | **Yes** | Firebase Storage bucket identifier. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Client | **Yes** | Firebase Cloud Messaging sender ID. |
| `VITE_FIREBASE_APP_ID` | Client | **Yes** | Firebase Web App ID. |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Client | Optional | Firestore database ID (defaults to `(default)` if omitted). |
| `VITE_RECAPTCHA_SITE_KEY` | Client | Optional | Public reCAPTCHA v3 site key for Firebase App Check. |
| `FIREBASE_PROJECT_ID` | Server | Optional | Server-side Firebase Admin SDK project ID override. |
| `FIRESTORE_DATABASE_ID` | Server | Optional | Server-side Firestore Database ID override. |
| `ENFORCE_APP_CHECK` | Server | Optional | Set to `true` to reject API calls missing valid `X-Firebase-AppCheck` tokens. |

---

## 2. Dedicated Least-Privilege Service Account & Secret Management

In accordance with Google Cloud security best practices, the Cloud Run backend runs under a **dedicated, least-privilege service account** rather than the default compute service account.

### A. Create Dedicated Service Account & Grant Scoped IAM Roles

```bash
# 1. Create the dedicated service account
gcloud iam service-accounts create reflect-ai-runner \
  --description="Dedicated runtime service account for ReflectAI on Cloud Run" \
  --display-name="ReflectAI Cloud Run Service Account"

export SERVICE_ACCOUNT="reflect-ai-runner@${PROJECT_ID}.iam.gserviceaccount.com"

# 2. Grant Firestore Data Access (Least-Privilege data access)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/datastore.user"

# 3. Grant AI Platform User (for Vertex AI / Gemini operations)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/aiplatform.user"
```

### B. Gemini API Key (Secret Manager)
ReflectAI enforces zero-hardcoding hygiene. The Gemini API key is securely retrieved by the Cloud Run runtime via Google Cloud Secret Manager and never exposed to the client.

```bash
# 1. Create the Secret in Secret Manager
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# 2. Add your Gemini API Key as a secret version
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant ONLY the dedicated service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

### C. Google Maps JavaScript API Key (Client-Side HTTP Referrer Restricted)
> **Security Notice**: Do **NOT** store the Google Maps JavaScript API Key in Secret Manager. Because it is executed in the user's browser, it must be bundled client-side via `VITE_GOOGLE_MAPS_API_KEY`.
>
> **Protection Mechanism**: Instead of secrecy, restrict the key in Google Cloud Console:
> 1. Open **Google Cloud Console** > **APIs & Services** > **Credentials**.
> 2. Edit your Maps API key under **Application restrictions**: select **Web sites** (HTTP referrers).
> 3. Add authorized website referrers:
>    - `https://your-service-*.run.app/*`
>    - `http://localhost:3000/*`
> 4. Under **API restrictions**: select **Restrict key** and check only **Maps JavaScript API**.

---

## 3. Firebase App Check & Firestore Security Rules

### A. Firebase App Check Configuration (Firebase Console)
Firebase App Check protects direct Client → Firestore writes (which bypass the backend) and defends `/api/gemini/*` endpoints from unauthorized replays and bot traffic:
1. Open the [Firebase Console](https://console.firebase.google.com/) and navigate to **App Check** > **Apps**.
2. Select your Web App and click **Register** under **reCAPTCHA v3**.
3. Create a reCAPTCHA v3 key in the [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin) for your app's domains.
4. Paste the reCAPTCHA Secret Key into Firebase Console and paste the public Site Key into `firebase-applet-config.json` under `recaptchaSiteKey` (or `.env` as `VITE_RECAPTCHA_SITE_KEY`).
5. Under the **APIs** tab in Firebase App Check, click **Enforce** on **Cloud Firestore** to reject all requests missing valid App Check tokens.
6. Optional: To strictly enforce App Check on the Cloud Run backend, set the environment variable `ENFORCE_APP_CHECK=true`.

### B. Firestore Security Rules (`firestore.rules`)
All journal entries, reflections, and generated recommendation batches are strictly owner-isolated and schema-validated:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isValidGeo(geo) {
      return geo == null || (
        geo is map
        && geo.lat is number
        && geo.lng is number
        && geo.lat >= -90
        && geo.lat <= 90
        && geo.lng >= -180
        && geo.lng <= 180
      );
    }

    function isValidReflection(data, userId) {
      return data.id is string && data.id.size() > 0 && data.id.size() <= 128
        && data.userId == userId
        && data.title is string && data.title.size() <= 300
        && data.createdAt is number
        && data.updatedAt is number
        && (!('primaryPrompt' in data) || (data.primaryPrompt is string && data.primaryPrompt.size() <= 5000))
        && (!('summary' in data) || (data.summary is string && data.summary.size() <= 5000))
        && (!('mode' in data) || (data.mode is string && data.mode.size() <= 50))
        && (!('pinned' in data) || data.pinned is bool)
        && (!('tags' in data) || data.tags is list)
        && (!('takeaways' in data) || data.takeaways is list)
        && (!('messages' in data) || data.messages is list)
        && (!('geo' in data) || isValidGeo(data.geo))
        && (!('embedding' in data) || true)
        && (!('embeddingUpdatedAt' in data) || data.embeddingUpdatedAt is number);
    }

    function isValidRecommendationBatch(data, userId) {
      return data.id is string && data.id.size() > 0 && data.id.size() <= 128
        && data.userId == userId
        && data.suggestions is list
        && data.createdAt is number;
    }

    match /users/{userId}/reflections/{reflectionId} {
      allow read, delete: if isOwner(userId);
      allow create, update: if isOwner(userId) && isValidReflection(request.resource.data, userId);
    }

    match /users/{userId}/recommendations/{recId} {
      allow read, delete: if isOwner(userId);
      allow create, update: if isOwner(userId) && isValidRecommendationBatch(request.resource.data, userId);
    }
  }
}
```

Deploy rules using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 4. Vector Search Index Setup (Manual Deployment Step for Semantic Journal Search)

Feature 3 implements semantic similarity search across reflections using Gemini 768-dimensional embeddings (`gemini-embedding-001`) and Cloud Firestore's native K-Nearest Neighbor (KNN) `findNearest` vector queries.

Run the following `gcloud` command to create the composite vector index (pass `--database` if your Firestore instance uses a custom database ID):

```bash
# Set your target database (or use "(default)")
export DATABASE_ID="ai-studio-d3fee594-9314-471a-9b0d-2a2808c4182d" # or "(default)"

# Create the composite vector index for the reflections subcollection
gcloud firestore indexes composite create \
  --project=$PROJECT_ID \
  --database=$DATABASE_ID \
  --collection-group=reflections \
  --query-scope=COLLECTION \
  --field-config field-path=embedding,vector-config='{"dimension":"768","flat":"{}"}'
```

*(Note: While this index is building, the backend automatically provides in-memory cosine similarity and keyword matching across the user's isolated vault so search remains functional without interruption).*

---

## 5. Backend API Endpoints Reference

All `/api/gemini/*` endpoints require a valid Firebase ID Token in the `Authorization: Bearer <idToken>` header, pass App Check validation, and enforce per-UID rate limits.

| Method | Endpoint | Description | Key Payload Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health & service readiness check. | None |
| `POST` | `/api/gemini/reflect` | Generates structured multi-turn reflection synthesis & takeaways. | `prompt` (string, max 2000), `mode` (`reflection` \| `brainstorm` \| `summary` \| `action_items` \| `chat`), `conversationHistory`, `tags`, `title` |
| `POST` | `/api/gemini/summarize` | Distills entry into an executive summary & bullet highlights. | `text` (string, max 3000) |
| `POST` | `/api/gemini/recommendations` | Analyzes caller's recent reflection themes & provides growth suggestions. | `clientReflections` (array of up to 10 entries) |
| `POST` | `/api/gemini/embed-reflection` | Computes 768-dim vector embedding (`gemini-embedding-001`) for an entry. | `reflectionId` (string), `title` (string), `summary` (string) |
| `POST` | `/api/gemini/search` | Performs KNN vector search & cosine ranking over user's journal vault. | `query` (string, max 500), `limit` (number, default 5), `clientEntries` (optional fallback array) |

---

## 6. Local Development & Build

```bash
# Install dependencies
npm install

# Run full-stack dev server (Express backend + Vite frontend on Port 3000)
npm run dev

# Run TypeScript compiler type checking
npm run lint

# Compile production bundle (Vite + esbuild backend bundle)
npm run build

# Start production server from dist bundle
npm start

# Preview production build locally
npm run preview

# Clean build artifacts
npm run clean
```

---

## 7. Google Cloud Run Deployment

Deploy the containerized full-stack application to Google Cloud Run utilizing the dedicated runtime service account:

```bash
# Deploy to Cloud Run with Secret Manager binding and dedicated runtime service account
gcloud run deploy reflect-ai \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --service-account="${SERVICE_ACCOUNT}" \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 3000
```

---

## 8. Required Campaign Verification Label

Apply the mandatory verification label to register your deployed service for automated challenge scoring:

```bash
gcloud run services update reflect-ai \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1 \
  --service-account="${SERVICE_ACCOUNT}"
```

---

## 9. Threat Modeling & Countermeasures Summary

ReflectAI operates across two distinct trust boundaries:
- **Boundary (a)**: Client → Cloud Run backend → Gemini API
- **Boundary (b)**: Client → Cloud Firestore directly (writes occur via client Firebase SDK without backend mediation)

| Threat Zone | Trust Boundary | Threat Scenario | Countermeasure Implemented |
| :--- | :--- | :--- | :--- |
| **Input Surfaces** | Boundary (a) | Prompt injection via past user reflection text; oversized payloads | Recommendation engine passes only reflection summaries/titles and explicitly instructs Gemini to treat entry content strictly as observational data to analyze, never executable instructions. Server enforces strict maximum character length limits (prompt ≤ 2000 chars, summarize ≤ 3000 chars) returning clean 400s. |
| **Input Surfaces** | Boundary (b) | Malformed or malicious direct client document writes to Firestore | `firestore.rules` enforces schema validation, field types, and size caps directly on create/update operations, including numerical range checks on geo-coordinates (`-90..90`, `-180..180`). |
| **Planning & Reasoning** | Boundary (a) | System prompt hijacking, model hallucinated links, or API outages | Recommendations response schema enforces structured JSON output with a curated developer allowlist for external resources (rejecting arbitrary hallucinated URLs). Resilient fallback ladder handles transient 503/429/404/500 errors gracefully. |
| **Tool Execution** | Boundary (a) | API key compromise, SSRF, or unauthorized third-party access | Gemini API key is isolated in Secret Manager and accessible only by the dedicated `reflect-ai-runner` service account. Google Maps JavaScript API key is restricted by HTTP Referrer in Google Cloud Console. |
| **Memory & State** | Boundary (a) | Cross-user data leakage, missing auth on AI endpoints | Firebase Admin SDK verifies Bearer ID tokens on `/api/gemini/*` endpoints before reading reflection history. Guest users are prevented from invoking server recommendation summaries. In-memory per-UID rate limiting prevents unbounded AI consumption. |
| **Memory & State** | Boundary (b) | Unauthorized direct Firestore read/write or token replay | Owner-bound Firestore rules isolate `reflections` and `recommendations` subcollections (`request.auth.uid == userId`). Firebase App Check with reCAPTCHA v3 enforces that direct Firestore writes originate from the authentic web application. |
| **Inter-System Comms** | Boundary (a) & (b) | Insecure token transmission, coordinate precision re-identification | All backend communications require verified HTTPS Firebase ID tokens. Geolocation is an explicit opt-in toggle (never silent) rounded to safe precision. Explicit CORS and Helmet CSP headers restrict network interactions. |
| **Recommendation & Search Generation** | Boundary (a) | Cross-user vector search leakage, raw embedding exposure, unauthenticated cost exhaustion | Similarity search (`POST /api/gemini/search`) queries are strictly scoped to `users/{uid}/reflections` (never collection-group queries spanning users). Embeddings are generated only on title+summary (never full raw message trees) and stripped from API responses, returning only sanitized `{ id, title, summary, score }`. Guest mode completely bypasses billable embedding endpoints. |
