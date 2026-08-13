@echo off
cd /d C:\Users\Administrador\Downloads\copy-of-fonoaudio-pro-ai
start "Backend" cmd /k "npx tsx fonoaudio-server.js"
timeout /t 3
start "Frontend" cmd /k "npx vite --host 0.0.0.0 --port 3002"
echo Both servers starting...
