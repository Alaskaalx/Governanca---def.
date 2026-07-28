import time
import json
import subprocess
import platform
import re
import mysql.connector
from websocket import create_connection

# ==========================================
# 1. COMUNICAÇÃO COM O MYSQL
# ==========================================
def conectar_banco():
    return mysql.connector.connect(
        host="127.0.0.1",
        user="admin",
        password="2LKQ8GkG4fEG",
        database="gov_corp_pages_mon_db"
    )

# ==========================================
# 2. PING NATIVO (À PROVA DE FALHAS/WINDOWS)
# ==========================================
def ping_nativo(ip):
    """
    Usa o comando ping do próprio sistema operacional (Windows/Linux).
    Não precisa de permissão de Administrador e é 100% preciso.
    """
    sistema = platform.system().lower()
    
    if sistema == "windows":
        # Comando: ping -n 1 -w 1000 192.168.1.1 (1 tentativa, 1 segundo limite)
        comando = ["ping", "-n", "1", "-w", "1000", ip]
    else:
        # Comando Linux
        comando = ["ping", "-c", "1", "-W", "1", ip]
        
    try:
        # Roda o comando em background escondido
        resultado = subprocess.run(comando, capture_output=True, text=True)
        saida = resultado.stdout.lower()
        
        # Se tiver 'ttl=' na resposta, o equipamento está vivo!
        if "ttl=" in saida:
            # Pega os milissegundos (funciona para Windows em Pt-BR 'tempo=' ou Inglês 'time=')
            match = re.search(r'(tempo|time)[=<](\d+)ms', saida)
            tempo_ms = f"{match.group(2)}ms" if match else "<1ms"
            return True, tempo_ms
            
        return False, "Falha"
    except Exception:
        return False, "Falha"

# ==========================================
# 3. FLUXO DE PING EM TEMPO REAL
# ==========================================
def iniciar_watchdog_realtime():
    print("🚀 SentryMap Watchdog Nativo Iniciado!")

    # Tenta conectar ao WebSocket do Node.js
    ws = None
    try:
        # Usa o IP da máquina e a rota /api/ws que o web.config liberou
        ws = create_connection("ws://10.201.2.51/api/ws")
        print("✅ Conectado ao Painel (WebSocket) com sucesso!\n")
    except Exception as e:
        print(f"⚠️ Aviso: Falha ao conectar no WebSocket do IIS ({e}). Vou salvar apenas no Banco de Dados.\n")

    while True:
        try:
            conn = conectar_banco()
            cursor = conn.cursor(dictionary=True)

            cursor.execute("""
                SELECT c.id as camera_id, c.nome, d.ip_rede_local as ip 
                FROM cameras c 
                JOIN dvrs d ON c.dvr_id = d.id
            """)
            cameras = cursor.fetchall()

            if not cameras:
                print("⏳ Nenhuma câmera cadastrada no banco. Aguardando...")

            for cam in cameras:
                cam_id = cam['camera_id']
                nome = cam['nome']
                ip = cam['ip']

                # ⚡ PING NATIVO
                is_online, tempo_ms = ping_nativo(ip)

                if is_online:
                    status = "ONLINE"
                    is_online_db = 1
                    print(f"🟢 {nome} ({ip}) -> {tempo_ms}")
                else:
                    status = "OFFLINE"
                    is_online_db = 0
                    print(f"🔴 {nome} ({ip}) -> OFFLINE")

                # Salva no Banco
                cursor.execute("UPDATE cameras SET is_online=%s, last_ping_at=NOW() WHERE id=%s", (is_online_db, cam_id))
                conn.commit()

                # Envia para a Tela
                if ws:
                    try:
                        ws.send(json.dumps({
                            "type": "WATCHDOG_ALERT",
                            "cameraId": cam_id,
                            "nome": nome,
                            "status": status,
                            "lastPing": tempo_ms
                        }))
                    except Exception:
                        pass # Ignora se o navegador foi fechado

            cursor.close()
            conn.close()

        except Exception as e:
            print(f"Erro no ciclo do banco/rede: {e}")

        # Respiro de 3 segundos para varrer novamente
        time.sleep(3)

if __name__ == "__main__":
    iniciar_watchdog_realtime()