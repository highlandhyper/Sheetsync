---

name: developing-genkit-js
description: Build, modify, debug, and maintain AI-powered applications using Genkit with Node.js and TypeScript. Use for Genkit flows, agents, prompts, tools, middleware, providers, schemas, deployment, validation errors, type errors, API errors, and Genkit architecture work.
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Genkit JS Development

## Core Rule

Genkit evolves quickly and has had breaking API changes.

Do not rely on remembered Genkit APIs when authoritative documentation or the installed project can be inspected.

Before implementing unfamiliar or version-sensitive Genkit functionality:

1. Inspect the existing project.
2. Check installed Genkit package versions.
3. Verify the relevant Genkit documentation.
4. Preserve the project's existing architecture unless a change is necessary.

Prefer the smallest correct modification over unnecessary rewrites.

---

# 1. Inspect the Existing Project First

Before changing an existing project, inspect:

* `package.json`
* existing Genkit initialization
* installed provider plugins
* flows
* agents
* tools
* schemas
* prompts / `.prompt` files
* middleware
* environment configuration
* framework integrations
* TypeScript configuration

Do not replace working architecture simply because another pattern exists.

Preserve:

* existing provider choice
* naming conventions
* folder structure
* schema patterns
* environment variable conventions
* framework integration
* deployment architecture

unless the user specifically requests a migration or redesign.

---

# 2. Version Requirements

Check versions before generating version-sensitive code.

Verify the CLI:

```bash
genkit --version
```

Recommended minimum CLI version:

```text
genkit-cli >= 1.29.0
```

Install or upgrade if necessary:

```bash
npm install -g genkit-cli@^1.29.0
```

Also inspect the installed Genkit library:

```bash
npm list genkit
```

Agents require:

```text
genkit >= 1.39.0
```

Do not confuse the `genkit-cli` version with the `genkit` npm package version.

If the required feature is unavailable in the installed version, either:

1. use a compatible implementation, or
2. clearly recommend the required upgrade.

Do not silently upgrade dependencies unless requested.

---

# 3. Documentation Verification

Use authoritative Genkit documentation when implementing version-sensitive APIs.

Useful commands:

```bash
genkit docs:list
genkit docs:search "topic"
genkit docs:read js/get-started.md
genkit docs:read js/flows.md
```

For unfamiliar functionality:

```bash
genkit docs:search "<feature>"
```

Examples:

```bash
genkit docs:search "streaming"
genkit docs:search "agents"
genkit docs:search "middleware"
genkit docs:search "tools"
genkit docs:search "providers"
```

Prefer current documentation over pre-1.0 Genkit examples found elsewhere.

---

# 4. Decide: Agent or Flow

Choose the correct abstraction before coding.

## Use an Agent when the task is:

* conversational
* multi-turn
* stateful
* an assistant
* a chatbot
* capable of tool use across turns
* expected to maintain sessions
* expected to pause/resume
* expected to branch conversations
* expected to coordinate multiple agents

Prefer:

```ts
ai.defineAgent(...)
```

Agent APIs are provided through:

```ts
genkit/beta
```

Browser agent APIs use:

```ts
genkit/beta/client
```

Do not import beta agent APIs from the stable `genkit` entrypoint.

## Use a Flow when the task is:

* single-shot
* deterministic orchestration
* stateless generation
* backend automation
* structured processing
* API-like AI execution

Prefer:

```ts
ai.defineFlow(...)
```

Do not build a manual multi-turn agent loop inside a flow when Genkit Agents are appropriate.

---

# 5. Provider Selection

Genkit is provider-agnostic.

Supported providers may include:

* Google AI
* Vertex AI
* OpenAI
* Anthropic
* Ollama
* other Genkit-supported plugins

## Existing Projects

Preserve the provider already used by the project unless the user requests a change.

Check `package.json` and the existing Genkit initialization before adding another provider.

## New Projects

If no provider is specified and the project has no existing provider configuration, default to Google AI.

Example:

```ts
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const ai = genkit({
  plugins: [googleAI()],
});
```

Do not add multiple providers without a reason.

If using another provider, verify its current plugin documentation first.

---

# 6. Minimal Hello World

```ts
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const ai = genkit({
  plugins: [googleAI()],
});

export const myFlow = ai.defineFlow(
  {
    name: 'myFlow',
    inputSchema: z.string().default('AI'),
    outputSchema: z.string(),
  },
  async (subject) => {
    const response = await ai.generate({
      model: googleAI.model('gemini-flash-latest'),
      prompt: `Tell me a joke about ${subject}`,
    });

    return response.text;
  }
);
```

