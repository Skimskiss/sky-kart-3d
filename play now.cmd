@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Sky Kart 3D
cd /d "%~dp0"

echo.
echo  ==========================================
echo    SKY KART 3D: ISLAND GRAND PRIX
echo  ==========================================
echo.

rem ---- Node.js is needed to run the game ----
where node >nul 2>nul
if errorlevel 1 goto no_node
call node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)" >nul 2>nul
if errorlevel 1 goto old_node

rem ---- first run: install the game's libraries ----
if not exist "node_modules\vite\package.json" goto install
rem  (the QR code library arrived later: fetch it if it is missing, but carry on without it if that fails)
if not exist "node_modules\qrcode-terminal\package.json" goto install_soft
goto build

:install
echo  First run: installing the game's libraries. This can take a minute or two...
echo.
call npm install
if errorlevel 1 goto install_failed
goto build

:install_soft
echo  Adding the phone QR code library...
call npm install >nul 2>nul

:build
rem ---- build the latest version of the game (a few seconds) ----
echo  Building the game...
call npm run build > "%TEMP%\skykart-build.log" 2>&1
if errorlevel 1 goto build_failed

rem ---- serve it on this PC and on your Wi-Fi (so a phone can play too) ----
rem  "play now.cmd --no-open" starts the game without opening a browser tab
call node scripts/play.mjs %*
echo.
echo  The game has stopped.
pause
exit /b 0

:no_node
echo  Node.js was not found on this computer.
echo.
echo  Install it from https://nodejs.org (choose the LTS version), then
echo  double-click "play now.cmd" again.
echo.
pause
exit /b 1

:old_node
echo  Your Node.js is too old. The game needs version 18 or newer.
echo.
echo  Install the current LTS version from https://nodejs.org, then
echo  double-click "play now.cmd" again.
echo.
pause
exit /b 1

:install_failed
echo.
echo  Could not install the game's libraries. Check your internet
echo  connection and try again.
echo.
pause
exit /b 1

:build_failed
echo.
echo  The game could not be built. Details:
echo.
type "%TEMP%\skykart-build.log"
echo.
pause
exit /b 1
