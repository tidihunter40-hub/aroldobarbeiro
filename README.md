# Aroldo Barbeiro — Escola & Barbearia

Site com página pública em HTML/CSS/JS. Na Vercel, a função em `api/index.js` usa o Supabase para persistir agendamentos. A prévia local continua disponível em SQLite: requer Node.js 24 ou superior (o módulo `node:sqlite` ainda emite aviso experimental nessa versão) e inicia com `node serve.mjs` em `http://127.0.0.1:5180/`. O servidor local grava solicitações e telefones em `data/bookings.sqlite`, fora de `dist/`. A hero usa a fotografia fornecida para o projeto e as demais seções seguem a [imagem de conceito aprovada](reference/conceito-aprovado.png).

## Composição

A hero usa a fotografia fornecida como imagem independente, com cabeçalho, tipografia, botões e atmosfera construídos em HTML/CSS. Abaixo dela permanecem a seção de prótese, oito cartões de serviços, visagismo, galeria de trabalhos reais, reconhecimento e painéis para Escola, Aroldo, espaço e contato. Os destaques do Instagram continuam na página; o formulário agora usa a API de agendamento.

## Fotos de conceito provisórias

A pedido do cliente, 11 fotografias genéricas foram geradas pelo recurso integrado de imagem do Codex e salvas como `dist/assets/concept-*.jpg`. Elas são **ilustrações**, não fotografias de Aroldo, clientes, aulas ou instalações. Após a auditoria visual, permanecem em uso `concept-corte.jpg` e `concept-protese.jpg` no painel de prótese, `concept-visagismo.jpg` no cartão e painel de visagismo e `concept-escola.jpg` no painel da Escola. Esses pontos estão identificados no site. Os demais arquivos de conceito permanecem no pacote, mas não aparecem na página. A tabela abaixo documenta o acervo histórico; suas sugestões de substituição só se aplicam se o arquivo voltar a ser usado.

| Arquivo | Substituir por | Prompt usado, em resumo |
| --- | --- | --- |
| `concept-hero.jpg` | Retrato profissional de Aroldo no espaço real | Barbeiro anônimo com avental de couro, à direita de barbearia cinematográfica escura, área livre à esquerda, sem marca ou texto. |
| `concept-corte.jpg` | Corte masculino real | Retrato vertical com degradê masculino, barbearia escura e luz âmbar. |
| `concept-barba.jpg` | Barba real | Retrato vertical de barba cheia bem acabada, barbearia escura. |
| `concept-kids.jpg` | Atendimento infantil real autorizado | Criança em corte apropriado à idade, luz quente de barbearia. |
| `concept-platinado.jpg` | Platinado real | Retrato vertical de corte curto prateado com degradê. |
| `concept-freestyle.jpg` | Desenho real no cabelo | Cabeça vista de trás/lado com linha geométrica no degradê. |
| `concept-desondulacao.jpg` | Registro real do procedimento | Retrato vertical de cabelo escuro alinhado em barbearia. |
| `concept-protese.jpg` | Registro real de prótese capilar | Cena vertical ilustrativa de colocação de sistema capilar. |
| `concept-visagismo.jpg` | Atendimento de visagismo real | Barbeiro genérico atendendo cliente à direita, área escura à esquerda. |
| `concept-escola.jpg` | Aula real da Escola | Instrutor e aluno adultos praticando corte em ambiente de ensino. |
| `concept-ambiente.jpg` | Foto real do estabelecimento | Interior de barbearia vazia com cadeiras pretas, espelhos e luz âmbar. |

Os arquivos foram gerados em PNG pelo recurso integrado e convertidos para JPEG com qualidade 85 para o site. Os originais gerados permanecem em `C:\Users\bangu\.codex\generated_images\01a1711e-b311-7ad0-ac7b-975ba2855301`. As imagens do conceito enviado pelo cliente foram usadas apenas como referência de composição, não como fotografia do negócio.

## Material real preservado

