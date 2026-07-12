@echo off
title Asistente de Restauración - Supabase
echo ══════════════════════════════════════════════════════════
echo   Asistente de Restauración de Base de Datos (Supabase)
echo ══════════════════════════════════════════════════════════
echo.

node "%~dp0restore.cjs"

echo.
echo ══════════════════════════════════════════════════════════
echo   Proceso finalizado.
echo ══════════════════════════════════════════════════════════
pause
