# Treino de problemas de repositório

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
