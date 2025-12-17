#!/bin/bash

# Bump all RC packages to the next RC version
# Usage: ./scripts/bump-rc.sh [--apply] [--sync]

set -e

DRY_RUN=true
SYNC_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --apply)
      DRY_RUN=false
      shift
      ;;
    --sync)
      SYNC_MODE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --apply    Actually apply version changes (default is dry-run)"
      echo "  --sync     Sync all packages to the highest RC (don't bump to next)"
      echo "  --help     Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Ensure we're at repo root
cd "$(dirname "$0")/.."

if [ "$DRY_RUN" = true ]; then
  echo "🔍 DRY RUN MODE (use --apply to make changes)"
  echo ""
fi

# Find the highest RC version number across all packages
echo "📦 Scanning for RC versions..."
highest_rc=0

for pkg in packages/*/package.json; do
  if [ -f "$pkg" ]; then
    version=$(node -p "require('./$pkg').version" 2>/dev/null || echo "")
    if [[ "$version" =~ ^1\.2\.0-rc\.([0-9]+)$ ]]; then
      rc_num="${BASH_REMATCH[1]}"
      if [ "$rc_num" -gt "$highest_rc" ]; then
        highest_rc=$rc_num
      fi
    fi
  fi
done

if [ "$SYNC_MODE" = true ]; then
  next_rc=$highest_rc
  echo "   Highest RC found: 1.2.0-rc.$highest_rc"
  echo "   Syncing all to: 1.2.0-rc.$next_rc"
else
  next_rc=$((highest_rc + 1))
  echo "   Highest RC found: 1.2.0-rc.$highest_rc"
  echo "   Bumping to: 1.2.0-rc.$next_rc"
fi
new_version="1.2.0-rc.$next_rc"
echo ""

# Bump all 1.2.0-rc.* packages to the new version
echo "📝 Packages to update:"
updated=0
skipped=0

for pkg in packages/*/package.json; do
  if [ -f "$pkg" ]; then
    version=$(node -p "require('./$pkg').version" 2>/dev/null || echo "")
    name=$(node -p "require('./$pkg').name" 2>/dev/null || echo "unknown")

    if [[ "$version" =~ ^1\.2\.0-rc\.[0-9]+$ ]]; then
      if [ "$version" != "$new_version" ]; then
        dir=$(dirname "$pkg")
        if [ "$DRY_RUN" = true ]; then
          echo "   📤 Would update: $name ($version → $new_version)"
        else
          echo "   📤 Updating: $name ($version → $new_version)"
          npm version "$new_version" --no-git-tag-version -w "$dir" >/dev/null 2>&1
        fi
        ((updated++))
      else
        echo "   ⏭️  Already at $new_version: $name"
        ((skipped++))
      fi
    fi
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$DRY_RUN" = true ]; then
  echo "📊 Summary (DRY RUN):"
  echo "   Would update: $updated packages to $new_version"
else
  echo "📊 Summary:"
  echo "   Updated: $updated packages to $new_version"
fi
echo "   Already current: $skipped"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
