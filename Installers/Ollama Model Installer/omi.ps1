# Ollama Model Installer Launcher
# PowerShell launcher for the Ollama Model Installer GUI

# Check if the OMI script exists
$omiScript = ".\Installers\Ollama Model Installer\omi.ps1"
if (-not (Test-Path $omiScript)) {
    Write-Host "ERROR: omi.ps1 not found in Installers\Ollama Model Installer\" -ForegroundColor Red
    Write-Host "Please ensure all files are in the correct directories" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Ollama is available
try {
    $ollamaVersion = & ollama --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Ollama detected: $ollamaVersion" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Ollama not found in PATH" -ForegroundColor Red
        Write-Host "Please install Ollama from https://ollama.ai" -ForegroundColor Red
        Write-Host "Installation instructions:" -ForegroundColor Yellow
        Write-Host "1. Download Ollama from https://ollama.ai/" -ForegroundColor Gray
        Write-Host "2. Run the installer" -ForegroundColor Gray
        Write-Host "3. Restart your command prompt" -ForegroundColor Gray
        Write-Host "4. Run this installer again" -ForegroundColor Gray
        Read-Host "Press Enter to exit"
        exit 1
    }
} catch {
    Write-Host "ERROR: Ollama not available" -ForegroundColor Red
    Write-Host "Please install Ollama from https://ollama.ai" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Ollama is running
try {
    $ollamaList = & ollama list 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: Ollama is installed but not running" -ForegroundColor Yellow
        Write-Host "Please start Ollama first:" -ForegroundColor Yellow
        Write-Host "- Windows: Run Ollama application" -ForegroundColor Gray
        Write-Host "- Linux/Mac: ollama serve" -ForegroundColor Gray
        Write-Host "`nContinuing anyway - the installer will try to work with Ollama..." -ForegroundColor Yellow
    } else {
        $models = ($ollamaList -split "`n" | Where-Object { $_ -match "^\s*\S+" }).Count
        Write-Host "Found $models installed models" -ForegroundColor Green
    }
} catch {
    Write-Host "WARNING: Could not check Ollama status" -ForegroundColor Yellow
}

Write-Host "`nStarting Ollama Model Installer...`n" -ForegroundColor Cyan

# Run the model installer
try {
    & $omiScript
} catch {
    Write-Host "Error running model installer: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "   Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor White
Write-Host "  1. Check installed models: ollama list" -ForegroundColor Gray
Write-Host "  2. Update bot configuration if needed" -ForegroundColor Gray
Write-Host "  3. Start the bot: npm start" -ForegroundColor Gray
Write-Host "  4. Test with: !models" -ForegroundColor Gray

Write-Host "`nPress Enter to exit..."
Read-Host
