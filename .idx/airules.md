# CRITICAL: CURRENT CODE IS SOURCE OF TRUTH

The current files in this workspace are the authoritative version of this project.

Manual changes may have been made outside the AI. Never restore, overwrite, reverse, or replace those changes based on previous AI-generated versions or previous conversation context.

## DEFAULT MODE: READ ONLY

Unless the user explicitly asks for a code modification, DO NOT modify any project file.

Questions such as:

* "check this"
* "look at this"
* "understand this"
* "what do you think?"
* "review this"
* "why is this happening?"
* "explain this"

are READ-ONLY requests.

Never interpret them as permission to edit code.

Before every requested modification:

1. Read the current relevant file(s).
2. Treat current code as source of truth.
3. Make only the explicitly requested change.
4. Use the smallest possible diff.
5. Preserve all unrelated logic, styling, behavior, APIs, routes, Firebase operations, schemas, caching, authentication, access control, and data handling.
6. Never perform unrelated refactoring or cleanup.
7. Never change dependencies/configuration unless explicitly requested.
8. Never modify additional files because they "could be improved."
9. If another file genuinely must change for the requested feature to work, explain why before modifying it.
10. After changes, list every modified file and exactly what changed.

DO NOT MODIFY CODE UNTIL THE USER EXPLICITLY AUTHORIZES A CHANGE.

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