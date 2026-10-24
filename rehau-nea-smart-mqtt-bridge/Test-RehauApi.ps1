#Requires -Version 5.1
<#
.SYNOPSIS
Tests REHAU user-data access from this PC using the adjacent .env file.
.DESCRIPTION
Makes one read-only HTTPS request. Does not renew tokens, contact MQTT, or
print credentials, account details, response bodies, or installation data.
Copy this script and .env to the home PC. An optional token-store file can
supply the same rotated access token used by the bridge.
Saves the raw response body to a timestamped .html file beside this script.
Successful responses may contain private account/installation JSON despite
 the .html extension. Protect the file and do not share it without review.
.EXAMPLE
.\Test-RehauApi.ps1
.EXAMPLE
.\Test-RehauApi.ps1 -TokenStorePath .\.rehau-tokens.json
#>
[CmdletBinding()]
param(
    [string]$EnvPath = (Join-Path $PSScriptRoot '.env'),
    [string]$TokenStorePath,
    [string]$ResponsePath = (Join-Path $PSScriptRoot ('rehau-response-{0}.html' -f (Get-Date -Format 'yyyyMMdd-HHmmss-fff')))
)

$ErrorActionPreference = 'Stop'
$client = $null
$handler = $null
$request = $null
$response = $null
$exitCode = 1

try {
    $settings = @{}
    foreach ($line in [System.IO.File]::ReadAllLines((Resolve-Path -LiteralPath $EnvPath).Path)) {
        if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $key = $Matches[1]
            $value = $Matches[2].Trim()
            if ($value.StartsWith('"') -or $value.StartsWith("'")) {
                $quote = $value.Substring(0, 1)
                $end = $value.IndexOf($quote, 1)
                if ($end -lt 0) { throw 'Invalid quoted value in environment file.' }
                $value = $value.Substring(1, $end - 1)
            } else {
                $value = ($value -split '#', 2)[0].Trim()
            }
            $settings[$key] = $value
        }
    }

    $email = $settings['REHAU_EMAIL']
    $accessToken = $settings['REHAU_ACCESS_TOKEN']
    $source = 'Access token from .env (no renewal performed)'
    if ($TokenStorePath) {
        $stored = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $TokenStorePath).Path) | ConvertFrom-Json
        if ([string]::IsNullOrWhiteSpace($stored.accessToken)) { throw 'The token store has no access token.' }
        $accessToken = [string]$stored.accessToken
        $source = 'Access token from explicitly selected token store (no renewal performed)'
    }
    if ([string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($accessToken)) {
        throw 'REHAU_EMAIL and REHAU_ACCESS_TOKEN must be set in .env, or supply an access token store.'
    }
    if ($email -match '[\r\n]' -or $accessToken -match '[\r\n]') { throw 'Invalid configuration value.' }

    Write-Host $source
    # JWT expiry is diagnostic only: decoding does not verify its signature.
    $parts = $accessToken.Split('.')
    if ($parts.Length -eq 3) {
        try {
            $encoded = $parts[1].Replace('-', '+').Replace('_', '/')
            $encoded = $encoded.PadRight($encoded.Length + ((4 - ($encoded.Length % 4)) % 4), '=')
            $payload = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded)) | ConvertFrom-Json
            if ($null -ne $payload.exp) {
                $expiry = [DateTimeOffset]::FromUnixTimeSeconds([long]$payload.exp)
                Write-Host ('JWT expiry (unverified): {0:u}; expired: {1}' -f $expiry.UtcDateTime, ($expiry -le [DateTimeOffset]::UtcNow))
            }
        } catch { Write-Host 'JWT expiry could not be decoded; continuing with the server check.' }
    }

    Add-Type -AssemblyName System.Net.Http
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $client = New-Object System.Net.Http.HttpClient -ArgumentList $handler
    $client.Timeout = [TimeSpan]::FromSeconds(20)
    $uri = 'https://api.nea2aws.aws.rehau.cloud/v2/users/' + [Uri]::EscapeDataString($email) + '/getUserData'
    $request = New-Object System.Net.Http.HttpRequestMessage -ArgumentList ([System.Net.Http.HttpMethod]::Get), $uri
    [void]$request.Headers.TryAddWithoutValidation('Authorization', $accessToken)
    [void]$request.Headers.TryAddWithoutValidation('User-Agent', 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36')
    [void]$request.Headers.TryAddWithoutValidation('Origin', 'http://android.neasmart.de')
    [void]$request.Headers.TryAddWithoutValidation('Referer', 'http://android.neasmart.de/')
    [void]$request.Headers.TryAddWithoutValidation('Accept', 'application/json, text/plain, */*')

    Write-Host 'Sending one read-only getUserData request (20-second timeout)...'
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $outputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ResponsePath)
    try {
        $encoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
        $bytes = $encoding.GetBytes($body)
        $file = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        try { $file.Write($bytes, 0, $bytes.Length) } finally { $file.Dispose() }
        Write-Host ('Response body saved to: {0}' -f $outputPath)
        Write-Host 'The file may contain private account/installation data. Review before sharing; no request headers were saved.'
    } catch {
        Write-Warning 'Could not save response: check destination permissions and ensure the file does not already exist. Continuing with HTTP diagnostics.'
    }
    $cache = ''
    if ($response.Headers.Contains('X-Cache')) { $cache = $response.Headers.GetValues('X-Cache') -join ', ' }
    $result = [pscustomobject]@{
        HttpStatus = [int]$response.StatusCode
        Server = $response.Headers.Server.ToString()
        ContentType = [string]$response.Content.Headers.ContentType
        CloudFrontResult = $cache
        RequestBlocked = [bool]($body -match '(?i)request blocked')
        CloudFrontErrorPage = [bool]($body -match '(?i)cloudfront' -and $body -match '(?i)request could not be satisfied')
        MissingAuthenticationToken = [bool]($body -match '(?i)missing authentication token')
    }
    $result | Format-List | Out-Host
    if ($response.IsSuccessStatusCode) {
        Write-Host 'SUCCESS: the REHAU API accepted this read-only request. Compare this result with the Azure VM using the same access token.'
        $exitCode = 0
    } elseif ($result.CloudFrontErrorPage -or $result.RequestBlocked) {
        Write-Host 'The request was blocked at CloudFront. This result alone does not identify the blocking rule or prove a token failure.'
    } else {
        Write-Host 'The API rejected the request. Check token expiry and account access; no response body was printed.'
    }
} catch {
    # Exception messages can include the account-bearing URL; do not print them.
    Write-Host 'Test could not complete: check .env/token-store formatting, file access, DNS, HTTPS connectivity, and proxy settings. Request timeout is 20 seconds. No credentials or exception details were printed.'
} finally {
    if ($response) { $response.Dispose() }
    if ($request) { $request.Dispose() }
    if ($client) { $client.Dispose() }
    if ($handler) { $handler.Dispose() }
}
exit $exitCode
