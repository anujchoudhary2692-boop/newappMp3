#!/bin/bash
# Mirror MediaFace to https://github.com/Anujk2692/newappmp3
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO_OWNER="Anujk2692"
REPO_NAME="newappmp3"
REMOTE="anujk2692"
REPO_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}.git"

echo "==> MediaFace → ${REPO_URL}"
echo ""

if ! command -v gh &>/dev/null; then
  echo "Install GitHub CLI: brew install gh"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "Not logged in. Starting GitHub login (browser)..."
  echo "Sign in as: ${REPO_OWNER}"
  gh auth login -h github.com -p https -w
fi

LOGIN="$(gh api user --jq .login)"
echo "Logged in as: ${LOGIN}"

if [[ "${LOGIN}" != "${REPO_OWNER}" ]]; then
  echo ""
  echo "WARNING: You are logged in as '${LOGIN}', not '${REPO_OWNER}'."
  echo "Log out and sign in as ${REPO_OWNER}:"
  echo "  gh auth logout"
  echo "  gh auth login -h github.com -p https -w"
  read -r -p "Continue anyway? [y/N] " ans
  [[ "${ans}" =~ ^[Yy]$ ]] || exit 1
fi

if gh repo view "${REPO_OWNER}/${REPO_NAME}" &>/dev/null; then
  echo "Repo exists: ${REPO_URL}"
else
  echo "Creating public repo ${REPO_OWNER}/${REPO_NAME}..."
  gh repo create "${REPO_OWNER}/${REPO_NAME}" --public --description "MediaFace — MP3/video player, geo camera, face AI (React Native + Spring Boot)"
fi

if git remote get-url "${REMOTE}" &>/dev/null; then
  git remote set-url "${REMOTE}" "${REPO_URL}"
else
  git remote add "${REMOTE}" "${REPO_URL}"
fi

echo "Pushing main branch..."
git push -u "${REMOTE}" main

echo ""
echo "[OK] Code is live at: ${REPO_URL}"
echo "     (Also on origin: https://github.com/anujchoudhary2692-boop/newappMp3)"
