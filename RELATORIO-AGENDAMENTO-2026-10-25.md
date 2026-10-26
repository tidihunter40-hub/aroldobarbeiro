# Entrega local — tipografia e agenda Aroldo Barbeiro

**Data:** 25/10/2026  
**Desenvolvimento:** TR Design  
**Estado:** implementado localmente; não publicado.

## Problemas encontrados e correções

O site anterior usava formulário que apenas abria o WhatsApp. Não havia calendário, disponibilidade persistente, proteção contra dois pedidos no mesmo horário nem área administrativa. O usuário poderia interpretar a conversa aberta como agendamento.

Na tipografia, rótulos de serviços, chamadas, botões e textos de apoio chegavam a 8–11 px em algumas larguras. A camada `dist/booking.css` elevou os tamanhos dos elementos informativos e acionáveis, reforçou o dourado claro sobre fundo escuro e escureceu o verde do botão do WhatsApp. Cormorant Garamond permanece nos títulos e DM Sans no texto funcional. A agenda distingue estados por texto e cor. Pares de cores calculados: dourado claro sobre fundo escuro 14,47:1; texto escuro sobre botão dourado 6,57:1; branco sobre botão verde 5,27:1; textos dos cartões disponível, pendente e ocupado acima de 11:1. A referência para texto comum no critério WCAG 2.2 AA é 4,5:1: https://www.w3.org/TR/WCAG22/#contrast-minimum.

## Arquitetura

- Servidor HTTP Node.js (`app-server.mjs`) com API pública e administrativa.
- SQLite persistente (`booking-api.mjs`) em `data/bookings.sqlite`, com transações `BEGIN IMMEDIATE` para pedidos e decisões.
- Tabelas: `settings`, `services`, `hours`, `days_off`, `appointments`, `admin`, `sessions`.
- Sessão administrativa com token aleatório armazenado como hash no banco e cookie HTTP-only, SameSite Strict. Senha protegida por scrypt e salt individual. Limites básicos de tentativas de login e pedidos públicos.
- Dados de nome e telefone só aparecem após autenticação administrativa. A API pública mostra horário e estado sem dados pessoais.
- Fuso `America/Bahia`; agenda consultada a cada 30 segundos no cliente e 15 segundos no painel. Erro de conexão aparece na interface; chamadas de API ficam fora do cache PWA.

## Fluxo implementado

O cliente escolhe serviço, data e horário, informa nome e telefone e envia uma solicitação. O servidor verifica duração, expediente, intervalo, data, disponibilidade e sobreposição dentro da transação. O horário fica **pendente** até a confirmação manual ou até o prazo configurado. O painel permite confirmar, recusar, cancelar, bloquear, liberar e ajustar expediente, dias sem atendimento, durações e prazo. O WhatsApp recebe apenas uma mensagem opcional após a gravação e não muda o estado da agenda.

Nenhum horário ou duração real foi presumido. Serviços vêm desativados e o expediente vazio. O painel precisa ser configurado pelo responsável antes que a agenda pública ofereça horários.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| Pedidos simultâneos para o mesmo horário via HTTP | Um criado, outro recusado com 409 |
| Durações diferentes e intervalo | Sobreposição recusada; horário que cruza o intervalo omitido |
| Pendência expirada | Horário liberado; confirmação posterior recusada |
| Confirmação, cancelamento, bloqueio e liberação | Estados atualizados corretamente |
| Reinício lógico do banco | Registros persistiram após fechar e reabrir SQLite |
| Rota administrativa sem sessão | HTTP 401 |
| Login administrativo de teste | Sessão permitiu acesso à configuração |
| PWA e integridade de recursos | Testes locais passaram; API excluída do cache |
| Larguras de 320, 360, 375, 390, 414, 768, 1024, 1280, 1440 e 1920 px | Sem rolagem horizontal; inspeção visual em 320, 390 e 1440 px |

Comandos: `node tests/booking-api.mjs`, `node tests/booking-smoke.mjs`, `node tests/site-integrity.mjs`, `node tests/pwa-smoke.mjs`.

## Antes da produção

1. Aroldo deve criar a senha com `node setup-admin.mjs` e informar expediente, intervalos, serviços ativos, durações e dias sem atendimento no painel.
2. Hospedar o **servidor Node**, não apenas a pasta `dist`, com HTTPS, armazenamento durável, backup do SQLite e acesso ao diretório `data/` restrito ao processo do servidor.
3. Definir política de retenção/exclusão dos dados de clientes e canal de contato para avisar confirmação ou cancelamento. O sistema não envia mensagem automática ao cliente.
4. Conferir conteúdo comercial e imagens provisórias já listados no README.
5. Fazer auditoria manual completa de acessibilidade, inclusive zoom de 200%, leitura de texto sobre todas as imagens e navegação por teclado. A checagem de pares de cores e larguras não equivale a certificação WCAG AA integral.
6. Testar a implantação no ambiente final, inclusive acesso por aparelhos distintos, queda e retorno de conexão, reinício do serviço e restauração de backup. Esses cenários não podem ser comprovados na prévia local.
