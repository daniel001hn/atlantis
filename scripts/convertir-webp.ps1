$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $PSScriptRoot
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$fotos = @(
  "beach-house", "coffee-corner", "habitacion", "kit-playa", "lancetilla",
  "loft", "masajes", "piscina-atardecer", "planta-electrica", "punta-sal",
  "tienda", "townhouse", "ubicacion-playa"
)

foreach ($nombre in $fotos) {
  $captura = Join-Path $env:TEMP ("atlantis-webp-" + $nombre + ".html")
  $url = "file:///C:/Users/ALIENWARE/Documents/atlantis/scripts/convertir-webp.html?foto=" + $nombre
  $args = @(
    "--headless=new", "--disable-gpu", "--no-first-run", "--allow-file-access-from-files",
    "--virtual-time-budget=20000", "--dump-dom", $url
  )
  $proceso = Start-Process -FilePath $edge -ArgumentList $args -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $captura
  $html = [System.IO.File]::ReadAllText($captura)
  $match = [regex]::Match($html, 'data:image/webp;base64,([^<]+)')
  if (-not $match.Success) { throw "Edge no devolvio WebP para $nombre" }
  $destino = Join-Path $raiz ("fotos\" + $nombre + ".webp")
  [System.IO.File]::WriteAllBytes($destino, [Convert]::FromBase64String($match.Groups[1].Value))
  Remove-Item -LiteralPath $captura -Force
  Write-Host ("  " + $nombre + ".webp")
}
