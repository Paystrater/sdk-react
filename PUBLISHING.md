# Publishing @paystrater/react

CI publishes every release from a version tag on `main`. No npm token lives in GitHub, and nothing goes live until a maintainer approves it twice: once in GitHub and once on npmjs.com. `@paystrater/react-native` follows the same steps in its own repository.

## Release in five steps

**1. Set the version on `dev`.**

For a test release, which goes to the `next` tag:

```bash
npm version 0.1.0-next.1 --no-git-tag-version
```

For a stable release, which goes to `latest`, run `npx changeset`, choose patch, minor or major and describe the change, then:

```bash
npx changeset version && npm install --package-lock-only
```

Use patch for fixes, minor for new features and major for breaking changes. The first stable release is `1.0.0`.

**2. Check it.**

```bash
npm run check
```

**3. Merge.** Commit, push `dev`, and merge it into `main` by pull request once CI passes. Merge `sdk-react` before `sdk-react-native` whenever the shared core changes, because React Native's CI compares its copy with `main` here.

**4. Tag `main`.** The tag must be `v` plus the version in `package.json`.

```bash
git checkout main && git pull && git tag v0.1.0-next.1 && git push origin v0.1.0-next.1
```

**5. Approve.** Approve the **Release** job in GitHub, wait for it to finish, then open the package's **Staged Packages** tab on npmjs.com, check the version and click **Approve**. This needs 2FA on your npm account.

Then confirm what went out:

```bash
npm view @paystrater/react dist-tags
```

Before the first stable release, test a `next` version on staging with test keys: a test merchant's `pk_test_…` key, its encryption key, and a payment created on `https://staging-api.paystrater.com`. Check the checkout end to end in a browser, including an encrypted payment.

## If a release fails

| What happened | What to do |
| --- | --- |
| The tag doesn't match `package.json` | Fix the version, merge, and push a new tag. Don't move a tag that has already been pushed |
| A check fails in the Release job | Fix it, merge, and release the next version number |
| npm says the version already exists | Version numbers can never be reused, so use the next one |
| npm returns a 404 or a trusted publisher error | Check the settings below. Names are case-sensitive, and npm doesn't check them when you save |
| A bad version went live | Publish a fixed version, then run `npm deprecate @paystrater/react@<version> "<reason>"` |

## One-time setup

1. **npm organisation.** Create `paystrater` on npmjs.com, which gives the `@paystrater` scope. Turn on 2FA for your account first, then add a second owner and require 2FA for every member.
2. **First version.** npm only offers trusted publishing for a package that already exists, so publish once by hand, with `npm publish --access public --tag next --provenance=false`. Provenance only works in CI.
3. **Trusted publisher.** On the package's page on npmjs.com, go to Settings → Trusted publishing → GitHub Actions and enter organisation `Paystrater`, repository `sdk-react`, workflow `release.yml` and environment `npm`. Leave direct publishing and dist-tag management off, because the workflow only stages. A new configuration expires unless it publishes within 2 days, and it can't be edited, so delete and recreate it if it has expired or is wrong.
4. **GitHub environment.** In Settings → Environments, create `npm`, add yourself as a required reviewer, and limit it to the branch `main` and the tag pattern `v*`.
5. **Protect the repository.** Add a ruleset for `main` that requires a pull request and passing CI and blocks force pushes and deletion, and one for `v*` tags that only admins can bypass. Turn on secret scanning with push protection, Dependabot alerts and private vulnerability reporting.
6. **Licence.** The packages are MIT. Change `license` and `LICENSE` if Paystrater wants another.

If `sdk-react` is ever made private, add an Actions secret `SDK_REACT_READ_TOKEN` (read-only Contents on `Paystrater/sdk-react`) to the React Native and Flutter repositories, which read it in CI. npm provenance also needs a public repository.

## Commit messages

This repository is public, so write each message for a stranger reading the history.

```
<type>: <what changed, in the imperative, under 72 characters>

Optional body explaining why, not how.
```

Types are `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `build` and `chore`. For a breaking change, write `feat!:` and describe it in the body. Give pull requests a title in the same format, because it becomes the merge's description.

- `fix: stop polling after a final payment status`
- `fix(deps): override minimatch to the patched 11.0.4`
- `ci: update actions/checkout to v7`

Keep out internal documents, customer details, keys and other companies' names.

## What CI checks

- **CI workflow** (every push and pull request): `npm ci`, `npm audit signatures` (registry signatures of every dependency), `npm run check`, and that the types regenerated from the published spec match the committed ones.
- **Release workflow** (a `v*` tag): the same checks, that the tag matches `package.json`, then `npm stage publish` with provenance through OIDC. Staged publishing needs npm 11.15.0 or later and Node 22.14 or later; the workflow installs npm 11.15.0 and uses Node 24 from `.nvmrc`.

## What is in the package

`dist/` only: ES modules and CommonJS, TypeScript types for both, source maps, `"use client"` on the React entry. `dependencies` is empty; `@noble/secp256k1` 3.2.0 is bundled into the encryption chunk with its MIT notice. Peers: `react` and `react-dom` 18 or later.
