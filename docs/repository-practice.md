# Treino de problemas de repositório

## Roteiro completo: ambiente, arquivos e implementação

Na primeira resposta de um problema, Repository agora segue esta ordem:

1. **O que eu entendi**: entradas, comportamento e saída em linguagem simples, com fala de entrevista.
2. **Perguntas de clarificação**: três a cinco decisões úteis e as suposições adotadas.
3. **Ambiente e stack**: ferramentas exigidas pelo enunciado, observadas na tela e propostas, com justificativa.
4. **Instalação e execução**: comandos, pasta em que rodar, dependências, inicialização, build e resultado esperado.
5. **Organização de arquivos**: árvore proposta, responsabilidades, imports/entrypoint e fluxo de dados.
6. **Arquitetura e fluxo**: diagrama Mermaid dos arquivos e dados/eventos, seguido de legenda.
7. **Plano por requisitos**: tabela que relaciona cada comportamento a arquivo e checagem.
8. **Construção passo a passo**: três a cinco incrementos por responsabilidade em tarefas com vários
   arquivos; dois bastam para uma mudança pequena.
9. **Validação**: testes/checks, resultados esperados, complexidade e trade-offs.
10. **Suposições e incertezas**: o que ainda falta instalar, colar, executar ou confirmar.

Cada incremento usa os mesmos cards de Code Problem: arquivo/ação no título, objetivo, código
completo, teste ou check manual reproduzível, resultado esperado, explicação e **Fala para entrevista**.
O texto descreve a sequência sem repetir o mesmo componente inteiro em várias seções. Uma continuação
do mesmo exercício mostra diagnóstico, próximo incremento e validação; um problema novo reinicia o
guia. Uma conclusão com evidências encerra o exercício sem inventar novas alterações.

A árvore, o diagrama, os imports e os códigos devem representar a mesma implementação. Para uma
lista interativa, a proposta pode separar dados, seleção pura e componentes de interface, explicando
por que isso basta. Cada arquivo novo alterado pelo exercício deve ter conteúdo completo e ligação
com o entrypoint. O roteiro pede exemplos concretos antes/depois, incluindo filtros combinados e
resultado vazio; não deve prometer módulos na árvore e concentrar todas as regras em `App.jsx`.

Os cards usam o mesmo realce de sintaxe do Markdown principal. `filePath`, `codeLanguage`,
`testLanguage` e `testKind` são metadados opcionais: respostas antigas continuam funcionando, com
inferência de linguagem pelo arquivo/código e detecção de checks manuais identificados. Checks
manuais aparecem como instruções Markdown; testes executáveis mantêm blocos de código. Falas dos
cards e citações no texto compartilham o destaque azul. Rótulos antigos inline como
`**Interview speech** → ...` passam a uma citação, preservando a explicação e os blocos de código.

O diagrama e sua legenda renderizam lado a lado quando há espaço e empilham no celular; o diagrama
pode ser ampliado e fechado com Escape. O Mermaid usa o renderer estrito existente e mantém fonte
visível se a renderização falhar. A validação v3 exige o par diagrama/legenda na resposta inicial e
mantém uma tentativa de reparo. A próxima geração renova guias anteriores uma vez. A apresentação
de respostas antigas melhora ao recarregar, mas seu conteúdo só muda com uma nova geração.
Testes estruturais não garantem a qualidade semântica de todos os arquivos produzidos pelo modelo;
o smoke com provedor real continua necessário.

