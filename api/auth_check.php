<?php
session_start();

// Se não existir a sessão do usuário_id, significa que ele não fez login
if (!isset($_SESSION['usuario_id'])) {
    // Chuta o usuário de volta para a tela inicial
    header("Location: ../index.html");
    exit;
}

// Função para verificar rapidamente se o cara é admin nas páginas internas
function isAdmin() {
    return isset($_SESSION['usuario_perfil']) && $_SESSION['usuario_perfil'] === 'admin';
}
?>