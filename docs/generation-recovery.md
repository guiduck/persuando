# Recuperação automática da geração

Quando uma geração do provedor OpenAI-compatible falha por resposta inválida, o backend tenta
recuperar a etapa que falhou. Isso funciona tanto no Generate manual quanto no Auto, sem um novo
clique. A falha relatada em 2026-11-11 motivou a mudança; sua causa específica não foi comprovada
por logs de produção nesta implementação.

1. O reparo rápido existente continua: JSON inválido/truncado ou artefatos obrigatórios ausentes
   recebem uma tentativa com as instruções e o orçamento ampliados já usados pelo app.
2. Se a falha persistir, uma chamada ao **mesmo modelo configurado** analisa o erro seguro, os
   detalhes disponíveis da rejeição HTTP, o último prompt efetivamente enviado, o motivo de término
   e até 12.000 caracteres da resposta inválida. Uma rejeição de pedido ou envelope HTTP/JSON inválido
   pode chegar diretamente ao diagnóstico quando não há reparo rápido aplicável.
3. Se o diagnóstico identificar uma causa corrigível no prompt, retorna uma instrução pontual de
   até 1.800 caracteres. O backend acrescenta essa instrução ao prompt da etapa e gera novamente
   uma única vez. Os requisitos originais, idioma, modelo, instruções de sistema, formato e
   validadores continuam valendo. Corrigir a resposta final não repete a análise visual já aceita.
4. Sem correção válida, se o diagnóstico falhar ou se a resposta corrigida continuar inválida,
   o erro seguro aparece pelo fluxo existente. A última resposta aceita continua disponível.

Há no máximo **um diagnóstico e uma tentativa com prompt corrigido por geração**, compartilhados
entre análise visual e resposta. O diagnóstico usa até 1.200 tokens de saída, tem timeout de 30
segundos e não tem retry de transporte. Não começa se a geração já passou de cinco minutos, para
reservar tempo dentro da espera de dez minutos do web. A tentativa corrigida mantém o orçamento
ampliado e o timeout de quatro minutos da etapa; retries transitórios de rede/HTTP já existentes
continuam limitados separadamente. Recuperação pode aumentar custo e tempo em gerações com erro.

Chave inválida, cota, rate limit, timeout, rede e indisponibilidade não acionam reescrita do prompt.
Falta de screenshot também não aciona diagnóstico. Incompatibilidade de parâmetros/modelo não pode
ser resolvida trocando configuração pelo diagnóstico; ele deve recusar uma correção por prompt.
Não existe promessa de recuperar todos os erros nem de corrigir a qualidade semântica de código
que já passou na validação estrutural.

O prompt e o trecho da resposta ficam só na memória da chamada. O diagnóstico recebe as partes de
texto, com referências de imagens omitidas; a tentativa visual corrigida preserva as imagens já
autorizadas. Credenciais e ecos reconhecíveis de credenciais são removidos do material diagnóstico.
Nenhum prompt, correção, diagnóstico textual, resposta inválida ou corpo bruto de erro é gravado
nos logs ou em uma nova tabela. Os logs registram `generationId`, etapa, resultado da recuperação,
modelo, duração e contagens disponíveis de tokens. Uma resposta final aceita segue a retenção
normal da sessão. O tratamento público de erros não expõe os detalhes internos do provedor.

Para disponibilizar: atualizar API/worker; reconstruir e reiniciar Response para os cards de código
em primeiro plano. Não há migration, variável nova ou novo instalador Capture. Ainda é necessário
smoke com provedor real para medir recuperação, latência e qualidade, sem assumir que os testes
com respostas simuladas reproduzem os erros de produção.
