$root = Get-Location
$excludeDirs = @('node_modules','.next','.git','dist','build')

Write-Host "Scanning ALL files for any 'beyond' variant (broader than before)..."

$allFiles = Get-ChildItem -Path $root -Recurse -File | Where-Object {
    $path = $_.FullName
    -not ($excludeDirs | Where-Object { $path -like "*\$_\*" })
}

Write-Host "Scanning $($allFiles.Count) files..."

$matches = Select-String -Path $allFiles.FullName -Pattern 'beyond' -CaseSensitive:$false -ErrorAction SilentlyContinue

$matches | Select-Object Path, LineNumber, Line | Export-Csv -Path "$root\beyond_remaining.csv" -NoTypeInformation

Write-Host ""
Write-Host "Found $($matches.Count) remaining matches -> beyond_remaining.csv"
$matches | ForEach-Object { Write-Host "$($_.Path):$($_.LineNumber) -> $($_.Line.Trim())" }
