# PROJECT EDITING RULES

You are assisting with an existing production web application.

## MOST IMPORTANT RULE
NEVER change anything that the user did not explicitly request.

## Editing behavior

- Make the smallest possible change.
- Do not redesign unrelated UI.
- Do not rename variables, functions, files, routes, components, or database fields unless requested.
- Do not refactor working code unless requested.
- Do not change Firebase configuration unless specifically requested.
- Do not change Firestore schema, collections, document fields, security rules, indexes, or authentication behavior unless specifically requested.
- Do not remove existing features.
- Do not change existing business logic while making a visual change.
- Do not change visual design while fixing a logic bug unless requested.
- Preserve existing functionality exactly unless the requested change requires modifying it.

## Before editing

Before changing code:

1. Identify the exact file(s) that need modification.
2. Explain briefly what you intend to change.
3. Identify anything that must remain untouched.
4. Prefer editing only the relevant component/function.

## After editing

After making changes:

- List the files changed.
- Explain exactly what changed.
- Confirm that unrelated functionality was not intentionally modified.
- Run TypeScript/build checks where possible.
- Fix only errors caused by the requested change.

## UI changes

When the user asks to change one UI element:

- Change only that element.
- Preserve surrounding layout unless required.
- Preserve colors, typography, spacing, responsiveness, and interactions unless the request specifically concerns them.

## Bug fixes

When fixing an error:

- Diagnose the actual cause first.
- Do not redesign or refactor unrelated code.
- Make the minimum fix required.
- Do not replace entire working components just to fix one error.

## Firebase safety

Treat Firebase data structures as stable contracts.

Never modify:
- collection names
- document IDs
- field names
- Firestore rules
- authentication logic
- Storage paths
- Cloud Functions
- environment variables

unless the user explicitly requests it.

## When uncertain

If a requested change could affect another feature, explain the dependency before changing it.

Do not make assumptions and then modify unrelated code.