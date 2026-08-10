@echo off
echo ========================================
echo  FonoAudio-Pro AI - Deploy Modal v4
echo ========================================
echo.

echo Configurando token de Modal...
modal token set --token-id ak-quko3cOaFkuL6U23qxu0GP --token-secret as-0A6SVHTxM8UXNLlFcbf2uo

echo.
echo Desplegando endpoint en Modal...
modal deploy modal_comfyui.py

echo.
echo ========================================
echo  Deploy completado!
echo ========================================
echo.
echo Tu endpoint estara disponible en:
echo https://TU_USUARIO--fonoaudio-comfyui-v4-entrypoint.modal.run
echo.
echo Actualiza VITE_MODAL_ENDPOINT en .env.local con tu nuevo endpoint
echo.
pause
