# Test Matrix: DreamShaper XL Turbo on T4
# Tests: CFG (0.0, 1.0, 2.0) x Resolution (512, 768) x Workflow types

$ENDPOINT = "https://matiasignacioperez--fonoaudio-comfyui-v3-entrypoint.modal.run"
$RESULTS = @()

# Test configurations
$tests = @(
    # Pictogram tests - CFG comparison at 512
    @{ workflow="pictogram"; prompt="nino sonriendo"; cfg=0.0; size=512; label="pictogram_CFG0_512" },
    @{ workflow="pictogram"; prompt="nino sonriendo"; cfg=1.0; size=512; label="pictogram_CFG1_512" },
    @{ workflow="pictogram"; prompt="nino sonriendo"; cfg=2.0; size=512; label="pictogram_CFG2_512" },
    @{ workflow="pictogram"; prompt="nino sonriendo"; cfg=0.0; size=768; label="pictogram_CFG0_768" },

    # Cartoon tests
    @{ workflow="cartoon"; prompt="oso lavandose los dientes"; cfg=0.0; size=512; label="cartoon_CFG0_512" },
    @{ workflow="cartoon"; prompt="oso lavandose los dientes"; cfg=1.0; size=512; label="cartoon_CFG1_512" },
    @{ workflow="cartoon"; prompt="oso lavandose los dientes"; cfg=0.0; size=768; label="cartoon_CFG0_768" },

    # Therapy scene tests
    @{ workflow="therapy_scene"; prompt="fonoaudiologo con nino en consultorio"; cfg=0.0; size=512; label="therapy_CFG0_512" },
    @{ workflow="therapy_scene"; prompt="fonoaudiologo con nino en consultorio"; cfg=1.0; size=512; label="therapy_CFG1_512" },
    @{ workflow="therapy_scene"; prompt="fonoaudiologo con nino en consultorio"; cfg=0.0; size=768; label="therapy_CFG0_768" },

    # Flashcard tests
    @{ workflow="flashcard"; prompt="letra A con manzana"; cfg=0.0; size=512; label="flashcard_CFG0_512" },
    @{ workflow="flashcard"; prompt="letra A con manzana"; cfg=1.0; size=512; label="flashcard_CFG1_512" },

    # Emotion tests
    @{ workflow="emotion"; prompt="cara de felicidad"; cfg=0.0; size=512; label="emotion_CFG0_512" },
    @{ workflow="emotion"; prompt="cara de felicidad"; cfg=2.0; size=512; label="emotion_CFG2_512" },

    # Realistic tests
    @{ workflow="realistic"; prompt="consultorio de fonoaudiologia moderno"; cfg=0.0; size=512; label="realistic_CFG0_512" },
    @{ workflow="realistic"; prompt="consultorio de fonoaudiologia moderno"; cfg=0.0; size=768; label="realistic_CFG0_768" }
)

Write-Host "=== DreamShaper XL Turbo - Test Matrix ===" -ForegroundColor Cyan
Write-Host "Endpoint: $ENDPOINT"
Write-Host "Tests: $($tests.Count)"
Write-Host ""

foreach ($test in $tests) {
    Write-Host "--- Testing: $($test.label) ---" -ForegroundColor Yellow
    
    $params = @{
        workflow = $test.workflow
        prompt = $test.prompt
        width = $test.size
        height = $test.size
        steps = 0  # Use workflow default
        guidance_scale = $test.cfg
        seed = 42
        num_images = 1
    }
    
    $queryString = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
    $url = "$ENDPOINT/generate?$queryString"
    
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -TimeoutSec 120
        $stopwatch.Stop()
        
        $result = [PSCustomObject]@{
            Label = $test.label
            Workflow = $test.workflow
            CFG = $test.cfg
            Size = $test.size
            Status = $response.status
            TimeMs = $stopwatch.ElapsedMilliseconds
            ImageId = if ($response.image_ids) { $response.image_ids[0] } else { "N/A" }
            Error = $null
        }
        
        Write-Host "  Status: $($response.status) | Time: $($stopwatch.ElapsedMilliseconds)ms | Image: $($result.ImageId)" -ForegroundColor Green
    } catch {
        $stopwatch.Stop()
        $result = [PSCustomObject]@{
            Label = $test.label
            Workflow = $test.workflow
            CFG = $test.cfg
            Size = $test.size
            Status = "FAILED"
            TimeMs = $stopwatch.ElapsedMilliseconds
            ImageId = "N/A"
            Error = $_.Exception.Message
        }
        Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    $RESULTS += $result
    Write-Host ""
}

# Summary
Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Total tests: $($RESULTS.Count)"
Write-Host "Successful: $(($RESULTS | Where-Object { $_.Status -eq 'completed' }).Count)"
Write-Host "Failed: $(($RESULTS | Where-Object { $_.Status -eq 'FAILED' }).Count)"
Write-Host ""

# Average time by size
$avg512 = ($RESULTS | Where-Object { $_.Size -eq 512 -and $_.Status -eq 'completed' } | Measure-Object -Property TimeMs -Average).Average
$avg768 = ($RESULTS | Where-Object { $_.Size -eq 768 -and $_.Status -eq 'completed' } | Measure-Object -Property TimeMs -Average).Average
Write-Host "Average time at 512: $([math]::Round($avg512))ms" -ForegroundColor Green
if ($avg768) { Write-Host "Average time at 768: $([math]::Round($avg768))ms" -ForegroundColor Green }

# Cost estimation (T4 at $0.59/hr)
$costPerHour = 0.59
$results | ForEach-Object {
    if ($_.Status -eq 'completed') {
        $_ | Add-Member -NotePropertyName "CostUSD" -NotePropertyValue ([math]::Round(($_.TimeMs / 3600000) * $costPerHour, 6)) -Force
    }
}

Write-Host "`nResults table:" -ForegroundColor Cyan
$results | Format-Table Label, CFG, Size, Status, TimeMs, CostUSD -AutoSize

# Export results
$results | Export-Csv -Path "C:\Users\Administrador\Downloads\copy-of-fonoaudio-pro-ai\scripts\test-results-dreamshaper.csv" -NoTypeInformation
Write-Host "`nResults saved to scripts/test-results-dreamshaper.csv"
