<#
  校验 Markdown 相对链接是否可达：跳过 http(s) / mailto / 纯锚点，只查仓库内相对路径。
  用法：pwsh scripts/check-md-links.ps1
  退出码 0 = 全部可达；1 = 存在失效链接（逐条列出文件与目标）。
#>
[CmdletBinding()]
param([string]$Root)

$ErrorActionPreference = "Stop"
if (-not $Root) { $Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path }

$skipDirs = @(
  ".git", "node_modules", "dist", "bin", "data", "tmp", "logs", ".codex",
  ".agents", "attachments", "reports", "knowledge-base"
)

$files = Get-ChildItem -LiteralPath $Root -Recurse -File -Filter "*.md" | Where-Object {
  $segments = [IO.Path]::GetRelativePath($Root, $_.FullName) -split "[\\/]"
  @($segments | Where-Object { $skipDirs -contains $_ }).Count -eq 0
}

$linkPattern = [regex]"\[[^\]]*\]\(([^)\s]+)"
$checked = 0
$issues = @()

foreach ($file in $files) {
  $text = Get-Content -LiteralPath $file.FullName -Raw -Encoding utf8
  foreach ($found in $linkPattern.Matches($text)) {
    $target = $found.Groups[1].Value.Trim()
    if ($target -match "^(https?:|mailto:|tel:|#)") { continue }
    $path = ($target -split "#")[0]
    if (-not $path) { continue }
    $relative = $path -replace "/", [IO.Path]::DirectorySeparatorChar
    $resolved = [IO.Path]::GetFullPath((Join-Path $file.DirectoryName $relative))
    $checked++
    if (-not (Test-Path -LiteralPath $resolved)) {
      $issues += ("{0} -> {1}" -f [IO.Path]::GetRelativePath($Root, $file.FullName), $target)
    }
  }
}

if ($issues.Count -gt 0) {
  Write-Host ("Markdown 链接校验失败：{0} 条失效 / 共 {1} 条" -f $issues.Count, $checked) -ForegroundColor Red
  $issues | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  exit 1
}

Write-Host ("Markdown 链接校验通过：{0} 个文件、{1} 条相对链接全部可达" -f $files.Count, $checked) -ForegroundColor Green
