$envFile = Join-Path $PSScriptRoot '..\.env'
$port = 4001

if (Test-Path $envFile) {
  $portLine = Select-String -Path $envFile -Pattern '^PORT=(\d+)' | Select-Object -First 1
  if ($portLine -and $portLine.Matches[0].Groups[1].Value) {
    $port = [int]$portLine.Matches[0].Groups[1].Value
  }
}

$projectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

foreach ($connection in $connections) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)"
  if ($process.CommandLine -and $process.CommandLine.Contains($projectPath)) {
    Write-Host "Stopping stale server process $($process.ProcessId) on port $port"
    taskkill /PID $process.ProcessId /T /F | Out-Null
  } else {
    Write-Host "Port $port is already used by another process; it was not stopped."
  }
}