Keep Genkit configuration minimal.

Only specify options that differ from defaults.

---

# 7. Schemas

Use schemas for:

* flow inputs
* flow outputs
* tool inputs
* tool outputs
* structured model responses
* reusable domain objects

Prefer shared schemas when multiple flows, tools, or prompts use the same structure.

Avoid duplicating schema definitions unnecessarily.

Use:

```ts
z.object(...)
```

for structured data.

When a reusable named schema is appropriate, use Genkit's schema registration APIs according to current documentation.

---

# 8. Tools

A tool should perform a clear external or deterministic action.

Examples:

* database lookup
* API request
* inventory search
* barcode lookup
* document retrieval
* calculation
* sending a notification
* accessing business data

Design tools with:

* narrow responsibility
* descriptive names
* clear descriptions
* strict input schemas
* predictable outputs

Avoid giant tools that perform unrelated tasks.

The tool description should tell the model:

1. what the tool does
2. when it should be used
3. what information it needs

Do not put normal reasoning inside a tool when ordinary model generation is sufficient.

---

# 9. Prompts / Dotprompt

Use `.prompt` files when prompt content should be separated from application code.

Dotprompt supports concepts such as:

* YAML frontmatter
* Handlebars templates
* variants
* partials
* named schemas
* tools
* `maxTurns`
* `returnToolRequests`
* middleware through `use`

Prompt loading may use:

```ts
ai.prompt(...)
```

Before implementing advanced Dotprompt behavior, verify the current documentation:

```bash
genkit docs:search "dotprompt"
```

Keep business logic out of prompts when it belongs in application code.

---

# 10. Agents

Use Genkit Agents for persistent multi-turn applications.

Agent capabilities may include:

* sessions
* persistence
* snapshots
* interrupts
* human approval
* conversation branching
* background execution
* typed state
* artifacts
* multi-agent orchestration

Relevant documentation topics include:

* agents
* sessions
* human-in-the-loop
* branching
* background agents
* state
* artifacts
* multi-agent orchestration
* custom agents
* deployment

Because Agents are beta APIs, verify their documentation before implementation.

---

# 11. Middleware

Middleware can wrap model generation and agent execution.

Common middleware use cases include:

* retries
* fallback models
* request transformation
* response transformation
* tool approval
* artifact handling
* filesystem functionality
* skills
* agent behavior

Middleware commonly attaches through:

```ts
use: [...]
```

Use middleware only when cross-cutting behavior justifies it.

Do not introduce middleware for logic that is clearer inside a single flow or tool.

---

# 12. Framework Detection

Inspect `package.json` before choosing integration patterns.

Look for packages such as:

```text
@genkit-ai/next
@genkit-ai/firebase
@genkit-ai/google-cloud
```

Also identify whether the application uses:

* Next.js
* Express
* Firebase
* Cloud Run
* standalone Node.js
* another server framework

Adapt the implementation to the project's framework instead of forcing a generic architecture.

---

# 13. Error Handling Protocol

When a Genkit-specific error occurs:

1. Read the actual error message completely.
2. Identify the failing Genkit API or component.
3. Check the installed Genkit version.
4. Consult Genkit's documented common errors.
5. Search current Genkit documentation if needed.
6. Apply the smallest documented fix.
7. Run TypeScript validation.
8. Reproduce the failing operation.
9. Inspect the resulting trace.

Useful documentation:

```text
references/common-errors.md
```

Do not guess fixes based on outdated pre-1.0 Genkit APIs.

Common outdated patterns may include APIs such as:

```text
configureGenkit
response.text()
old defineFlow imports
```

Always confirm the correct current replacement.

---

# 14. Type Checking

After code changes, run:

```bash
npx tsc --noEmit
```

Fix Genkit-related errors before considering the task complete.

Do not suppress TypeScript errors with:

```ts
any
```

unless there is a specific justified reason.

Do not use unsafe casts merely to make compilation succeed.

Prefer fixing the actual type mismatch.

---

# 15. Running and Debugging Genkit

For development, prefer running the application through Genkit so traces are captured.

Example:

```bash
genkit start -- npx tsx --watch src/index.ts
```

Without the Dev UI:

```bash
genkit start --noui -- npx tsx src/index.ts
```

For automated environments:

```bash
genkit start --non-interactive -- npx tsx src/index.ts
```

Running only:

```bash
node ...
tsx ...
npm start
```

may execute the application but does not provide the same Genkit trace workflow.

Use traces when debugging model behavior.

