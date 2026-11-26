$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$dist = Join-Path $PSScriptRoot 'dist'
$unpacked = Join-Path $dist 'win-unpacked'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'O compilador do .NET Framework para Windows x64 não foi encontrado.' }

$argsBuilder = @('exec', '--', 'electron-builder', '--win', 'dir', '--x64', '--publish', 'never')
if ($env:FICHAS_ELECTRON_DIST) { $argsBuilder += '--config.electronDist=' + $env:FICHAS_ELECTRON_DIST }
& npm.cmd @argsBuilder
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$versao = (Get-Content package.json -Raw | ConvertFrom-Json).version
$executavel = Join-Path $dist "Fichas-Tecnicas-Setup-$versao.exe"
$payload = Join-Path $dist 'pacote-windows.zip'
try {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::CreateFromDirectory($unpacked, $payload, [IO.Compression.CompressionLevel]::Optimal, $false, [Text.Encoding]::UTF8)
  & $compiler /nologo /codepage:65001 /target:winexe /platform:x64 /optimize+ "/out:$executavel" /win32icon:app.ico "/resource:$payload,FichasTecnicas.Pacote" /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:Microsoft.CSharp.dll instalador.cs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Get-Item -LiteralPath $executavel
}
finally {
  Remove-Item -LiteralPath $payload -ErrorAction SilentlyContinue
}
