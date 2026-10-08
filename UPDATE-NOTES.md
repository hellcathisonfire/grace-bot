# Grace update — Live v2 + Grace Offenders

## Drop-in
Copy `src/`, `test/`, `assets/ranks/`, `tools/` over your `bot/` folder (replace files with the same name).
Add to `package.json` → "scripts":

    "test:offenders": "node test/offenders_test.mjs",
    "test:emoji": "node test/emoji_test.mjs",
    "hashpass": "node tools/hash-password.mjs",
    "ranks": "node tools/make-ranks.mjs"      (needs: npm i -D sharp; PNGs are already included)

and add the new tests to your "test" script (ui_test, handlers_test, offenders_test, emoji_test).

## Env vars (all optional)
- GRACE_OWNER_ID          your Discord user ID. Without it, the owner of the application in the Developer Portal is used.
- OFFENDERS_PASSWORD_HASH override the built-in password hash (make one with `npm run hashpass -- "new password"`).
- OFFENDERS_PASSWORD      plain-text alternative to the hash.

## First start
The bot registers /offenders by itself, uploads 7 rank emblems + ~60 legend heads as *application emojis*
(takes ~30 s the first time; cards use normal emojis until each one exists). Nothing to do by hand.
If you ever redesign the emblems, delete the `rk_*` emojis in Developer Portal → your app → Emojis, then restart.
