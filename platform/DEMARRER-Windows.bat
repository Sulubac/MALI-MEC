@echo off
chcp 65001 >nul
title Djibouti Event Intelligence
cd /d "%~dp0"

echo ============================================================
echo   Djibouti Event Intelligence - Demarrage
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js n'est pas installe.
  echo     Telechargez-le ici : https://nodejs.org  ^(version LTS^)
  echo     Puis relancez ce fichier.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Premiere utilisation : installation des composants...
  call npm install
  if errorlevel 1 (
    echo [!] L'installation a echoue. Verifiez votre connexion internet.
    pause
    exit /b 1
  )
)

echo.
echo Demarrage du serveur... Le navigateur va s'ouvrir automatiquement.
echo Laissez cette fenetre ouverte pendant l'utilisation.
echo Pour arreter : fermez cette fenetre ou appuyez sur Ctrl + C.
echo.
call npm start
pause
