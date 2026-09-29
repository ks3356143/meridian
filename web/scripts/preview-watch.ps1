$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

$build = $null
$preview = $null
try {
  $build = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "build", "--", "--watch" -NoNewWindow -PassThru
  Start-Sleep -Milliseconds 1200
  $preview = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "preview", "--", "--host", "127.0.0.1", "--port", "4173", "--strictPort" -NoNewWindow -PassThru
  Write-Host "preview:watch 已启动：http://127.0.0.1:4173（production React，自动重建，页面需手动刷新）"
  Wait-Process -Id $preview.Id
}
finally {
  foreach ($process in @($build, $preview)) {
    if ($null -ne $process -and -not $process.HasExited) {
      taskkill /PID $process.Id /T /F 2>$null | Out-Null
    }
  }
  Pop-Location
}
