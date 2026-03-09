#!/usr/bin/env bash
# Bump version, commit, tag, and push.
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 1.0.0

set -euo pipefail

VERSION="${1:?Usage: ./scripts/release.sh <version>}"

# Strip leading "v" if provided
VERSION="${VERSION#v}"

echo "Releasing v${VERSION}..."

npm version "$VERSION" --no-git-tag-version --allow-same-version

git add package.json package-lock.json
if ! git diff --cached --quiet; then
  git commit -m "v${VERSION}"
fi

git tag "v${VERSION}"
git push origin main "v${VERSION}"

echo "Done - v${VERSION} tagged and pushed."
