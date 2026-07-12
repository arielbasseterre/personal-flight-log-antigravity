@echo off
title Respaldo de Base de Datos - Supabase
echo ══════════════════════════════════════════════════════════
echo   Iniciando Respaldo de Base de Datos (Supabase)
echo ══════════════════════════════════════════════════════════
echo.

node "%~dp0backup.cjs"

echo.
echo ══════════════════════════════════════════════════════════
echo   Proceso finalizado.
echo ══════════════════════════════════════════════════════════
pause
