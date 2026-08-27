@echo off
setlocal
cd /d "%~dp0"
echo.
echo Starting Pratix Bridge...
echo Installing dependencies if required. This can take a moment on the first run.
call pnpm install
if errorlevel 1 (
  echo.
  echo pnpm could not be found or dependencies could not be installed.
  echo Install Node.js 22+ and pnpm, then run this file again.
  pause
  exit /b 1
)
start "Pratix Bridge" cmd /k "pnpm dev"
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000"
echo.
echo Pratix Bridge was opened in your browser. Keep the server window open while using the app.
pause
