export function DocsPanel() {
	return (
		<article className="admin-form admin-docs">
			<h2>Documentação detalhada</h2>
			<p>
				Este guia cobre cada etapa necessária para operar a área administrativa. Use-o como manual de referência rápida ou durante treinamentos de
				novos integrantes.
			</p>

			<section>
				<h3>Visão geral</h3>
				<ul>
					<li>O menu lateral seleciona qual fluxo você está preenchendo.</li>
					<li>Os dados enviados aqui alimentam funções serverless que atualizam os bancos dedicados de cada cliente.</li>
					<li>Campos marcados com * são obrigatórios. Se algo estiver incorreto, uma mensagem aparecerá na parte inferior do formulário.</li>
					<li>Você pode alternar entre as abas sem perder o que já digitou.</li>
				</ul>
			</section>

			<section>
				<h3>Registrar novo usuário</h3>
				<p>
					Este formulário cria um registro na tabela mestre, provisiona as credenciais iniciais e vincula a conta ao banco dedicado do cliente.
				</p>
				<ol>
					<li>Preencha os dados de login, informando um e-mail corporativo válido.</li>
					<li>Defina uma senha temporária — o usuário receberá instruções para trocá-la no primeiro acesso.</li>
					<li>Informe host, nome, usuário e senha do banco dedicado do cliente. Esses dados são usados pela função de replicação.</li>
					<li>Finalize com o nome comercial da empresa. Ele será exibido nas listas e nas telas internas.</li>
				</ol>
				<h4>Detalhe dos campos</h4>
				<ul>
					<li>
						<strong>Email*</strong>: endereço que receberá o convite e servirá como login.
					</li>
					<li>
						<strong>Senha temporária*</strong>: gere algo seguro (12+ caracteres). Evite senhas triviais.
					</li>
					<li>
						<strong>Host/Nome/Usuário/Senha do banco*</strong>: credenciais do PostgreSQL dedicado do cliente.
					</li>
					<li>
						<strong>Nome da empresa*</strong>: usado para identificar o cliente nas listas e dashboards.
					</li>
				</ul>
				<p>
					Após enviar, valide se o novo usuário aparece na lista da empresa e realize um login de teste quando possível.
				</p>
			</section>

			<section>
				<h3>Cadastrar gráficos</h3>
				<p>
					Este fluxo cria registros na tabela <code>graficos_dashboard</code> do banco dedicado, permitindo que gráficos dinâmicos sejam exibidos no
					dashboard do cliente.
				</p>
				<h4>Passo a passo essencial</h4>
				<ol>
					<li>Selecione a empresa. Isso garante que o registro seja gravado no banco correto.</li>
					<li>
						Defina um <strong>slug*</strong> (ex.: <code>reservas_por_status</code>). Ele precisa ser único por empresa e será usado como identificador
						técnico.
					</li>
					<li>Opcionalmente, informe título e descrição para ajudar o time interno.</li>
					<li>
						Escreva a <strong>query template*</strong>. Utilize placeholders de parâmetros com chaves duplas, como {"{{data_inicio}}"}.
					</li>
					<li>Configure os parâmetros da query quando precisar filtrar valores dinamicamente.</li>
					<li>Descreva os campos de resultado para documentar o formato esperado da query.</li>
					<li>Confirme se o conteúdo pode ser exibido para clientes — dashboards ficam disponíveis automaticamente após a publicação.</li>
				</ol>
				<h4>Tipos de parâmetros disponíveis</h4>
				<ul>
					<li>
						<strong>string</strong>: textos livres, códigos ou identificadores.
					</li>
					<li>
						<strong>number</strong>: valores numéricos, usados em limites, ids ou métricas.
					</li>
					<li>
						<strong>date</strong>: datas em formato ISO (<code>YYYY-MM-DD</code>).
					</li>
					<li>
						<strong>boolean</strong>: marcações verdadeiro/falso. Aceita valores como "true", "false", "1", "0".
					</li>
					<li>
						<strong>array</strong>: listas de valores. Defina o tipo dos itens (ex.: lista de números) e separe entradas por vírgula.
					</li>
				</ul>
				<p>
					Se você definir <em>Valores permitidos</em>, o sistema converte automaticamente para o tipo adequado (número, booleano, etc.). Isso evita erros de execução
					da query.
				</p>
				<h4>Exemplo completo</h4>
				<pre>
					<code>
{`SELECT tipo_reserva AS categoria,
       COUNT(*)        AS total
  FROM reservas
 WHERE data_checkin BETWEEN {{data_inicio}} AND {{data_fim}}
   AND status IN {{status_lista}}
 GROUP BY 1
 ORDER BY total DESC;`}
					</code>
				</pre>
				<p>
					Nesse exemplo, defina três parâmetros: <code>data_inicio</code> (date, obrigatório), <code>data_fim</code> (date, obrigatório) e <code>status_lista</code>
					(array de string) com valores permitidos como <code>confirmada</code>, <code>cancelada</code> e <code>no_show</code>.
				</p>
				<p>Documente os campos de resultado como:</p>
				<ul>
					<li>
						<strong>categoria</strong> — rótulo "Tipo de reserva", tipo string.
					</li>
					<li>
						<strong>total</strong> — rótulo "Quantidade", tipo number.
					</li>
				</ul>
			</section>

			<section>
				<h3>Cadastrar tabelas</h3>
				<p>
					Este fluxo alimenta a tabela <code>dashboard_tables</code>, responsável por renderizar listagens completas no dashboard do cliente.
				</p>
				<ol>
					<li>Escolha a empresa e defina um <strong>slug*</strong> exclusivo (ex.: <code>clientes_ativos</code>).</li>
					<li>Informe query, título, descrição e a chave primária (opcional, mas útil para ações futuras).</li>
					<li>Configure cada coluna exibida: chave (nome do campo na query), rótulo amigável e tipo de dado.</li>
					<li>Utilize a opção "Campo é um toggle" para colunas booleanas que serão renderizadas como switches.</li>
					<li>Parametrize filtros dinâmicos da query da mesma forma que nos gráficos.</li>
					<li>Lembre-se de que listas ficam acessíveis no dashboard do cliente assim que salvas e aprovadas.</li>
				</ol>
				<h4>Formato esperado das colunas</h4>
				<ul>
					<li>
						<strong>key*</strong>: nome do campo retornado pela query (ex.: <code>cliente_nome</code>).
					</li>
					<li>
						<strong>label</strong>: título que aparecerá para o usuário final.
					</li>
					<li>
						<strong>type</strong>: string, number, date ou boolean — isso ajusta formatação e alinhamento padrão.
					</li>
					<li>
						<strong>align</strong>: esquerda, centro ou direita.
					</li>
					<li>
						<strong>width</strong>: largura fixa opcional (ex.: <code>160px</code>).
					</li>
					<li>
						<strong>is_toggle</strong>: marca colunas booleanas para exibir um botão de alternância.
					</li>
					<li>
						<strong>hidden</strong>: se verdadeiro, a coluna inicia oculta e pode ser exibida via preferências.
					</li>
				</ul>
				<p>
					Ao salvar, a função <code>manageTable</code> valida a existência do slug, converte o JSON e grava na tabela. Erros de SQL são exibidos na mensagem de retorno
					para facilitar correções.
				</p>
			</section>

			<section>
				<h3>Boas práticas gerais</h3>
				<ul>
					<li>Teste suas queries no banco dedicado antes de colá-las aqui. Use limites (<code>LIMIT 50</code>) durante a validação.</li>
					<li>Sempre utilize placeholders para qualquer filtro variável. Evita SQL cheio de concatenações manuais.</li>
					<li>Prefira nomes de slug em minúsculas, com <code>_</code>, sem espaços ou acentos.</li>
					<li>Descreva campos e parâmetros com clareza para facilitar a manutenção por outros analistas.</li>
					<li>Garanta que nenhum dado sensível seja exposto: tudo que você cadastrar aqui aparece direto no dashboard do cliente.</li>
				</ul>
				<p>
					Em caso de dúvidas, consulte este painel, valide seus dados em ambiente de teste e só então replique em produção.
				</p>
			</section>
		</article>
	);
}
