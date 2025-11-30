# EAS Secrets Setup Script
# Uploads environment variables from .env.local file to EAS secrets

Write-Host "Starting EAS Secrets setup..." -ForegroundColor Green

# Read .env.local file
$envFile = ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "Error: .env.local file not found." -ForegroundColor Red
    exit 1
}

# Read environment variables from .env.local file
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        if ($key -and $value) {
            $envVars[$key] = $value
        }
    }
}

# Filter only Firebase-related environment variables
$firebaseVars = $envVars.Keys | Where-Object { $_ -like "EXPO_PUBLIC_FIREBASE_*" }

if ($firebaseVars.Count -eq 0) {
    Write-Host "Warning: No Firebase environment variables found." -ForegroundColor Yellow
    Write-Host "Please check for variables in EXPO_PUBLIC_FIREBASE_* format." -ForegroundColor Yellow
    exit 1
}

Write-Host "`nThe following environment variables will be set as EAS secrets:" -ForegroundColor Cyan
$firebaseVars | ForEach-Object { Write-Host "  - $_" }

$confirm = Read-Host "`nContinue? (Y/n)"
if ($confirm -eq "n" -or $confirm -eq "N") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

# Set each environment variable as EAS secret
foreach ($varName in $firebaseVars) {
    $varValue = $envVars[$varName]
    
    Write-Host "`nSetting: $varName" -ForegroundColor Yellow
    
    # Create or update secret
    $result = eas secret:create --scope project --name $varName --value $varValue --force 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Success: $varName configured" -ForegroundColor Green
    } else {
        Write-Host "Failed: $varName configuration failed" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
}

Write-Host "`nAll environment variables have been configured!" -ForegroundColor Green
Write-Host "You can now run the build: eas build --platform android --profile preview" -ForegroundColor Cyan

