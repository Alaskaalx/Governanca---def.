import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import {
  fileURLToPath
} from "url";
import pool from "../config/gov_corp_pages_mon_db.js";

const router = express.Router();

const __filename = fileURLToPath(
  import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CONFIGURAÇÃO DO MULTER
// ==========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const filial = (req.body.filial || "Sem_Filial").replace(/[^a-zA-Z0-9]/g, "_");
    const ip = (req.body.ip_rede_local || "0.0.0.0").replace(/\./g, "_");

    const dir = `C:\\inetpub\\wwwroot\\GovCorp\\src\\components\\page_painel_monitoramento\\html\\server\\static\\uploads\\mapas\\${filial}\\${ip}`;

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {
          recursive: true
        });
      }
      cb(null, dir);
    } catch (err) {
      console.error("❌ Erro de permissão do IIS ao criar pasta:", err);
      cb(err, dir);
    }
  },
  filename: (req, file, cb) => {
    const dataAtual = new Date().toISOString().split('T')[0];
    const nomeLimpo = file.originalname.replace(/\s+/g, "_");
    cb(null, `${dataAtual}-${Date.now()}-${nomeLimpo}`);
  }
});

const upload = multer({
  storage
});

// ==========================================
// NÍVEL 1: ENGENHARIA DE DVR (CADASTRO MESTRE & ACÇÕES)
// ==========================================

// Super Rota com "Escudo" contra erro de pasta do Windows
router.post("/dvrs-completo", (req, res, next) => {
  upload.single("blueprint")(req, res, (err) => {
    if (err) {
      console.error("Erro no Upload Multer:", err);
      return res.status(500).json({
        error: "O IIS não tem permissão para salvar imagens na pasta 'uploads'. Altere a segurança da pasta no Windows!"
      });
    }
    next();
  });
}, async (req, res) => {
  const {
    filial,
    nome,
    ip_rede_local,
    marca_dvr,
    usuario,
    senha,
    qtd_cameras,
    sem_mapa
  } = req.body;

  const porta_rtsp = marca_dvr === "geovision" ? 8554 : 554;
  const porta_servico = 8000;

  try {
    const [resultDvr] = await pool.query(
      `INSERT INTO dvrs (filial, nome, ip_rede_local, porta_servico, porta_rtsp, usuario, senha) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [filial, nome, ip_rede_local, porta_servico, porta_rtsp, usuario, senha]
    );
    const dvrId = resultDvr.insertId;

    if (sem_mapa !== "true" && req.file) {
      const filialLimpa = filial.replace(/[^a-zA-Z0-9]/g, "_");
      const ipLimpo = ip_rede_local.replace(/\./g, "_");
      const filePath = `/src/components/page_painel_monitoramento/html/server/static/uploads/mapas/${filialLimpa}/${ipLimpo}/${req.file.filename}`;

      await pool.query(
        "INSERT INTO dvr_mapas (dvr_id, nome, arquivo_url, is_ativo) VALUES (?, ?, ?, 1)",
        [dvrId, "Planta Inicial (Cadastro Mestre)", filePath]
      );
    }

    const totalCameras = parseInt(qtd_cameras) || 0;
    for (let i = 1; i <= totalCameras; i++) {
      const camName = `${nome}_CH${i.toString().padStart(2, '0')}`;
      const rtsp = `rtsp://${usuario}:${senha}@${ip_rede_local}:${porta_rtsp}/ch${i}/stream`;

      await pool.query(
        "INSERT INTO cameras (dvr_id, nome, canal_dvr, rtsp_url) VALUES (?, ?, ?, ?)",
        [dvrId, camName, i, rtsp]
      );
    }

    if (req.broadcast) {
      const [cams] = await pool.query(`SELECT c.*, d.ip_rede_local as ip FROM cameras c JOIN dvrs d ON c.dvr_id = d.id`);
      req.broadcast({
        type: "INIT",
        cameras: cams
      });
    }

    res.status(201).json({
      success: true,
      dvrId
    });
  } catch (err) {
    console.error("❌ Erro fatal no /dvrs-completo:", err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        error: "O Nome ou o IP deste DVR já estão cadastrados no sistema!"
      });
    }
    res.status(500).json({
      error: `Erro SQL/Interno: ${err.message}`
    });
  }
});

router.get("/dvrs", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM dvrs");
    res.json(rows);
  } catch (err) {
    res.status(500).json({
      error: "Erro ao listar DVRs."
    });
  }
});

router.delete("/dvrs/:id", async (req, res) => {
  const {
    id
  } = req.params;
  try {
    const [result] = await pool.query("DELETE FROM dvrs WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({
      error: "DVR não encontrado."
    });
    if (req.broadcast) {
      const [cams] = await pool.query(`SELECT c.*, d.ip_rede_local as ip FROM cameras c JOIN dvrs d ON c.dvr_id = d.id`);
      req.broadcast({
        type: "INIT",
        cameras: cams
      });
    }
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: "Erro ao remover DVR do sistema."
    });
  }
});

