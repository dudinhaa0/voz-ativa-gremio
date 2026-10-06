const API = '/api';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const sessionKey = 'voz-ativa-session';
const queueKey = 'voz-ativa-queue';
const candidatesKey = 'voz-ativa-candidates';

const sessionId =
    localStorage.getItem(sessionKey) || crypto.randomUUID();

localStorage.setItem(sessionKey, sessionId);

let candidates = [];

// ========================================
// STATUS ONLINE / OFFLINE
// ========================================

function setStatus() {
    $$('.status').forEach((el) => {

        const online = navigator.onLine;

        el.textContent = online
            ? '● ONLINE'
            : '○ OFFLINE';

        el.className =
            'status ' + (online ? 'online' : 'offline');
    });
}

// ========================================
// BUSCAR CANDIDATOS DO SERVIDOR
// ========================================

async function getCandidates() {

    try {

        const response = await fetch(API + '/candidates', {
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar candidatos');
        }

        const data = await response.json();

        candidates = Array.isArray(data) ? data : [];

        localStorage.setItem(
            candidatesKey,
            JSON.stringify(candidates)
        );

        console.log('Candidatos carregados:', candidates);

        return candidates;

    } catch (error) {

        console.warn(
            'Não foi possível buscar candidatos do servidor:',
            error
        );

        try {

            candidates = JSON.parse(
                localStorage.getItem(candidatesKey) || '[]'
            );

        } catch {

            candidates = [];

        }

        return candidates;
    }
}

// ========================================
// CANDIDATOS
// ========================================

function renderCandidates(list = candidates) {

    const wrap = $('#candidateGrid');

    if (!wrap) return;

    if (!list.length) {

        wrap.innerHTML = `
            <div class="empty-state">
                <h3>Nenhuma chapa encontrada</h3>
                <p>
                    Verifique se os candidatos foram cadastrados
                    no banco de dados.
                </p>
            </div>
        `;

        return;
    }

    wrap.innerHTML = list.map((candidate) => {

        const proposals = Array.isArray(candidate.proposals)
            ? candidate.proposals
            : [];

        return `
            <article class="candidate">

                <div class="num">
                    ${candidate.number}
                </div>

                <span class="tag">
                    CHAPA ${String(candidate.number).padStart(2, '0')}
                </span>

                <h3>
                    ${candidate.name}
                </h3>

                <div class="slogan">
                    ${candidate.slogan || ''}
                </div>

                ${
                    proposals.length
                        ? `
                            <ul>
                                ${proposals.map((proposal) => `
                                    <li>${proposal}</li>
                                `).join('')}
                            </ul>
                        `
                        : `
                            <p class="no-proposals">
                                Nenhuma proposta cadastrada.
                            </p>
                        `
                }

            </article>
        `;

    }).join('');
}

// ========================================
// PROPOSTAS
// ========================================

function renderProposals() {

    const wrap = $('#proposalGrid');

    if (!wrap) return;

    if (!candidates.length) {

        wrap.innerHTML = `
            <div class="empty-state">
                <h3>Nenhuma proposta encontrada</h3>
            </div>
        `;

        return;
    }

    wrap.innerHTML = candidates
        .flatMap((candidate) => {

            const proposals = Array.isArray(candidate.proposals)
                ? candidate.proposals
                : [];

            return proposals.map((proposal, index) => `

                <article class="proposal-card">

                    <div class="idx">
                        ${String(index + 1).padStart(2, '0')}
                    </div>

                    <span class="tag">
                        ${candidate.name}
                    </span>

                    <h3>
                        ${proposal}
                    </h3>

                    <p>
                        Proposta da chapa ${candidate.number}
                        para fortalecer a participação estudantil.
                    </p>

                </article>

            `);

        })
        .join('');
}

// ========================================
// VOTAÇÃO
// ========================================

function renderVote() {

    const wrap = $('#voteOptions');

    if (!wrap) return;

    if (!candidates.length) {

        wrap.innerHTML = `
            <p>
                Nenhuma chapa disponível para votação.
            </p>
        `;

        return;
    }

    wrap.innerHTML = candidates.map((candidate) => `

        <label class="vote-option">

            <input
                type="radio"
                name="candidate"
                value="${candidate.id}"
            >

            <div>

                <strong>
                    ${candidate.number} — ${candidate.name}
                </strong>

                <small>
                    ${candidate.slogan || ''}
                </small>

            </div>

        </label>

    `).join('');

    $$('.vote-option').forEach((option) => {

        option.onclick = () => {

            $$('.vote-option').forEach((item) => {
                item.classList.remove('selected');
            });

            option.classList.add('selected');
        };

    });
}

// ========================================
// REGISTRAR VOTO
// ========================================

async function vote() {

    const selected =
        $('input[name="candidate"]:checked');

    const message = $('#voteMsg');

    if (!selected) {

        if (message) {
            message.textContent =
                'Escolha uma chapa antes de confirmar.';
        }

        return;
    }

    const voteData = {

        candidateId: selected.value,

        sessionId,

        createdAt:
            new Date().toISOString(),

        id:
            crypto.randomUUID()

    };

    // ====================================
    // OFFLINE
    // ====================================

    if (!navigator.onLine) {

        const queue = JSON.parse(
            localStorage.getItem(queueKey) || '[]'
        );

        queue.push(voteData);

        localStorage.setItem(
            queueKey,
            JSON.stringify(queue)
        );

        if (message) {
            message.textContent =
                'Voto guardado no dispositivo. Será sincronizado quando a conexão voltar.';
        }

        return;
    }

    // ====================================
    // ONLINE
    // ====================================

    try {

        const response = await fetch(
            API + '/votes',
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify(voteData)
            }
        );

        const data = await response.json();

        if (message) {

            if (response.ok) {

                message.textContent =
                    'Voto registrado com sucesso!';

                // ==================================
                // ATUALIZAR APURAÇÃO IMEDIATAMENTE
                // ==================================

                await renderResults();

            } else {

                message.textContent =
                    data.message ||
                    'Não foi possível registrar o voto.';
            }
        }

    } catch (error) {

        const queue = JSON.parse(
            localStorage.getItem(queueKey) || '[]'
        );

        queue.push(voteData);

        localStorage.setItem(
            queueKey,
            JSON.stringify(queue)
        );

        if (message) {

            message.textContent =
                'Sem conexão: voto guardado para sincronização.';

        }
    }
}

