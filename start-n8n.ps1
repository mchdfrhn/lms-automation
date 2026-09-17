Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  MEMULAI n8n DENGAN DUKUNGAN EXECUTE COMMAND NODE    " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
$env:NODES_EXCLUDE="[]"
$n8nPath = "$env:LOCALAPPDATA\npm-cache\_npx\a8a7eec953f1f314\node_modules\n8n\bin\n8n"
if (Test-Path $n8nPath) {
    node $n8nPath start
} else {
    npx n8n start
}
