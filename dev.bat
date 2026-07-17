@echo off
title Personal Flight Log - Dev Mode

echo ========================================
echo  Matando procesos viejos...
echo ========================================
taskkill /f /im node.exe 2>nul
taskkill /f /im cloudflared.exe 2>nul
timeout /t 2 /nobreak >nul

echo ========================================
echo  Iniciando servidor (npm run dev)...
echo ========================================
start "Vite + Server" cmd /c "npm run dev"

echo Esperando 5 segundos para que arranque...
timeout /t 5 /nobreak >nul

echo ========================================
echo  Iniciando tunnel Cloudflare...
echo ========================================
echo URL del tunnel aparecera abajo.
echo ========================================
echo.
cloudflared tunnel --no-autoupdate --protocol http2 --edge-ip-version 4 --url http://localhost:3000

pause
