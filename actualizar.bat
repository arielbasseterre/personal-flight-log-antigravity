@echo off
title Actualizar personal-flight-log desde GitHub
cd /d "%~dp0personal-flight-log"

:: 1. Desvincular la planilla local del git SIN borrarla (por si aun esta trackeada)
echo [1/3] Desvinculando 'planilla modelo tcp.xlsx' del git local...
git rm --cached "planilla modelo tcp.xlsx" 2>nul
if exist "planilla modelo tcp.xlsx" (
  echo   OK: el archivo sigue en disco.
) else (
  echo   AVISO: no se encontro el archivo en disco.
)

:: 2. Traer los cambios de GitHub
echo [2/3] Actualizando desde GitHub...
git pull origin main
if errorlevel 1 (
  echo ERROR: el pull fallo. Revisa si hay cambios locales sin commitear.
  pause
  exit /b 1
)

:: 3. Verificacion final
echo [3/3] Verificando...
git log --oneline -3
if exist "planilla modelo tcp.xlsx" (
  echo   La planilla sigue en el proyecto: OK.
) else (
  echo   La planilla NO esta en el proyecto. Copiala desde la otra PC.
)

echo.
echo Actualizacion completada.
pause