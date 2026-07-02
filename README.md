# Fate — Social Matching System

Fate turns birth data into an explainable personality and relationship model. It is a social matching product, not a fortune-telling service.

## Run locally

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To enable the real DeepSeek relationship assistant:

```powershell
Copy-Item .env.example .env.local
# Set DEEPSEEK_API_KEY in .env.local, then restart npm run dev
```

The assistant uses the server-side Chat Completions API. The current example targets SiliconFlow with `deepseek-ai/DeepSeek-V3.2`; without a key, the UI falls back to local rule explanations.

For a China-friendly free deployment path, see [docs/DEPLOY_CN.md](docs/DEPLOY_CN.md).

## Production check

```powershell
npm run build
npm start
```

## API

### `POST /api/analyze`

```json
{ "year": 1998, "month": 8, "day": 24, "hour": 14 }
```

Returns the simplified Bazi pillars and five elements, zodiac, personality vector, and social profile.

### `POST /api/match`

Both users may be a birth input or a complete profile returned by `/api/analyze`.

```json
{
  "userA": { "year": 1998, "month": 8, "day": 24, "hour": 14 },
  "userB": { "year": 1997, "month": 11, "day": 8, "hour": 22 }
}
```

Returns a deterministic 0–100 score, rule-based reasons, and a natural-language explanation. The explanation layer does not recalculate the score.

## Architecture

- `lib/fate.ts` — deterministic Bazi, zodiac, personality, social, and matching rules
- `lib/types.ts` — shared domain contracts
- `app/api/*` — App Router API endpoints
- `app/page.tsx` — complete input → report → recommendation → match experience
