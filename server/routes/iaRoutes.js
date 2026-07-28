import express from "express";
import pool from "../config/gov_corp_pages_mon_db.js";

const router = express.Router();

// O Python chamará este endpoint sempre que detectar um rosto
router.post("/face-detect", async (req, res) => {
  const { camera_id, pessoa_id, nome_identificado, confianca, foto_capturada, tipo_alerta } = req.body;

  try {
    // 1. Salva o registro no banco de dados (Tabela logs_acesso)
    const [result] = await pool.query(
      `INSERT INTO logs_acesso (camera_id, pessoa_id, nome_identificado, confianca, foto_capturada, tipo_alerta)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [camera_id, pessoa_id || null, nome_identificado, confianca, foto_capturada, tipo_alerta || 'DESCONHECIDO']
    );

    // 2. Busca o nome da câmera para o alerta ficar nítido na tela
    const [cams] = await pool.query("SELECT nome FROM cameras WHERE id = ?", [camera_id]);
    const cameraNome = cams.length > 0 ? cams[0].nome : "Câmera Desconhecida";

    // 3. Monta o pacote para enviar em tempo real pro Frontend
    const wsPayload = {
      type: "FACE_DETECTED",
      id: result.insertId,
      cameraNome: cameraNome,
      pessoaNome: nome_identificado,
      confianca: confianca,
      tipo: tipo_alerta, 
      fotoUrl: foto_capturada, 
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour12: false })
    };

    // 4. Dispara a notificação para todos os painéis abertos
    if (req.broadcast) {
      req.broadcast(wsPayload);
    }

    res.status(200).json({ success: true, log_id: result.insertId });
  } catch (err) {
    console.error("Erro ao salvar log da IA:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

export default router;