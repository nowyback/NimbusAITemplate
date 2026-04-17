# Discord Bot Configuration Setup
# Interactive configuration script for the Discord-Ollama bot
# Automatically detects local Ollama models and creates proper configuration

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Function to detect Ollama models
function Get-OllamaModels {
    try {
        Write-Host "Detecting local Ollama models..." -ForegroundColor Yellow
        $result = & ollama list 2>$null
        if ($LASTEXITCODE -eq 0) {
            $models = @()
            $lines = $result -split "`n"
            foreach ($line in $lines) {
                if ($line -match "^\s*(\S+)\s+") {
                    $models += $matches[1]
                }
            }
            Write-Host "Found $($models.Count) models: $($models -join ', ')" -ForegroundColor Green
            return $models
        } else {
            Write-Host "Ollama not found or not running" -ForegroundColor Red
            return @()
        }
    } catch {
        Write-Host "Error detecting Ollama models: $($_.Exception.Message)" -ForegroundColor Red
        return @()
    }
}

# Function to generate model suffix
function Get-ModelSuffix {
    param([string]$modelName)
    
    # Convert model name to suffix format
    if ($modelName -match ":") {
        return "--$($modelName -replace ':', '')"
    } else {
        return "--$modelName"
    }
}

# Function to calculate token cost based on model characteristics
function Get-TokenCost {
    param([string]$modelName)
    
    $name = $modelName.ToLower()
    
    # Large models (70B+)
    if ($name -match "70b|31b" -or $name -match "mixtral") {
        return 9
    }
    # Medium-large models (13B-26B)
    elseif ($name -match "13b|26b") {
        return 6
    }
    # Medium models (7B-8B)
    elseif ($name -match "7b|8b") {
        return 2
    }
    # Small models (2B-4B)
    elseif ($name -match "2b|3b|4b") {
        return 1
    }
    # Default
    else {
        return 2
    }
}

# Function to generate model configuration
function Generate-ModelConfig {
    param([string[]]$models)
    
    $config = @()
    foreach ($model in $models) {
        $cost = Get-TokenCost -modelName $model
        $config += "$model,$cost"
    }
    return $config
}

# --- UI Setup ---
$form = New-Object Windows.Forms.Form
$form.Text = "Discord Bot Configuration - Auto Model Detection"
$form.Size = New-Object Drawing.Size(650, 950)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = [Drawing.Color]::FromArgb(10, 10, 15)

# Typography
$fontHead = New-Object Drawing.Font("Segoe UI", 14, [Drawing.FontStyle]::Bold)
$fontSub = New-Object Drawing.Font("Segoe UI", 9)
$fontButton = New-Object Drawing.Font("Segoe UI", 10, [Drawing.FontStyle]::Bold)

# Header
$header = New-Object Windows.Forms.Label
$header.Text = "DISCORD BOT CONFIGURATION"
$header.ForeColor = [Drawing.Color]::FromArgb(100, 200, 255)
$header.Font = $fontHead
$header.TextAlign = "MiddleCenter"
$header.Size = New-Object Drawing.Size(500, 40)
$header.Location = New-Object Drawing.Point(25, 20)
$form.Controls.Add($header)

# Discord Token
$lblDiscordToken = New-Object Windows.Forms.Label
$lblDiscordToken.Text = "Discord Bot Token:"
$lblDiscordToken.ForeColor = [Drawing.Color]::LightGray
$lblDiscordToken.Font = $fontSub
$lblDiscordToken.Size = New-Object Drawing.Size(150, 20)
$lblDiscordToken.Location = New-Object Drawing.Point(25, 80)
$form.Controls.Add($lblDiscordToken)

$txtDiscordToken = New-Object Windows.Forms.TextBox
$txtDiscordToken.Location = New-Object Drawing.Point(25, 100)
$txtDiscordToken.Size = New-Object Drawing.Size(600, 30)
$txtDiscordToken.BackColor = [Drawing.Color]::FromArgb(20, 20, 30)
$txtDiscordToken.ForeColor = [Drawing.Color]::LightGray
$txtDiscordToken.BorderStyle = "FixedSingle"
$txtDiscordToken.UseSystemPasswordChar = $true
$form.Controls.Add($txtDiscordToken)

