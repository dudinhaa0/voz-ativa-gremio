require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
    throw new Error(
        'Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no .env'
    );
}

const supabase = createClient(url, key);

// ==============================
// CONFIGURAÇÕES
// ==============================

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Servir arquivos do frontend
app.use(express.static(path.join(__dirname, 'public')));

// ==============================
// FUNÇÕES AUXILIARES
// ==============================

function cleanCandidate(c) {
    return {
        id: c.id,
        number: c.numero,
        name: c.nome,
        slogan: c.slogan,
        color: null,
        initials: null,
        proposals: (c.propostas || []).map(p => p.titulo)
    };
}

// ==============================
// API - STATUS
// ==============================

app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        service: 'voz-ativa',
        database: 'supabase'
    });
});

// ==============================
// API - CANDIDATOS
// ==============================

app.get('/api/candidates', async (req, res) => {
    try {
        const { data, error } = await supabase
    .from('candidatos')
    .select(`
    id,
    numero,
    nome,
    slogan,
    propostas(
        id,
        titulo,
        descricao
    )
`)
    .order('numero');

        if (error) {
            return res.status(500).json({
                error: error.message
            });
        }

        res.json((data || []).map(cleanCandidate));

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// ==============================
// API - APURAÇÃO
// ==============================

app.get('/api/results', async (req, res) => {
    try {
        const { data, error } = await supabase.rpc('apuracao_votos');

        if (error) {
            return res.status(500).json({
                error: error.message
            });
        }

        res.json(data || []);

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// ==============================
// REGISTRAR VOTO
// ==============================

async function registerVote(v) {

    if (!v || !v.candidateId || !v.sessionId) {
        return {
            status: 'invalid',
            message: 'Dados do voto incompletos.'
        };
    }

    // Verificar se a chapa existe
    const { data: candidate, error: candidateError } = await supabase
        .from('candidatos')
        .select('id')
        .eq('id', v.candidateId)
        .maybeSingle();

    if (candidateError) {
        return {
            status: 'error',
            message: candidateError.message
        };
    }

    if (!candidate) {
        return {
            status: 'invalid',
            message: 'Chapa inexistente.'
        };
    }

    // Verificar se esta sessão já votou
    const { data: existing, error: existingError } = await supabase
        .from('votos')
        .select('id')
        .eq('session_id', v.sessionId)
        .maybeSingle();

    if (existingError) {
        return {
            status: 'error',
            message: existingError.message
        };
    }

    if (existing) {
        return {
            status: 'duplicate',
            message: 'Esta sessão já registrou um voto.'
        };
    }

    // Registrar voto
    const { error } = await supabase
        .from('votos')
        .insert({
            candidato_id: v.candidateId,
            session_id: v.sessionId
        });

    if (error) {

        // Violação da UNIQUE de session_id
        if (error.code === '23505') {
            return {
                status: 'duplicate',
                message: 'Esta sessão já registrou um voto.'
            };
        }

        return {
            status: 'error',
            message: error.message
        };
    }

    return {
        status: 'accepted'
    };
}

// ==============================
// API - VOTO ONLINE
// ==============================

app.post('/api/votes', async (req, res) => {

    try {

        const result = await registerVote(req.body);

        const code =
            result.status === 'accepted'
                ? 201
                : result.status === 'duplicate'
                    ? 409
                    : 400;

        res.status(code).json(result);

    } catch (error) {

        res.status(500).json({
            status: 'error',
            message: error.message
        });

    }
});

// ==============================
// API - SINCRONIZAÇÃO OFFLINE
// ==============================

app.post('/api/votes/sync', async (req, res) => {

    try {

        const votes = Array.isArray(req.body?.votes)
            ? req.body.votes
            : [];

        const report = {
            accepted: 0,
            duplicates: 0,
            invalid: 0,
            errors: 0
        };

        for (const v of votes) {

            const result = await registerVote(v);

            if (result.status === 'accepted') {
                report.accepted++;
            }

            else if (result.status === 'duplicate') {
                report.duplicates++;
            }

            else if (result.status === 'invalid') {
                report.invalid++;
            }

            else {
                report.errors++;
            }
        }

        // Atualizar total de votos
        const { data } = await supabase.rpc('apuracao_votos');

        report.totalVotes = (data || []).reduce(
            (total, item) => total + Number(item.votos || 0),
            0
        );

        res.json(report);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }
});

// ==============================
// PÁGINA INICIAL
// ==============================

app.get('/', (req, res) => {

    res.sendFile(
        path.join(__dirname, 'public', 'index.html')
    );

});

// ==============================
// INICIAR SERVIDOR
// ==============================

app.listen(PORT, () => {

    console.log('');
    console.log('========================================');
    console.log('        VOZ ATIVA - GRÊMIO');
    console.log('========================================');
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
    console.log('========================================');
    console.log('');

});