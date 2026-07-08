# Deployment Guidelines - ibe-mobile

This document describes the Git-based deployment workflow for the **ibe-mobile** React Native project. It ensures consistency, stability, and clear handoffs between developers, QA, and production.

For build commands, EAS profiles, environment selection, and versioning, see [Build and Release Notes](./build-and-release.md).

---

## Branching Strategy

We follow a multi-environment flow using the following permanent branches:

| Branch | Purpose |
| --- | --- |
| `develop` | Developer integration, internal testing |
| `staging` | QA/UAT testing prior to production |
| `main` | Stable, production-ready code |

---

## Deployment Process

### 1. Feature Development

- Developers branch from `develop`:

  ```bash
  git checkout develop
  git pull origin develop
  git checkout -b feature/your-feature-name
  ```

- Implement changes and open a pull request into `develop`.
- Pull requests should pass lint, build, and test checks where available.
- Changes should be reviewed before merge.

---

### 2. Internal QA

- Merge feature branches into `develop` via pull request.
- Test individual features and integration flows in the development environment.
- Use the EAS `development` profile when a development build is needed.

---

### 3. QA/UAT Testing

- Once `develop` is stable, merge `develop` -> `staging`.
- QA conducts user testing on staging builds.
- Use the EAS `preview` profile for QA/testing builds.
- The `preview` profile points to the testing backend environment.

---

### 4. Production

- After QA sign-off, merge `staging` -> `main`.
- Use the EAS `production` profile for production builds.
- Tag the release for traceability:

  ```bash
  git checkout main
  git merge staging
  git tag -a v1.2.0 -m "Release v1.2.0"
  git push origin main --tags
  ```

---

### 5. Hotfixes

For urgent production issues:

- Branch from `main`.
- Fix and validate the issue.
- Merge back into both `main` and `develop`.
- Tag and release as a patch version, for example `v1.2.1`.

---

## Build Profile Mapping

Branch strategy and EAS build profiles should normally align as follows:

| Branch | Purpose | EAS profile | Backend environment |
| --- | --- | --- | --- |
| `develop` | Developer integration | `development` | `development` |
| `staging` | QA/UAT testing | `preview` | `testing` |
| `main` | Production release | `production` | `production` |

Do not edit `src/constants.js` to switch environments. Use EAS profiles and `APP_ENV` as described in [Build and Release Notes](./build-and-release.md).

---

## Release Checklist

Before a testing or production build:

- Confirm the branch is correct.
- Confirm the build profile points to the intended backend environment.
- Run lint/tests where applicable.
- Confirm `expo.version` changes only when the user-facing release version changes.
- Let EAS auto-increment native build numbers.
- Record release notes for testers or app store reviewers.

---

## Remote Tracking

Make sure local branches track the correct remotes:

```bash
git checkout develop
git branch --set-upstream-to=origin/develop

git checkout staging
git branch --set-upstream-to=origin/staging

git checkout main
git branch --set-upstream-to=origin/main
```

This avoids confusion and helps keep push/pull operations predictable.

---

## Recommended Merge Schedule

| Environment | Suggested Frequency |
| --- | --- |
| `develop` | Daily, as features are completed |
| `staging` | Weekly, end of sprint, or QA cycle |
| `main` | Post-release validation or approved release window |

Adjust frequency based on release cycles, sprint reviews, and customer requirements.

---

## Best Practices

- Always branch from `develop` for features.
- Keep `main` clean and always deployable.
- Enforce pull request reviews before merging.
- Tag every production release as `vX.Y.Z`.
- Avoid force pushes on shared branches.
- Keep build/release commands in [Build and Release Notes](./build-and-release.md) instead of duplicating them here.

---

_This document is subject to change as the team scales or the release strategy evolves._
