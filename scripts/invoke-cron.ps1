param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('payment-reward', 'paymongo-archive', 'paymongo-reconcile', 'paypal-cancel', 'paypal-reconcile', 'auto-expire', 'crypto-verify')]
    [string]$Job
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptRoot '..')
$envPath = Join-Path $projectRoot '.env.production'

if (-not (Test-Path $envPath)) {
    Write-Error "Environment file not found at $envPath"
}

$cronSecretLine = Get-Content $envPath | Where-Object { $_ -match '^\s*CRON_SECRET\s*=' } | Select-Object -First 1
if (-not $cronSecretLine) {
    Write-Error 'CRON_SECRET not configured in .env.production'
}

$cronSecret = $cronSecretLine.Substring($cronSecretLine.IndexOf('=') + 1).Trim()
if (-not $cronSecret) {
    Write-Error 'CRON_SECRET value empty'
}

$baseUrl = 'http://127.0.0.1:3000'
$endpoint = "/api/cron/$Job"
$uri = "$baseUrl$endpoint"

try {
    $response = Invoke-WebRequest -Uri $uri -Method Post -Headers @{ Authorization = "Bearer $cronSecret" } -UseBasicParsing -TimeoutSec 60
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Output "[$timestamp] $Job -> HTTP $($response.StatusCode)"
    if ($response.Content) {
        Write-Output $response.Content
    }
} catch {
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Error "[$timestamp] $Job failed: $($_.Exception.Message)"
    throw
}
