$logFile = "$env:LOCALAPPDATA\cloudflared\tunnel.log"
$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$date] Starting cloudflared tunnel..." | Out-File $logFile -Encoding utf8
& "$env:LOCALAPPDATA\cloudflared\cloudflared.exe" tunnel --url http://localhost:5000 2>>$logFile
