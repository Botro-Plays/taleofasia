$pwd = ConvertTo-SecureString -String 'Conquest2024!' -Force -AsPlainText
$cert = Import-PfxCertificate -FilePath 'C:\certs\taleofconquest_com\taleofconquest_com.pfx' -CertStoreLocation Cert:\LocalMachine\My -Password $pwd
Write-Host "Imported taleofconquest cert with thumbprint: $($cert.Thumbprint)"