O pacote também inclui registros do [Instagram oficial](https://www.instagram.com/aroldobarbeirooficial/) consultados em 25/10/2026. Os seis destaques interativos — [Artistas](https://www.instagram.com/stories/highlights/17912568753117277/), [Premiações](https://www.instagram.com/stories/highlights/17969838071171142/), [Barbas](https://www.instagram.com/stories/highlights/17962977680653535/), [Corte Kids](https://www.instagram.com/stories/highlights/17998904341653498/), [Nevou](https://www.instagram.com/stories/highlights/17966296571269322/) e [Desenhos Animados](https://www.instagram.com/stories/highlights/17956278125249781/) — usam esses registros reais e vinculam a fonte.

O hero usa a fotografia fornecida para este projeto (`dist/assets/aroldo-hero-fornecida.png`); seus textos, botões, header e atmosfera são elementos HTML/CSS independentes. Seis cartões de serviços, a galeria de trabalhos e o painel do espaço usam registros do perfil oficial. O reconhecimento mostra foto real do destaque Premiações e menciona somente o certificado de 2020 e os troféus que aparecem ali. A Escola é apresentada sem inventar turmas, datas ou depoimentos. O agendamento grava a solicitação no servidor; o WhatsApp continua opcional e não confirma horários.

## Agendamento

- `booking-api.mjs` e `app-server.mjs`: API local com SQLite para prévia e testes.
- `supabase/schema.sql` e `api/index.js`: banco e API de produção na Vercel.
- `dist/booking-client.js`: calendário de 60 dias, horários por serviço, pedido pendente e aviso opcional pelo WhatsApp.
- `dist/admin.html` e `dist/admin.js`: agenda diária ou de sete dias, confirmação, recusa, cancelamento, bloqueio, liberação e configuração de serviços, expediente, intervalos, dias sem atendimento e prazo pendente.
- `data/bookings.sqlite`: banco da prévia local; não entra no GitHub nem na Vercel.

Aroldo confirma cada solicitação manualmente. Um pedido pendente impede outros pedidos sobrepostos até ser confirmado, recusado ou expirar. A expiração é calculada no servidor; os registros antigos continuam no banco para histórico, com status “Expirado” no painel. Serviços com durações diferentes respeitam sobreposição, expediente e intervalo. A página pública nunca mostra nome ou telefone de outra pessoa. A agenda é consultada novamente a cada 30 segundos na página pública e a cada 15 segundos no painel, além de atualizar após ações.

### Configuração inicial

1. Para a prévia local, execute `node setup-admin.mjs` no diretório do projeto e crie uma senha de pelo menos 12 caracteres.
2. Execute `node serve.mjs` e entre em `/admin.html`.
3. Configure os dias e horários reais, intervalos, serviços ativos e duração de cada serviço. Nenhum expediente foi inventado; até salvar essa configuração, o público vê a agenda indisponível e pode conversar pelo WhatsApp.
4. Para produção, siga a configuração Supabase e Vercel abaixo. O banco local não é enviado à produção.

O fuso da agenda é `America/Bahia`. Na prévia local é possível mudar o caminho do banco com `AROLDO_DB_PATH` e a porta com `PORT`. Mudanças de expediente não cancelam automaticamente agendamentos já confirmados; revise a agenda antes de alterar os horários. Confirme com Aroldo o prazo da pendência, as durações e o expediente antes de produção. Defina um processo de retenção e exclusão de dados pessoais adequado ao negócio.

### Produção: Supabase e Vercel

1. No SQL Editor do projeto Supabase `zjegmzuwducmaffcorut`, execute todo o arquivo `supabase/schema.sql`. Ele cria as tabelas, funções e regras de acesso. Não habilita políticas públicas: o navegador acessa apenas a função da Vercel.
2. Importe o repositório no Vercel com o diretório raiz do projeto. `vercel.json` publica `dist/` e encaminha `/api/*` para a função. Use Node.js 20 ou superior.
3. Configure as variáveis de ambiente **Production**: `SUPABASE_URL` (URL base sem `/rest/v1`), `SUPABASE_SECRET_KEY` e `AROLDO_ADMIN_PASSWORD` (senha forte escolhida pelo responsável, pelo menos 12 caracteres). O arquivo `.env.example` mostra os nomes. As credenciais ficam apenas nas variáveis da Vercel; não coloque em `dist/` nem no GitHub. A chave publicável não é necessária porque o cliente usa a API própria.
4. Faça um novo deploy após definir as variáveis. Verifique `/api/public/config`, depois entre em `/admin.html` para configurar serviços e expediente reais. Até então o formulário de agendamento fica indisponível.

O cookie administrativo dura 12 horas. Trocar a senha administrativa ou a chave secreta invalida as sessões. As funções SQL serializam solicitações concorrentes por dia para impedir reservas sobrepostas. O Supabase deve ter backup e política de retenção de nomes e telefones.

### Testes

Execute `node tests/booking-api.mjs`, `node tests/site-integrity.mjs`, `node tests/booking-smoke.mjs` e `node tests/pwa-smoke.mjs`. O teste de API usa um banco temporário e cobre autenticação, concorrência HTTP, serviços de durações diferentes, bloqueio, cancelamento, limites do expediente e persistência após reabrir o SQLite. O teste PWA verifica atualização e navegação offline; chamadas `/api/` são excluídas do cache, portanto não há agenda falsa quando a conexão falha.

### Tipografia e acessibilidade

O ajuste final em `dist/booking.css` aumentou rótulos e botões pequenos, preservou a fonte decorativa nos títulos, reforçou o contraste dourado/escuro e escureceu o botão verde do WhatsApp. Foram verificadas larguras de 320, 360, 375, 390, 414, 768, 1024, 1280, 1440 e 1920 px sem rolagem horizontal. A agenda usa texto além da cor para diferenciar os estados. Isso melhora os critérios de contraste do WCAG AA, mas a conformidade integral do site ainda exige auditoria manual de todas as imagens, estados de foco e zoom antes da publicação.

## Para a troca das fotos e publicação final

- Substitua as quatro imagens ilustrativas ainda exibidas por fotografias oficiais de prótese, visagismo e Escola. Use autorização de quem aparece.
- Envie a logomarca oficial, caso deseje substituir a assinatura tipográfica AROLDO BARBEIRO no cabeçalho e rever os ícones provisórios do PWA.
- Para uma futura galeria de antes/depois, envie pares do mesmo atendimento e autorização de uso. A galeria atual mostra trabalhos reais sem simular pares.
- Para depoimentos, envie avaliações verdadeiras com autorização. O painel correspondente apresenta o perfil da empresa por enquanto.
- Confirme endereço, horários, serviços, oferta de cursos, detalhes dos títulos e eventual catálogo de produtos.

## PWA

O site tem manifest, ícones para Android/iOS, botão de instalação quando o navegador oferece essa opção e cache offline da página e das imagens locais. Para instalar, abra a prévia em `http://127.0.0.1:5180/` ou publique em HTTPS; abrir `dist/index.html` diretamente não ativa o service worker. Isso segue os [requisitos atuais de instalação de PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

Os recursos locais usam rede primeiro e recorrem ao cache quando não há conexão; o service worker é registrado com `updateViaCache: 'none'`. A versão atual é `v11`. O precache inclui apenas recursos usados pela página, inclusive a fotografia fornecida para a hero. A API e o painel administrativo não são guardados em cache. Ao publicar uma atualização, continue alterando `CACHE_NAME` em `dist/sw.js` para eliminar caches antigos. Links externos como WhatsApp e Instagram continuam dependentes de internet.

## Arquivos

- `dist/index.html`: estrutura, textos e links.
- `dist/hero.css`: composição e responsividade da hero e do cabeçalho.
- `dist/styles.css`: direção visual original do conceito.
- `dist/refinement.css`: tipografia, espaçamentos e breakpoints refinados.
- `dist/script.js`: menu, galeria, destaques e instalação.
- `dist/booking.css`, `dist/booking-client.js`: legibilidade final e interface pública de agenda.
- `dist/admin.html`, `dist/admin.css`, `dist/admin.js`: painel administrativo.
- `booking-api.mjs`, `app-server.mjs`, `setup-admin.mjs`: banco, API e configuração de senha.
- `dist/manifest.webmanifest`, `dist/sw.js`, `dist/assets/icon*`: PWA e cache offline.
- `reference/conceito-aprovado.png`: peça aprovada pelo cliente.
- `auditoria-visual/`: capturas reais do Chrome e relatório de validação.
- `auditoria-visual/RELATORIO-FINAL-V9.md`: auditoria visual e funcional anterior.
- `auditoria-visual/ajuste-cabeca-v10/`: capturas e medidas do enquadramento corrigido.
