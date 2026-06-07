
# Claude Project Context Instructions

Before writing any code or making changes, please:

0. Read README.md it contains crucial context concerning WHY I'm building this website. 

0a. **Read the session status / handoff files FIRST, for continuity of work.**
    These capture where the last session left off — what was fixed, what's deployed,
    gotchas learned, infra IDs, and open follow-ups. Always read them before starting:
    - `.claude/status-*.md` (e.g. `.claude/status-jun6.md`) — dated session handoffs.
      Read the most recent one in full; skim older ones for context. If you finish a
      substantial chunk of work, UPDATE the latest status file (or create a new
      `.claude/status-<date>.md`) so the next session has continuity.
    - The auto-memory index at
      `~/.claude/projects/-home-mark-code-considerate-website/memory/MEMORY.md`
      and the memory files it points to — durable facts (deploy procedure, video
      pipeline gotchas, Fargate setup). These are also surfaced automatically, but
      consult them before acting on deploy/video/infra tasks.
    A status file may describe a fix that was later superseded — trust the most
    recent dated entry, and verify any file:line/behavior claim against current code
    before relying on it.

1. **Read all project files** in the parent directory (`../`) and all subdirectories
2. **Gather important context** including:
    - Project structure and organization
    - Existing code patterns and conventions
    - Configuration files (Terraform, build configs, etc.)
    - Dependencies and requirements
    - Documentation and README files

3. **Use this context** to ensure any code you generate:
    - Follows the project's established patterns
    - Maintains consistency with existing code
    - Respects the project's architecture and design decisions
    - Integrates properly with existing infrastructure (e.g., Terraform setup)

4. **Reference specific files** when relevant to explain your understanding
