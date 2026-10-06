create extension if not exists pgcrypto;
create table if not exists public.candidatos (id text primary key, numero integer unique not null, nome text not null, slogan text not null, cor text not null default '#e50914', iniciais text not null, created_at timestamptz default now());
create table if not exists public.propostas (id uuid primary key default gen_random_uuid(), candidato_id text not null references public.candidatos(id) on delete cascade, texto text not null, ordem integer not null default 1, created_at timestamptz default now());
create table if not exists public.votos (id uuid primary key default gen_random_uuid(), candidato_id text not null references public.candidatos(id), session_id text unique not null, created_at timestamptz default now());
alter table public.candidatos enable row level security; alter table public.propostas enable row level security; alter table public.votos enable row level security;
drop policy if exists candidatos_public_read on public.candidatos; create policy candidatos_public_read on public.candidatos for select to anon, authenticated using (true);
drop policy if exists propostas_public_read on public.propostas; create policy propostas_public_read on public.propostas for select to anon, authenticated using (true);
drop policy if exists votos_public_insert on public.votos; create policy votos_public_insert on public.votos for insert to anon, authenticated with check (length(session_id) between 20 and 120);
insert into public.candidatos(id,numero,nome,slogan,cor,iniciais) values
('voz-ativa',1,'Chapa Voz Ativa','Nossa escola, nossa voz.','#e50914','VA'),
('movimento',2,'Chapa Movimento','Participar é transformar.','#ffffff','MO'),
('conexao',3,'Chapa Conexão','Ideias que aproximam.','#e50914','CO'),
('avanca',4,'Chapa Avança','Juventude em movimento.','#ffffff','AV') on conflict (id) do update set numero=excluded.numero,nome=excluded.nome,slogan=excluded.slogan,cor=excluded.cor,iniciais=excluded.iniciais;
insert into public.propostas(candidato_id,texto,ordem) values
('voz-ativa','Mais eventos culturais e esportivos',1),('voz-ativa','Caixa de sugestões com retorno público',2),('voz-ativa','Campanhas de acolhimento e combate ao bullying',3),('voz-ativa','Representação dos estudantes nas decisões da escola',4),
('movimento','Feiras de profissões e tecnologia',1),('movimento','Clube de estudos e monitorias entre alunos',2),('movimento','Calendário estudantil colaborativo',3),('movimento','Projetos de sustentabilidade',4),
('conexao','Mais oficinas e rodas de conversa',1),('conexao','Melhoria da comunicação entre turmas',2),('conexao','Semana cultural com talentos da escola',3),('conexao','Ações de integração entre os anos',4),
('avanca','Projetos de voluntariado',1),('avanca','Torneios e atividades no intervalo',2),('avanca','Mural digital de oportunidades',3),('avanca','Campanhas de saúde e bem-estar',4)
on conflict do nothing;
create or replace function public.apuracao_votos() returns table(id text,nome text,numero integer,votos bigint,total_votos bigint,percentual numeric) language sql security definer set search_path=public as $$
with cont as (select c.id,c.nome,c.numero,count(v.id) votos from candidatos c left join votos v on v.candidato_id=c.id group by c.id,c.nome,c.numero), tot as (select coalesce(sum(votos),0) total from cont) select cont.id,cont.nome,cont.numero,cont.votos,tot.total,case when tot.total=0 then 0 else round((cont.votos::numeric/tot.total::numeric)*100,1) end from cont cross join tot order by cont.numero; $$;
grant execute on function public.apuracao_votos() to anon, authenticated;
