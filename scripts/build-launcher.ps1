$ErrorActionPreference = 'Stop'
$officeRoot = Split-Path -Parent $PSScriptRoot
$officeCompiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $officeCompiler)) {
    $officeCompiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework/v4.0.30319/csc.exe'
}
if (-not (Test-Path -LiteralPath $officeCompiler)) { throw 'C# compiler from .NET Framework 4.x is required on the build machine.' }
$officeExe = Join-Path $officeRoot 'AI Agent Office.exe'
& $officeCompiler /nologo /target:winexe /platform:anycpu /optimize+ "/out:$officeExe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll (Join-Path $officeRoot 'launcher/OfficeLauncher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
Write-Output "Launcher: $officeExe"