# Owner ID
$lblOwnerId = New-Object Windows.Forms.Label
$lblOwnerId.Text = "Owner Discord ID:"
$lblOwnerId.ForeColor = [Drawing.Color]::LightGray
$lblOwnerId.Font = $fontSub
$lblOwnerId.Size = New-Object Drawing.Size(150, 20)
$lblOwnerId.Location = New-Object Drawing.Point(25, 150)
$form.Controls.Add($lblOwnerId)

$txtOwnerId = New-Object Windows.Forms.TextBox
$txtOwnerId.Location = New-Object Drawing.Point(25, 170)
$txtOwnerId.Size = New-Object Drawing.Size(600, 30)
$txtOwnerId.BackColor = [Drawing.Color]::FromArgb(20, 20, 30)
$txtOwnerId.ForeColor = [Drawing.Color]::LightGray
$txtOwnerId.BorderStyle = "FixedSingle"
$form.Controls.Add($txtOwnerId)

# Version
$lblVersion = New-Object Windows.Forms.Label
$lblVersion.Text = "Bot Version:"
$lblVersion.ForeColor = [Drawing.Color]::LightGray
$lblVersion.Font = $fontSub
$lblVersion.Size = New-Object Drawing.Size(150, 20)
$lblVersion.Location = New-Object Drawing.Point(25, 220)
$form.Controls.Add($lblVersion)

$txtVersion = New-Object Windows.Forms.TextBox
$txtVersion.Location = New-Object Drawing.Point(25, 240)
$txtVersion.Size = New-Object Drawing.Size(600, 30)
$txtVersion.Text = "1.0.0"
$txtVersion.BackColor = [Drawing.Color]::FromArgb(20, 20, 30)
$txtVersion.ForeColor = [Drawing.Color]::LightGray
$txtVersion.BorderStyle = "FixedSingle"
$form.Controls.Add($txtVersion)

# Internet Access Section
$lblInternetAccess = New-Object Windows.Forms.Label
$lblInternetAccess.Text = "Internet Access:"
$lblInternetAccess.ForeColor = [Drawing.Color]::LightGray
$lblInternetAccess.Font = $fontSub
$lblInternetAccess.Size = New-Object Drawing.Size(150, 20)
$lblInternetAccess.Location = New-Object Drawing.Point(25, 290)
$form.Controls.Add($lblInternetAccess)

# Internet access toggle
$chkInternetEnabled = New-Object Windows.Forms.CheckBox
$chkInternetEnabled.Text = "Enable Internet Access"
$chkInternetEnabled.Location = New-Object Drawing.Point(25, 310)
$chkInternetEnabled.Size = New-Object Drawing.Size(200, 30)
$chkInternetEnabled.BackColor = [Drawing.Color]::FromArgb(30, 30, 40)
$chkInternetEnabled.ForeColor = [Drawing.Color]::LightGray
$form.Controls.Add($chkInternetEnabled)

# Internet method
$lblInternetMethod = New-Object Windows.Forms.Label
$lblInternetMethod.Text = "Access Method:"
$lblInternetMethod.ForeColor = [Drawing.Color]::LightGray
$lblInternetMethod.Font = $fontSub
$lblInternetMethod.Size = New-Object Drawing.Size(150, 20)
$lblInternetMethod.Location = New-Object Drawing.Point(25, 340)
$form.Controls.Add($lblInternetMethod)

$comboInternetMethod = New-Object Windows.Forms.ComboBox
$comboInternetMethod.Location = New-Object Drawing.Point(25, 360)
$comboInternetMethod.Size = New-Object Drawing.Size(200, 30)
$comboInternetMethod.BackColor = [Drawing.Color]::FromArgb(20, 20, 30)
$comboInternetMethod.ForeColor = [Drawing.Color]::LightGray
$comboInternetMethod.FlatStyle = "Flat"
$comboInternetMethod.DropDownStyle = "DropDownList"
$comboInternetMethod.Items.AddRange(@("Search Only", "URL Fetch Only", "Hybrid (Both)"))
$comboInternetMethod.SelectedIndex = 0
$form.Controls.Add($comboInternetMethod)

# Allowed domains
$lblAllowedDomains = New-Object Windows.Forms.Label
$lblAllowedDomains.Text = "Allowed Domains (comma-separated, leave empty for all):"
$lblAllowedDomains.ForeColor = [Drawing.Color]::LightGray
$lblAllowedDomains.Font = $fontSub
$lblAllowedDomains.Size = New-Object Drawing.Size(350, 20)
$lblAllowedDomains.Location = New-Object Drawing.Point(250, 340)
$form.Controls.Add($lblAllowedDomains)

