import express from 'express';
import { login } from '../controllers/authController.js';

const router = express.Router();

// Quando o frontend der um POST em /api/auth/login, a função login será executada
router.post('/login', login);

export default router;