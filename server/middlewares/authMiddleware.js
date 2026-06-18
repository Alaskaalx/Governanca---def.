// Substitui o if (!isset($_SESSION['usuario_id']))
export const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.usuario_id) {
        return next(); // Usuário logado, deixa passar para a próxima função
    }
    // Chuta o usuário devolvendo um erro 401 (Não Autorizado)
    return res.status(401).json({ erro: 'Não autorizado. Redirecionar para login.' });
};

// Substitui a function isAdmin()
export const isAdmin = (req, res, next) => {
    if (req.session && req.session.usuario_perfil === 'admin') {
        return next(); // É admin, deixa passar
    }
    return res.status(403).json({ erro: 'Acesso restrito apenas para administradores.' });
};
