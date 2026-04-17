@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    Ollama Model Installer
echo ========================================
echo.
echo This will help you install Ollama models
echo with an easy-to-use dropdown interface
echo.
echo Requirements:
echo - Ollama must be installed and running
echo - Internet connection for downloading models
echo - Sufficient disk space for models
echo.

REM Check if PowerShell is available
powershell -Command "Write-Host 'PowerShell available'" >nul 2>&1
if errorlevel 1 (
    echo ERROR: PowerShell is not available on this system
    echo Please install PowerShell or use a different system
    pause
    exit /b 1
)

REM Check if the PowerShell script exists
if not exist "Installers\Ollama Model Installer\omi.ps1" (
    echo ERROR: omi.ps1 (Ollama Model Installer) not found
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
    echo 2. Run the installer
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
    echo Continuing anyway - the installer will try to start Ollama...
    echo.
)

echo Starting model installer...
echo.

REM Run the PowerShell model installer
powershell -ExecutionPolicy Bypass -File ".\Installers\Ollama Model Installer\omi.ps1"

echo.
echo ========================================
echo    Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Check installed models: ollama list
echo 2. Update bot configuration if needed
echo 3. Start the bot: npm start
echo 4. Test with: !models
echo.

echo Press any key to exit...
pause >nul
