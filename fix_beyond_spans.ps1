$root = Get-Location

function Replace-InFile($path, $find, $replace) {
    if (Test-Path $path) {
        $content = Get-Content -Path $path -Raw
        $updated = $content -creplace [regex]::Escape($find), $replace
        if ($updated -ne $content) {
            Set-Content -Path $path -Value $updated -NoNewline
            Write-Host "  Updated: $path"
        } else {
            Write-Host "  No exact match in: $path (check manually)"
        }
    } else {
        Write-Host "  Skipped (not found): $path"
    }
}

Write-Host "Fixing styled Beyond/IQ span text..."

Replace-InFile "src\app\api\send-email\route.ts" 'Beyond<span style="color:#FFB347;">IQ</span>' 'Fluxor<span style="color:#FFB347;">X</span>'
Replace-InFile "src\app\login\page.tsx" 'Beyond<span className="text-[#FFB347]">IQ</span>' 'Fluxor<span className="text-[#FFB347]">X</span>'
Replace-InFile "src\components\app-shell.tsx" 'Beyond<span className="text-[#FFB347]">IQ</span>' 'Fluxor<span className="text-[#FFB347]">X</span>'

Write-Host ""
Write-Host "Re-scanning for any remaining 'beyond' text in source files..."

$excludeDirs = @('node_modules','.next','.git','dist','build')
$allFiles = Get-ChildItem -Path $root -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.json,*.md | Where-Object {
    $path = $_.FullName
    -not ($excludeDirs | Where-Object { $path -like "*\$_\*" })
}
$remaining = Select-String -Path $allFiles.FullName -Pattern 'beyond' -CaseSensitive:$false -ErrorAction SilentlyContinue
Write-Host "Remaining matches: $($remaining.Count)"
$remaining | ForEach-Object { Write-Host "$($_.Path):$($_.LineNumber) -> $($_.Line.Trim())" }
