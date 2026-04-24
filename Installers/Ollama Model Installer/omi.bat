@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    Enhanced Ollama Model Installer
echo ========================================
echo.
echo This will help you configure Ollama models
echo with an editable, scrollable interface
echo.
echo Features:
echo ✅ Editable token costs
echo ✅ Scrollable model list
echo ✅ Automatic model detection
echo ✅ Real-time configuration
echo.
echo Requirements:
echo - Ollama must be installed and running
echo - PowerShell (for GUI interface)
echo - Internet connection (optional)
echo.
echo.

REM Check if PowerShell is available
powershell -Command "Write-Host 'PowerShell available'" >nul 2>&1
if errorlevel 1 (
    echo ERROR: PowerShell is not available on this system
    echo Please install PowerShell or use the standard installer
    pause
    exit /b 1
)

REM Check if the enhanced script exists
if not exist "Installers\Ollama Model Installer\omi-enhanced.ps1" (
    echo ERROR: Enhanced installer not found
    echo Please ensure all files are in the correct directories
    pause
    exit /b 1
)

REM Check if Ollama is available
ollama --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Ollama not found in PATH
    echo Please install Ollama first: https://ollama.ai/
    echo.
    echo Installation instructions:
    echo 1. Download Ollama from https://ollama.ai/
    echo 2. Run this installer
    echo 3. Restart your command prompt
    echo 4. Run this installer again
    pause
    exit /b 1
)

REM Check if Ollama is running
ollama list >nul 2>&1
if errorlevel 1 (
    echo WARNING: Ollama is installed but not running
    echo Please start Ollama first:
    echo - Windows: Run Ollama application
    echo - Linux/Mac: ollama serve
    echo.
    echo Continuing anyway - will still work with configuration...
    echo.
)

echo Starting enhanced model installer...
echo.

REM Run the enhanced PowerShell model installer
powershell -ExecutionPolicy Bypass -File ".\Installers\Ollama Model Installer\omi-enhanced.ps1"

echo.
echo ========================================
echo    Configuration Complete!
echo ========================================
echo.
echo Features configured:
echo ✅ Editable token costs for each model
echo ✅ Scrollable interface for many models
echo ✅ Automatic cost suggestions
echo ✅ Real-time model detection
echo.
echo Next steps:
echo 1. Check configured models: Get-Content discord-models.txt
echo 2. Start the bot: npm start
echo 3. Test with: /models
echo 4. Test AI chat: 'Hello there --gemma3n:e4b'
echo.
echo Press any key to exit...
pause >nul
