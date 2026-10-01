# Contributing: the day-to-day Git workflow

Every change, however small, follows the same loop: **issue → branch → commits → pull request → review → merge**. `main` is protected: it only changes through pull requests, and it cannot be force-pushed or deleted.

All commands are for **PowerShell on Windows**, run from the repository root in VS Code's terminal (Ctrl + `).

## One-time setup

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global core.editor "code --wait"     # write commit messages in VS Code
git config --global pull.ff only                  # never create surprise merge commits on pull

winget install GitHub.cli                          # then open a new terminal
gh auth login                                      # GitHub.com, HTTPS, log in with a browser
```

> If GitHub CLI was installed as a portable copy rather than with winget, it is not on `PATH`. Either add its folder to `PATH`, or use it through a variable for the session:
> `$gh = "$env:LOCALAPPDATA\Programs\gh-cli\bin\gh.exe"` and then `& $gh issue list`.

## 1. Pick an issue

Every change starts from an issue with acceptance criteria. Pick one from the current milestone:

```powershell
gh issue list --milestone "M4: Frontend Integration"
gh issue view 24
gh issue edit 24 --add-assignee "@me"
```

No issue yet? Create one with the templates (bug report or feature request):

```powershell
gh issue create --title "Short, specific title" --label feature --milestone "M5: Testing and Evaluation"
```

**Milestones:** M1 Repository and environment setup · M2 Core backend and auth · M3 ML matching service · M4 Frontend integration · M5 Testing and evaluation · M6 Deployment and final documentation.

**Labels:** `feature`, `enhancement`, `bug`, `docs`, `chore`, `testing`, `devops`, `research` for the kind of work; `frontend`, `backend`, `ml` for the component.

## 2. Create a short-lived branch

```powershell
git switch main
git pull
git switch -c feat/client-profile-mentorship
```

Branch names are `<type>/<short-description>` with the same types as commits (below). Keep a branch to one issue and merge it within a day or two.

## 3. Make the change, then check it

Run the checks for what you touched before every commit:

```powershell
npm run lint                         # ESLint for client, server, e2e and scripts
npm run format:check                 # Prettier (npm run format fixes it)
npm test -w client                   # client tests
npm test -w server                   # API tests
cd ml-service; .venv\Scripts\activate; ruff check .; pytest; deactivate; cd ..
npm run test:e2e                     # whole-stack journeys (before a pull request)
```

Never commit secrets. `.env` files are gitignored; only `.env.example` files with placeholders are committed. Before committing, look at what is staged:

```powershell
git status
git diff --staged
```

## 4. Commit with Conventional Commits

```
<type>(<scope>): <summary in the imperative, under 72 characters>

<why the change is needed and what it does, wrapped at 72 characters>

Refs #24            (or "Closes #24" in the commit that finishes the issue)
```

| Type | Use for |
|---|---|
| `feat` | A new capability for users |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `test` | Tests only |
| `refactor` | Restructuring without changing behaviour |
| `style` | Formatting only |
| `chore` | Tooling, configuration, dependencies |
| `ci` | GitHub Actions workflows |
| `build` | Packaging and build configuration |

Scopes: `client`, `server`, `ml`, `e2e`, `dev`, or leave it out for repository-wide changes.

Stage only the files that belong together, and make several small commits rather than one large one:

```powershell
git add client/src/pages/Profile.jsx client/src/pages/Profile.test.jsx
git commit                       # VS Code opens; write the message, save, close the tab
```

For a one-line message: `git commit -m "fix(client): keep the save bar above the footer"`.

## 5. Push and open a pull request

```powershell
git push -u origin feat/client-profile-mentorship
gh pr create --base main --label feature --milestone "M4: Frontend Integration" --title "feat(client): profile editor and mentorship screens"
```

The pull request template asks for a summary, the changes, the components touched, how you tested it, and a self-review checklist. The description must contain **`Closes #24`** (one line per issue) so the issue closes when the pull request merges.

## 6. Wait for CI and review

```powershell
gh pr checks --watch
```

The relevant workflows run on every pull request: Client, Server, ML service, End-to-end, and ESLint with Prettier. Fix any failure with another commit on the same branch and push again.

Then review your own diff on GitHub ("Files changed") and post the review as a comment. GitHub does not let you approve your own pull request, so the review is a comment:

```powershell
gh pr review --comment --body-file review.md
```

Use the same structure every time: summary, critical issues, suggestions (file, line, suggestion, category), what looks good, verdict. When someone else reviews, address each point with a commit or a reply before merging.

## 7. Merge and clean up

```powershell
gh pr merge --merge --delete-branch
git switch main
git pull
git branch -d feat/client-profile-mentorship
```

Merge commits keep each pull request's commits visible in the history. Never force-push `main`, and never rewrite commits that are already on GitHub.

## 8. Close the milestone

When every issue in a milestone is closed:

```powershell
gh api repos/glenkochieng/daraja-connect/milestones --jq ".[] | {number, title, open_issues}"
gh api -X PATCH repos/glenkochieng/daraja-connect/milestones/4 -f state=closed
```

## If something goes wrong

| Situation | Fix |
|---|---|
| Committed to `main` by mistake (not pushed) | `git switch -c fix/my-change` (the commit comes along), then `git switch main; git reset --hard origin/main` |
| Need the latest `main` in your branch | `git switch main; git pull; git switch -; git merge main` |
| A secret was committed | Do not just delete it in a new commit: rotate the secret immediately (new password or key), then remove it from the code and ask for help cleaning history |
| Prettier fails in CI | `npm run format`, run `npm run format:check` again (some files need two passes), commit |
| CI passes locally but not on GitHub | Read the failing step with `gh run view --log-failed` |
