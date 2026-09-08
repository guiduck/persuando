# Mapa rápido de System Design

Use esta folha como apoio para reconhecer as peças mais comuns de uma arquitetura. Em uma entrevista, comece pelo problema e pelos requisitos; só depois escolha os componentes que realmente ajudam.

## Load balancer

**O que faz:** distribui requisições entre várias instâncias do serviço. Pode decidir o destino por round robin, menor número de conexões, peso, região ou estado de saúde.

**Quando considerar:** quando uma única instância não suporta o tráfego ou quando o sistema precisa continuar disponível se uma instância falhar.

### ✅ Pontos positivos

- ✅ **Escala e disponibilidade:** permite adicionar servidores e retirar instâncias com falha.
- ✅ **Health checks:** evita enviar tráfego para servidores que não estão saudáveis.
- ✅ **Roteamento:** pode direcionar tráfego por região, versão ou tipo de requisição.

### ⚠️ Trade-offs e custos

- ⚠️ **Novo ponto crítico:** precisa de redundância para não virar um ponto único de falha.
- ⚠️ **Estado de sessão:** sessões presas a uma instância dificultam a distribuição; prefira estado compartilhado ou tokens.
- ⚠️ **Operação adicional:** certificados, timeouts, retries e health checks precisam ser configurados corretamente.

> **Fala para entrevista:** “Eu colocaria um load balancer na entrada para distribuir o tráfego entre instâncias saudáveis e permitir escala horizontal. Também evitaria estado local nas instâncias.”

## Escalamento vertical vs. horizontal

**Vertical:** aumenta CPU, memória ou disco de uma máquina. **Horizontal:** adiciona mais máquinas ou instâncias trabalhando juntas.

### ✅ Pontos positivos

- ✅ **Vertical é simples:** normalmente exige poucas mudanças na aplicação.
- ✅ **Horizontal aumenta resiliência:** a perda de uma instância não precisa derrubar todo o serviço.
- ✅ **Horizontal cresce gradualmente:** capacidade pode acompanhar a demanda.

### ⚠️ Trade-offs e custos

- ⚠️ **Vertical tem limite físico:** máquinas maiores ficam caras e ainda representam uma unidade de falha.
- ⚠️ **Horizontal exige coordenação:** estado, concorrência, balanceamento e consistência ficam mais complexos.
- ⚠️ **Mais máquinas, mais operação:** deploy, observabilidade e debugging tornam-se distribuídos.

> **Fala para entrevista:** “Eu começaria verticalmente pela simplicidade, mas desenharia o serviço sem estado para poder escalar horizontalmente quando tráfego e disponibilidade justificarem.”

## Cache

**O que faz:** guarda dados acessados com frequência em uma camada mais rápida, como memória local, Redis ou Memcached, reduzindo latência e carga no banco.

**Estratégias comuns:** cache-aside, write-through, write-back e TTL.

### ✅ Pontos positivos

- ✅ **Menor latência:** respostas frequentes podem evitar consultas ou cálculos caros.
- ✅ **Menos carga:** protege banco de dados e serviços downstream.
- ✅ **Absorve picos:** itens populares podem ser servidos sem repetir o trabalho de origem.

### ⚠️ Trade-offs e custos

- ⚠️ **Invalidação é difícil:** dados podem ficar desatualizados ou inconsistentes.
- ⚠️ **Cache stampede:** muitas requisições podem recalcular o mesmo item expirado ao mesmo tempo.
- ⚠️ **Memória custa:** é preciso escolher tamanho, TTL e política de expulsão.

> **Fala para entrevista:** “Eu usaria cache-aside para as leituras mais frequentes, com TTL e proteção contra stampede. Aceito uma janela curta de dados desatualizados porque este requisito permite consistência eventual.”

## CDN

**O que faz:** mantém conteúdo em pontos de presença próximos dos usuários. É especialmente útil para imagens, vídeos, JavaScript, CSS e respostas públicas cacheáveis.

### ✅ Pontos positivos

