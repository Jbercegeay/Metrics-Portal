$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "Server running on http://localhost:8080/"

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath
    
    $basedir = "c:\Users\Johnny.Bercegeay\Documents\Antigravity PL Portal"
    
    if ($path -eq "/" -or $path -eq "/index.html") {
        $file = Join-Path $basedir "PL Test Portal ex.html"
    } else {
        $file = Join-Path $basedir ($path.TrimStart("/"))
    }
    
    if (Test-Path $file) {
        $content = [System.IO.File]::ReadAllBytes($file)
        $ctx.Response.ContentType = "text/html; charset=utf-8"
        $ctx.Response.ContentLength64 = $content.Length
        $ctx.Response.OutputStream.Write($content, 0, $content.Length)
    } else {
        $ctx.Response.StatusCode = 404
    }
    
    $ctx.Response.Close()
}