---

# 16. Running a Flow

Run a specific flow using:

```bash
genkit flow:run myFlow '{"data":"input"}' -- npx tsx src/index.ts
```

Always provide input JSON when the flow expects input.

Do not assume schema `.default()` will automatically be used by `flow:run` when input is omitted.

`flow:run` runs flows, not agents.

To test an agent from the CLI, use an appropriate test harness or a temporary flow that executes one agent turn according to current Genkit documentation.

---

# 17. Trace Debugging

Use traces to verify actual application behavior.

Useful commands:

```bash
genkit trace:list
genkit trace:get <traceId>
```

Inspect traces for:

* model input
* model output
* prompts
* tool calls
* tool arguments
* tool results
* latency
* failures
* token usage
* middleware behavior

Do not claim a tool executed successfully merely because the model produced text suggesting that it did.

Verify tool execution through the trace or application result.

Do not assume trace output is guaranteed to be machine-readable JSON.

---

# 18. Security

Never hard-code API keys.

Use environment variables or the deployment platform's secret-management mechanism.

Never expose secret values in:

* browser code
* logs
* prompts
* tool outputs
* error responses
* committed source files

Validate external input before passing it to:

* databases
* shell commands
* filesystem operations
* external APIs

Do not allow arbitrary model-generated commands to execute without proper validation.

For sensitive operations, consider explicit tool approval or human-in-the-loop controls.

---

# 19. Tool Safety

Treat model-generated tool arguments as untrusted input.

Validate them using schemas and application-level authorization.

For destructive actions such as:

* deleting data
* modifying production records
* sending communications
* purchasing
* account changes
* irreversible operations

require appropriate confirmation or authorization.

Keep read-only tools separate from destructive tools where practical.

---

# 20. Project Structure

Prefer simple project organization.

Example:

```text
src/
  genkit.ts
  flows/
  agents/
  tools/
  schemas/
  prompts/
  services/
```

Do not create unnecessary abstraction layers.

Small projects may keep related functionality together.

Larger projects should separate reusable schemas, services, tools, agents, and flows.

Follow the project's existing structure when one already exists.

---

# 21. Implementation Style

Prefer:

* TypeScript
* small functions
* explicit schemas
* descriptive names
* minimal configuration
* reusable services
* narrow tools
* clear error handling
* current documented APIs

Avoid:

* unnecessary wrappers
* excessive abstraction
* giant files
* duplicated schemas
* duplicated Genkit initialization
* hidden side effects
* undocumented beta APIs
* pre-1.0 Genkit patterns

---

# 22. Existing Application Rule

When modifying an existing application:

**DO NOT rewrite the application from scratch unless the user explicitly asks for a rewrite.**

Instead:

1. inspect the current implementation
2. understand the existing architecture
3. identify the smallest required change
4. modify only affected components
5. preserve working behavior
6. run type checks
7. test the changed functionality
8. inspect traces when AI behavior is involved

This rule takes priority over stylistic preferences.

---

# 23. New Project Workflow

For a new Genkit project:

1. determine the application's goal
2. determine whether it needs flows, agents, or both
3. choose the runtime/framework
4. choose the provider
5. install required Genkit packages
6. initialize Genkit once
7. define reusable schemas
8. create tools
9. create flows or agents
10. add prompts if appropriate
11. configure environment variables
12. run TypeScript validation
13. execute the application through Genkit
14. inspect traces
15. test failure cases

Start with the minimum working implementation.

Expand only when the requirements justify it.

---

# 24. Completion Checklist

Before considering Genkit work complete, verify:

* [ ] existing architecture was inspected
* [ ] installed Genkit versions were checked
* [ ] current APIs were verified when necessary
* [ ] provider configuration is correct
* [ ] schemas are valid
* [ ] tool inputs are validated
* [ ] environment variables are handled safely
* [ ] TypeScript passes
* [ ] affected functionality was tested
* [ ] AI/tool behavior was verified through traces when applicable
* [ ] no unnecessary architectural rewrite was introduced
* [ ] no deprecated Genkit APIs were added
* [ ] errors are handled clearly

---

# 25. Reference Topics

Use the relevant documentation for:

* Getting started
* Flows
* Agents
* Sessions
* Human-in-the-loop
* Branching
* Background agents
* State
* Artifacts
* Multi-agent orchestration
* Custom agents
* Deployment
* Dotprompt
* Middleware
* Tools
* Schemas
* Providers
* CLI
* Traces
* Common errors

When documentation and remembered knowledge disagree, follow the current documentation and installed project version.