- ✅ **Menor latência global:** o conteúdo percorre uma distância menor até o usuário.
- ✅ **Protege a origem:** reduz tráfego e picos nos servidores principais.
- ✅ **Entrega otimizada:** CDNs oferecem compressão, TLS e mitigação de ataques na borda.

### ⚠️ Trade-offs e custos

- ⚠️ **Conteúdo desatualizado:** invalidações podem levar tempo e aumentar custo.
- ⚠️ **Não serve qualquer dado:** conteúdo privado ou altamente dinâmico exige regras cuidadosas.
- ⚠️ **Dependência externa:** falhas e preços do provedor entram na arquitetura.

> **Fala para entrevista:** “Para conteúdo estático e público, eu colocaria uma CDN à frente do object storage. Definiria cache-control e versionaria os arquivos para evitar invalidação ambígua.”

## SQL vs. NoSQL

**SQL:** tabelas, esquema explícito, joins e transações fortes. **NoSQL:** família de modelos como chave-valor, documento, wide-column e grafo, normalmente otimizada para padrões específicos de acesso e distribuição.

### ✅ Pontos positivos

- ✅ **SQL:** ótimo para relações, consultas flexíveis, integridade e transações ACID.
- ✅ **NoSQL:** pode oferecer escala horizontal simples e alto throughput para acessos previsíveis.
- ✅ **Escolha por acesso:** cada armazenamento pode ser selecionado a partir das consultas e garantias necessárias.

### ⚠️ Trade-offs e custos

- ⚠️ **SQL distribuído é mais complexo:** joins e transações globais podem custar latência e coordenação.
- ⚠️ **NoSQL limita consultas:** frequentemente exige desnormalização e decisões antecipadas sobre padrões de acesso.
- ⚠️ **Mais de um banco aumenta operação:** backups, observabilidade, conhecimento e consistência entre sistemas ficam mais difíceis.

> **Fala para entrevista:** “Eu não escolheria NoSQL apenas por escala. Como precisamos de transações e relações claras, começaria com SQL; mudaria ou adicionaria outro modelo somente se um padrão de acesso concreto justificar.”

## Sharding

**O que faz:** divide os dados em grupos e coloca cada grupo em um shard diferente. Uma chave de shard, como `userId`, determina onde cada registro vive.

### ✅ Pontos positivos

- ✅ **Mais capacidade de escrita e armazenamento:** o trabalho é dividido entre máquinas.
- ✅ **Falhas podem ser isoladas:** um shard pode ser tratado sem parar todos os dados.
- ✅ **Escala por domínio:** uma boa chave mantém dados relacionados próximos.

### ⚠️ Trade-offs e custos

- ⚠️ **Chave ruim cria hotspots:** alguns shards podem receber muito mais carga que outros.
- ⚠️ **Consultas entre shards custam:** agregações, joins e transações globais exigem coordenação.
- ⚠️ **Operação complexa:** roteamento, rebalanceamento, backups e recuperação passam a envolver vários bancos.

> **Fala para entrevista:** “Eu escolheria uma chave de shard de alta cardinalidade que acompanhe nossos padrões de acesso. Antes de shardear, confirmaria que réplicas, índices e cache já não resolvem o gargalo.”

## Hashing consistente

**O que faz:** posiciona nós e chaves em um anel lógico. Quando um nó entra ou sai, apenas uma parte das chaves muda de destino, em vez de quase todas.

### ✅ Pontos positivos

- ✅ **Menos movimentação:** facilita adicionar ou remover nós de cache e armazenamento distribuído.
- ✅ **Boa base para distribuição:** reduz remapeamentos em clusters elásticos.
- ✅ **Virtual nodes ajudam:** vários pontos por servidor melhoram o equilíbrio e permitem pesos diferentes.

### ⚠️ Trade-offs e custos

- ⚠️ **Não garante equilíbrio sozinho:** distribuição ruim exige virtual nodes e monitoramento.
- ⚠️ **Nós heterogêneos complicam pesos:** capacidades diferentes precisam ser representadas.
- ⚠️ **Falhas ainda causam carga:** as chaves do nó perdido migram para vizinhos, que precisam suportar o pico.

