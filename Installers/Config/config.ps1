# Discord Bot Configuration Setup - Addon System
# Interactive configuration script for the Nimbus AI Bot with addon system
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

# Function to ensure config directory exists
function Ensure-ConfigDirectory {
    $configDir = "config"
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
        Write-Host "Created config directory" -ForegroundColor Green
    }
}

# Function to create bot configuration
function Create-BotConfig {
    param(
        [string]$token,
        [string]$ownerId,
        [string]$version,
        [string]$defaultModel,
        [int]$requestCooldown,
        [int]$defaultTokens,
        [bool]$internetEnabled,
        [string]$internetMethod,
        [string]$allowedDomains,
        [int]$rateLimit,
        [int]$sessionTimeout,
        [int]$maxSessionsPerUser,
        [int]$maxMessagesPerSession,
        [string]$aiName,
        [string]$archiveCategoryName,
        [bool]$deleteRolesOnMove,
        [bool]$createArchiveCategoryIfMissing,
        [bool]$buildEnabled,
        [int]$censoringLevel
    )
    
    $botConfig = @{
        bot = @{
            token = $token
            ownerId = $ownerId
            version = $version
            prefix = ">"
        }
        ollama = @{
            host = "localhost"
            port = 11434
            defaultModel = $defaultModel
        }
        tokens = @{
            defaultTokens = $defaultTokens
            requestCooldown = $requestCooldown
        }
        sessions = @{
            timeout = $sessionTimeout
            maxSessionsPerUser = $maxSessionsPerUser
            maxMessagesPerSession = $maxMessagesPerSession
        }
        internet = @{
            enabled = $internetEnabled
            method = $internetMethod
            allowedDomains = if ($allowedDomains) { $allowedDomains -split ',' | ForEach-Object { $_.Trim() } } else { @() }
            rateLimit = $rateLimit
            censoringLevel = $censoringLevel
        }
        ai = @{
            name = $aiName
            responsePrefix = "$aiName Response"
            processingPrefix = "AI is generating"
            errorPrefix = "AI encountered an error"
        }
        server = @{
            archiveCategoryName = $archiveCategoryName
            deleteRolesOnMove = $deleteRolesOnMove
            createArchiveCategoryIfMissing = $createArchiveCategoryIfMissing
            buildEnabled = $buildEnabled
        }
    }
    
    return $botConfig | ConvertTo-Json -Depth 10
}

