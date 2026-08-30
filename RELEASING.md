# Release procedure

Future releases are built once in GitHub Actions, attested, reviewed as drafts,
and made immutable when published.

## Prepare the release

1. Merge a pull request that updates all release-specific metadata:
   - The version in `package.json` and `package-lock.json`.
   - Release archive URLs and current-release references in `README.md`.
   - The supported versions table in `.github/SECURITY.md`.
   - The prebuild version, corresponding-source revision, and release source
     link in `THIRD_PARTY_NOTICES.md`.
2. Confirm every required check passed on the merge commit.
3. Update a local `master` branch and derive the release tag from the package
   version:

   ```bash
   git switch master
   git pull --ff-only origin master
   version="$(node -p "require('./package.json').version")"
   tag="v${version}"
   ```

## Create the verified tag

Create an annotated, cryptographically signed tag, verify it locally, and push
only that tag:

```bash
git tag -s "$tag" -m "uiohook-napi ${version}"
git tag -v "$tag"
git push origin "$tag"
```

Confirm that GitHub displays the tag as **Verified**. Never move, delete, or
reuse a release tag.

## Review the draft

The tag workflow rejects lightweight or unverified tags, tags outside `master`
history, and versions that do not match the package. It then builds the native
binaries, packages the exact CI artifacts, creates a build-provenance
attestation, and attaches the tarball to a draft release. Before publishing:

1. Confirm the workflow completed successfully.
2. Confirm the tag targets the intended `master` commit.
3. Review the release title, notes, and attached
   `uiohook-napi-<version>.tgz` asset.
4. Download the asset and verify its build provenance:

   ```bash
   gh release download "$tag" --pattern 'uiohook-napi-*.tgz' --dir release \
     --repo valis-so/uiohook-napi
   tarball="release/uiohook-napi-${version}.tgz"
   gh attestation verify "$tarball" --repo valis-so/uiohook-napi
   ```

If anything is wrong, leave the release as a draft and fix the release process.
Do not publish or reuse the tag.

## Publish and verify

Publish the reviewed draft in the GitHub UI or with:

```bash
gh release edit "$tag" --draft=false --repo valis-so/uiohook-napi
```

Published releases are immutable: their tag and assets cannot be changed. The
publication also creates a release attestation. Verify both the release and the
downloaded asset:

```bash
gh release verify "$tag" --repo valis-so/uiohook-napi
gh release verify-asset "$tag" "$tarball" --repo valis-so/uiohook-napi
```
