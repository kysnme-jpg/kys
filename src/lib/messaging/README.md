# Messaging data-access layer (§4a Layer 5)

**All** reads and writes to messaging tables go through the repository modules in
this directory. No route handler, job, or script may query a messaging table
directly.

Enforced by `scripts/check-messaging-isolation.mjs` (run via
`npm run check:messaging-isolation`), which fails if a messaging table/model name
appears in `src/` outside `src/lib/messaging/`.

Tables are introduced in later phases:
- External (store ↔ customer/consignor): `externalThread`, `externalMessage`, `externalInternalNote`
- Internal (staff ↔ staff): `internalThread`, `internalMessage`, `internalParticipant`, `internalChannel`
- Owner: `ownerThread`

Each repository function takes the resolved `Actor` (from `@/lib/authz`) as its
first argument and applies the channel scope itself — callers never pass a role
or channel from the client.