$txtAllowedDomains = New-Object Windows.Forms.TextBox
$txtAllowedDomains.Location = New-Object Drawing.Point(250, 360)
$txtAllowedDomains.Size = New-Object Drawing.Size(375, 30)
$txtAllowedDomains.Text = "wikipedia.org,github.com,stackoverflow.com"
$txtAllowedDomains.BackColor = [Drawing.Color]::FromArgb(20, 20, 30)
$txtAllowedDomains.ForeColor = [Drawing.Color]::LightGray
$txtAllowedDomains.BorderStyle = "FixedSingle"
$form.Controls.Add($txtAllowedDomains)

# Rate limit
$lblRateLimit = New-Object Windows.Forms.Label
$lblRateLimit.Text = "Rate Limit (requests per minute per user):"
$lblRateLimit.ForeColor = [Drawing.Color]::LightGray
$lblRateLimit.Font = $fontSub
$lblRateLimit.Size = New-Object Drawing.Size(300, 20)
$lblRateLimit.Location = New-Object Drawing.Point(25, 400)
$form.Controls.Add($lblRateLimit)

$txtRateLimit = New-Object Windows.Forms.TextBox
$txtRateLimit.Location = New-Object Drawing.Point(25, 420)
$txtRateLimit.Size = New-Object Drawing.Size(100, 30)
$txtRateLimit.Text = "10"
$txtRateLimit.BackColor = [Drawing.Color]::FromArgb(20, 20, 30)
$txtRateLimit.ForeColor = [Drawing.Color]::LightGray
$txtRateLimit.BorderStyle = "FixedSingle"
$form.Controls.Add($txtRateLimit)

# Chat Session Section
$lblChatSession = New-Object Windows.Forms.Label
$lblChatSession.Text = "Chat Sessions:"
$lblChatSession.ForeColor = [Drawing.Color]::LightGray
$lblChatSession.Font = $fontSub
$lblChatSession.Size = New-Object Drawing.Size(150, 20)
$lblChatSession.Location = New-Object Drawing.Point(25, 460)
$form.Controls.Add($lblChatSession)

# Session timeout
$lblSessionTimeout = New-Object Windows.Forms.Label
$lblSessionTimeout.Text = "Session Timeout (hours):"
$lblSessionTimeout.ForeColor = [Drawing.Color]::LightGray
$lblSessionTimeout.Font = $fontSub
$lblSessionTimeout.Size = New-Object Drawing.Size(200, 20)
$lblSessionTimeout.Location = New-Object Drawing.Point(25, 480)
$form.Controls.Add($lblSessionTimeout)

$txtSessionTimeout = New-Object Windows.Forms.TextBox
$txtSessionTimeout.Location = New-Object Drawing.Point(25, 500)
$txtSessionTimeout.Size = New-Object Drawing.Size(100, 30)
$txtSessionTimeout.Text = "72"
$txtSessionTimeout.BackColor = [Drawing.Color]::FromArgb(20, 20, 30)
$txtSessionTimeout.ForeColor = [Drawing.Color]::LightGray
$txtSessionTimeout.BorderStyle = "FixedSingle"
$form.Controls.Add($txtSessionTimeout)

# Max sessions per user
$lblMaxSessions = New-Object Windows.Forms.Label
$lblMaxSessions.Text = "Max Sessions Per User:"
$lblMaxSessions.ForeColor = [Drawing.Color]::LightGray
$lblMaxSessions.Font = $fontSub
$lblMaxSessions.Size = New-Object Drawing.Size(200, 20)
$lblMaxSessions.Location = New-Object Drawing.Point(250, 480)
$form.Controls.Add($lblMaxSessions)

$txtMaxSessions = New-Object Windows.Forms.TextBox
$txtMaxSessions.Location = New-Object Drawing.Point(250, 500)
$txtMaxSessions.Size = New-Object Drawing.Size(100, 30)
$txtMaxSessions.Text = "5"
$txtMaxSessions.BackColor = [Drawing.Color]::FromArgb(20, 20, 30)
$txtMaxSessions.ForeColor = [Drawing.Color]::LightGray
$txtMaxSessions.BorderStyle = "FixedSingle"
$form.Controls.Add($txtMaxSessions)

