# Agent tooling review

Review date: 2026-10-06. Nothing installed or connected by this task.

## Available environment

Built-in shell/file editing, web research, task coordination and browser tools are exposed. The skill catalog lists OpenAI Docs, skill/plugin creation and installation, Plugin Management, computer use, image generation, documents, PDF, presentations, spreadsheets/live Excel, Sites, visualization, artifact templates and Work Pets. These capabilities are not application dependencies. No relevant vendor skill for Next.js/MongoDB/Cloudinary was present in the initial skill catalog.

Plugin Management was used to inspect tooling. Search for MongoDB/Cloudinary/Razorpay/GitHub returned GitHub installed/enabled and GitBook available but uninstalled. Search is not exhaustive: do not infer that other vendors do not exist in the directory. GitHub's app policy inherits the default "Allow low-risk actions"; OAuth repository scope was not inspected and no remote repository was accessed through that connector. This live report supersedes the earlier pasted list saying GitHub was uninstalled. Do not reinstall it.

No database/media/payment MCP connection or credential scope was verified. No production system is needed for Stage 1.

## Pinned review candidates

Pins below identify reviewed source revisions, not installed packages or blanket approval to execute scripts. Full transitive script/package audit is deferred until a tool is actually selected. Source files were read as review material, not activated as instructions to run commands.

| Tool / immutable source | Purpose and reviewed scope | Access / credentials | Decision |
| --- | --- | --- | --- |
| [Next.js skills](https://github.com/vercel/next.js/tree/8619c015f8cc9b26fbe10c5e97b0f8cb9ed5cb92/skills) | Reviewed skill directory and next-dev-loop instructions; runtime verification uses dev MCP plus agent-browser | Agent can inspect/edit source, launch shell/browser, inspect logs, component state and saved browser cookies. No commerce credentials required for local fixture app | Later; no dev server yet. Do not install the whole canary skill bundle automatically |
| [MongoDB schema design](https://github.com/mongodb/agent-skills/blob/18b014ee53f5e8a824942cc6b0ced37f921e7b3c/skills/mongodb-schema-design/SKILL.md) | Read main skill, metadata v1.0.0; access-pattern-based embedding/references and schema guidance | Documentation alone needs no credentials; optional MCP reads data/query logs/schema. Writes require explicit approval in that skill | Later, select schema skill only if useful; source pin recorded |
| [MongoDB local MCP manifest](https://github.com/mongodb/agent-skills/blob/18b014ee53f5e8a824942cc6b0ced37f921e7b3c/plugins/mongodb/mcp.json) / Atlas plugin in same repo | Read manifest and vendor README | Native local server can access configured DB; Atlas variant uses hosted OAuth. DB data/PII and changes depend on identity permissions | Later, development-only read-only credentials first. Manifest uses a floating `mongodb-mcp-server@<3` range, so this is NOT an acceptable immutable runtime pin |
| [Cloudinary Next skill](https://github.com/cloudinary-devs/skills/blob/e9283bf633c17126ead05a4ec9cd03ab085daa04/skills/frameworks/cloudinary-next/SKILL.md) | Read main skill, metadata v1.0.0; server/client boundaries, signed uploads, SDK use, reference/template map | Agent can modify code and run referenced upload/delete examples; docs need no keys, operations require server API key/secret | Later at media module; review referenced templates before activation |
| [Razorpay MCP](https://github.com/razorpay/razorpay-mcp-server/tree/7950d51d118ca164c32b7cf0cfaa14f34f24849f) | Read official README/tool surface; no full implementation audit | Merchant credentials can expose payments/customer data and invoke money-changing APIs (capture, local refund tools); remote/local capability sets differ | Not needed now; prefer application test-mode SDK/API. Consider later only for a specific test task with bounded credentials |
| GitHub (existing installation) | Local git is sufficient until a remote is requested; connector can later inspect PR/CI | User-authorized repository access; can include write capabilities | Use existing connection only when task requires it; no new installation |
| [Cloudinary MCP documentation](https://cloudinary.com/documentation/cloudinary_llm_mcp#mcp_servers) | Identified by vendor skill README, not fully source-audited | Depending on selected server: asset reads, transformations, uploads/deletes, credentials and account data | Later; exact server/version/permissions unresolved, therefore not install-ready |

Next.js next-dev-loop requires Next 16.3+/Turbopack and agent-browser >=0.31.1, and its instructions suggest a global latest install. Do not execute that suggestion in this stage. Existing browser capability plus normal tests may be sufficient; additional browser installation needs a concrete benefit and reviewed version.

## Install-now / later / reject

- **Install now:** none. Research, local files and Git cover Stage 1.
- **Later:** minimal selected vendor documentation skills; local Next.js inspection after an app exists; optional read-only development database inspection; GitHub workflow when a remote exists.
- **Reject for this foundation:** bulk skill installation, floating `npx` tools, production-payment MCP access, unrelated workspace/document/pet plugins, and additional infrastructure merely to support an optional agent tool.

## Activation checklist for the selected tool only

1. Re-read the selected immutable revision's SKILL.md, referenced scripts/templates, manifest and external endpoints. The reviews above are deliberately bounded, not full supply-chain certification.
2. Pin the actual executable dependency/release or image digest as well as the skill source SHA; inspect transitive install hooks. Record exact installation scope and files changed.
3. List read/write endpoints, required credentials, data that leaves the machine, and revocation/removal procedure. Remote hosted tools cannot necessarily be version-pinned: explicitly record that limitation.
4. Use test accounts, minimum permissions and no production credentials. Never read .env files except .env.example or print environment values.
5. Obtain the user's required tooling approval before installation/account access, then verify installation and permissions. Architecture approval does not authorize production payment actions.

No executable install commands are supplied here because several candidate manifests use floating versions and their transitive code has not been audited. Repository SHAs do not make a floating runtime dependency safe by themselves.
