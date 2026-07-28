import express from 'express';
import session from 'express-session';
import path from 'path';
import http from 'http'; // Adicionado para suportar WebSockets
import { WebSocketServer } from 'ws'; // Adicionado do SentryMap
import { fileURLToPath } from 'url';

// =======================================================================
// IMPORTAÇÕES DAS ROTAS DO SISTEMA PRINCIPAL
// =======================================================================
import authRoutes from './routes/authRoutes.js';
import medidasRoutes from './routes/medidasRoutes.js';
import governancaRoutes from './routes/governancaRoutes.js';
import gestaoLogRoutes from './routes/gestaoLogRoutes.js';

// =======================================================================
// IMPORTAÇÕES DO MÓDULO SENTRYMAP (MONITORAMENTO)
// =======================================================================
import pool from "./config/gov_corp_pages_mon_db.js"; 
import mapasRoutes from "./routes/mapasRoutes.js";
import iaRoutes from "./routes/iaRoutes.js";
import watchdogRoutes, { ligarWatchdogFlutuante } from "./routes/watchdogRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// CRIANDO O SERVIDOR HTTP (Necessário para juntar Express e WebSockets)
const server = http.createServer(app); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================================================================
// FILTRO DE LIMPEZA PARA O IISNODE 
// =======================================================================
app.use((req, res, next) => {
    if (req.url.includes('/server/iis_start.cjs')) {
        req.url = req.url.replace('/server/iis_start.cjs', '');
    }
    if (req.url.includes('/iis_start.cjs')) {
        req.url = req.url.replace('/iis_start.cjs', '');
    }
    if (req.url.includes('/GovCorp')) {
        req.url = req.url.replace('/GovCorp', '');
    }
    if (req.url === '') req.url = '/';
    next();
});

// =======================================================================
// DESTRANCANDO AS PASTAS DO FRONT-END (HTML, CSS, JS, IMAGENS)
// =======================================================================
app.use('/src', express.static(path.join(__dirname, '../src')));
app.use('/pages_login', express.static(path.join(__dirname, '../pages_login')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Configuração de sessão
app.use(session({
    secret: 'CHAVE_SUPER_SECRETA_SISTEMA_MEDIDAS_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, 
        maxAge: 1000 * 60 * 60 * 24 
    }
}));

// =======================================================================
// GERENCIADOR DE TRANSMISSÃO TEMPO REAL (WEBSOCKETS - SENTRYMAP)
// =======================================================================
const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

wss.on("connection", async (ws) => {
    clients.add(ws);
    try {
        const [rows] = await pool.query(`SELECT c.*, d.ip_rede_local as ip FROM cameras c JOIN dvrs d ON c.dvr_id = d.id`);
        ws.send(JSON.stringify({ type: "INIT", cameras: rows }));
    } catch (err) {
        console.error("Erro no handshake inicial do WebSocket:", err);
    }

    ws.on("message", (data) => {
        try {
            const msg = JSON.parse(data);
            broadcast(msg);
        } catch (e) {
            console.error("Erro ao processar mensagem do WebSocket", e);
        }
    });

    ws.on("close", () => clients.delete(ws));
});

function broadcast(msg) {
    const payload = JSON.stringify(msg);
    clients.forEach((client) => {
        if (client.readyState === 1) client.send(payload);
    });
}

// MIDDLEWARE CRÍTICO: Injeta o broadcast nas rotas HTTP do Express
app.use((req, res, next) => {
    req.broadcast = broadcast;
    next();
});

// =======================================================================
// LIGA AS ROTAS DE BACKEND (SISTEMA PRINCIPAL + SENTRYMAP)
// =======================================================================
// Principal
app.use('/api/auth', authRoutes);
app.use('/api/medidas', medidasRoutes);
app.use('/api/governanca', governancaRoutes);
app.use('/api/gestao-log', gestaoLogRoutes);

// SentryMap
app.use("/api", mapasRoutes);
app.use("/api/ia", iaRoutes);
app.use("/api", watchdogRoutes);

// =======================================================================
// ROTA 404 (SEMPRE POR ÚLTIMO)
// =======================================================================
app.use((req, res) => {
    res.status(404).json({ sucesso: false, erro: "Rota ou arquivo não encontrado no servidor." });
});

app.use((err, req, res, next) => {
    console.error("🔥 ERRO GLOBAL:", err);
    res.status(500).json({ error: "Erro critico no servidor", detalhes: err.message });
});

 

// =======================================================================
// CONEXÃO DO WEBSOCKET COM O SERVIDOR HTTP
// =======================================================================
server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
    });
});

// =======================================================================
// INICIANDO O SERVIDOR UNIFICADO NO IISNODE
// =======================================================================
const PORT = process.env.PORT || 3002;

// ATENÇÃO: Mudamos app.listen para server.listen!
server.listen(PORT, () => {
    console.log(`======================================================`);
    console.log(`✅ SERVIDOR PRINCIPAL UNIFICADO RODANDO VIA IISNODE`);
    console.log(`📡 Porta: ${PORT} | WebSockets: Habilitado`);
    console.log(`======================================================`);
    
    // 🔥 AUTOMAÇÃO CENTRAL: Inicia o Watchdog Python sozinho
    console.log("🐺 Automação: Disparando Cão de Guarda de IPs (Watchdog)...");
    ligarWatchdogFlutuante();
});