$sources = (Invoke-WebRequest -Uri 'http://localhost:3001/api/sources?tenantId=00000000-0000-0000-0000-000000000000' -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "=== SOURCES ===" -ForegroundColor Cyan
Write-Host ("Total sources: " + $sources.sources.Count)
foreach ($s in $sources.sources) {
    Write-Host ("  - " + $s.displayName + " | " + $s.status + " | location: " + $s.locationName + " | account: " + $s.externalAccountId)
}

Write-Host ""
Write-Host "=== REVIEWS ===" -ForegroundColor Cyan
$reviews = (Invoke-WebRequest -Uri 'http://localhost:3001/api/reviews' -UseBasicParsing).Content | ConvertFrom-Json
Write-Host ("Total reviews: " + $reviews.reviews.Count)
foreach ($rv in $reviews.reviews) {
    Write-Host ("  - " + $rv.authorName + " | " + $rv.rating + " stars | " + $rv.locationName)
}