# Function to create addons configuration
function Create-AddonsConfig {
    param(
        [bool]$internetEnabled,
        [string]$internetMethod,
        [string]$allowedDomains,
        [int]$rateLimit,
        [int]$censoringLevel,
        [bool]$buildEnabled,
        [string]$archiveCategoryName,
        [bool]$deleteRolesOnMove,
        [bool]$createArchiveCategoryIfMissing,
        [string]$defaultModel
    )
    
    $addonsConfig = @{
        "internet-access" = @{
            enabled = $internetEnabled
            config = @{
                enabled = $internetEnabled
                searchEngine = "duckduckgo"
                maxResults = 3
                requestTimeout = 10000
                maxContentSize = 2000
                allowedDomains = if ($allowedDomains) { $allowedDomains -split ',' | ForEach-Object { $_.Trim() } } else { @() }
                blockedDomains = @(
                    "pornhub.com",
                    "xvideos.com", 
                    "adultfriendfinder.com",
                    "malware.com",
                    "virus.com"
                )
                censoring = @{
                    enabled = $true
                    level = $censoringLevel
                    customFilters = @()
                }
                rateLimit = @{
                    enabled = $true
                    requestsPerMinute = $rateLimit
                    blockDuration = 60000
                }
            }
        }
        "image-processing" = @{
            enabled = $true
            config = @{
                enabled = $true
                generation = @{
                    enabled = $true
                    defaultModel = "dall-e"
                    maxSize = "1024x1024"
                    quality = "standard"
                    maxRequestsPerHour = 5
                }
                analysis = @{
                    enabled = $true
                    maxImageSize = "20MB"
                    supportedFormats = @("png", "jpg", "jpeg", "gif", "webp")
                }
                processing = @{
                    timeout = 30000
                    maxConcurrent = 3
                }
            }
        }
        "server-building" = @{
            enabled = $buildEnabled
            config = @{
                enabled = $buildEnabled
                building = @{
                    maxChannels = 50
                    maxRoles = 25
                    maxCategories = 10
                    archiveCategoryName = $archiveCategoryName
                    deleteRolesOnMove = $deleteRolesOnMove
                    createArchiveCategoryIfMissing = $createArchiveCategoryIfMissing
                }
                ai = @{
                    model = $defaultModel
                    maxResponseLength = 2000
                    temperature = 0.7
                }
                templates = @{
                    gaming = @{
                        name = "Gaming Server"
                        description = "A server for gaming communities"
                        categories = @("General", "Gaming", "Voice Channels")
                        channels = @("welcome", "rules", "announcements", "general-chat", "gaming-chat", "media")
                        roles = @("Member", "Gamer", "Moderator", "Admin")
                    }
                    community = @{
                        name = "Community Server"
                        description = "A server for general communities"
                        categories = @("General", "Discussion", "Resources")
                        channels = @("welcome", "rules", "announcements", "general-chat", "introductions", "resources")
                        roles = @("Member", "Contributor", "Moderator", "Admin")
                    }
                    study = @{
                        name = "Study Server"
                        description = "A server for study groups and learning"
                        categories = @("General", "Study Rooms", "Resources")
                        channels = @("welcome", "rules", "announcements", "general-chat", "study-help", "resources")
                        roles = @("Student", "Tutor", "Moderator", "Admin")
                    }
                }
            }
        }
        "auto-moderation" = @{
            enabled = $false
            config = @{}
        }
        "server-management" = @{
            enabled = $false
            config = @{}
        }
    }
    
    return $addonsConfig | ConvertTo-Json -Depth 10
}

# --- UI Setup ---
$form = New-Object Windows.Forms.Form
$form.Text = "Nimbus AI Bot Configuration - Addon System"
$form.Size = New-Object Drawing.Size(650, 1050)
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
$header.Text = "Nimbus AI Bot Configuration"
$header.Font = $fontHead
$header.ForeColor = [Drawing.Color]::White
$header.Location = New-Object Drawing.Point(20, 20)
$header.Size = New-Object Drawing.Size(400, 30)
$form.Controls.Add($header)

# Subtitle
$subtitle = New-Object Windows.Forms.Label
$subtitle.Text = "Configure your modular Discord bot with addon system"
$subtitle.Font = $fontSub
$subtitle.ForeColor = [Drawing.Color]::Gray
$subtitle.Location = New-Object Drawing.Point(20, 55)
$subtitle.Size = New-Object Drawing.Size(400, 20)
$form.Controls.Add($subtitle)

# Discord Token
$lblDiscordToken = New-Object Windows.Forms.Label
$lblDiscordToken.Text = "Discord Bot Token:"
$lblDiscordToken.ForeColor = [Drawing.Color]::White
$lblDiscordToken.Location = New-Object Drawing.Point(20, 90)
$lblDiscordToken.Size = New-Object Drawing.Size(150, 25)
$form.Controls.Add($lblDiscordToken)

$txtDiscordToken = New-Object Windows.Forms.TextBox
$txtDiscordToken.Location = New-Object Drawing.Point(180, 90)
$txtDiscordToken.Size = New-Object Drawing.Size(400, 25)
$txtDiscordToken.PasswordChar = "*"
$form.Controls.Add($txtDiscordToken)

# Owner ID
$lblOwnerId = New-Object Windows.Forms.Label
$lblOwnerId.Text = "Owner Discord ID:"
$lblOwnerId.ForeColor = [Drawing.Color]::White
$lblOwnerId.Location = New-Object Drawing.Point(20, 125)
$lblOwnerId.Size = New-Object Drawing.Size(150, 25)
$form.Controls.Add($lblOwnerId)

