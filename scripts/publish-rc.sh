#!/bin/bash

# Publish RC packages locally
# Mirrors the logic from .github/workflows/npm-deploy.yml

set -e

DRY_RUN=true
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --publish)
      DRY_RUN=false
      shift
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --publish    Actually publish (default is dry-run)"
      echo "  --verbose    Show more details"
      echo "  --help       Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [ "$DRY_RUN" = true ]; then
  echo "🔍 DRY RUN MODE (use --publish to actually publish)"
  echo ""
fi

# Ensure we're at repo root
cd "$(dirname "$0")/.."

# Check npm auth
if ! npm whoami >/dev/null 2>&1; then
  echo "❌ Not logged in to npm. Run 'npm login' first."
  exit 1
fi

echo "📦 Checking packages for RC versions..."
echo ""

published=0
skipped=0
not_rc=0

for pkg in packages/*/; do
  if [ -f "$pkg/package.json" ]; then
    private=$(node -p "require('./$pkg/package.json').private || false")
    if [ "$private" != "true" ]; then
      name=$(node -p "require('./$pkg/package.json').name")
      version=$(node -p "require('./$pkg/package.json').version")

      # Only process RC versions
      if [[ "$version" == *"-rc."* ]]; then
        if ! npm view "$name@$version" version >/dev/null 2>&1; then
          if [ "$DRY_RUN" = true ]; then
            echo "📤 Would publish: $name@$version (tag: rc)"
          else
            echo "📤 Publishing: $name@$version (tag: rc)"
            npm publish "$pkg" --tag rc
          fi
          ((published++))
        else
          echo "⏭️  Skipping: $name@$version (already published)"
          ((skipped++))
        fi
      else
        if [ "$VERBOSE" = true ]; then
          echo "➖ Not RC: $name@$version"
        fi
        ((not_rc++))
      fi
    else
      if [ "$VERBOSE" = true ]; then
        echo "🔒 Private: $pkg"
      fi
    fi
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$DRY_RUN" = true ]; then
  echo "📊 Summary (DRY RUN):"
  echo "   Would publish: $published"
else
  echo "📊 Summary:"
  echo "   Published: $published"
fi
echo "   Skipped (already published): $skipped"
echo "   Not RC version: $not_rc"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
