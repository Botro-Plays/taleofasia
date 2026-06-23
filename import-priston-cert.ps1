$pwd = ConvertTo-SecureString -String 'Conquest2024!' -Force -AsPlainText
$cert = Import-PfxCertificate -FilePath 'C:\certs\priston_taleofconquest.com\priston_taleofconquest_com.pfx' -CertStoreLocation Cert:\LocalMachine\My -Password $pwd
Write-Host "Imported priston cert with thumbprint: $($cert.Thumbprint)"
