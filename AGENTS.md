# Guia para Agentes de IA — Contexto do Projeto [NOME DO APP]

## Visão Geral
Este repositório contém uma aplicação web estática de flashcards e repetição espaçada, orientada a execução local sem backend obrigatório e deploy no GitHub Pages.

## Diretrizes de Arquitetura
1. **Persistência Primeiro:** Toda persistência deve ser garantida no IndexedDB via camada de repositórios (`src/db/repositories/`) antes de confirmar a interface.
2. **Padrão de Repositórios & Serviços:** 
   - A camada de apresentação (`src/ui/`) **nunca** deve interagir diretamente com transações IndexedDB ou calcular intervalos matemáticos.
   - O agendamento deve ser puramente calculado no módulo `src/services/scheduler.js`.
3. **Imutabilidade e Funções Puras:** 
   - `scheduler.js` e `dates.js` recebem instâncias explícitas de relógio (`clock = new Date()`) para permitir testes com relógio injetável.
4. **Markdown e Sanitização:** 
   - Qualquer inserção de conteúdo dinâmico na árvore DOM deve passar por `renderCardContent` em `src/ui/render.js` para mitigar ataques XSS.
5. **Compatibilidade com GitHub Pages:**
   - Mantenha `base: './'` no `vite.config.js` e caminhos relativos em todos os assets para garantir funcionamento sob qualquer subdiretório de hospedagem.
6. **Esquema de Banco e Migrações:**
   - Nunca altere o esquema de banco de dados diretamente sem atualizar `src/db/migrations.js` e incrementar `DB_CONFIG.VERSION` em `src/config/constants.js`.
