# Contributing

Each push to `main` deploys the site to fabbit.dev. Submit changes through a pull request.

## Workflow

```bash
git switch main && git pull
git switch -c feat/team-section
# Make changes, then check before committing
npm test && npm run build
git add <files>
git commit -m "feat(team): карточки команды"
git push -u origin HEAD            # Use -u for the first push only
gh pr create --fill --title "feat(team): карточки команды"
gh pr merge --squash --delete-branch
git switch main && git pull
```

Squash merging uses the PR title as the commit title on `main`.

## Branches

| Prefix | Purpose | Example |
|---|---|---|
| `feat/` | Section or component | `feat/profiles-grid` |
| `fix/` | Bug fix | `fix/mobile-menu` |
| `docs/` | README or text changes without code | `docs/en-copy` |
| `style/` | Layout changes without logic | `style/hero-spacing` |

Use one branch per task. Keep its lifetime to one or two days.

## Commits

Use `type(scope): change`, with the description in Russian. The scope identifies a page section or directory.
Types: `feat`, `fix`, `docs`, `style`, `chore`, `refactor`, `test`, `perf`.
Keep each commit focused on one change.

## Before merging

Run `npm run build && npm run preview`. Check the Russian and English versions on mobile and desktop. Fix console errors.

## Do not

- Push to `main` or use `git push --force` on shared branches.
- Commit `dist/`, `scripts/out/`, or Blender source files.
- Keep branches open for weeks.
