# Import taleofconquest.com certificate
$certPem = Get-Content 'C:\certs\taleofconquest_com\taleofconquest_com.crt' -Raw
$keyPem = Get-Content 'C:\certs\taleofconquest_com\taleofconquest_com.key' -Raw
$cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::CreateFromPem($certPem, $keyPem)
$cert2 = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12), '', [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::PersistKeySet -bor [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
$store = [System.Security.Cryptography.X509Certificates.X509Store]::new('My', 'LocalMachine')
$store.Open('ReadWrite')
$store.Add($cert2)
$store.Close()
Write-Host "Imported taleofconquest.com - Thumbprint: $($cert2.Thumbprint)"

# Import priston.taleofconquest.com certificate
$certPem2 = Get-Content 'C:\certs\priston_taleofconquest.com\priston_taleofconquest_com.crt' -Raw
$keyPem2 = Get-Content 'C:\certs\priston_taleofconquest.com\priston_taleofconquest_com.key' -Raw
$certP = [System.Security.Cryptography.X509Certificates.X509Certificate2]::CreateFromPem($certPem2, $keyPem2)
$certP2 = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($certP.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12), '', [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::PersistKeySet -bor [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
$store2 = [System.Security.Cryptography.X509Certificates.X509Store]::new('My', 'LocalMachine')
$store2.Open('ReadWrite')
$store2.Add($certP2)
$store2.Close()
Write-Host "Imported priston.taleofconquest.com - Thumbprint: $($certP2.Thumbprint)"
