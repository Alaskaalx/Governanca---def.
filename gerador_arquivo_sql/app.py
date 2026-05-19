import os
import io
import pandas as pd
from datetime import datetime
from flask import Flask, render_template, request, send_file, flash, redirect

app = Flask(__name__)
app.secret_key = 'chave_secreta_para_desenvolvimento_local'

def processar_planilha_para_sql(arquivo_armazenado, nome_tabela, modo, campo_chave, tamanho_bloco=500):
    """
    Processa o stream do arquivo enviado pela interface e gera a string contendo o SQL.
    """
    nome_arquivo = arquivo_armazenado.filename
    
    # Leitura em memória baseada na extensão do arquivo vindo do formulário HTML
    if nome_arquivo.endswith('.xlsx') or nome_arquivo.endswith('.xls'):
        df = pd.read_excel(arquivo_armazenado)
    elif nome_arquivo.endswith('.csv'):
        # Tenta tratar encoding comum latino/brasileiro se necessário
        try:
            df = pd.read_csv(arquivo_armazenado, sep=';', dtype=str)
        except Exception:
            df = pd.read_csv(arquivo_armazenado, sep=',', dtype=str)
    else:
        raise ValueError("Formato de arquivo inválido.")

    # Higienização: substitui nulos do Pandas por None
    df = df.where(pd.notnull(df), None)
    
    colunas = list(df.columns)
    colunas_str = ", ".join(colunas)
    
    linhas_sql = []
    linhas_sql.append("-- Script gerado via Interface Web Local")
    linhas_sql.append(f"-- Data de geração: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
    linhas_sql.append("SET NAMES utf8mb4;")
    linhas_sql.append("START TRANSACTION;")
    
    if modo == 'substituir':
        linhas_sql.append(f"TRUNCATE TABLE {nome_tabela};")
        
    valores_acumulados = []
    
    for idx, linha in df.iterrows():
        valores_linha = []
        for col in colunas:
            val = linha[col]
            if val is None:
                valores_linha.append("NULL")
            else:
                val_limpo = str(val).replace("'", "''").strip()
                valores_linha.append(f"'{val_limpo}'")
        valores_acumulados.append(f"({', '.join(valores_linha)})")
        
    # Agrupamento em lotes (Evita estouro de pacotes no XAMPP)
    for i in range(0, len(valores_acumulados), tamanho_bloco):
        bloco = valores_acumulados[i:i+tamanho_bloco]
        insert_statement = f"INSERT INTO {nome_tabela} ({colunas_str}) VALUES \n" + ",\n".join(bloco)
        
        if modo == 'atualizar':
            # Separa chaves primárias enviadas via input de texto (aceita múltiplas separadas por vírgula)
            chaves = [c.strip() for c in campo_chave.split(',') if c.strip()]
            regras_update = [f"{col} = VALUES({col})" for col in colunas if col not in chaves]
            insert_statement += "\nON DUPLICATE KEY UPDATE " + ", ".join(regras_update)
            
        insert_statement += ";"
        linhas_sql.append(insert_statement)
        
    linhas_sql.append("COMMIT;")
    
    return "\n".join(linhas_sql)


@app.route('/')
def index():
    # Renderiza a nossa interface HTML construída
    return render_template('index.html')


@app.route('/converter', methods=['POST'])
def converter():
    # Captura os dados vindos do formulário HTML
    if 'planilha' not in request.files:
        return "Nenhum arquivo enviado", 400
        
    arquivo = request.files['planilha']
    nome_tabela = request.form.get('tabela', 'cadastro_colaborador').strip()
    modo = request.form.get('modo', 'substituir')
    campo_chave = request.form.get('chave_primaria', '').strip()
    
    if arquivo.filename == '':
        return "Nenhum arquivo selecionado", 400
        
    try:
        # Processa a planilha e extrai o texto SQL final
        conteudo_sql = processar_planilha_para_sql(arquivo, nome_tabela, modo, campo_chave)
        
        # Converte a string gerada em um stream binário na memória para servir como download seguro
        memoria_arquivo = io.BytesIO()
        memoria_arquivo.write(conteudo_sql.encode('utf-8'))
        memoria_arquivo.seek(0)
        
        # Nome do arquivo que o usuário vai baixar
        nome_saida = f"importacao_{nome_tabela}.sql"
        
        return send_file(
            memoria_arquivo,
            mimetype='text/x-sql',
            as_attachment=True,
            download_name=nome_saida
        )
        
    except Exception as e:
        return f"Erro interno ao processar a conversão: {str(e)}", 500


if __name__ == '__main__':
    # Roda o servidor localmente na porta 5000
    app.run(debug=True, host='127.0.0.1', port=5000)