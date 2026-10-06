# Voz Ativa — Grêmio Estudantil

Projeto completo da Equipe 05: frontend multipágina com visual preto/vermelho, backend Express e Supabase, além de experiência offline-first.

## 1. Instalar
Abra esta pasta no VS Code e rode:

```bash
npm install
```

## 2. Configurar o Supabase
No Supabase, abra o SQL Editor e execute **todo o arquivo `supabase.sql`**.

As credenciais já estão no `.env` deste projeto. Não publique o `.env` no GitHub.

## 3. Rodar

```bash
npm start
```

Depois abra:

http://localhost:3000

## Páginas
- `/` — início
- `/candidaturas.html` — chapas
- `/propostas.html` — propostas
- `/votacao.html` — votação
- `/apuracao.html` — apuração
- `/projeto.html` — arquitetura

## Arquitetura
Frontend multipágina → Service Worker/cache → API Express → Supabase/PostgreSQL.

O voto é identificado por uma sessão do navegador e a tabela `votos` possui `UNIQUE(session_id)` para impedir duplicidade.
