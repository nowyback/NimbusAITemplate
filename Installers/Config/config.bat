@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    Nimbus AI Bot Configuration Setup
echo    (Addon System)
echo ========================================
echo.
echo This will help you configure your Nimbus AI bot
echo with the new modular addon system
echo.
echo Requirements:
echo - Ollama must be installed and running
echo - At least one Ollama model should be pulled
echo - Discord bot token and user ID ready
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
if not exist "config.ps1" (
    echo ERROR: config.ps1 not found
    echo Please ensure all files are in the same directory
    pause
    exit /b 1
)

REM Check if Ollama is available (basic check)
ollama --version >nul 2>&1
if errorlevel 1 (
    echo WARNING: Ollama not found in PATH
    echo Please ensure Ollama is installed and running
    echo You can still continue, but model detection may fail
    echo.
)

echo Starting addon system configuration tool...
echo.

REM Run the PowerShell configuration script
powershell -ExecutionPolicy Bypass -File ".\config.ps1"

REM Check if configuration was successful
if exist "config\bot-config.json" (
    echo.
    echo ========================================
    echo    Configuration Complete!
    echo ========================================
    echo.
    echo Files created:
    echo - config\bot-config.json (main bot configuration)
    echo - config\addons.json (addon configuration)
    if exist "discord-models.txt" (
        echo - discord-models.txt (model configuration)
    )
    echo.
    echo Next steps:
    echo 1. Review the generated configuration files
    echo 2. Start the bot with: npm start
    echo 3. Use /help in Discord to see all commands
    echo 4. Use /addons to manage addons
    echo.
    echo Available addons:
    echo - Internet Access (web search, URL fetching)
    echo - Image Processing (generation and analysis)
    echo - Server Building (AI-powered server setup)
    echo.
) else (
    echo.
    echo Configuration was not completed.
    echo Please check for any error messages above.
    echo.
)

echo Press any key to exit...
pause >nul