$txtOwnerId = New-Object Windows.Forms.TextBox
$txtOwnerId.Location = New-Object Drawing.Point(180, 125)
$txtOwnerId.Size = New-Object Drawing.Size(400, 25)
$form.Controls.Add($txtOwnerId)

# Version
$lblVersion = New-Object Windows.Forms.Label
$lblVersion.Text = "Bot Version:"
$lblVersion.ForeColor = [Drawing.Color]::White
$lblVersion.Location = New-Object Drawing.Point(20, 160)
$lblVersion.Size = New-Object Drawing.Size(150, 25)
$form.Controls.Add($lblVersion)

$txtVersion = New-Object Windows.Forms.TextBox
$txtVersion.Text = "1.2.0"
$txtVersion.Location = New-Object Drawing.Point(180, 160)
$txtVersion.Size = New-Object Drawing.Size(400, 25)
$form.Controls.Add($txtVersion)

# AI Name
$lblAIName = New-Object Windows.Forms.Label
$lblAIName.Text = "AI Name:"
$lblAIName.ForeColor = [Drawing.Color]::White
$lblAIName.Location = New-Object Drawing.Point(20, 195)
$lblAIName.Size = New-Object Drawing.Size(150, 25)
$form.Controls.Add($lblAIName)

$txtAIName = New-Object Windows.Forms.TextBox
$txtAIName.Text = "Nimbus AI"
$txtAIName.Location = New-Object Drawing.Point(180, 195)
$txtAIName.Size = New-Object Drawing.Size(400, 25)
$form.Controls.Add($txtAIName)

# Model Detection Section
$lblModelSection = New-Object Windows.Forms.Label
$lblModelSection.Text = "AI Model Configuration"
$lblModelSection.Font = $fontHead
$lblModelSection.ForeColor = [Drawing.Color]::White
$lblModelSection.Location = New-Object Drawing.Point(20, 240)
$lblModelSection.Size = New-Object Drawing.Size(300, 30)
$form.Controls.Add($lblModelSection)

# Detect Models Button
$btnDetectModels = New-Object Windows.Forms.Button
$btnDetectModels.Text = "Detect Ollama Models"
$btnDetectModels.BackColor = [Drawing.Color]::FromArgb(0, 120, 215)
$btnDetectModels.ForeColor = [Drawing.Color]::White
$btnDetectModels.Font = $fontButton
$btnDetectModels.Location = New-Object Drawing.Point(20, 280)
$btnDetectModels.Size = New-Object Drawing.Size(200, 35)
$form.Controls.Add($btnDetectModels)

# Default Model Dropdown
$lblDefaultModel = New-Object Windows.Forms.Label
$lblDefaultModel.Text = "Default Model:"
$lblDefaultModel.ForeColor = [Drawing.Color]::White
$lblDefaultModel.Location = New-Object Drawing.Point(240, 280)
$lblDefaultModel.Size = New-Object Drawing.Size(100, 25)
$form.Controls.Add($lblDefaultModel)

$comboDefaultModel = New-Object Windows.Forms.ComboBox
$comboDefaultModel.Location = New-Object Drawing.Point(340, 280)
$comboDefaultModel.Size = New-Object Drawing.Size(240, 25)
$comboDefaultModel.DropDownStyle = [Windows.Forms.ComboBoxStyle]::DropDownList
$form.Controls.Add($comboDefaultModel)

# Model Configuration Display
$txtModelConfig = New-Object Windows.Forms.TextBox
$txtModelConfig.Multiline = $true
$txtModelConfig.ScrollBars = [Windows.Forms.ScrollBars]::Vertical
$txtModelConfig.Location = New-Object Drawing.Point(20, 320)
$txtModelConfig.Size = New-Object Drawing.Size(560, 80)
$txtModelConfig.ReadOnly = $true
$txtModelConfig.BackColor = [Drawing.Color]::FromArgb(30, 30, 40)
$txtModelConfig.ForeColor = [Drawing.Color]::White
$form.Controls.Add($txtModelConfig)

