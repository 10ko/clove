# Commit and PR workflow (worktrees)

When you use the **local** runtime, each agent gets a **git worktree** on its own branch (e.g. `clove/agent-123`). The agent edits files in that worktree. To turn that work into a PR you commit and push from that worktree, then open a PR. Clove does not commit or create PRs for you.

## Flow

1. **Start an agent**  
   `start --repo /path/to/repo --prompt "Add tests for auth"`  
   Clove creates a worktree at e.g. `repo/.clove/worktrees/agent-123` on branch `clove/agent-123`.

2. **Let the agent run**  
   Use the dashboard or `stream` / `send-input` as needed.

3. **Review and commit (before stopping)**  
   Go to the agent’s workspace (dashboard “VS Code” button, or `cd` to the path from `list`):

   ```bash
   cd /path/to/repo/.clove/worktrees/agent-123   # or open in VS Code from dashboard
   git status
   git diff
   git add .
   git commit -m "Add tests for auth"
   git push -u origin clove/agent-123
   ```

4. **Open a PR**  
   - GitHub: open the repo in the browser; you’ll usually see “Compare & pull request” for the new branch, or create a PR from `clove/agent-123` into `main`.
   - Or use GitHub CLI: `gh pr create --base main --head clove/agent-123 --title "Add tests for auth"`.

5. **Optionally stop the agent**  
   In Clove, `stop <agent-id>` (or Stop in the dashboard). This removes the worktree and deletes the **local** branch. The branch on the remote (e.g. `origin/clove/agent-123`) is unchanged, so your PR is still there.

## Important

- **Commit and push before stopping.** When you stop an agent, Clove runs `git worktree remove` and `git branch -D` for that agent’s branch. Unpushed commits (and the branch) would be lost. Pushing first keeps the branch on the remote so you can open or update the PR.
- The worktree is a normal git checkout; you can run any git commands there. The main repo stays on its current branch (e.g. `main`); the worktree is the only place on branch `clove/agent-123`.

## Remote / Docker

With the **Docker** runtime, the workspace is a **clone** (not a worktree). The clone lives in a temp directory on the host. To get a PR you’d need to add a remote and push from that clone, or copy changes out; that flow is not yet documented or automated.
