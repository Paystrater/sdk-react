#!/usr/bin/env bash
# Opens test/vectors/encryption.json with the Developer Service's own Go code
# (openBody, deriveKey, openGCM in internal/app/services/encryption), proving the
# SDK and the server agree. Nothing is written into that repo:
# the test file is laid over the package with `go test -overlay`.
#   DEVELOPER_SERVICE_DIR=../../../Go\ Projects/paystrater/developer-service scripts/verify-vector/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="${DEVELOPER_SERVICE_DIR:?Set DEVELOPER_SERVICE_DIR to a checkout of developer-service}"
repo="$(cd "$repo" && pwd)"
overlay="$(mktemp)"
trap 'rm -f "$overlay"' EXIT
printf '{"Replace":{"%s/internal/app/services/encryption/sdk_vector_test.go":"%s/sdk_vector_test.go"}}' "$repo" "$here" > "$overlay"
cd "$repo"
SDK_VECTOR="$here/../../test/vectors/encryption.json" go test -overlay "$overlay" -run TestSDKEncryptionVector -count=1 ./internal/app/services/encryption/