# Internet Access Section
$lblInternetSection = New-Object Windows.Forms.Label
$lblInternetSection.Text = "Internet Access Configuration"
$lblInternetSection.Font = $fontHead
$lblInternetSection.ForeColor = [Drawing.Color]::White
$lblInternetSection.Location = New-Object Drawing.Point(20, 420)
$lblInternetSection.Size = New-Object Drawing.Size(300, 30)
$form.Controls.Add($lblInternetSection)

# Enable Internet Access
$chkInternetEnabled = New-Object Windows.Forms.CheckBox
$chkInternetEnabled.Text = "Enable Internet Access"
$chkInternetEnabled.ForeColor = [Drawing.Color]::White
$chkInternetEnabled.Location = New-Object Drawing.Point(20, 460)
$chkInternetEnabled.Size = New-Object Drawing.Size(200, 25)
$form.Controls.Add($chkInternetEnabled)

# Internet Method
$lblInternetMethod = New-Object Windows.Forms.Label
$lblInternetMethod.Text = "Method:"
$lblInternetMethod.ForeColor = [Drawing.Color]::White
$lblInternetMethod.Location = New-Object Drawing.Point(40, 490)
$lblInternetMethod.Size = New-Object Drawing.Size(80, 25)
$form.Controls.Add($lblInternetMethod)

$comboInternetMethod = New-Object Windows.Forms.ComboBox
$comboInternetMethod.Items.AddRange(@("search", "fetch", "hybrid"))
$comboInternetMethod.SelectedItem = "search"
$comboInternetMethod.Location = New-Object Drawing.Point(120, 490)
$comboInternetMethod.Size = New-Object Drawing.Size(150, 25)
$form.Controls.Add($comboInternetMethod)

# Rate Limit
$lblRateLimit = New-Object Windows.Forms.Label
$lblRateLimit.Text = "Rate Limit (req/min):"
$lblRateLimit.ForeColor = [Drawing.Color]::White
$lblRateLimit.Location = New-Object Drawing.Point(40, 525)
$lblRateLimit.Size = New-Object Drawing.Size(120, 25)
$form.Controls.Add($lblRateLimit)

$txtRateLimit = New-Object Windows.Forms.TextBox
$txtRateLimit.Text = "10"
$txtRateLimit.Location = New-Object Drawing.Point(160, 525)
$txtRateLimit.Size = New-Object Drawing.Size(110, 25)
$form.Controls.Add($txtRateLimit)

# Censoring Level
$lblCensoringLevel = New-Object Windows.Forms.Label
$lblCensoringLevel.Text = "Censoring Level (0-5):"
$lblCensoringLevel.ForeColor = [Drawing.Color]::White
$lblCensoringLevel.Location = New-Object Drawing.Point(300, 525)
$lblCensoringLevel.Size = New-Object Drawing.Size(130, 25)
$form.Controls.Add($lblCensoringLevel)

$txtCensoringLevel = New-Object Windows.Forms.TextBox
$txtCensoringLevel.Text = "2"
$txtCensoringLevel.Location = New-Object Drawing.Point(430, 525)
$txtCensoringLevel.Size = New-Object Drawing.Size(150, 25)
$form.Controls.Add($txtCensoringLevel)

# Allowed Domains
$lblAllowedDomains = New-Object Windows.Forms.Label
$lblAllowedDomains.Text = "Allowed Domains (comma-separated):"
$lblAllowedDomains.ForeColor = [Drawing.Color]::White
$lblAllowedDomains.Location = New-Object Drawing.Point(40, 560)
$lblAllowedDomains.Size = New-Object Drawing.Size(200, 25)
$form.Controls.Add($lblAllowedDomains)

$txtAllowedDomains = New-Object Windows.Forms.TextBox
$txtAllowedDomains.Location = New-Object Drawing.Point(40, 585)
$txtAllowedDomains.Size = New-Object Drawing.Size(540, 25)
$txtAllowedDomains.PlaceholderText = "e.g., wikipedia.org, github.com, stackoverflow.com"
$form.Controls.Add($txtAllowedDomains)