Um `script.js` com comentários e um array incompleto não prova que React/Vite esteja instalado nem
que esse framework seja obrigatório. Se o enunciado pedir React (ou permitir essa escolha), o tutor
pode propor React + Vite e orientar sua criação numa **pasta nova**. Com um manifest/lockfile visível,
deve reutilizar os scripts e convenções existentes em vez de recriar o projeto. Exemplo de comando
de scaffolding confirmado na [documentação do Vite](https://vite.dev/guide/):

```bash
node --version
npm --version
npm create vite@latest product-dashboard -- --template react
cd product-dashboard
npm install
npm run dev
npm run build
```

Para TypeScript, o template proposto é `react-ts` e os arquivos JSX usam `.tsx`. As versões de Node
devem atender aos engines da ferramenta escolhida. `npm run dev` inicia o servidor; não é um teste.
O template básico do Vite não cria `npm test`: o tutor deve mostrar a configuração de um runner ou
fornecer checks manuais explícitos. Dados reais ausentes não devem ser inventados; fixtures sintéticas
servem apenas a testes claramente identificados.

As duas fases do provedor consideram o progresso de instalação/ambiente além do código. Respostas
sem a estrutura mínima, fala, comandos, árvore ou pares completos recebem uma tentativa de reparo;
se ela falhar, o app mostra um erro seguro em vez de aceitar o guia incompleto. O contrato novo
invalida uma vez a comparação antiga de screenshots para permitir uma próxima resposta atualizada.

## Modelos para comparar velocidade

O Capture 0.1.2 oferece `gpt-6-luna`, `gpt-6.1-terra`, `gpt-6.1-sol` e `gpt-6-astra`, mantendo
as opções anteriores e a seleção salva. Conforme a documentação oficial consultada em 2026-11-11:

| Opção | Uso para comparar |
| --- | --- |
| [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) | Tarefas focadas e alta eficiência |
| [GPT-6.1 Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra) | Raciocínio visual rápido para screenshots |
| [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) | Código complexo e equilíbrio de capacidade/custo |
| [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra) | Maior capacidade para tarefas exigentes |

Todos esses modelos suportam imagens, Chat Completions e saída estruturada. Os pedidos GPT-6 do
app usam `max_completion_tokens`, `reasoning_effort: low` e omitem `temperature`, de acordo com o
[guia de parâmetros](https://developers.openai.com/api/docs/guides/latest-model). Modelos anteriores
mantêm os controles existentes; nenhum plano de processamento premium é ativado.

Selecione o modelo em **Capture → Analysis model** após instalar a versão nova. Comece comparando
Terra e Sol com as mesmas telas e requisitos; Luna é outra opção para casos focados. Acesso depende
da conta/provedor. Não foi feito benchmark nem chamada real nesta alteração. O fluxo continua com
leitura visual seguida de geração, e um guia inicial detalhado produz mais texto que uma continuação;
tempo total depende também de tokens, screenshots, rede e eventual reparo.

## Como usar as instruções específicas

1. Abra a sessão no Response web e selecione **Code practice → Repository**.
2. Em **Antes do treino: instruções específicas (opcional)**, cole o prompt, enunciado ou e-mail
   completo. Não é necessário transformar o texto em um formato especial.
3. Clique em **Continuar com instruções**. Se não houver contexto extra, escolha
   **Pular / continuar sem instruções**.
4. Tenha pelo menos um screenshot autorizado disponível e clique em **Generate**, ou use **Auto**.
   A etapa não inicia uma chamada por si só no modo On demand.
5. Use **Editar instruções** para alterar o contexto. Para remover o texto anterior, escolha
   **Pular / continuar sem instruções**. A próxima geração considera a alteração mesmo se a tela
   capturada continuar igual.

O contexto pode incluir requisitos, linguagem/plataforma, duração, formato do dataset, ambiente,
critérios de aceitação e regras do teste. Ele complementa o diagnóstico, evidências, continuação
incremental, roteiro de entrevista, construção passo a passo, mudanças concretas, versão final
relevante, validação e suposições que já existiam. Um e-mail sem o enunciado técnico não fornece
detalhes suficientes para inventar o problema: o modelo deve explicitar o que ainda falta.

O limite é de 16.000 caracteres. O texto confirmado e a decisão de pular ficam por sessão na aba
atual (`sessionStorage`), inclusive após recarregar. Não sincronizam para outro dispositivo/navegador.
Sem acesso ao armazenamento do navegador, funcionam em memória até recarregar. O texto é enviado ao
provedor nas gerações de Repository; não há nova tabela de prompts nem gravação do texto bruto nos
logs. Orientações e análises produzidas pelo modelo continuam sujeitas à retenção normal da sessão.
Quando a aba recebe a exclusão/expiração da sessão, ela remove também as instruções salvas nela.

Instruções coladas são contexto do exercício, não substituem as instruções do sistema, o formato
da resposta ou as evidências observáveis. Links e dados de agendamento do e-mail não são abertos.
Os modos Code Problem, System Design, Exam Study e Conversation não recebem esse campo.

## Exemplo de contexto para preparação

```text
Preparação para uma entrevista de live coding em projeto mobile.
Janela de treino: 90 minutos.
Será fornecido um conjunto detalhado de requisitos e um dataset JSON ou CSV.
Ambiente, linguagem e emulador/simulador devem estar configurados e testados antes do treino.
Praticar implementação incremental, execução de testes e comunicação clara das decisões e trade-offs.
O enunciado técnico e a plataforma escolhida ainda não foram fornecidos: não invente esses detalhes.
Na avaliação real não são permitidos IA, código externo ou soluções prontas.
Este contexto é para estudo prévio; manter o roteiro de entrevista e o passo a passo do Repository.
```

## Fonte de treino próxima desse formato

O [Mobile Take-Home Project da Block/Square](https://square.github.io/microsite/mobile-interview-project/)
publica um desafio de diretório de funcionários para Android/iOS, com dados JSON, recarregamento,
imagens, estados de carregamento/vazio/erro e testes unitários. Há endpoints de dados normais, vazios
e malformados. O projeto original estima 4–5 horas; não é uma reprodução do teste da Toptal.

Adaptação proposta para um simulado de 90 minutos:

- 0–10 min: leia requisitos e JSON, esclareça campos obrigatórios, identifique o menor fluxo útil.
- 10–25 min: implemente modelo/parser e teste de dataset válido e malformado.
- 25–55 min: mostre lista e estados de carregamento, vazio e erro no emulador.
- 55–70 min: adicione recarregamento e teste o comportamento principal.
- 70–85 min: execute testes, corrija falhas e verifique a interface.
- 85–90 min: apresente decisões, limitações e o próximo incremento.

Esse recorte não conclui todos os requisitos do take-home original (por exemplo, cache de imagens).
Use o enunciado como exercício e escreva sua própria implementação. Depois, repita sem IA nem
consulta a soluções, seguindo as regras recebidas para a avaliação real.

Para reforçar sintaxe e testes na linguagem, o [Exercism Kotlin](https://exercism.org/tracks/kotlin)
oferece exercícios gratuitos. É complementar: não substitui o treino de app mobile no emulador.
