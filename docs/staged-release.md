Version 0.1.39 delivers EF-1897 skill guidance. Only logging starts a planned session (EF-1895): the first logged set, completed set, logged activity or group score, or an explicit `start_workout`. Planning edits never do. The `update_user_profile` rules describe the long day `longSession` (EF-1870) and the stated maximum heart rate `maxHeartRate` (EF-1874), and the `create_custom_exercise` row says a cardio exercise tracks every cardio metric unless a flag is set false (EF-1885).

Producer requirement: none. The application already serves every behaviour the skill describes. The card, schemas, fixtures, tool inventory and `contract/server-contract.json`, including its minimum application commit, are unchanged.

Staging creates immutable prerelease assets only. Published catalog promotion must wait for the independently approved compatible application pin to serve exact production READY. External Desktop activation is a separate acceptance surface.