# Server Building Section
$lblServerSection = New-Object Windows.Forms.Label
$lblServerSection.Text = "Server Building Configuration"
$lblServerSection.Font = $fontHead
$lblServerSection.ForeColor = [Drawing.Color]::White
$lblServerSection.Location = New-Object Drawing.Point(20, 630)
$lblServerSection.Size = New-Object Drawing.Size(300, 30)
$form.Controls.Add($lblServerSection)

# Enable Server Building
$chkBuildEnabled = New-Object Windows.Forms.CheckBox
$chkBuildEnabled.Text = "Enable Server Building"
$chkBuildEnabled.ForeColor = [Drawing.Color]::White
$chkBuildEnabled.Location = New-Object Drawing.Point(20, 670)
$chkBuildEnabled.Size = New-Object Drawing.Size(200, 25)
$form.Controls.Add($chkBuildEnabled)

# Archive Category Name
$lblArchiveCategory = New-Object Windows.Forms.Label
$lblArchiveCategory.Text = "Archive Category Name:"
$lblArchiveCategory.ForeColor = [Drawing.Color]::White
$lblArchiveCategory.Location = New-Object Drawing.Point(40, 700)
$lblArchiveCategory.Size = New-Object Drawing.Size(150, 25)
$form.Controls.Add($lblArchiveCategory)

$txtArchiveCategory = New-Object Windows.Forms.TextBox
$txtArchiveCategory.Text = "Archive"
$txtArchiveCategory.Location = New-Object Drawing.Point(190, 700)
$txtArchiveCategory.Size = New-Object Drawing.Size(150, 25)
$form.Controls.Add($txtArchiveCategory)

# Delete Roles on Move
$chkDeleteRoles = New-Object Windows.Forms.CheckBox
$chkDeleteRoles.Text = "Delete Roles When Moving Channels"
$chkDeleteRoles.ForeColor = [Drawing.Color]::White
$chkDeleteRoles.Location = New-Object Drawing.Point(40, 735)
$chkDeleteRoles.Size = New-Object Drawing.Size(250, 25)
$form.Controls.Add($chkDeleteRoles)

# Create Archive Category
$chkCreateArchive = New-Object Windows.Forms.CheckBox
$chkCreateArchive.Text = "Create Archive Category if Missing"
$chkCreateArchive.ForeColor = [Drawing.Color]::White
$chkCreateArchive.Location = New-Object Drawing.Point(40, 765)
$chkCreateArchive.Size = New-Object Drawing.Size(250, 25)
$form.Controls.Add($chkCreateArchive)

# Chat Session Section
$lblSessionSection = New-Object Windows.Forms.Label
$lblSessionSection.Text = "Chat Session Configuration"
$lblSessionSection.Font = $fontHead
$lblSessionSection.ForeColor = [Drawing.Color]::White
$lblSessionSection.Location = New-Object Drawing.Point(20, 810)
$lblSessionSection.Size = New-Object Drawing.Size(300, 30)
$form.Controls.Add($lblSessionSection)

# Session Timeout (hours)
$lblSessionTimeout = New-Object Windows.Forms.Label
$lblSessionTimeout.Text = "Session Timeout (hours):"
$lblSessionTimeout.ForeColor = [Drawing.Color]::White
$lblSessionTimeout.Location = New-Object Drawing.Point(40, 850)
$lblSessionTimeout.Size = New-Object Drawing.Size(150, 25)
$form.Controls.Add($lblSessionTimeout)

$txtSessionTimeout = New-Object Windows.Forms.TextBox
$txtSessionTimeout.Text = "72"
$txtSessionTimeout.Location = New-Object Drawing.Point(190, 850)
$txtSessionTimeout.Size = New-Object Drawing.Size(100, 25)
$form.Controls.Add($txtSessionTimeout)

# Max Sessions per User
$lblMaxSessions = New-Object Windows.Forms.Label
$lblMaxSessions.Text = "Max Sessions per User:"
$lblMaxSessions.ForeColor = [Drawing.Color]::White
$lblMaxSessions.Location = New-Object Drawing.Point(40, 885)
$lblMaxSessions.Size = New-Object Drawing.Size(150, 25)
$form.Controls.Add($lblMaxSessions)

