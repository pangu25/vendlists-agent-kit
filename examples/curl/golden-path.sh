#!/usr/bin/env bash
# The whole path in curl and jq. It stops before publishing.
#
#   export VENDLISTS_KEY=vl_agent_your_key_here
#   bash examples/curl/golden-path.sh ./photos/front.jpg
set -euo pipefail

API="${VENDLISTS_API:-https://api.vendlists.com}"
: "${VENDLISTS_KEY:?Set VENDLISTS_KEY to your vl_agent_... key}"
PHOTO="${1:?Pass one photo path}"
AUTH=(-H "Authorization: Bearer ${VENDLISTS_KEY}")
JSON=(-H 'Content-Type: application/json')

echo "== where the person stands"
curl -s "${AUTH[@]}" "$API/agent/me" | jq '{plan: .plan.name, left: .allowance.remaining, ebay: .ebay.connected, next: .allowance.nextListing}'

echo "== create the draft"
LISTING_ID=$(curl -s -X POST "${AUTH[@]}" "${JSON[@]}" \
  -d '{"additionalContext":"Listed from the Vendlists agent kit example.","quantity":1}' \
  "$API/listings" | jq -r .listingId)
echo "   $LISTING_ID"

echo "== upload the photo"
UPLOAD_URL=$(curl -s -X POST "${AUTH[@]}" "${JSON[@]}" \
  -d "{\"listingId\":\"$LISTING_ID\",\"files\":[{\"contentType\":\"image/jpeg\",\"index\":0}]}" \
  "$API/listings/upload-url" | jq -r '.[0].uploadUrl')
curl -s -X PUT -H 'Content-Type: image/jpeg' --data-binary "@$PHOTO" "$UPLOAD_URL" >/dev/null
echo "   uploaded"

echo "== write the listing (uses one of the month's listings)"
curl -s -X POST "${AUTH[@]}" "${JSON[@]}" -d '{}' "$API/listings/$LISTING_ID/generate" >/dev/null

echo "== wait for it"
for _ in $(seq 1 100); do
  sleep 6
  STATUS=$(curl -s "${AUTH[@]}" "$API/listings/$LISTING_ID" | jq -r .status)
  printf '   %s\r' "$STATUS"
  [ "$STATUS" = "processing" ] || break
done
echo

curl -s "${AUTH[@]}" "$API/listings/$LISTING_ID" \
  | jq '{status, title, price, categoryName, condition, processingError}'

cat <<EOS

Review it at https://vendlists.com/dashboard/listings/$LISTING_ID

When the person says yes, publish with:
  curl -X POST $API/ebay/publish/$LISTING_ID \\
    -H "Authorization: Bearer \$VENDLISTS_KEY" -H 'Content-Type: application/json' -d '{}'
EOS