> **Fala para entrevista:** “Usaria hashing consistente com virtual nodes para que mudanças no cluster remapeiem apenas parte das chaves e para distribuir melhor a carga.”

## Resharding

**O que faz:** altera a quantidade ou os limites dos shards e move dados para recuperar equilíbrio ou adicionar capacidade.

### ✅ Pontos positivos

- ✅ **Recupera equilíbrio:** corrige shards muito grandes ou muito acessados.
- ✅ **Permite crescimento:** adiciona capacidade sem recriar todo o sistema de uma vez.
- ✅ **Pode ser gradual:** migrações em lotes reduzem risco operacional.

### ⚠️ Trade-offs e custos

- ⚠️ **Movimentação é cara:** consome rede, disco e CPU enquanto o sistema continua atendendo tráfego.
- ⚠️ **Escritas concorrentes:** exigem dual-write, forwarding ou uma janela controlada de migração.
- ⚠️ **Risco de inconsistência:** roteamento e dados precisam mudar de forma coordenada e observável.

> **Fala para entrevista:** “Planejaria resharding online em pequenos lotes, com estado de migração por faixa, verificação de consistência e rollback antes de trocar o roteamento definitivamente.”

## Replicação

**O que faz:** mantém cópias dos mesmos dados em nós diferentes. Pode usar líder-seguidores, múltiplos líderes ou modelos sem líder.

### ✅ Pontos positivos

- ✅ **Disponibilidade:** outra réplica pode atender quando um nó falha.
- ✅ **Escala de leitura:** réplicas podem distribuir consultas de leitura.
- ✅ **Recuperação:** cópias em regiões ou zonas distintas reduzem impacto de falhas locais.

### ⚠️ Trade-offs e custos

- ⚠️ **Replication lag:** uma leitura pode receber dados antigos.
- ⚠️ **Failover não é instantâneo:** eleição e promoção precisam evitar dois líderes ativos.
- ⚠️ **Mais cópias custam:** armazenamento, rede e operação aumentam.

> **Fala para entrevista:** “Usaria um líder para escritas e réplicas para leitura e disponibilidade. Para operações que precisam ler a própria escrita, rotearia a leitura ao líder ou usaria uma garantia de sessão.”

## Índices de banco de dados

**O que fazem:** criam estruturas auxiliares, geralmente árvores B ou índices invertidos, para encontrar dados sem percorrer toda a tabela.

### ✅ Pontos positivos

- ✅ **Consultas mais rápidas:** filtros, ordenação e joins podem evitar scans completos.
- ✅ **Unicidade:** índices únicos também protegem invariantes.
- ✅ **Índices compostos:** podem atender um padrão de consulta inteiro.

### ⚠️ Trade-offs e custos

- ⚠️ **Escritas ficam mais caras:** cada índice precisa ser atualizado.
- ⚠️ **Consomem espaço:** índices grandes competem por memória e disco.
- ⚠️ **Ordem importa:** um índice composto inadequado pode não ajudar a consulta esperada.

> **Fala para entrevista:** “Eu criaria índices a partir das consultas críticas e validaria com o plano de execução. Evitaria indexar tudo porque cada índice aumenta custo de escrita e armazenamento.”

## Filas e event streams

**O que fazem:** desacoplam produtores e consumidores. Filas normalmente distribuem tarefas; streams mantêm uma sequência de eventos que pode ser lida por diferentes consumidores.

### ✅ Pontos positivos

- ✅ **Absorvem picos:** consumidores processam no ritmo suportado.
- ✅ **Desacoplam serviços:** produtor não precisa esperar todo o processamento downstream.
- ✅ **Retries e replay:** trabalhos podem ser repetidos e eventos podem reconstruir estado.

### ⚠️ Trade-offs e custos

- ⚠️ **Consistência eventual:** o resultado não aparece imediatamente.
- ⚠️ **Duplicatas acontecem:** consumidores precisam ser idempotentes.
- ⚠️ **Backlog exige operação:** atraso, dead-letter queue, ordenação e retenção precisam ser monitorados.