$txtMaxSessions = New-Object Windows.Forms.TextBox
$txtMaxSessions.Text = "5"
$txtMaxSessions.Location = New-Object Drawing.Point(190, 885)
$txtMaxSessions.Size = New-Object Drawing.Size(100, 25)
$form.Controls.Add($txtMaxSessions)

# Max Messages per Session
$lblMaxMessages = New-Object Windows.Forms.Label
$lblMaxMessages.Text = "Max Messages per Session:"
$lblMaxMessages.ForeColor = [Drawing.Color]::White
$lblMaxMessages.Location = New-Object Drawing.Point(40, 920)
$lblMaxMessages.Size = New-Object Drawing.Size(180, 25)
$form.Controls.Add($lblMaxMessages)

$txtMaxMessages = New-Object Windows.Forms.TextBox
$txtMaxMessages.Text = "50"
$txtMaxMessages.Location = New-Object Drawing.Point(220, 920)
$txtMaxMessages.Size = New-Object Drawing.Size(100, 25)
$form.Controls.Add($txtMaxMessages)

# Status Label
$lblStatus = New-Object Windows.Forms.Label
$lblStatus.Text = "Ready to configure"
$lblStatus.ForeColor = [Drawing.Color]::Yellow
$lblStatus.Location = New-Object Drawing.Point(20, 970)
$lblStatus.Size = New-Object Drawing.Size(400, 25)
$form.Controls.Add($lblStatus)

# Buttons
$btnSave = New-Object Windows.Forms.Button
$btnSave.Text = "Save Configuration"
$btnSave.BackColor = [Drawing.Color]::FromArgb(0, 200, 83)
$btnSave.ForeColor = [Drawing.Color]::White
$btnSave.Font = $fontButton
$btnSave.Location = New-Object Drawing.Point(350, 970)
$btnSave.Size = New-Object Drawing.Size(130, 35)
$form.Controls.Add($btnSave)

$btnCancel = New-Object Windows.Forms.Button
$btnCancel.Text = "Cancel"
$btnCancel.BackColor = [Drawing.Color]::FromArgb(200, 50, 50)
$btnCancel.ForeColor = [Drawing.Color]::White
$btnCancel.Font = $fontButton
$btnCancel.Location = New-Object Drawing.Point(490, 970)
$btnCancel.Size = New-Object Drawing.Size(90, 35)
$form.Controls.Add($btnCancel)

# Event Handlers

# Detect Models button click
$btnDetectModels.Add_Click({
    $lblStatus.Text = "Detecting Ollama models..."
    $form.Refresh()
    
    $models = Get-OllamaModels
    
    if ($models.Count -gt 0) {
        $comboDefaultModel.Items.Clear()
        $comboDefaultModel.Items.AddRange($models)
        $comboDefaultModel.SelectedIndex = 0
        
        $modelConfig = Generate-ModelConfig -models $models
        $txtModelConfig.Text = $modelConfig -join "`n"
        
        $lblStatus.Text = "Found $($models.Count) models"
        $lblStatus.ForeColor = [Drawing.Color]::LightGreen
    } else {
        $lblStatus.Text = "No models found. Make sure Ollama is running."
        $lblStatus.ForeColor = [Drawing.Color]::Red
    }
})

