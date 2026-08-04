param([string]$ExePath = 'dist\KlyroSC-Setup-2.0.0.exe', [string]$OutPng = "$env:TEMP\bootstrap-real.png", [int]$WaitSec = 5)

$p = Start-Process $ExePath -PassThru
Start-Sleep -Seconds $WaitSec

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public struct KRC { public int L, T, R, B; }
public class KWP {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out KRC r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
}
'@
Add-Type -AssemblyName System.Drawing

$proc = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
if (-not $proc -or $proc.MainWindowHandle -eq 0) { Write-Output 'no window'; exit 1 }

$r = New-Object KRC
[KWP]::GetWindowRect($proc.MainWindowHandle, [ref]$r) | Out-Null
$w = $r.R - $r.L
$h = $r.B - $r.T
$b = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($b)
$dc = $g.GetHdc()
[KWP]::PrintWindow($proc.MainWindowHandle, $dc, 3) | Out-Null
$g.ReleaseHdc($dc)
$b.Save($OutPng)
Write-Output "captured ${w}x${h} -> $OutPng"
