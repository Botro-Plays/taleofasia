# Safe build script: pauses game server monitor during Next.js build/restart
# to prevent resource contention from crashing game servers.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\safe-build.ps1

$ErrorActionPreference = 'Continue'
$WEB_DIR = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PAUSE_FILE = 'C:\taleofasia-server-project\servers\monitor.pause'

Write-Host '[safe-build] Pausing game server monitor...' -ForegroundColor Cyan
Set-Content -Path $PAUSE_FILE -Value "paused-by-build-$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss')" -ErrorAction SilentlyContinue

try {
    Write-Host '[safe-build] Setting NODE_ENV=production...' -ForegroundColor Cyan
    $env:NODE_ENV = 'production'

    Write-Host '[safe-build] Running next build...' -ForegroundColor Cyan
    Push-Location $WEB_DIR
    npx next build
    $buildExit = $LASTEXITCODE
    Pop-Location

    if ($buildExit -ne 0) {
        Write-Host "[safe-build] Build failed with exit code $buildExit" -ForegroundColor Red
        throw "Build failed"
    }

    Write-Host '[safe-build] Build successful. Restarting PM2...' -ForegroundColor Cyan
    pm2 delete taleofasia-web 2>$null
    pm2 start ecosystem.config.js
    pm2 save

    Write-Host '[safe-build] Server restarted.' -ForegroundColor Green
}
catch {
    Write-Host "[safe-build] ERROR: $_" -ForegroundColor Red
    exit 1
}
finally {
    Write-Host '[safe-build] Resuming game server monitor...' -ForegroundColor Cyan
    Remove-Item -Path $PAUSE_FILE -Force -ErrorAction SilentlyContinue
    Write-Host '[safe-build] Done.' -ForegroundColor Green
}
