# Deploy ComfyUI a Modal
# Ejecutar: python deploy_comfyui.py

import subprocess
import sys
import os

def check_modal_cli():
    """Verifica que Modal CLI esté instalado"""
    try:
        result = subprocess.run(["modal", "--version"], capture_output=True, text=True)
        print(f"Modal CLI: {result.stdout.strip()}")
        return True
    except FileNotFoundError:
        print("Error: Modal CLI no instalado")
        print("Instalar con: pip install modal")
        return False

def check_modal_token():
    """Verifica que Modal esté autenticado"""
    try:
        result = subprocess.run(["modal", "token", "--check"], capture_output=True, text=True)
        if result.returncode == 0:
            print("Modal autenticado ✓")
            return True
        else:
            print("Modal no autenticado")
            print("Ejecutar: modal token new")
            return False
    except Exception as e:
        print(f"Error verificando token: {e}")
        return False

def deploy():
    """Deploy ComfyUI a Modal"""
    print("\n=== Deploy ComfyUI a Modal ===\n")
    
    # Verificar prerequisitos
    if not check_modal_cli():
        sys.exit(1)
    
    if not check_modal_token():
        print("\nPara autenticarse:")
        print("1. Instalar modal: pip install modal")
        print("2. Crear cuenta en https://modal.com")
        print("3. Ejecutar: modal token new")
        sys.exit(1)
    
    print("\nDesplegando ComfyUI...")
    print("Esto puede tardar 5-10 minutos la primera vez\n")
    
    # Deploy
    result = subprocess.run(
        ["modal", "deploy", "modal_comfyui.py"],
        capture_output=True,
        text=True,
    )
    
    if result.returncode == 0:
        print("✓ Deploy exitoso!")
        print(f"\nEndpoints:")
        print(result.stdout)
        
        # Guardar endpoint
        print("\nGuardando configuración...")
        with open(".env.local", "w") as f:
            # Extraer URL del output
            for line in result.stdout.split("\n"):
                if "https://" in line:
                    url = line.strip().split()[-1]
                    f.write(f"VITE_MODAL_ENDPOINT={url}\n")
                    print(f"Endpoint guardado: {url}")
                    break
    else:
        print("✗ Error en deploy:")
        print(result.stderr)
        sys.exit(1)

if __name__ == "__main__":
    deploy()