// ========================================
// SINCRONIZAR VOTOS OFFLINE
// ========================================

async function syncQueue() {

    const queue = JSON.parse(
        localStorage.getItem(queueKey) || '[]'
    );

    if (!navigator.onLine || !queue.length) {
        return;
    }

    try {

        const response = await fetch(
            API + '/votes/sync',
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    votes: queue
                })
            }
        );

        if (response.ok) {

            localStorage.removeItem(queueKey);

            console.log(
                'Votos offline sincronizados.'
            );

            // Atualizar apuração após sincronização
            await renderResults();
        }

    } catch (error) {

        console.warn(
            'Não foi possível sincronizar os votos.',
            error
        );

    }
}

// ========================================
// APURAÇÃO
// ========================================

async function renderResults() {

    const wrap = $('#resultsList');
    const total = $('#totalVotes');

    if (!wrap) return;

    try {

        const response =
            await fetch(API + '/results', {
                cache: 'no-store'
            });

        if (!response.ok) {
            throw new Error('Erro na apuração');
        }

        const data = await response.json();

        console.log('Apuração atualizada:', data);

        if (!Array.isArray(data) || !data.length) {

            wrap.innerHTML = `
                <p>
                    Nenhum voto registrado ainda.
                </p>
            `;

            if (total) {
                total.textContent = '0';
            }

            return;
        }

        // ====================================
        // TOTAL DE VOTOS
        // ====================================

        const totalVotes = data.reduce(
            (sum, candidate) =>
                sum + Number(candidate.votos || 0),
            0
        );

        if (total) {
            total.textContent = totalVotes;
        }

        // ====================================
        // RESULTADOS
        // ====================================

        wrap.innerHTML = data.map((candidate) => {

            const votes =
                Number(candidate.votos || 0);

            const percentage =
                totalVotes > 0
                    ? (votes / totalVotes) * 100
                    : 0;

            return `

                <article class="result-card">

                    <div>

                        <span class="tag">
                            ${candidate.numero}
                        </span>

                        <h3>
                            ${candidate.nome}
                        </h3>

                    </div>

                    <div class="bar">

                        <i
                            style="width:${percentage}%"
                        ></i>

                    </div>

                    <div class="pct">
                        ${percentage.toFixed(1)}%
                    </div>

                    <small>
                        ${votes}
                        voto${votes === 1 ? '' : 's'}
                    </small>

                </article>

            `;

        }).join('');

    } catch (error) {

        console.error(
            'Erro ao carregar apuração:',
            error
        );

        wrap.innerHTML = `
            <p style="color:#777">
                A apuração depende da conexão com o servidor.
            </p>
        `;
    }
}

// ========================================
// INICIALIZAÇÃO
// ========================================

async function boot() {

    setStatus();

    // ====================================
    // QUANDO VOLTAR A INTERNET
    // ====================================

    window.addEventListener(
        'online',
        async () => {

            setStatus();

            await syncQueue();

            await getCandidates();

            renderCandidates();
            renderProposals();
            renderVote();
            renderResults();

        }
    );

    window.addEventListener(
        'offline',
        setStatus
    );

    // ====================================
    // SERVICE WORKER
    // ====================================

    if ('serviceWorker' in navigator) {

        navigator.serviceWorker
            .register('/sw.js')
            .catch((error) => {

                console.warn(
                    'Service Worker:',
                    error
                );

            });

    }

    // ====================================
    // CARREGAR DADOS DO SUPABASE
    // ====================================

    await getCandidates();

    renderCandidates();
    renderProposals();
    renderVote();
    renderResults();

    // ====================================
    // SINCRONIZAR VOTOS PENDENTES
    // ====================================

    await syncQueue();

    // ====================================
    // ATUALIZAÇÃO AUTOMÁTICA DA APURAÇÃO
    // ====================================

    setInterval(() => {

        if (navigator.onLine) {
            renderResults();
        }

    }, 5000);
}

// ========================================
// DOM
// ========================================

document.addEventListener(
    'DOMContentLoaded',
    () => {

        boot();

        const voteButton = $('#voteBtn');

        if (voteButton) {
            voteButton.onclick = vote;
        }

    }
);