> **Fala para entrevista:** “Colocaria o trabalho não interativo em uma fila para proteger a latência da requisição. O consumidor será idempotente e terá retry com backoff e dead-letter queue.”

## Rate limiting

**O que faz:** limita quantas requisições um usuário, token, IP ou serviço pode executar em uma janela. Algoritmos comuns incluem token bucket, leaky bucket e sliding window.

### ✅ Pontos positivos

- ✅ **Protege capacidade:** reduz abuso e impede que um cliente monopolize o sistema.
- ✅ **Controla custo:** limita operações caras e chamadas a provedores externos.
- ✅ **Degradação previsível:** respostas `429` permitem retry controlado.

### ⚠️ Trade-offs e custos

- ⚠️ **Pode bloquear uso legítimo:** limites e dimensões ruins prejudicam clientes reais.
- ⚠️ **Estado distribuído custa:** limites globais normalmente exigem armazenamento compartilhado.
- ⚠️ **Retry sincronizado piora picos:** clientes precisam de backoff e jitter.

> **Fala para entrevista:** “Usaria token bucket por usuário e por rota, retornando `429` com orientação de retry. Para disponibilidade, aceitaria pequena imprecisão entre regiões se o requisito permitir.”

## Consistência, disponibilidade e CAP

**Ideia central:** durante uma partição de rede, um sistema distribuído precisa priorizar respostas disponíveis ou consistência forte. Fora de partições, a escolha real inclui latência, coordenação e o nível de consistência exigido por cada operação.

### ✅ Pontos positivos

- ✅ **Consistência forte simplifica invariantes:** útil para saldo, estoque crítico e unicidade.
- ✅ **Consistência eventual melhora disponibilidade:** adequada para feeds, métricas e contadores aproximados.
- ✅ **Escolha por operação:** o mesmo produto pode usar garantias diferentes em fluxos diferentes.

### ⚠️ Trade-offs e custos

- ⚠️ **Coordenação aumenta latência:** consenso e quórum exigem comunicação entre nós.
- ⚠️ **Disponibilidade pode cair:** uma operação consistente pode recusar escrita durante partição.
- ⚠️ **Eventual exige reconciliação:** conflitos, ordem e experiência com dados antigos precisam ser definidos.

> **Fala para entrevista:** “Eu definiria consistência por operação: pagamento exige garantia forte, enquanto métricas podem ser eventualmente consistentes. Assim não pago o custo máximo em todo o sistema.”

## Object storage

**O que faz:** armazena blobs como imagens, vídeos, backups e documentos por uma chave, normalmente com alta durabilidade e integração com CDN.

### ✅ Pontos positivos

- ✅ **Escala e durabilidade:** adequado para grandes volumes de arquivos.
- ✅ **Custo menor que banco relacional:** evita colocar blobs grandes nas tabelas transacionais.
- ✅ **Upload direto:** URLs assinadas podem tirar o tráfego pesado do servidor da aplicação.

### ⚠️ Trade-offs e custos

- ⚠️ **Não substitui banco consultável:** metadados e relações normalmente ficam em outro armazenamento.
- ⚠️ **Permissões são sensíveis:** buckets e URLs precisam ser privados por padrão.
- ⚠️ **Consistência de ciclo de vida:** exclusão de metadado e objeto precisa ser coordenada.

> **Fala para entrevista:** “Guardaria o arquivo no object storage e apenas metadados no banco. O cliente enviaria por URL assinada curta e a entrega passaria pela CDN quando o acesso permitisse.”

## Checklist de decisão rápida

1. Quais são os requisitos funcionais e não funcionais?
2. Qual é a escala de leitura, escrita, armazenamento e pico?
3. Que dados precisam de consistência forte?
4. Qual falha precisamos tolerar: processo, máquina, zona ou região?
5. Onde estão os maiores custos de latência?
6. Qual é a solução mínima que atende hoje?
7. Qual componente será adicionado somente quando uma métrica justificar?

> **Fala para entrevista:** “Vou começar pela solução mínima e pelos requisitos. Em cada evolução, explicarei qual gargalo ela resolve e qual novo custo operacional ela introduz.”