# Max messages per session
$lblMaxMessages = New-Object Windows.Forms.Label
$lblMaxMessages.Text = "Max Messages Per Session:"
$lblMaxMessages.ForeColor = [Drawing.Color]::LightGray
$lblMaxMessages.Font = $fontSub
$lblMaxMessages.Size = New-Object Drawing.Size(200, 20)
$lblMaxMessages.Location = New-Object Drawing.Point(450, 480)
$form.Controls.Add($lblMaxMessages)

$txtMaxMessages = New-Object Windows.Forms.TextBox
$txtMaxMessages.Location = New-Object Drawing.Point(450, 500)
$txtMaxMessages.Size = New-Object Drawing.Size(100, 30)
$txtMaxMessages.Text = "50"
$txtMaxMessages.BackColor = [Drawing.Color]::FromArgb(20, 20, 30)
$txtMaxMessages.ForeColor = [Drawing.Color]::LightGray
$txtMaxMessages.BorderStyle = "FixedSingle"
$form.Controls.Add($txtMaxMessages)

# Model Detection Section
$lblModelDetection = New-Object Windows.Forms.Label
$lblModelDetection.Text = "Model Detection:"
$lblModelDetection.ForeColor = [Drawing.Color]::LightGray
$lblModelDetection.Font = $fontSub
$lblModelDetection.Size = New-Object Drawing.Size(150, 20)
$lblModelDetection.Location = New-Object Drawing.Point(25, 540)
$form.Controls.Add($lblModelDetection)

# Detect models button
$btnDetectModels = New-Object Windows.Forms.Button
$btnDetectModels.Text = "Detect Local Models"
$btnDetectModels.BackColor = [Drawing.Color]::FromArgb(100, 150, 255)
$btnDetectModels.ForeColor = [Drawing.Color]::White
$btnDetectModels.FlatStyle = "Flat"
$btnDetectModels.Font = $fontSub
$btnDetectModels.Location = New-Object Drawing.Point(25, 560)
$btnDetectModels.Size = New-Object Drawing.Size(150, 30)
$form.Controls.Add($btnDetectModels)

# Model status
$lblModelStatus = New-Object Windows.Forms.Label
$lblModelStatus.Text = "Click to detect local Ollama models..."
$lblModelStatus.ForeColor = [Drawing.Color]::DimGray
$lblModelStatus.Font = $fontSub
$lblModelStatus.Size = New-Object Drawing.Size(375, 30)
$lblModelStatus.Location = New-Object Drawing.Point(185, 565)
$form.Controls.Add($lblModelStatus)

# Default Model (will be populated after detection)
$lblDefaultModel = New-Object Windows.Forms.Label
$lblDefaultModel.Text = "Default Model:"
$lblDefaultModel.ForeColor = [Drawing.Color]::LightGray
$lblDefaultModel.Font = $fontSub
$lblDefaultModel.Size = New-Object Drawing.Size(150, 20)
$lblDefaultModel.Location = New-Object Drawing.Point(25, 610)
$form.Controls.Add($lblDefaultModel)

$comboDefaultModel = New-Object Windows.Forms.ComboBox
$comboDefaultModel.Location = New-Object Drawing.Point(25, 630)
$comboDefaultModel.Size = New-Object Drawing.Size(600, 30)
$comboDefaultModel.BackColor = [Drawing.Color]::FromArgb(20, 20, 30)
$comboDefaultModel.ForeColor = [Drawing.Color]::White
$comboDefaultModel.FlatStyle = "Flat"
$comboDefaultModel.DropDownStyle = "DropDownList"
$comboDefaultModel.Enabled = $false
$form.Controls.Add($comboDefaultModel)

# Model Configuration Preview
$lblModelConfig = New-Object Windows.Forms.Label
$lblModelConfig.Text = "Generated Model Configuration:"
$lblModelConfig.ForeColor = [Drawing.Color]::LightGray
$lblModelConfig.Font = $fontSub
$lblModelConfig.Size = New-Object Drawing.Size(500, 20)
$lblModelConfig.Location = New-Object Drawing.Point(25, 600)
$form.Controls.Add($lblModelConfig)

