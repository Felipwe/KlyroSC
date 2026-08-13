<#
.SYNOPSIS
  Prepara uma pasta com 15 arquivos de assets para uso no Release do GitHub.

.DESCRIPTION
  Copia artefatos gerados em `dist/` (se existirem) para `release_assets\<version>`.
  Se não houver arquivos suficientes ou se `-CreatePlaceholders` for usado, cria placeholders
  para completar 15 arquivos com nomes sugeridos. Gera `checksums.txt` (SHA256) e um zip
  contendo todos os assets.

.PARAMETER Version
  Versão para usar no nome da pasta (ex: 2.16.3). Se ausente, tenta ler de package.json.

.PARAMETER DistPath
  Pasta de origem onde o `electron-builder` coloca os artefatos (default: ./dist).

.PARAMETER OutRoot
  Pasta raiz onde será criada a subpasta de assets (default: ./release_assets).

.PARAMETER CreatePlaceholders
  Força a criação de placeholders mesmo que existam arquivos em `DistPath`.

.EXAMPLE
  # Usar a versão do package.json e copiar dist
  .\scripts\make-release-assets.ps1

  # Criar placeholders para a versão específica
  .\scripts\make-release-assets.ps1 -Version 2.16.3 -CreatePlaceholders
#>

param(
  [string]$Version,
  [string]$DistPath = "dist",
  [string]$OutRoot = "release_assets",
  [switch]$CreatePlaceholders
)

Set-StrictMode -Version Latest

function Read-PackageVersion {
  $pkg = Join-Path $PSScriptRoot '..\package.json'
  if (Test-Path $pkg) {
    try {
      $json = Get-Content $pkg -Raw | ConvertFrom-Json
      return $json.version
    } catch { return $null }
  }
  return $null
}

if (-not $Version) {
  $Version = Read-PackageVersion
  if (-not $Version) {
    Write-Error "Versão não informada e não foi possível ler package.json. Use -Version <x.y.z>."
    exit 1
  }
}

$OutDir = Join-Path $OutRoot $Version
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

# Suggested asset filenames (adjust as needed)
$suggested = @(
  "KlyroSC-Setup-$Version.exe",
  "KlyroSC-$Version-full.zip",
  "KlyroSC-$Version-portable.zip",
  "KlyroSC-$Version-win-unpacked.zip",
  "KlyroSC-$Version-mac.dmg",
  "KlyroSC-$Version-mac.zip",
  "KlyroSC-$Version.AppImage",
  "KlyroSC-$Version-linux.tar.gz",
  "KlyroSC-$Version-setup.7z",
  "KlyroSC-$Version-checksums.txt",
  "KlyroSC-$Version-theme.zip",
  "KlyroSC-$Version-readme.txt",
  "KlyroSC-$Version-changelog.txt",
  "KlyroSC-$Version-portable-installer.exe",
  "KlyroSC-$Version-notarization-info.txt"
)

Write-Host "Preparing release assets for version $Version into $OutDir"

$copied = 0
if (-not $CreatePlaceholders -and (Test-Path $DistPath)) {
  Write-Host "Copying files from $DistPath..."
  try {
    Get-ChildItem -Path $DistPath -File -Recurse | ForEach-Object {
      $dest = Join-Path $OutDir $_.Name
      Copy-Item -Path $_.FullName -Destination $dest -Force
      $copied++
    }
  } catch {
    Write-Warning "Erro ao copiar de $DistPath: $_"
  }
}

if ($CreatePlaceholders -or $copied -lt 15) {
  Write-Host "Creating placeholders to reach 15 assets..."
  for ($i = 0; $i -lt 15; $i++) {
    $name = $suggested[$i]
    $path = Join-Path $OutDir $name
    if (-not (Test-Path $path)) {
      "Placeholder for $name - generated on $(Get-Date -Format o)" | Out-File -FilePath $path -Encoding UTF8
    }
  }
}

# Ensure at least the suggested filenames exist (do not overwrite existing files)
for ($i = 0; $i -lt $suggested.Count; $i++) {
  $p = Join-Path $OutDir $suggested[$i]
  if (-not (Test-Path $p)) {
    "Placeholder for $($suggested[$i])" | Out-File -FilePath $p -Encoding UTF8
  }
}

# Generate checksums (SHA256) for all files except checksums.txt itself
$files = Get-ChildItem -Path $OutDir -File | Where-Object { $_.Name -notmatch 'checksums' }
$checksumLines = @()
foreach ($f in $files) {
  $h = Get-FileHash -Algorithm SHA256 $f.FullName
  $checksumLines += "{0}  {1}" -f $h.Hash, $f.Name
}

$checksumFile = Join-Path $OutDir "checksums.txt"
$checksumLines | Out-File -FilePath $checksumFile -Encoding UTF8

Write-Host "Generated checksums.txt with $($checksumLines.Count) entries."

# Create a zip archive of the folder
$zipName = Join-Path $OutRoot "KlyroSC-$Version-assets.zip"
if (Test-Path $zipName) { Remove-Item $zipName -Force }
Compress-Archive -Path (Join-Path $OutDir '*') -DestinationPath $zipName -Force

Write-Host "Created zip: $zipName"

Write-Host "Assets prepared in: $OutDir"
Get-ChildItem -Path $OutDir | Select-Object Name,Length | Format-Table

Write-Host "Done. Upload the files in $OutDir to your GitHub Release (drag & drop) or use the 'gh' CLI to upload the zip or individual files."
