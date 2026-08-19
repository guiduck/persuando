# Super Prompt Lovable - Protótipo V2

Use este prompt no Lovable para gerar um protótipo navegável com aparência de produto final. Esta versão substitui a intenção do prompt anterior e corrige o principal problema: `Full-time` e `Freelance` devem parecer dois apps independentes dentro da mesma aplicação, não uma tabela única com filtros.

```text
Você é um expert em criar SaaS internos, dashboards operacionais, CRMs e produtos de prospecção usando Lovable AI.

Crie uma aplicação web completa, navegável e visualmente production-ready para "Scrapper Freelance API", com dados mockados, mas aparência e comportamento de produto final.

=========================================================
OBJETIVO ABSOLUTO
=========================================================

Criar um protótipo de uma plataforma operacional com DOIS MODOS INDEPENDENTES:

1. Full-time
   Um app para buscar vagas/publicações de emprego, revisar oportunidades de carreira, preparar candidatura com currículo e acompanhar resposta/entrevista.

2. Freelance
   Um app para prospectar clientes, revisar negócios locais, analisar site, salvar demo URL, gerar mega prompt Lovable e gerar mensagens comerciais a partir de templates.

REGRA MAIS IMPORTANTE:
Full-time e Freelance NÃO podem ser misturados.

Não crie uma tabela "Todas".
Não crie uma visão única misturando vagas full-time com leads freelance.
Não trate Full-time e Freelance como simples filtros.
O seletor de modo deve trocar o contexto inteiro da aplicação.

Mesmo que os dois modos compartilhem layout, sidebar, componentes e backend futuro, eles devem parecer dois apps separados dentro da mesma casca visual.

=========================================================
STACK DO PROTÓTIPO E PRODUÇÃO FUTURA
=========================================================

Protótipo no Lovable:
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide icons
- Framer Motion apenas se for leve e necessário
- Dados mockados
- Estado local e/ou localStorage
- Serviços mockados assíncronos simulando API

Produção futura:
- Backend Python com FastAPI
- PostgreSQL
- Worker separado para scraping, enriquecimento, deduplicação e envio
- API apenas para consulta, comandos, filtros, revisão e disparo de jobs

No código do protótipo:
- crie tipos TypeScript compatíveis com o domínio
- crie mock services que pareçam futuros endpoints FastAPI
- simule loading de worker nas buscas
- não faça scraping real
- não faça envio real de email ou WhatsApp
- use toasts para feedback
- salve alterações simples em localStorage

=========================================================
REFERÊNCIAS VISUAIS OBRIGATÓRIAS
=========================================================

Use as imagens anexadas de references/images como inspiração visual direta.

O estilo observado nas imagens deve ser preservado:

- dark UI como tema principal
- fundo geral azul/preto profundo
- sidebar fixa à esquerda
- header/top bar horizontal
- barra superior amarela/laranja de status/trial
- cards escuros com borda sutil
- azul vivo para botões primários
- roxo/gradiente apenas para destaque do modo ativo ou recursos de IA
- badges pequenos para status, etapa, temperatura, categoria e modo
- tabelas densas com hover
- filtros horizontais acima das tabelas
- cards de campanha com status e ações
- empty states centralizados com ícone, texto e CTA
- modais centrais grandes com backdrop escuro
- formulários dentro de cards escuros
- score circular em detalhes de lead
- layout de detalhe em duas colunas
- painel lateral de ações no detalhe
- gerador de mensagem com tabs e select
- modal de prompt com editor monoespaçado e contador de caracteres

Não copie:
- nome "HB Insider"
- textos do protótipo de referência
- conteúdos de clínica/dentista dos templates
- identidade visual pública de landing page

Use o nome do app como:
- "Opportunity Desk" no UI
- subtítulo pequeno: "Scrapper Freelance API"

=========================================================
CASCA DA APLICAÇÃO
=========================================================

A aplicação deve ter:

1. Sidebar fixa
2. Header/top bar
3. Seletor global de modo Full-time/Freelance
4. Conteúdo principal escopado pelo modo ativo
5. Toasts
6. Modais
7. Loading states
8. Empty states
9. Página de detalhe por lead/oportunidade

=========================================================
HEADER COM SELETOR DE MODO
=========================================================

No header, crie um segmented control/pill switch bem visível:

[ Full-time ] [ Freelance ]

Comportamento:
- o modo ativo fica preenchido com cor forte
- Full-time pode usar azul como destaque
- Freelance pode usar roxo como destaque
- o modo inativo fica escuro/outlined
- trocar de modo troca todo o contexto do app
- a URL ou estado deve refletir o modo atual
- o seletor deve estar sempre visível em desktop
- em mobile, deve ficar no topo como segmented control horizontal

Exemplo visual desejado:
- Full-time inativo: botão escuro com ícone de maleta
- Freelance ativo: pill roxa com ícone de ferramenta/varinha e ícone de enviar

=========================================================
SIDEBAR
=========================================================

Itens principais:

- Dashboard
- Campanhas
- Leads
- Templates
- Configurações

Itens opcionais menores:

- Feedback
- Changelog

Rodapé da sidebar:
- ponto verde
- texto "Sistemas operacionais"
- versão "v0.2.0"

Comportamento:
- o item ativo tem fundo azul escuro
- sidebar fixa em desktop
- sidebar vira drawer em mobile
- os itens da sidebar são os mesmos, mas o conteúdo muda conforme o modo ativo

Importante:
- "Leads" em Full-time significa vagas/publicações salvas
- "Leads" em Freelance significa negócios/prospects comerciais

=========================================================
TOP STATUS BAR
=========================================================

Adicionar uma barra fina no topo, amarela/laranja, como nas imagens.

Conteúdo por modo:

Full-time:
"Modo Full-time - worker pronto - 18 vagas novas para revisar"

Freelance:
"Modo Freelance - 2 prospecções restantes - campanha pronta"

Incluir também:
- link/botão pequeno "Configurar"
- indicador de protótipo: "dados mockados"

=========================================================
MODO FULL-TIME - VISÃO GERAL
=========================================================

Full-time é um app de busca e operação de vagas.

Origem dos leads:
- publicações de vagas no LinkedIn
- anúncios de vagas
- posts públicos com email de recrutamento
- textos que contenham keywords aderentes ao currículo

Fluxo:
1. configurar cargo, senioridade, localidade e keywords
2. rodar busca de publicações/vagas
3. salvar cada vaga como lead job
4. revisar empresa, cargo, email, link e evidência
5. selecionar currículo
6. selecionar ou gerar template de candidatura
7. aprovar envio individual ou em massa
8. acompanhar resposta, entrevista, rejeição ou ignorado

Linguagem do modo:
- vagas
- publicações
- empresa
- cargo
- email de recrutamento
- keywords do currículo
- candidatura
- currículo anexado
- resposta
- entrevista

Não mostrar no modo Full-time:
- demo URL
- landing page demo
- prompt Lovable como CTA principal
- WhatsApp comercial
- cliente
- receita potencial
- site fraco
- score de website
- templates de prospecção freelance

=========================================================
MODO FREELANCE - VISÃO GERAL
=========================================================

Freelance é um app de prospecção comercial.

Origem dos leads:
- negócios por nicho e localidade
- negócios sem site claro
- negócios com site fraco
- negócios com email, telefone ou WhatsApp público
- resultados de busca com sinais de baixa maturidade digital

Fluxo:
1. criar campanha por nicho, mercado e localidade
2. prospectar leads
3. revisar negócio, contato, site, score e evidências
4. salvar ou gerar URL de demo
5. gerar mega prompt Lovable para criar demo
6. gerar mensagem de primeiro contato ou follow-up
7. copiar/enviar por email ou WhatsApp com aprovação humana
8. acompanhar status comercial

Linguagem do modo:
- leads
- prospects
- negócio
- nicho
- cidade
- site
- score do site
- demo
- prompt Lovable
- primeiro contato
- follow-up
- WhatsApp
- receita potencial

Não mostrar no modo Freelance:
- vaga
- currículo
- candidatura
- entrevista
- job_stage
- templates de candidatura

=========================================================
DASHBOARD - FULL-TIME
=========================================================

Criar uma tela Dashboard específica para Full-time.

Header:
- título: "Dashboard Full-time"
- subtítulo: "Revise vagas capturadas e prepare candidaturas com currículo."
- CTA principal: "Buscar vagas"
- CTA secundário: "Configurar keywords"

Alert card:
"Configure keywords, currículo e preferências antes de rodar o bot de vagas."

Cards de métricas:
- Vagas capturadas
- Vagas com email
- Vagas salvas
- Candidaturas enviadas
- Respostas recebidas
- Entrevistas

Funil:
- Capturadas
- Revisadas
- Salvas
- Aplicadas
- Responderam
- Entrevista

Card "Job bot status":
- keywords ativas: reactjs, typescript, nextjs, nodejs
- última busca
- fonte principal: LinkedIn posts
- oportunidades capturadas
- falso positivo estimado
- botão "Buscar vagas"

Card "Vagas recentes":
- empresa
- cargo
- email
- score
- status
- link "Ver vagas"

Card "Próximas ações":
- revisar vagas novas
- preparar emails com currículo
- registrar respostas
- atualizar keywords

Loading:
Ao clicar em "Buscar vagas", simular worker:
- "Buscando publicações no LinkedIn..."
- "Filtrando por keywords..."
- "Detectando emails..."
- "Salvando vagas..."

=========================================================
DASHBOARD - FREELANCE
=========================================================

Criar uma tela Dashboard específica para Freelance.

Header:
- título: "Dashboard Freelance"
- subtítulo: "Acompanhe prospecções, demos e mensagens comerciais."
- CTA principal: "Prospectar leads"
- CTA secundário: "Criar campanha"

Alert card:
"Configure seus dados de vendedor, preço e WhatsApp antes de prospectar."

Cards de métricas:
- Total de leads
- Contactados
- Convertidos
- Receita potencial
- Leads quentes
- Demos criadas
- Prompts gerados

Funil:
- Leads
- Contactados
- Interessados
- Proposta enviada
- Convertidos

Card "Leads recentes":
- negócio
- nicho
- cidade
- score
- temperatura
- status
- link "Ver leads"

Card "O que a comunidade diz" ou "Feedback":
- seguir visual das imagens com cards pequenos e estrelas

=========================================================
CAMPANHAS - FULL-TIME
=========================================================

Tela: Campanhas no modo Full-time.

Header:
- título: "Campanhas de vagas"
- subtítulo: "Organize buscas por cargo, stack, senioridade e mercado."
- botão: "+ Nova campanha"

Empty state:
- ícone central
- título: "Nenhuma campanha de vagas"
- texto: "Crie uma campanha para buscar publicações com email e keywords aderentes ao seu currículo."
- botão "Criar campanha"

Cards de campanha:
- nome da campanha
- cargo alvo
- senioridade
- modalidade: remoto/híbrido/presencial
- mercado/localidade
- keywords
- total de vagas
- vagas com email
- status: Rascunho, Buscando, Pausada, Concluída
- última execução
- progresso quando estiver buscando
- ações: "Ver vagas", "Buscar vagas", "Pausar", "Parar", "Excluir"

Campanhas mockadas:

1. React Remote - BR
- cargo: Frontend Developer
- senioridade: Pleno/Sênior
- modalidade: Remoto
- keywords: reactjs, typescript, nextjs, nodejs
- status: Buscando

2. Next.js International
- cargo: Next.js Engineer
- mercado: US / Remote
- keywords: nextjs, typescript, frontend
- status: Rascunho

Modal "+ Nova campanha":
- título: "Nova campanha Full-time"
- campos:
  - Nome da campanha
  - Cargo alvo
  - Senioridade
  - Modalidade
  - País/região
  - Keywords
  - Keywords negativas
  - Exigir email público
  - Fonte: LinkedIn posts, LinkedIn jobs, job boards
- botões:
  - Cancelar
  - Criar campanha

Não incluir nichos comerciais nem percentuais de conversão nesta tela.

=========================================================
CAMPANHAS - FREELANCE
=========================================================

Tela: Campanhas no modo Freelance.

Header:
- título: "Campanhas Freelance"
- subtítulo: "Crie campanhas por nicho e localidade para encontrar negócios com potencial."
- botão: "+ Nova campanha"

Empty state:
- ícone central
- título: "Nenhuma campanha"
- texto: "Crie sua primeira campanha para começar a prospectar leads."
- botão "Criar campanha"

Cards de campanha:
- nome da campanha, ex: Dentist - Alamo
- localidade
- nicho
- status: Rascunho, Coletando, Pausada, Concluída
- total de leads
- contadores por temperatura/status
- progresso quando estiver coletando
- texto de etapa: "Abrindo navegador...", "Analisando websites..."
- estimativa: "pode levar ~30s"
- ações: "Ver leads", "Prospectar", "Pausar", "Parar", "Excluir"

Campanhas mockadas:

1. Dentist - Alamo
- mercado: Internacional
- país: United States
- estado: Texas
- cidade: Alamo
- nicho: Dentist
- status: Rascunho

2. Imobiliária - Indaial
- mercado: BR Nacional
- estado: SC
- cidade: Indaial
- nicho: Imobiliária
- status: Coletando

Modal "+ Nova campanha":
- título: "Nova campanha Freelance"
- mercado segmentado: BR Nacional / Internacional
- país/região
- nicho
- estado
- cidade
- nome da campanha preenchido automaticamente e editável
- barra de conversão do nicho, quando houver
- botões:
  - Cancelar
  - Criar campanha

Select de nicho deve conter opções com percentual de conversão:
- Clínica de Estética - 18.5% conversão
- Clínica Odontológica - 17.2% conversão
- Dentista - 16.8% conversão
- Salão de Beleza - 15.4% conversão
- Psicólogo - 15.2% conversão
- Terapeuta - 15% conversão
- Nutricionista - 14.8% conversão
- Barbearia - 14.7% conversão
- Fotógrafo - 14.2% conversão
- Personal Trainer - 13.5% conversão
- Clínica de Fisioterapia - 13.2% conversão
- Arquiteto - 13% conversão
- Designer de Interiores - 12.9% conversão
- Academia - 12.8% conversão
- Clínica Veterinária - 12.3% conversão
- Pet Shop - 9.5% conversão
- Escola de Idiomas - 9.2% conversão
- Restaurante - 5.8% conversão
- Pizzaria - 5.5% conversão
- Hamburgueria - 5.3% conversão
- Oficina Mecânica - 5% conversão
- Med Spa - 18% conv.
- HVAC - 15.8% conv.
- Plumber - 16.2% conv.
- Lawyer - 15% conv.
- Real Estate Agent - 14.5% conv.
- Landscaping - 13% conv.
- Cleaning Service - 14% conv.

=========================================================
LEADS - FULL-TIME
=========================================================

Tela: Leads no modo Full-time.

Título:
"Vagas"

Subtítulo:
"Revise publicações capturadas antes de preparar candidaturas."

Header actions:
- Exportar CSV
- Buscar vagas

Filtros:
- busca textual
- campanha
- cargo
- senioridade
- modalidade
- keywords
- email disponível
- status da candidatura
- score mínimo

Tabela obrigatória:
- checkbox
- Empresa
- Cargo
- Email de recrutamento
- Fonte/link
- Keywords encontradas
- Score de aderência
- Status da candidatura
- Capturada em
- Ações

Estados de candidatura:
- Novo
- Salvo
- Aplicado
- Respondeu
- Entrevista
- Rejeitado
- Ignorado

Ações por linha:
- Abrir detalhe
- Preparar email
- Salvar vaga
- Ignorar

Seleção em massa:
- Preparar emails
- Marcar como salvo
- Marcar como ignorado
- Exportar selecionadas

Empty state:
"Nenhuma vaga encontrada. Crie uma campanha de busca ou ajuste suas keywords."

Dados mockados:

1. TechNova Labs
- cargo: Frontend Developer React
- email: jobs@technova.dev
- fonte: LinkedIn Post
- keywords: reactjs, typescript, nextjs
- score: 88
- status: Novo

2. BrightHire AI
- cargo: Next.js Engineer
- email: careers@brighthire.ai
- fonte: LinkedIn Jobs
- keywords: nextjs, typescript
- score: 82
- status: Salvo

3. RemoteCraft Studio
- cargo: React TypeScript Developer
- email: talent@remotecraft.io
- fonte: LinkedIn Post
- keywords: reactjs, typescript, nodejs
- score: 79
- status: Aplicado

4. CloudPixel
- cargo: Full Stack JS Developer
- email: people@cloudpixel.com
- fonte: LinkedIn Post
- keywords: nodejs, reactjs
- score: 71
- status: Respondeu

Não mostrar:
- telefone como coluna primária
- nicho comercial
- score de website
- demo URL
- botão de prompt Lovable
- WhatsApp comercial

=========================================================
LEADS - FREELANCE
=========================================================

Tela: Leads no modo Freelance.

Título:
"Leads"

Subtítulo:
"Revise negócios capturados antes de gerar demo, prompt ou mensagem."

Header actions:
- Exportar CSV
- Prospectar

Filtros:
- busca textual
- campanha
- nicho
- temperatura
- status
- website status
- cidade/região
- score mínimo

Tabela obrigatória:
- checkbox
- Nome do negócio
- Telefone
- Email
- Nicho
- Canais
- Score
- Temperatura
- Status
- Ações

Estados comerciais:
- Novo
- Contactado
- Convertido
- Perdido
- Ignorado

Ações por linha:
- Ver
- Gerar prompt
- Gerar mensagem
- Abrir demo

Seleção em massa:
- Gerar mensagens
- Marcar como contactado
- Exportar selecionados

Empty state:
"Nenhum lead encontrado. Crie uma campanha e inicie a prospecção."

Dados mockados:

1. Mazi Imobiliária
- telefone: 554730911700
- email: financeiro@maziimobiliaria.com.br
- nicho: Imobiliária
- cidade: Indaial, SC
- score: 53
- temperatura: Quente
- status: Novo
- website status: confirmado mas fraco

2. Geralo Urbanismo
- telefone: 554733334886
- email: contato@geralote.com.br
- nicho: Imobiliária
- score: 60
- temperatura: Quente
- status: Novo

3. Sorriso Prime Dental
- telefone: +1 956 375 2248
- email: hello@sorrisoprime.com
- nicho: Dentista
- score: 76
- temperatura: Morno
- status: Novo

Não mostrar:
- currículo
- candidatura
- entrevista
- job_stage
- templates de vaga

=========================================================
PÁGINA DE DETALHE - FULL-TIME
=========================================================

Esta tela é obrigatória. Não pode ser substituída por modal pequeno.

Rota sugerida:
/fulltime/leads/:id

Layout:
- botão "Voltar"
- título com empresa e cargo
- badges: status da candidatura, score, email disponível
- coluna principal com cards grandes
- coluna lateral com score, candidatura e ações

Card "Informações da vaga":
- Empresa
- Cargo
- Email encontrado
- Link da vaga/publicação
- Fonte
- Localidade/modalidade
- Data de captura

Card "Evidência da captura":
- source_query
- source_evidence
- trecho/resumo da publicação
- keywords destacadas
- motivo da classificação

Card "Aderência ao currículo":
- score de aderência circular ou barra
- keywords encontradas
- keywords ausentes
- recomendação: "Boa aderência", "Revisar antes de aplicar", etc.

Card "Revisão do operador":
- notas editáveis
- dropdown de status da candidatura
- botão "Salvar revisão"

Card "Preparar candidatura":
- select de currículo
- select de template de candidatura
- preview do email
- botões:
  - Gerar email
  - Copiar email
  - Marcar como enviado
  - Envio simulado

Card "Histórico":
- Capturada
- Revisada
- Email preparado
- Aplicada
- Respondeu
- Entrevista
- Rejeitada/Ignorada

Templates disponíveis nesta tela:
- Job - Candidatura direta
- Job - Destaque React/TypeScript
- Job - Follow-up educado
- Job - Resposta a recrutador
- Job - Agradecimento pós-entrevista

Variáveis:
- {{company_name}}
- {{job_title}}
- {{matched_keywords}}
- {{source_url}}
- {{resume_name}}
- {{operator_name}}
- {{operator_email}}

Não incluir nesta tela:
- demo URL
- prompt Lovable
- score de site
- gerador de mensagem WhatsApp comercial

=========================================================
PÁGINA DE DETALHE - FREELANCE
=========================================================

Esta tela é obrigatória e deve seguir de perto as imagens de referência.

Rota sugerida:
/freelance/leads/:id

Layout:
- botão "Voltar"
- título com nome do negócio
- badges: Quente/Morno/Frio, Novo/Contactado/etc.
- coluna principal 65-70%
- coluna lateral 30-35%
- cards escuros com bordas sutis

Card "Informações":
- Telefone
- Email
- Website
- Endereço
- Cidade
- Nicho
- Nota Google
- Avaliações
- Google Maps/source URL

Card "Análise do site":
- Tem Website
- Score Mobile
- Score Desktop
- Responsivo
- Tem Anúncios
- Plataformas de Ads
- Plataforma
- Linktree
- Motivo da classificação em faixa destacada

Card "Alterar Status":
- Novo
- Contactado
- Convertido
- Perdido
- Ignorado

Coluna lateral:

1. Card "Score"
- score circular grande
- valor /100
- cor laranja/amarelo como nas imagens

2. Card "Landing Page Demo"
- input "Cole o link da demo (Lovable URL)"
- botão "Salvar"
- botão "Gerar Prompt Lovable"

3. Card "Gerar Mensagem"
- tabs: 1o Contato / Follow-up
- select "Template automático"
- botão "Gerar Mensagem"

4. Card "Mensagens"
- empty state "Nenhuma mensagem gerada"
- quando houver mensagem, renderizar card com:
  - nome do template
  - badge da etapa
  - texto da mensagem
  - link da demo
  - preço ou parcelamento
  - botões Copiar, Email, WhatsApp
  - ações editar/aprovar

=========================================================
MODAL MEGA PROMPT LOVABLE - FREELANCE
=========================================================

Obrigatório no modo Freelance.

Abrir ao clicar em "Gerar Prompt Lovable" na página de detalhe freelance.

Modal:
- grande e centralizado
- backdrop escuro/blur
- título "Prompt Lovable"
- botão X para fechar
- tabs/variantes:
  - Blueprint
  - Genérico
  - Compacto
- chip "Nicho pesquisado"
- chips de design:
  - split-left
  - CTA pill
  - Inter
  - dark-light contrast
  - cores sugeridas
- contador de caracteres
- área grande monoespaçada com o prompt
- botão grande "Copiar Prompt"
- feedback "Prompt copiado!"

O prompt gerado dentro do modal deve usar dados do lead:
- nome do negócio
- nicho
- localização
- telefone/WhatsApp
- nota Google
- número de avaliações
- website status
- score
- análise do site
- demo_url se existir
- oferta
- preço
- parcelamento

O texto do prompt deve seguir o estilo dos templates Lovable:
- seções com separadores
- dados do negócio
- dados de pesquisa
- estrutura da landing page
- CTAs
- trust signals
- design system
- mobile
- SEO
- tech stack
- regras de design único
- pedido final de código completo

Salvar o prompt como artefato mockado na lista/histórico do lead.

=========================================================
GERADOR DE MENSAGENS - FREELANCE
=========================================================

Obrigatório no detalhe freelance.

UI:
- card "Gerar Mensagem"
- tabs segmentadas:
  - 1o Contato
  - Follow-up
- select "Template automático"
- botão "Gerar Mensagem"

Opções de template no select:
- Sem Site - Demo Pronta
- Sem Site - Impacto Visual
- Site Fraco - Demo Comparativa
- Site Fraco - Upgrade Direto
- Linktree - Site Real
- Linktree - Reputação Merecida
- Sem Anúncios - Base Digital
- Sem Anúncios - Concorrentes na Frente
- Geral - Demo Direto
- Geral - Resultado na Mão

Ao gerar mensagem:
- adicionar card em "Mensagens"
- incluir nome do template
- incluir badge da etapa
- preencher texto com dados do lead
- incluir link da demo se existir
- incluir preço e parcelamento
- mostrar botões:
  - Copiar
  - Email
  - WhatsApp
  - Editar
  - Aprovar

Exemplo de tom:
"Mazi Imobiliária, aqui é o [nome]. Vi que o site de vocês tem score mobile baixo e isso pode estar empurrando clientes para concorrentes. Preparei uma demo para vocês verem a diferença: [demo_url]. Rápida, responsiva e feita para converter visitante em cliente. Vale 2 minutos de uma olhada?"

=========================================================
TEMPLATES - FULL-TIME
=========================================================

Tela Templates no modo Full-time.

Título:
"Templates de candidatura"

Tabs:
- Todos
- Candidatura
- Follow-up
- Resposta
- Entrevista

Botões:
- Restaurar padrões
- Novo template

Cards:
- nome
- badge de tipo
- badge Padrão quando aplicável
- preview curto
- variáveis usadas
- ações Preview, Editar, Excluir

Templates mockados:

1. Job - Candidatura direta
"Olá {{company_name}}, vi a oportunidade para {{job_title}} e acredito que meu perfil com {{matched_keywords}} se encaixa bem..."

2. Job - Destaque React/TypeScript
"Tenho experiência prática com {{matched_keywords}} e gostaria de me candidatar para {{job_title}}..."

3. Job - Follow-up educado
"Olá {{company_name}}, passando para acompanhar minha candidatura para {{job_title}} enviada recentemente..."

4. Job - Resposta a recrutador
"Obrigado pelo retorno sobre {{job_title}}. Fico à disposição para avançarmos..."

5. Job - Agradecimento pós-entrevista
"Obrigado pela conversa sobre {{job_title}}. Gostei de entender melhor o desafio..."

=========================================================
TEMPLATES - FREELANCE
=========================================================

Tela Templates no modo Freelance.

Título:
"Templates comerciais"

Tabs:
- Todos
- 1o Contato
- Follow-up
- Sem Site
- Site Fraco
- Linktree
- Sem Anúncios

Botões:
- Restaurar padrões
- Novo template

Cards:
- nome
- badge de categoria
- badge Padrão quando aplicável
- preview curto
- ações Preview, Editar, Excluir

Templates mockados:
- Sem Site - Demo Pronta
- Sem Site - Impacto Visual
- Site Fraco - Demo Comparativa
- Site Fraco - Upgrade Direto
- Linktree - Site Real
- Linktree - Reputação Merecida
- Sem Anúncios - Base Digital
- Sem Anúncios - Concorrentes na Frente
- Geral - Demo Direto
- Geral - Resultado na Mão
- [EN] No Website - Demo Ready
- [EN] Linktree - Professional Site

Variáveis:
- {{business_name}}
- {{niche}}
- {{city}}
- {{demo_url}}
- {{offer_price}}
- {{installments}}
- {{website_score}}
- {{seller_name}}
- {{seller_whatsapp}}

=========================================================
CONFIGURAÇÕES - FULL-TIME
=========================================================

Tela Configurações no modo Full-time.

Alert:
"Configure seu perfil profissional e currículo antes de buscar vagas."

Seções:

1. Perfil profissional
- Nome
- Título profissional
- Email de candidatura
- LinkedIn
- Portfólio/GitHub

2. Currículo
- currículo padrão
- upload simulado
- nome do arquivo
- botão "Definir como padrão"

3. Preferências de vaga
- cargos alvo
- senioridade
- modalidade
- países/regiões
- faixa salarial desejada

4. Keywords
- keywords principais
- keywords negativas
- chips editáveis
- fallback: reactjs, typescript, nextjs, nodejs

5. Assinatura de email
- textarea
- preview

Botão:
"Salvar configurações"

=========================================================
CONFIGURAÇÕES - FREELANCE
=========================================================

Tela Configurações no modo Freelance.

Seguir visual das imagens:
- alerta vermelho/rosa se dados estiverem padrão
- card central de formulário
- inputs escuros
- botão azul grande

Alert:
"Dados do vendedor ainda com valores padrão. Configure antes de prospectar."

Seções:

1. País / Região
- país
- código do país
- moeda

2. Dados do vendedor
- nome
- título profissional
- WhatsApp
- link WhatsApp preview

3. Preço
- valor da landing page
- parcelas
- preview: "12x de R$ 250,00"
- total

4. Oferta
- promessa principal
- prazo estimado
- observações

Botão:
"Salvar configurações"

=========================================================
DADOS MOCKADOS E TIPOS
=========================================================

Crie tipos:

OpportunityMode:
- fulltime
- freelance

Lead:
- id
- opportunity_type
- campaign_id
- business_name
- contact_name
- headline
- job_title
- category
- city
- region
- country
- phone
- email
- website_url
- website_status
- source_name
- source_url
- source_query
- source_evidence
- matched_keywords
- job_stage
- lead_score
- lead_temperature
- crm_stage
- demo_url
- resume_attachment_id
- operator_notes
- captured_at
- updated_at

Campaign:
- id
- opportunity_type
- name
- status
- target_niche
- target_role
- target_region
- market_scope
- keywords
- created_at

MessageTemplate:
- id
- mode
- name
- channel
- message_stage
- template_kind
- content
- variables_schema
- is_active

ResumeAttachment:
- id
- display_name
- file_name
- mime_type
- is_default

PromptArtifact:
- id
- lead_id
- variant
- title
- generated_prompt
- copied_at
- created_at

Interaction:
- id
- lead_id
- interaction_type
- channel
- summary
- created_at

=========================================================
MOCK SERVICES / FUTUROS ENDPOINTS FASTAPI
=========================================================

Crie uma camada mockApi com funções assíncronas:

- getDashboard(mode)
- listCampaigns(mode)
- createCampaign(mode, payload)
- startCampaignJob(campaignId)
- pauseCampaignJob(campaignId)
- stopCampaignJob(campaignId)
- listLeads(mode, filters)
- getLead(mode, leadId)
- updateLead(mode, leadId, patch)
- listTemplates(mode)
- createTemplate(mode, payload)
- generateFulltimeEmail(leadId, templateId, resumeId)
- markApplicationSent(leadId)
- generateFreelancePrompt(leadId, variant)
- saveDemoUrl(leadId, demoUrl)
- generateFreelanceMessage(leadId, templateId, stage)
- listResumeAttachments()
- updateSettings(mode, payload)

Comentários de endpoints futuros:
- GET /api/{mode}/dashboard
- GET /api/{mode}/campaigns
- POST /api/{mode}/campaigns
- POST /api/{mode}/campaigns/{id}/start
- GET /api/{mode}/leads
- GET /api/{mode}/leads/{id}
- PATCH /api/{mode}/leads/{id}
- GET /api/{mode}/templates
- POST /api/fulltime/leads/{id}/generate-email
- POST /api/fulltime/leads/{id}/mark-sent
- POST /api/freelance/leads/{id}/generate-lovable-prompt
- POST /api/freelance/leads/{id}/generate-message

=========================================================
INTERAÇÕES OBRIGATÓRIAS
=========================================================

Implementar:

- trocar modo Full-time/Freelance
- navegação por sidebar
- criar campanha por modo
- simular busca/coleta com loading
- pausar/parar job simulado
- filtrar listas
- selecionar linhas
- ações em massa
- abrir página de detalhe
- editar notas
- alterar status
- preparar email full-time
- marcar candidatura como enviada
- salvar demo URL freelance
- abrir modal de mega prompt Lovable
- copiar prompt
- gerar mensagem freelance por template
- copiar mensagem
- simular envio por email
- simular envio por WhatsApp
- criar/editar template
- salvar configurações por modo
- empty states
- loading states
- toasts

=========================================================
RESPONSIVIDADE
=========================================================

Desktop:
- sidebar fixa
- header com mode switch
- tabelas completas
- detalhe em duas colunas
- cards em grid

Tablet:
- sidebar colapsável
- tabelas com scroll horizontal
- cards em duas colunas

Mobile:
- sidebar vira drawer
- mode switch no topo
- tabelas viram cards
- filtros viram accordion/drawer
- modais ocupam quase tela inteira
- botões com mínimo 44px de altura
- action bar em seleção fica sticky bottom

=========================================================
DESIGN SYSTEM
=========================================================

Cores:
- background: #050B16
- sidebar: #0B1628
- surface/card: #0F1B2E
- elevated: #111F35
- border: #20304A
- text primary: #E5EDF7
- text secondary: #8EA0B8
- primary blue: #2F7DF6
- primary hover: #1F6FE5
- mode freelance purple: #8B5CF6
- status yellow/orange: #F59E0B
- success: #22C55E
- danger: #EF4444
- hot: #F97316
- warm: #EAB308
- cold: #38BDF8

Tipografia:
- Inter
- H1 28-36px, font-weight 750
- H2 20-28px, font-weight 700
- Body 14-16px
- Tabela 12-13px
- Labels 12px

Componentes:
- Button primary
- Button secondary
- Button ghost
- Button destructive
- Badge
- Tabs/segmented control
- Card
- Modal
- Table
- Form input
- Select
- Textarea
- Toast
- Progress bar
- Score ring
- Empty state
- Skeleton loading

Motion:
- transições 150-250ms
- fade/scale leve em modal
- skeleton em loading
- respeitar reduced motion

=========================================================
ACESSIBILIDADE E PERFORMANCE
=========================================================

Obrigatório:
- contraste WCAG AA
- foco visível
- navegação por teclado
- aria-label em botões de ícone
- labels em inputs
- estados disabled/loading claros
- sem dependências pesadas
- não usar chamadas externas reais
- não depender de imagens externas
- usar mock data local

=========================================================
ANTI-REQUISITOS
=========================================================

Não faça:

- Não criar landing page pública.
- Não criar aba "Todas" misturando Full-time e Freelance.
- Não misturar vagas e prospects na mesma tabela.
- Não mostrar demo URL no detalhe Full-time.
- Não mostrar currículo no detalhe Freelance.
- Não usar templates freelance em candidatura.
- Não usar templates de candidatura em prospecção.
- Não esconder a página de detalhe do lead.
- Não deixar "Gerar Prompt Lovable" apenas como botão sem modal completo.
- Não criar apenas cards estáticos sem navegação.
- Não fazer o modo Full-time parecer variação pequena do Freelance.
- Não fazer o modo Freelance parecer variação pequena do Full-time.

=========================================================
CHECKLIST FINAL DE ACEITAÇÃO
=========================================================

Antes de considerar pronto:

[ ] Existe mode switch global Full-time/Freelance no header.
[ ] O modo ativo muda todo o app, não apenas filtra uma tabela.
[ ] Não existe aba "Todas".
[ ] Dashboard Full-time é específico de vagas/candidaturas.
[ ] Dashboard Freelance é específico de prospecção/demos/mensagens.
[ ] Campanhas Full-time usam cargo, senioridade, keywords e fonte LinkedIn.
[ ] Campanhas Freelance usam nicho, mercado, país, estado e cidade.
[ ] Leads Full-time mostram empresa, cargo, email, keywords, score e status de candidatura.
[ ] Leads Freelance mostram negócio, telefone, email, nicho, score, temperatura e status comercial.
[ ] Cada modo tem página de detalhe própria.
[ ] Detalhe Full-time tem evidência da vaga, currículo, template e preview de email.
[ ] Detalhe Freelance tem informações, análise do site, score circular, demo URL, prompt e mensagem.
[ ] Modal de mega prompt Lovable existe e é completo.
[ ] Gerador de mensagens freelance usa templates cadastrados.
[ ] Templates Full-time e Freelance são coleções separadas.
[ ] Configurações Full-time e Freelance são telas separadas.
[ ] Loading de worker aparece em buscas/coletas.
[ ] Empty states são específicos por modo.
[ ] UI segue dark mode das imagens de referência.
[ ] App parece produto final, não wireframe.
[ ] Código é organizado e pronto para trocar mockApi por FastAPI.

Agora gere o código completo da aplicação prototipada, pronta para rodar no Lovable, com visual de produto final e com todos os fluxos descritos acima.
```
