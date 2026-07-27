# Tiny static file server for previewing the site locally on Windows.
#   powershell -ExecutionPolicy Bypass -File serve.ps1
# Then open http://localhost:8123
#
# You don't strictly need this — index.html opens fine straight from disk.
# It's here because a real server gives you correct MIME types and normal
# cache behaviour while editing. Ctrl+C to stop.

param(
  [string]$Root = $PSScriptRoot,
  [int]$Port = 8123
)

$ErrorActionPreference = "Stop"

$mime = @{
  ".html"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8"
  ".js"="text/javascript; charset=utf-8"; ".json"="application/json"
  ".svg"="image/svg+xml"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"
  ".png"="image/png"; ".webp"="image/webp"; ".ico"="image/x-icon"
  ".woff2"="font/woff2"; ".woff"="font/woff"; ".txt"="text/plain; charset=utf-8"
  ".md"="text/markdown; charset=utf-8"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try { $listener.Start() }
catch { Write-Host "Could not bind port $Port. Try: -Port 8124" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  Serving $Root" -ForegroundColor DarkGray
Write-Host "  http://localhost:$Port" -ForegroundColor Cyan
Write-Host "  Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""

$rootFull = [System.IO.Path]::GetFullPath($Root)

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $res = $ctx.Response

    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }

    $full = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))

    # Never serve anything outside the site folder.
    if (-not $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403; $res.Close(); continue
    }

    if (Test-Path -LiteralPath $full -PathType Container) { $full = Join-Path $full "index.html" }

    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
      $res.Headers.Add("Cache-Control", "no-store")
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - $rel")
      $res.StatusCode = 404
      $res.ContentType = "text/plain; charset=utf-8"
      $res.ContentLength64 = $msg.Length
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
    $res.Close()
  } catch {
    Write-Host "  error: $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
}
