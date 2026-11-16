# Tiny local web server (no install needed). Run: powershell -ExecutionPolicy Bypass -File serve.ps1
# Then open http://localhost:8080 in your browser. Press Ctrl+C to stop.
$port = 8080
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$port"
$types = @{ '.html'='text/html'; '.css'='text/css'; '.js'='application/javascript'; '.csv'='text/csv'; '.json'='application/json'; '.png'='image/png'; '.svg'='image/svg+xml' }
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($path -eq '') { $path = 'index.html' }
  $file = Join-Path $root $path
  if ((Test-Path $file -PathType Leaf) -and ([IO.Path]::GetFullPath($file).StartsWith($root))) {
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $ctx.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
    $bytes = [IO.File]::ReadAllBytes($file)
    $ctx.Response.ContentLength64 = $bytes.Length
    if ($ctx.Request.HttpMethod -ne 'HEAD') { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) }
  } else {
    $ctx.Response.StatusCode = 404
  }
  $ctx.Response.Close()
}