# Save button click
$btnSave.Add_Click({
    try {
        $lblStatus.Text = "Saving configuration..."
        $form.Refresh()
        
        # Validate inputs
        if ([string]::IsNullOrWhiteSpace($txtDiscordToken.Text)) {
            [Windows.Forms.MessageBox]::Show("Please enter a Discord bot token.", "Validation Error", "OK", "Warning")
            return
        }
        
        if ([string]::IsNullOrWhiteSpace($txtOwnerId.Text)) {
            [Windows.Forms.MessageBox]::Show("Please enter an owner Discord ID.", "Validation Error", "OK", "Warning")
            return
        }
        
        # Get configuration values
        $internetEnabled = $chkInternetEnabled.Checked
        $internetMethod = $comboInternetMethod.SelectedItem.ToString()
        $allowedDomains = $txtAllowedDomains.Text.Trim()
        $rateLimit = [int]$txtRateLimit.Text
        $censoringLevel = [int]$txtCensoringLevel.Text
        
        # Get chat session settings
        $sessionTimeout = [int]$txtSessionTimeout.Text.Trim()
        $maxSessionsPerUser = [int]$txtMaxSessions.Text.Trim()
        $maxMessagesPerSession = [int]$txtMaxMessages.Text.Trim()
        
        # Convert hours to milliseconds
        $sessionTimeoutMs = $sessionTimeout * 60 * 60 * 1000
        
        # Get server building settings
        $buildEnabled = $chkBuildEnabled.Checked
        $archiveCategoryName = $txtArchiveCategory.Text.Trim()
        $deleteRolesOnMove = $chkDeleteRoles.Checked
        $createArchiveCategoryIfMissing = $chkCreateArchive.Checked
        
        # Ensure config directory exists
        Ensure-ConfigDirectory
        
        # Create bot configuration
        $botConfigContent = Create-BotConfig -token $txtDiscordToken.Text -ownerId $txtOwnerId.Text -version $txtVersion.Text -defaultModel $comboDefaultModel.SelectedItem -requestCooldown 5000 -defaultTokens 1 -internetEnabled $internetEnabled -internetMethod $internetMethod -allowedDomains $allowedDomains -rateLimit $rateLimit -sessionTimeout $sessionTimeoutMs -maxSessionsPerUser $maxSessionsPerUser -maxMessagesPerSession $maxMessagesPerSession -aiName $txtAIName.Text -archiveCategoryName $archiveCategoryName -deleteRolesOnMove $deleteRolesOnMove -createArchiveCategoryIfMissing $createArchiveCategoryIfMissing -buildEnabled $buildEnabled -censoringLevel $censoringLevel
        
        $botConfigContent | Out-File -FilePath "config\bot-config.json" -Encoding UTF8
        
        # Create addons configuration
        $addonsConfigContent = Create-AddonsConfig -internetEnabled $internetEnabled -internetMethod $internetMethod -allowedDomains $allowedDomains -rateLimit $rateLimit -censoringLevel $censoringLevel -buildEnabled $buildEnabled -archiveCategoryName $archiveCategoryName -deleteRolesOnMove $deleteRolesOnMove -createArchiveCategoryIfMissing $createArchiveCategoryIfMissing -defaultModel $comboDefaultModel.SelectedItem
        
        $addonsConfigContent | Out-File -FilePath "config\addons.json" -Encoding UTF8
        
        # Save model configuration to discord-models.txt (for compatibility)
        $modelsContent = $txtModelConfig.Text
        $modelsContent | Out-File -FilePath "discord-models.txt" -Encoding UTF8
        
        # Auto-rename example files if they exist
        $exampleFiles = @(
            "addons\internet-access\processing-messages.example.json",
            "addons\internet-access\banned-users.example.json", 
            "addons\internet-access\tokens.example.json"
        )
        
        foreach ($exampleFile in $exampleFiles) {
            if (Test-Path $exampleFile) {
                $targetFile = $exampleFile -replace ".example.json", ".json"
                try {
                    Move-Item -Path $exampleFile -Destination $targetFile -Force
                    Write-Host "Created $targetFile from example" -ForegroundColor Green
                } catch {
                    Write-Host "Warning: Could not rename $exampleFile to $targetFile" -ForegroundColor Yellow
                }
            }
        }
        
        $lblStatus.Text = "Configuration saved successfully!"
        $lblStatus.ForeColor = [Drawing.Color]::LightGreen
        
        [Windows.Forms.MessageBox]::Show("Configuration saved successfully!`n`nFiles created/updated:`n- config\bot-config.json (main bot configuration)`n- config\addons.json (addon configuration)`n- discord-models.txt (model configuration)`n- processing-messages.json (processing messages)`n- banned-users.json (banned users list)`n- tokens.json (token balances)`n`nYou can now start the bot with: npm start", "Success", "OK", "Information")
        
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
