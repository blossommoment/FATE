# FATE Backend Architecture

## Product Loop

FATE's backend is centered on one loop:

1. Bazi classification: convert birth information into a structured chart, five-element energy profile, and personality tags.
2. Smart recommendation: rank people, locations, and content by compatibility, intent, and recent trend signals.
3. Chat feedback: collect likes, skips, chats, voice messages, meetups, and post interactions.
4. Data iteration: adjust recommendation weights and retrain ranking features.
5. Better personalization: return improved matches, places, and community insights.

## Suggested Production Services

- API gateway: auth, rate limiting, request logging, app version gates.
- Identity service: accounts, FATE ID, profile, privacy settings.
- Bazi service: birth data normalization, chart calculation, tag generation.
- Recommendation service: people ranking, location ranking, content ranking.
- Feedback service: event collection and online score updates.
- Messaging service: chat list, voice metadata, safety moderation hooks.
- Community service: posts, trend overview, topic clustering.
- Feature store: user tags, interaction features, location features, model inputs.

## Storage

- Postgres: users, charts, posts, messages, places, recommendation snapshots.
- Redis: sessions, hot rankings, unread counters, short-lived match pools.
- Object storage: avatar images, voice messages, generated report images.
- Vector database: semantic user/post embeddings for deep matching.
- Analytics warehouse: offline model training and trend dashboards.

## Privacy Notes

Bazi birth information is sensitive profile data. Production should support private birth time visibility, encrypted storage for exact birth data, explicit consent for matching use, and event-level deletion on account removal.
