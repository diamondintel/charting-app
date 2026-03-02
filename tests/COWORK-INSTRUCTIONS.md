# How to Run Pitch Intelligence Tests with Claude Cowork

## One-Time Setup

1. Copy `test-suite.js` into your project folder: `C:\projects\charting_app\tests\`
2. Open Claude Desktop → click **Cowork** tab
3. Select your `C:\projects\charting_app` folder

---

## Running Tests (Cowork Prompt)

Paste this prompt into Cowork to run the tests:

```
Go to the C:\projects\charting_app\tests folder.
Run this command in the terminal:
  node test-suite.js

Then report back:
- How many tests passed
- How many tests failed
- The exact error message for any failed test
- Whether cleanup completed successfully
```

---

## Scheduling Repeated Runs

To run tests automatically before every deploy:

1. In Cowork, type `/schedule`
2. Set the prompt to the one above
3. Set cadence to: **On demand** (run manually before each push) 
   OR **Daily** at a time when you're not coaching

---

## What the Tests Check

| Suite | What It Tests |
|-------|--------------|
| 1 - Connectivity | Supabase API reachable, Vercel app is live |
| 2 - Read Integrity | All 6 tables queryable, players have required fields, opponent tagging correct |
| 3 - Write Flow | Full game cycle: create game → PA → pitch → game_state → verify → delete |
| 4 - Business Logic | Valid outcome values, zone coords in range, pitch counts per PA, date sanity |
| 5 - Cleanup | All test data removed, verified |

---

## After You Push Code

Run this Cowork prompt after every `git push`:

```
1. Wait 45 seconds (Vercel deploys automatically)
2. Run: node C:\projects\charting_app\tests\test-suite.js
3. If any tests fail, show me the exact error
4. If all tests pass, confirm "Deploy verified ✅"
```

---

## What Exit Code Means

- Exit 0 = all tests passed ✅
- Exit 1 = one or more tests failed ❌

Claude Code / Cowork will see the exit code and report accordingly.
