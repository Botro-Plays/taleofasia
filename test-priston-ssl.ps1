Add-Type -AssemblyName System.Net.Http
$handler = New-Object System.Net.Http.HttpClientHandler
$handler.ServerCertificateCustomValidationCallback = { $true }
$client = New-Object System.Net.Http.HttpClient($handler)
try {
    $response = $client.GetAsync("https://priston.taleofconquest.com/").Result
    $cert = $response.RequestMessage.Headers.Host
    Write-Host "Success - Status: $($response.StatusCode)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
