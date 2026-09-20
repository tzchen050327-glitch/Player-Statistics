# Supabase B migration package

Target split:

- A: CPBL / NPB live play-by-play and current-season data.
- B: KBO, MLB / MiLB, international tournaments, and historical seasons.

The Edge Function templates in this directory intentionally contain placeholders instead of internal proxy credentials:

- `__APP_KEY__`
- `__BASEBALL_PROXY_KEY__`
- `__CPBL_PROXY_KEY__`
- `__CPBL_PROXY_KEY_SHA256__`

Before deploying to B, generate B-specific internal proxy keys and replace the placeholders in-memory. Do not commit the real internal keys.
