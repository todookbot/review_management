# Git Sync Script for ReviewPulse
$GIT_PATH = "C:\Users\venpep\AppData\Local\Programs\Git\cmd\git.exe"

function Sync-Git {
    param (
        [string]$Message = "Update from Antigravity"
    )
    
    Write-Host "Starting Git Sync..." -ForegroundColor Cyan
    
    & $GIT_PATH add .
    & $GIT_PATH commit -m $Message
    & $GIT_PATH push origin main
    
    Write-Host "Git Sync Complete!" -ForegroundColor Green
}

# Run the sync
Sync-Git -Message $args[0]
