param(
  [Parameter(Mandatory = $true)]
  [string]$FlutterProject
)

$ErrorActionPreference = 'Stop'
$FlutterProject = (Resolve-Path -LiteralPath $FlutterProject).Path
$mainWeb = Join-Path $FlutterProject 'lib\main_web.dart'
if (-not (Test-Path -LiteralPath $mainWeb)) {
  throw "Non trovo lib\main_web.dart in $FlutterProject"
}

Push-Location $FlutterProject
try {
  flutter pub get
  if ($LASTEXITCODE -ne 0) { throw 'flutter pub get non riuscito.' }

  flutter build web --release -t lib/main_web.dart --base-href /privato/split-with-dan/
  if ($LASTEXITCODE -ne 0) { throw 'flutter build web non riuscito.' }
} finally {
  Pop-Location
}

$build = Join-Path $FlutterProject 'build\web'
if (-not (Test-Path -LiteralPath (Join-Path $build 'main.dart.js'))) {
  throw "La compilazione non ha prodotto $build\main.dart.js"
}

$target = Join-Path $PSScriptRoot 'privato\split-with-dan'
New-Item -ItemType Directory -Force -Path $target | Out-Null
Get-ChildItem -LiteralPath $build -Force | Copy-Item -Destination $target -Recurse -Force

$index = Get-Content -Raw -LiteralPath (Join-Path $target 'index.html')
if ($index -notmatch '<base href="/privato/split-with-dan/">') {
  throw 'Il base href della build non corrisponde al percorso privato previsto.'
}

Write-Host "Pronto: $target"
Write-Host 'Apri GitHub Desktop, controlla i file aggiunti, poi Commit to main e Push origin.'
