# PowerShell script to clean up temporary Codecov debug files

Write-Host "Cleaning up temporary Codecov debug files..."

# List of files to remove
$filesToRemove = @(
    "codecov-wrapper.sh",
    "codecov-force-org.js",
    "debug-codecov.js",
    "workflow-test-trigger.js",
    "codecov-fix.env",
    "codecov-local-override.yml",
    "debug-output.json",
    "codecov-debug-output.txt"
)

foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Write-Host "Removing $file"
        Remove-Item $file
    } else {
        Write-Host "File $file not found, skipping"
    }
}

Write-Host "Cleanup complete!"