$txtModelConfig = New-Object Windows.Forms.TextBox
$txtModelConfig.Location = New-Object Drawing.Point(25, 670)
$txtModelConfig.Size = New-Object Drawing.Size(600, 120)
$txtModelConfig.Text = "Models will be detected and configured here..."
$txtModelConfig.BackColor = [Drawing.Color]::FromArgb(20, 20, 30)
$txtModelConfig.ForeColor = [Drawing.Color]::LightGray
$txtModelConfig.BorderStyle = "FixedSingle"
$txtModelConfig.Multiline = $true
$txtModelConfig.ScrollBars = "Vertical"
$txtModelConfig.ReadOnly = $true
$form.Controls.Add($txtModelConfig)

# Status
$lblStatus = New-Object Windows.Forms.Label
$lblStatus.Text = "Configure your Discord bot settings above..."
$lblStatus.ForeColor = [Drawing.Color]::DimGray
$lblStatus.TextAlign = "MiddleCenter"
$lblStatus.Size = New-Object Drawing.Size(600, 20)
$lblStatus.Location = New-Object Drawing.Point(25, 810)
$form.Controls.Add($lblStatus)

# Save Button
$btnSave = New-Object Windows.Forms.Button
$btnSave.Text = "Save Configuration"
$btnSave.BackColor = [Drawing.Color]::FromArgb(100, 200, 255)
$btnSave.ForeColor = [Drawing.Color]::Black
$btnSave.FlatStyle = "Flat"
$btnSave.Font = $fontButton
$btnSave.Location = New-Object Drawing.Point(25, 840)
$btnSave.Size = New-Object Drawing.Size(600, 50)
$btnSave.Enabled = $false
$form.Controls.Add($btnSave)

# Cancel Button
$btnCancel = New-Object Windows.Forms.Button
$btnCancel.Text = "Cancel"
$btnCancel.BackColor = [Drawing.Color]::FromArgb(60, 60, 70)
$btnCancel.ForeColor = [Drawing.Color]::White
$btnCancel.FlatStyle = "Flat"
$btnCancel.Location = New-Object Drawing.Point(25, 900)
$btnCancel.Size = New-Object Drawing.Size(600, 50)
$btnCancel.Font = $fontButton
$form.Controls.Add($btnCancel)

# Store detected models globally
$detectedModels = @()

# Model detection button click handler
$btnDetectModels.Add_Click({
    $lblModelStatus.Text = "Detecting models..."
    $lblModelStatus.ForeColor = [Drawing.Color]::Yellow
    
    $form.Refresh()
    
    $detectedModels = Get-OllamaModels
    
    if ($detectedModels.Count -gt 0) {
        # Update combo box
        $comboDefaultModel.Items.Clear()
        foreach ($model in $detectedModels) {
            $comboDefaultModel.Items.Add($model) | Out-Null
        }
        $comboDefaultModel.SelectedIndex = 0
        $comboDefaultModel.Enabled = $true
        
        # Generate model configuration
        $modelConfig = Generate-ModelConfig -models $detectedModels
        $configText = $modelConfig -join "`r`n"
        $txtModelConfig.Text = $configText
        
        $lblModelStatus.Text = "Found $($detectedModels.Count) models!"
        $lblModelStatus.ForeColor = [Drawing.Color]::LightGreen
        $btnSave.Enabled = $true
        
        # Update status
        $lblStatus.Text = "Models detected and configured! Fill in your bot details and save."
    } else {
        $lblModelStatus.Text = "No models detected. Make sure Ollama is running."
        $lblModelStatus.ForeColor = [Drawing.Color]::Red
        $txtModelConfig.Text = "# No models detected`n# Please install Ollama and pull some models first`n# Example: ollama pull llama3:8b"
    }
})

# Load existing configuration if exists
if (Test-Path ".env") {
    try {
        $envContent = Get-Content ".env" -ErrorAction SilentlyContinue
        foreach ($line in $envContent) {
            if ($line.StartsWith("DISCORDBOTTOKEN=")) {
                $txtDiscordToken.Text = $line.Substring(16)
            }
            elseif ($line.StartsWith("OWNER_ID=")) {
                $txtOwnerId.Text = $line.Substring(9)
            }
            elseif ($line.StartsWith("VERSION=")) {
                $txtVersion.Text = $line.Substring(8)
            }
        }
        $lblStatus.Text = "Loaded existing configuration"
    } catch {
        $lblStatus.Text = "Error loading existing configuration"
    }
}

