import express from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

// Mapeamento de caminhos para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Variável global para segurar a instância do processo Python (Padrão Singleton)
let watchdogInstance = null;

/**
 * Função Mestre que inicializa o script Python em background
 */
export function ligarWatchdogFlutuante() {
  if (watchdogInstance) {
    console.log("⚠️ SentryMap Watchdog já está rodando em background.");
    return { success: false, message: "Watchdog já está ativo." };
  }

  // Descobre o caminho da pasta /python/watchdog.py recuando uma pasta antes de /routes
  const scriptPythonPath = path.join(__dirname, "..", "python", "watchdog.py");
  
  // =========================================================================
  // CORREÇÃO DO IIS (ENOENT): Defina o caminho absoluto do Python no Servidor
  // =========================================================================
  // Verifique no seu Windows Server onde o Python foi instalado. 
  // Caminhos comuns: "C:\\Program Files\\Python311\\python.exe" ou "C:\\Python39\\python.exe"
  // Se você já arrumou nas variáveis de ambiente do Windows, pode voltar para "python"
  const caminhoPython = process.env.PYTHON_PATH || "C:\\Program Files\\Python313";

  console.log(` Disparando processo Python usando: ${caminhoPython}`);
  console.log(` Script alvo: ${scriptPythonPath}`);

  // Executa o Python forçando a codificação UTF-8 para aceitar Emojis no Windows
  watchdogInstance = spawn(caminhoPython, ["-u", scriptPythonPath], {
    env: { ...process.env, PYTHONIOENCODING: "utf-8" }
  });

  // =========================================================================
  // PROTEÇÃO CONTRA QUEDA (Impede o "spawn python ENOENT" de matar o Node)
  // =========================================================================
  watchdogInstance.on("error", (err) => {
    console.error(` [ERRO CRÍTICO]: O Windows/IIS não conseguiu iniciar o Python.`);
    console.error(`Motivo: ${err.message}`);
    console.error(`Verifique se o caminho está correto: ${caminhoPython}`);
    watchdogInstance = null; // Reseta a variável para não travar o sistema
  });

  // Captura as mensagens normais (print) do terminal do Python
  watchdogInstance.stdout.on("data", (data) => {
    console.log(`[Python Watchdog]: ${data.toString().trim()}`);
  });

  // Captura erros se o script Python quebrar ou falhar
  watchdogInstance.stderr.on("data", (data) => {
    console.error(` [Erro no Script Python]: ${data.toString().trim()}`);
  });

  // Monitora se o processo foi fechado por algum motivo
  watchdogInstance.on("close", (code) => {
    // Se o código for null, provavelmente deu erro no "spawn" (tratado acima)
    if (code !== null) {
        console.log(` Processo do Watchdog Python finalizado (Código de saída: ${code})`);
    }
    watchdogInstance = null; // Libera a memória para poder ser restartado
  });

  return { success: true, message: "Tentativa de ativar o Watchdog enviada com sucesso." };
}

// ==========================================
// ROTAS HTTP DE CONTROLE (Para uso do Site)
// ==========================================

// Rota para ativar manualmente pelo site (caso tenha caído)
router.post("/watchdog/ativar", (req, res) => {
  const resultado = ligarWatchdogFlutuante();
  if (resultado.success) {
    res.json(resultado);
  } else {
    res.status(400).json(resultado);
  }
});

// Rota para o painel do site consultar se o Cão de Guarda está vivo ou morto
router.get("/watchdog/status", (req, res) => {
  res.json({
    online: watchdogInstance !== null,
    message: watchdogInstance ? "O monitoramento por ping está ativo." : "O monitoramento por ping está desligado."
  });
});

export default router;