@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bu proje icin Node.js gerekli. https://nodejs.org adresinden kurabilirsiniz.
  pause
  exit /b 1
)
node launch.mjs
pause