# Load existing discord-models.txt if exists
if (Test-Path "discord-models.txt") {
    try {
        $modelsContent = Get-Content "discord-models.txt" -ErrorAction SilentlyContinue
        $txtModelConfig.Text = $modelsContent -join "`r`n"
        $lblStatus.Text = "Loaded existing configuration and models"
        $btnSave.Enabled = $true
    } catch {
        $lblStatus.Text = "Error loading discord-models.txt"
    }
}

# Save button click handler
$btnSave.Add_Click({
    # Validate inputs
    if ($txtDiscordToken.Text -eq "") {
        [Windows.Forms.MessageBox]::Show("Please enter your Discord bot token.", "Missing Information", "OK", "Warning")
        return
    }
    
    if ($txtOwnerId.Text -eq "") {
        [Windows.Forms.MessageBox]::Show("Please enter your Discord user ID.", "Missing Information", "OK", "Warning")
        return
    }
    
    if ($comboDefaultModel.SelectedItem -eq "") {
        [Windows.Forms.MessageBox]::Show("Please detect and select a default model.", "Missing Information", "OK", "Warning")
        return
    }
    
    try {
        # Get internet access settings
        $internetEnabled = if ($chkInternetEnabled.Checked) { "true" } else { "false" }
        $internetMethod = $comboInternetMethod.SelectedIndex
        $allowedDomains = $txtAllowedDomains.Text.Trim()
        $rateLimit = $txtRateLimit.Text.Trim()
        
        # Map method index to actual values
        $methodMap = @("search", "fetch", "hybrid")
        $internetMethodValue = $methodMap[$internetMethod]
        
        # Get chat session settings
        $sessionTimeout = $txtSessionTimeout.Text.Trim()
        $maxSessionsPerUser = $txtMaxSessions.Text.Trim()
        $maxMessagesPerSession = $txtMaxMessages.Text.Trim()
        
        # Convert hours to milliseconds
        $sessionTimeoutMs = [int]$sessionTimeout * 60 * 60 * 1000

        # Create .env file
        $envContent = @"
# Discord Bot Configuration
DISCORDBOTTOKEN=$($txtDiscordToken.Text)
OWNER_ID=$($txtOwnerId.Text)
VERSION=$($txtVersion.Text)
DEFAULT_MODEL=$($comboDefaultModel.SelectedItem)
REQUEST_COOLDOWN=5
DEFAULT_TOKENS=1

# Internet Access Configuration
INTERNET_ACCESS=$internetEnabled
INTERNET_METHOD=$internetMethodValue
ALLOWED_DOMAINS=$allowedDomains
RATE_LIMIT=$rateLimit

# Chat Session Configuration
SESSION_TIMEOUT=$sessionTimeoutMs
MAX_SESSIONS_PER_USER=$maxSessionsPerUser
MAX_MESSAGES_PER_SESSION=$maxMessagesPerSession

# Optional: Custom settings
# MAX_PROMPT_LOG_ENTRIES=1000
# BOT_PREFIX=>
# HELP_PREFIX=?
"@
        
        $envContent | Out-File -FilePath ".env" -Encoding UTF8
        
        # Save model configuration to discord-models.txt
        $modelsContent = $txtModelConfig.Text
        $modelsContent | Out-File -FilePath "discord-models.txt" -Encoding UTF8
        
        $lblStatus.Text = "Configuration saved successfully!"
        $lblStatus.ForeColor = [Drawing.Color]::LightGreen
        
        [Windows.Forms.MessageBox]::Show("Configuration saved successfully!`n`nFiles created:`n- .env (bot configuration)`n- discord-models.txt (model configuration)`n`nYou can now start the bot with: npm start", "Success", "OK", "Information")
        
        # Close form after a short delay
        $form.Close()
        
    } catch {
        [Windows.Forms.MessageBox]::Show("Error saving configuration: $($_.Exception.Message)", "Error", "OK", "Error")
        $lblStatus.Text = "Error saving configuration"
        $lblStatus.ForeColor = [Drawing.Color]::Red
    }
})

# Cancel button click handler
$btnCancel.Add_Click({
    $form.Close()
})

# Auto-detect models on form load
$btnDetectModels.PerformClick()

# Show form
$form.ShowDialog()
