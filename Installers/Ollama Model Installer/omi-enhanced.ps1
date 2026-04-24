# Enhanced Ollama Model Installer
# PowerShell script with editable costs and scrollable interface

# Check if the OMI script exists
$omiScript = ".\omi.ps1"
if (-not (Test-Path $omiScript)) {
    Write-Host "ERROR: omi.ps1 not found in current directory" -ForegroundColor Red
    Write-Host "Please ensure all files are in the correct directories" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Ollama is available
try {
    $ollamaVersion = & ollama --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Ollama detected: $ollamaVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ ERROR: Ollama not found in PATH" -ForegroundColor Red
        Write-Host "Please install Ollama from https://ollama.ai" -ForegroundColor Red
        Write-Host "Installation instructions:" -ForegroundColor Yellow
        Write-Host "1. Download Ollama from https://ollama.ai/" -ForegroundColor Gray
        Write-Host "2. Run this installer" -ForegroundColor Gray
        Write-Host "3. Restart your command prompt" -ForegroundColor Gray
        Write-Host "4. Run this installer again" -ForegroundColor Gray
        Read-Host "Press Enter to exit"
        exit 1
    }
} catch {
    Write-Host "❌ ERROR: Ollama not available" -ForegroundColor Red
    Write-Host "Please install Ollama from https://ollama.ai" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Ollama is running
try {
    $ollamaList = & ollama list 2>$null
    if ($LASTEXITCODE -neq 0) {
        Write-Host "⚠️  WARNING: Ollama is installed but not running" -ForegroundColor Yellow
        Write-Host "Please start Ollama first:" -ForegroundColor Yellow
        Write-Host "- Windows: Run Ollama application" -ForegroundColor Gray
        Write-Host "- Linux/Mac: ollama serve" -ForegroundColor Gray
        Write-Host "Continuing anyway - will try to start Ollama..." -ForegroundColor Yellow
        $ollamaRunning = $false
    } else {
        $models = ($ollamaList -split "`n" | Where-Object { $_ -match "^\s*\S+" }).Count
        Write-Host "✅ Found $models installed models" -ForegroundColor Green
        $ollamaRunning = $true
    }
} catch {
    Write-Host "⚠️  WARNING: Could not check Ollama status" -ForegroundColor Yellow
    $ollamaRunning = $false
}

# Enhanced Model Configuration Function
function Show-ModelConfiguration {
    param([array]$Models)
    
    # Create scrollable window
    Add-Type -AssemblyName System.Windows.Forms
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Ollama Model Configuration"
    $form.Size = New-Object System.Drawing.Size(600, 500)
    $form.StartPosition = "CenterScreen"
    
    # Title
    $titleLabel = New-Object System.Windows.Forms.Label
    $titleLabel.Text = "Configure Model Costs"
    $titleLabel.Font = New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Bold)
    $titleLabel.Location = New-Object System.Drawing.Point(20, 15)
    $titleLabel.Size = New-Object System.Drawing.Size(560, 25)
    $form.Controls.Add($titleLabel)
    
    # Instructions
    $instructionsLabel = New-Object System.Windows.Forms.Label
    $instructionsLabel.Text = "Set token costs for each model (1-10 tokens recommended)"
    $instructionsLabel.Location = New-Object System.Drawing.Point(20, 45)
    $instructionsLabel.Size = New-Object System.Drawing.Size(560, 20)
    $instructionsLabel.ForeColor = [System.Drawing.Color]::Gray
    $form.Controls.Add($instructionsLabel)
    
    # Scrollable panel for models
    $panel = New-Object System.Windows.Forms.Panel
    $panel.Location = New-Object System.Drawing.Point(20, 75)
    $panel.Size = New-Object System.Drawing.Size(560, 350)
    $panel.AutoScroll = $true
    $form.Controls.Add($panel)
    
    $yPosition = 10
    
    # Create controls for each model
    foreach ($model in $Models) {
        # Model name label
        $modelLabel = New-Object System.Windows.Forms.Label
        $modelLabel.Text = $model.Name
        $modelLabel.Location = New-Object System.Drawing.Point(10, $yPosition)
        $modelLabel.Size = New-Object System.Drawing.Size(200, 20)
        $modelLabel.Font = New-Object System.Drawing.Font("Arial", 9, [System.Drawing.FontStyle]::Bold)
        $panel.Controls.Add($modelLabel)
        
        # Size info
        $sizeLabel = New-Object System.Windows.Forms.Label
        $sizeLabel.Text = "Size: $($model.Size)"
        $sizeLabel.Location = New-Object System.Drawing.Point(220, $yPosition)
        $sizeLabel.Size = New-Object System.Drawing.Size(150, 20)
        $sizeLabel.ForeColor = [System.Drawing.Color]::Gray
        $panel.Controls.Add($sizeLabel)
        
        # Cost input
        $costLabel = New-Object System.Windows.Forms.Label
        $costLabel.Text = "Cost:"
        $costLabel.Location = New-Object System.Drawing.Point(380, $yPosition)
        $costLabel.Size = New-Object System.Drawing.Size(40, 20)
        $panel.Controls.Add($costLabel)
        
        $costTextBox = New-Object System.Windows.Forms.TextBox
        $costTextBox.Text = $model.Cost.ToString()
        $costTextBox.Location = New-New-Object System.Drawing.Point(420, $yPosition - 2)
        $costTextBox.Size = New-Object System.Drawing.Size(60, 20)
        $costTextBox.Tag = $model.Name
        $panel.Controls.Add($costTextBox)
        
        $yPosition += 30
    }
    
    # Buttons
    $saveButton = New-Object System.Windows.Forms.Button
    $saveButton.Text = "Save Configuration"
    $saveButton.Location = New-Object System.Drawing.Point(20, 440)
    $saveButton.Size = New-Object System.Drawing.Size(120, 30)
    $saveButton.BackColor = [System.Drawing.Color]::Green
    $saveButton.ForeColor = [System.Drawing.Color]::White
    $form.Controls.Add($saveButton)
    
    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Text = "Cancel"
    $cancelButton.Location = New-Object System.Drawing.Point(460, 440)
    $cancelButton.Size = New-Object System.Drawing.Size(120, 30)
    $cancelButton.BackColor = [System.Drawing.Color]::Red
    $cancelButton.ForeColor = [System.Drawing.Color]::White
    $form.Controls.Add($cancelButton)
    
    # Save button handler
    $saveButton.Add_Click({
        $configContent = @()
        foreach ($control in $panel.Controls) {
            if ($control -is [System.Windows.Forms.TextBox]) {
                $modelName = $control.Tag
                $cost = $control.Text
                if ($cost -match '^\d+$') {
                    $configContent += "$modelName,$cost"
                } else {
                    [System.Windows.Forms.MessageBox]::Show($form, "Invalid cost for $($modelName). Please enter a number.", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
                    return
                }
            }
        }
        
        # Save to discord-models.txt
        $configContent | Out-File -FilePath "discord-models.txt" -Encoding UTF8
        
        [System.Windows.Forms.MessageBox]::Show($form, "Configuration saved to discord-models.txt", "Success", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        $form.Close()
    })
    
    # Cancel button handler
    $cancelButton.Add_Click({
        $form.Close()
    })
    
    # Show the dialog
    $form.ShowDialog() | Out-Null
}

# Get available models from Ollama
function Get-AvailableModels {
    try {
        $ollamaList = & ollama list 2>$null
        if ($LASTEXITCODE -eq 0) {
            $models = @()
            foreach ($line in $ollamaList -split "`n") {
                if ($line -match "^\s*(\S+)") {
                    $modelName = $matches[1]
                    $size = "Unknown"
                    
                    # Try to get model size
                    try {
                        $modelInfo = & ollama show $modelName 2>$null
                        if ($modelInfo -match "Size:\s*(\d+(?:\.\d+)?\s*(KB|MB|GB)") {
                            $size = $matches[1] + $matches[2]
                        }
                    } catch {
                        # Ignore errors
                    }
                    
                    # Determine default cost based on model characteristics
                    $defaultCost = 1
                    $modelNameLower = $modelName.ToLower()
                    if ($modelNameLower -match "70b|31b|8x7b") {
                        $defaultCost = 6
                    } elseif ($modelNameLower -match "26b|13b") {
                        $defaultCost = 4
                    } elseif ($modelNameLower -match "8b|7b") {
                        $defaultCost = 2
                    }
                    
                    $models += @{
                        Name = $modelName
                        Size = $size
                        Cost = $defaultCost
                    }
                }
            }
            return $models
        } else {
            return @()
        }
    } catch {
        return @()
    }
}

# Main execution
Write-Host "🤖 Enhanced Ollama Model Installer" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Get available models
$availableModels = Get-AvailableModels

if ($availableModels.Count -eq 0) {
    Write-Host "❌ No models found. Please install some models first." -ForegroundColor Red
    Write-Host "Use 'ollama pull <model-name>' to install models." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Example models:" -ForegroundColor Gray
    Write-Host "  ollama pull gemma3n:e4b" -ForegroundColor Gray
    Write-Host "  ollama pull phi:2.7b" -ForegroundColor Gray
    Write-Host "  ollama pull mistral:7b" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "✅ Found $($availableModels.Count) available models:" -ForegroundColor Green
    foreach ($model in $availableModels) {
        Write-Host "  • $($model.Name) ($($model.Size))" -ForegroundColor White
    }
    Write-Host ""
    
    # Show configuration dialog
    Write-Host "Opening configuration interface..." -ForegroundColor Cyan
    Show-ModelConfiguration $availableModels
}

Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "Configuration Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Check configured models: Get-Content discord-models.txt" -ForegroundColor Gray
Write-Host "2. Start the bot: npm start" -ForegroundColor Gray
Write-Host "3. Test with: /models" -ForegroundColor Gray
Write-Host "4. Test AI chat: 'Hello there --gemma3n:e4b'" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host
