# ReflectAI - User-Authenticated AI Journaling & Reflection Workspace

ReflectAI is a full-stack, user-authenticated journaling and reflective thought partner application powered by the **Gemini 3.6 Flash API** and **Google Cloud Firestore**, hosted on **Google Cloud Run**.

The application features multi-turn conversation modes (Deep Reflection, Brainstorming, Executive Summary, Action Items), automated takeaway extraction, and strictly isolated per-user persistence backed by Firebase Authentication and Firestore Security Rules.

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
4. Paste the reCAPTCHA Secret Key into Firebase Console and paste the public Site Key into `firebase-applet-config.json` under `recaptchaSiteKey`.
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

To activate native Firestore vector acceleration, execute the following `gcloud` command once in your Google Cloud environment:

```bash
# Create the composite vector index for the reflections subcollection
gcloud firestore indexes composite create \
  --collection-group=reflections \
  --query-scope=COLLECTION \
  --field-config field-path=embedding,vector-config='{"dimension":"768","flat":"{}"}'
```

*(Note: While this index is building, the backend gracefully provides in-memory cosine similarity and keyword matching across the user's isolated vault so search remains functional without interruption).*

---

## 5. Local Development & Build

```bash
# Install dependencies
npm install

# Run full-stack dev server (Express backend + Vite frontend on Port 3000)
npm run dev

# Compile production bundle
npm run build

# Start production server
npm start
```

---

## 6. Google Cloud Run Deployment

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

## 7. Required Campaign Verification Label

Apply the mandatory verification label to register your deployed service for automated challenge scoring:

```bash
gcloud run services update reflect-ai \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1 \
  --service-account="${SERVICE_ACCOUNT}"
```

---

## 8. Threat Modeling & Countermeasures Summary

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

