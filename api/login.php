<?php
session_start();
header('Content-Type: application/json');

// Conexão com o NOVO banco focado APENAS em senhas
$host = 'localhost';
$dbname = 'gov_corp_senhas_db';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(["sucesso" => false, "mensagem" => "Erro de conexão com o servidor de senhas."]);
    exit;
}

$dados = json_decode(file_get_contents("php://input"), true);
$username = $dados['username'] ?? '';
$password = $dados['password'] ?? '';
$modulo_id = $dados['modulo_id'] ?? 0;

if (empty($username) || empty($password)) {
    echo json_encode(["sucesso" => false, "mensagem" => "Preencha usuário e senha."]);
    exit;
}

// Mapeamento de Qual ID = Qual Tabela e Qual URL
// Isso age como um filtro de segurança para evitar Injeção de SQL no nome da tabela
$tabelas_modulos = [
    1 => ['tabela' => 'login_compliance',            'url' => 'painel_governanca.html'],
    2 => ['tabela' => 'login_monitoramento',         'url' => 'painel_monitoramento.html'],
    3 => ['tabela' => 'login_auditoria_sites',       'url' => 'painel_auditoria_sites.html'],
    4 => ['tabela' => 'login_auditoria_processos',   'url' => 'painel_auditoria_processos.html'],
    5 => ['tabela' => 'login_gestao_medidas',        'url' => 'painel_gestao_medidas.html']
];

if (!array_key_exists($modulo_id, $tabelas_modulos)) {
    echo json_encode(["sucesso" => false, "mensagem" => "Módulo inválido."]);
    exit;
}

$nome_tabela = $tabelas_modulos[$modulo_id]['tabela'];
$url_destino = $tabelas_modulos[$modulo_id]['url'];

// Busca o usuário na tabela específica daquele módulo
// (Variáveis seguras do array não permitem SQL Injection, usamos query direta para a tabela)
$stmt = $pdo->prepare("SELECT * FROM $nome_tabela WHERE username = :username AND ativo = 1");
$stmt->execute(['username' => $username]);
$usuario = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$usuario) {
    echo json_encode(["sucesso" => false, "mensagem" => "Usuário não tem acesso a este módulo ou está inativo."]);
    exit;
}

// Verifica a senha
if (!password_verify($password, $usuario['senha_hash'])) {
    echo json_encode(["sucesso" => false, "mensagem" => "Senha incorreta."]);
    exit;
}

// Verifica se é o primeiro acesso
if ($usuario['primeiro_acesso'] == 1) {
    // Retornamos também qual é a tabela para o frontend saber onde dar UPDATE na senha
    echo json_encode(["sucesso" => true, "primeiro_acesso" => true, "tabela_alvo" => $nome_tabela]);
    exit;
}

$_SESSION['usuario_id'] = $usuario['id'];
$_SESSION['usuario_nome'] = $usuario['nome'];
$_SESSION['usuario_perfil'] = $usuario['perfil'];
$_SESSION['modulo_atual'] = $nome_tabela;


// Sucesso! Retorna a URL e o perfil (admin ou usuario) para a interface saber o que liberar
echo json_encode([
    "sucesso" => true, 
    "primeiro_acesso" => false, 
    "url_destino" => $url_destino,
    "perfil" => $usuario['perfil'] // Aqui entregamos se ele é admin ou usuário
]);
?>