// ==========================================
// ROTA PARA EDITAR DVR EXISTENTE (FALTAVA ESSA!)
// ==========================================
router.put("/dvrs/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, filial, ip_rede_local, usuario, senha } = req.body;
  
  try {
    // Atualiza os dados no banco
    await pool.query(
      `UPDATE dvrs SET nome = ?, filial = ?, ip_rede_local = ?, usuario = ?, senha = ? WHERE id = ?`,
      [nome, filial, ip_rede_local, usuario, senha, id]
    );
    
    // Busca os dados atualizados para devolver ao painel
    const [rows] = await pool.query("SELECT * FROM dvrs WHERE id = ?", [id]);
    
    // Atualiza o painel de todo mundo em tempo real (já que o IP ou nome pode ter mudado)
    if (req.broadcast) {
        const [cams] = await pool.query(`SELECT c.*, d.ip_rede_local as ip FROM cameras c JOIN dvrs d ON c.dvr_id = d.id`);
        req.broadcast({ type: "INIT", cameras: cams });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Erro ao editar DVR:", err.message);
    res.status(500).json({ error: "Erro ao atualizar dados do DVR no banco." });
  }
});

router.get("/dvrs/:id/mapas", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM dvr_mapas WHERE dvr_id = ? ORDER BY created_at DESC", [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({
      error: "Erro ao buscar histórico de mapas."
    });
  }
});

router.post("/dvrs/:id/mapas", (req, res, next) => {
  upload.single("blueprint")(req, res, (err) => {
    if (err) return res.status(500).json({
      error: "Sem permissão na pasta uploads no Windows."
    });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({
    error: "Arquivo ausente."
  });
  const {
    id
  } = req.params;
  const nomeMapa = req.body.nome || `Atualização ${new Date().toLocaleDateString('pt-BR')}`;
  try {
    const [dvrs] = await pool.query("SELECT filial, ip_rede_local FROM dvrs WHERE id = ?", [id]);
    if (dvrs.length === 0) return res.status(404).json({
      error: "DVR pai inexistente."
    });

    const filialLimpa = dvrs[0].filial.replace(/[^a-zA-Z0-9]/g, "_");
    const ipLimpo = dvrs[0].ip_rede_local.replace(/\./g, "_");
    const filePath = `/server/static/uploads/mapas/${filialLimpa}/${ipLimpo}/${req.file.filename}`;

    const [result] = await pool.query(
      "INSERT INTO dvr_mapas (dvr_id, nome, arquivo_url, is_ativo) VALUES (?, ?, ?, ?)",
      [id, nomeMapa, filePath, 0]
    );
    res.status(201).json({
      id: result.insertId,
      nome: nomeMapa,
      arquivo_url: filePath,
      is_ativo: 0
    });
  } catch (err) {
    res.status(500).json({
      error: "Erro ao indexar novo mapa."
    });
  }
});

router.put("/mapas/:id/ativar", async (req, res) => {
  const {
    id
  } = req.params;
  const {
    dvr_id
  } = req.body;
  try {
    await pool.query("UPDATE dvr_mapas SET is_ativo = 0 WHERE dvr_id = ?", [dvr_id]);
    await pool.query("UPDATE dvr_mapas SET is_ativo = 1 WHERE id = ?", [id]);
    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: "Falha ao chavear ativação do mapa."
    });
  }
});

router.get("/cameras", async (req, res) => {
  try {
    const query = `SELECT c.*, d.ip_rede_local as ip FROM cameras c JOIN dvrs d ON c.dvr_id = d.id`;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({
      error: "Erro ao carregar malha de câmeras."
    });
  }
});

router.put("/cameras/:id/position", async (req, res) => {
  const {
    id
  } = req.params;
  const {
    posX,
    posY
  } = req.body;
  try {
    await pool.query(`UPDATE cameras SET pos_x = ?, pos_y = ? WHERE id = ?`, [posX, posY, id]);
    const [rows] = await pool.query(`SELECT c.*, d.ip_rede_local as ip FROM cameras c JOIN dvrs d ON c.dvr_id = d.id WHERE c.id = ?`, [id]);
    if (req.broadcast) req.broadcast({
      type: "CAMERA_UPDATED",
      data: rows[0]
    });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({
      error: "Erro ao fixar posição da câmera."
    });
  }
});

router.put("/cameras/:id/remove-map", async (req, res) => {
  const {
    id
  } = req.params;
  try {
    await pool.query(`UPDATE cameras SET pos_x = 0, pos_y = 0 WHERE id = ?`, [id]);
    const [rows] = await pool.query(`SELECT c.*, d.ip_rede_local as ip FROM cameras c JOIN dvrs d ON c.dvr_id = d.id WHERE c.id = ?`, [id]);
    if (req.broadcast) req.broadcast({
      type: "CAMERA_UPDATED",
      data: rows[0]
    });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({
      error: "Erro ao desancorar câmera."
    });
  }
});

export default router;