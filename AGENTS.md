<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Keep the manuals up to date

This project ships user-facing documentation in `docs/`:
- `docs/USER_GUIDE.md` — for store staff (POS, inventory, consignors, etc.)
- `docs/ADMIN_GUIDE.md` — for the owner/admin (hosting, env vars, integrations, troubleshooting)

**Whenever you add or change a feature, workflow, setting, environment variable,
integration, or deployment step, update the relevant guide(s) in the SAME change**
so the manuals never drift from the platform. New feature → document it; renamed
or removed feature → fix/remove its section; new env var or setup step → add it
to the Admin Guide.
