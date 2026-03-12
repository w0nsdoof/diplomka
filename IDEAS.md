# Ideas & Future Improvements

| # | Area | Idea | Notes |
|---|------|------|-------|
| 1 | Comments | Autocomplete for @mentions | Add a user search endpoint (`GET /api/users/search/?q=...`), listen for `@` in the comment textarea, show a dropdown with matching users (debounced, org-scoped). Consider `angular-mentions` library or a contenteditable approach for cursor-aware insertion. Current regex-based parsing requires exact `@FirstName LastName` with no assistance. |
