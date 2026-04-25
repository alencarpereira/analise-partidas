function exibirResultados(pC, pE, pF, pBTTS, pOver, evC, evB, evO, kellyC, kellyB, kellyO, totalGols) {

    const painel = document.getElementById('painelResultado');
    if (!painel) return;

    const linha = (nome, prob) => `
    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <span>${nome}</span>
        <b>${prob.toFixed(1)}%</b>
    </div>
    `;

    let html = `
    <h3>📊 Probabilidades</h3>
    ${linha("🏠 Casa", pC)}
    ${linha("🤝 Empate", pE)}
    ${linha("🚀 Fora", pF)}

    <hr>

    <h3>📈 Mercados</h3>
    ${linha("⚽ BTTS", pBTTS)}
    ${linha("📈 Over 2.5", pOver)}

    <hr>
    <p>🔢 Gols esperados: <b>${totalGols.toFixed(2)}</b></p>
    `;

    let melhor = "Sem valor";
    let ev = 1;
    let stake = 0;

    if (evC > ev) { melhor = "🏠 Casa"; ev = evC; stake = kellyC; }
    if (evB > ev) { melhor = "⚽ BTTS"; ev = evB; stake = kellyB; }
    if (evO > ev) { melhor = "📈 Over 2.5"; ev = evO; stake = kellyO; }

    if (ev > 1.02) {
        html += `
        <div style="margin-top:15px; padding:10px; background:#e8f5e9; border-radius:6px;">
            <b>🔥 Melhor Aposta:</b> ${melhor}<br>
            EV: <b>${ev.toFixed(2)}</b> | Stake: <b>${stake}%</b>
        </div>`;
    } else {
        html += `
        <div style="margin-top:15px; padding:10px; background:#ffebee; border-radius:6px;">
            ⚠️ Sem valor no jogo
        </div>`;

        // 👇 AGORA SIM VAI APARECER
        html += `
        <div style="margin-top:10px; padding:10px; background:#fff3e0; border-radius:6px;">
            ⚠️ Recomendação: NÃO APOSTAR
        </div>`;
    }

    html += `
    <button onclick="salvarResultado()" 
    style="margin-top:10px;padding:10px;width:100%;background:#1a237e;color:#fff;border:none;border-radius:6px;cursor:pointer;">
    💾 Salvar Aposta
    </button>
    `;

    painel.innerHTML = html;
}

function executarAnalise() {

    const getVal = id => parseFloat(document.getElementById(id)?.value) || 0;

    // 🔥 INPUTS
    const motivacao = getVal('motivacao') || 1;

    const mercado = {
        casa: getVal('oddCasa'),
        empate: getVal('oddEmpate'),
        fora: getVal('oddFora'),
        over: getVal('oddOver'),
        btts: getVal('oddBTTS')
    };

    const ataqueCasa = getVal('ataqueCasa');
    const ataqueFora = getVal('ataqueFora');
    const defesaCasa = getVal('defesaCasa');
    const defesaFora = getVal('defesaFora');
    const mediaLiga = getVal('mediaLiga') || 2.5;

    // 📊 FORMA RECENTE
    const media = id => {
        const el = document.getElementById(id);
        if (!el || !el.value) return 0;

        const v = el.value.split(',').map(Number);
        if (v.length < 5) return 0;

        return (v[0] + v[1] + v[2] + v[3] * 1.5 + v[4] * 1.5) / 6;
    };

    const formaCasa = media('golsMCasa');
    const formaFora = media('golsMFora');

    // ⚖️ FORÇA RELATIVA
    const forcaAtaqueCasa = ataqueCasa / mediaLiga;
    const forcaDefesaFora = defesaFora / mediaLiga;

    const forcaAtaqueFora = ataqueFora / mediaLiga;
    const forcaDefesaCasa = defesaCasa / mediaLiga;

    // 🔥 MOTIVAÇÃO SUAVE
    const ajusteMotivacao = 1 + ((motivacao - 1) * 0.5);

    // ⚽ EXPECTATIVA INICIAL (POISSON)
    let lambdaCasa = mediaLiga * forcaAtaqueCasa * forcaDefesaFora * 1.10 * ajusteMotivacao;
    let lambdaFora = mediaLiga * forcaAtaqueFora * forcaDefesaCasa * ajusteMotivacao;

    // 🔄 AJUSTE COM FORMA RECENTE
    if (formaCasa > 0) lambdaCasa = (lambdaCasa + formaCasa) / 2;
    if (formaFora > 0) lambdaFora = (lambdaFora + formaFora) / 2;

    // 🔢 FATORIAL OTIMIZADO
    const fatorial = n => {
        let r = 1;
        for (let i = 2; i <= n; i++) r *= i;
        return r;
    };

    const poisson = (l, k) => (Math.exp(-l) * Math.pow(l, k)) / fatorial(k);

    // 🔄 MATRIZ DE PROBABILIDADE
    let pC = 0, pF = 0, pE = 0, pO = 0, pB = 0, soma = 0;

    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {

            const p = poisson(lambdaCasa, i) * poisson(lambdaFora, j);
            soma += p;

            if (i > j) pC += p;
            else if (i < j) pF += p;
            else pE += p;

            if (i + j >= 3) pO += p;
            if (i > 0 && j > 0) pB += p;
        }
    }

    // 🔥 NORMALIZAÇÃO
    pC /= soma;
    pF /= soma;
    pE /= soma;
    pO /= soma;
    pB /= soma;

    // 💰 EV
    let evC = pC * mercado.casa;
    let evE = pE * mercado.empate;
    let evB = pB * mercado.btts;
    let evO = pO * mercado.over;

    // 🚫 FILTRO DE PROBABILIDADE (ANTI ARMADILHA)
    if (pC < 0.40) evC = 0;
    if (pE < 0.25) evE = 0;
    if (pB < 0.35) evB = 0;
    if (pO < 0.30) evO = 0;

    // 📉 KELLY SEGURO
    const kelly = (p, o) => {
        if (!o || o <= 1) return 0;

        const b = o - 1;
        const k = ((b * p) - (1 - p)) / b;

        return k > 0 ? Math.min(k * 0.25 * 100, 5).toFixed(1) : 0;
    };

    const kC = kelly(pC, mercado.casa);
    const kE = kelly(pE, mercado.empate);
    const kB = kelly(pB, mercado.btts);
    const kO = kelly(pO, mercado.over);

    // 📊 EXIBIÇÃO
    exibirResultados(
        pC * 100, pE * 100, pF * 100,
        pB * 100, pO * 100,
        evC, evB, evO,
        kC, kB, kO,
        lambdaCasa + lambdaFora
    );

    // 🧠 ESCOLHA DA MELHOR APOSTA
    let principal = "Sem valor";
    let ev = 1;
    let odd = 0;
    let stake = 0;

    if (evE > ev) {
        principal = "Empate";
        ev = evE;
        odd = mercado.empate;
        stake = kE;
    }

    if (evB > ev) {
        principal = "BTTS";
        ev = evB;
        odd = mercado.btts;
        stake = kB;
    }

    if (evO > ev) {
        principal = "Over 2.5";
        ev = evO;
        odd = mercado.over;
        stake = kO;
    }

    // 🚫 FILTRO FINAL
    if (ev < 1.08) principal = "Sem valor";

    // 💾 SALVAR TEMP
    window.dadosTemp = {
        time: document.getElementById('nomeJogo')?.value || "Jogo",
        ev,
        odd,
        stake: Number(stake),
        pC: pC * 100,
        pE: pE * 100,
        pF: pF * 100,
        pB: pB * 100,
        pO: pO * 100,
        expGols: lambdaCasa + lambdaFora,
        principal,
        lucro: 0,
        resultado: "Pendente"
    };
}

document.getElementById('painelResultado').innerHTML += `
    <button onclick="salvarResultado()"
        style="width:100%; margin-top:15px; padding:12px;
        background:#1a237e; color:white; border:none;
        border-radius:8px; font-weight:bold; cursor:pointer;">
        💾 SALVAR NA TABELA
    </button>
`;




function salvarResultado() {

    if (!window.dadosTemp) {
        alert("Nenhuma análise para salvar!");
        return;
    }

    const confirmar = confirm("Deseja salvar esta análise no relatório?");

    if (!confirmar) return;

    let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];

    historico.unshift(window.dadosTemp);

    localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));

    renderizarTabela();

    alert("✅ Análise salva com sucesso!");
}

function renderizarTabela() {

    const hist = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    const corpo = document.getElementById('corpoTabela');

    let lucroTotal = 0;
    const bancaBase = 100;

    corpo.innerHTML = hist.map((j, i) => {

        const lucro = Number(j.lucro) || 0;
        lucroTotal += lucro;

        return `
        <tr>
            <td>${j.time}</td>
            <td>${Number(j.ev).toFixed(2)}</td>
            <td>${Number(j.odd).toFixed(2)}</td>
            <td>${Number(j.stake).toFixed(1)}%</td>
            <td>${Number(j.pC).toFixed(1)}%</td>
            <td>${Number(j.pE).toFixed(1)}%</td>
            <td>${Number(j.pF).toFixed(1)}%</td>
            <td>${Number(j.pB).toFixed(1)}%</td>
            <td>${Number(j.pO).toFixed(1)}%</td>
            <td>${Number(j.expGols).toFixed(2)}</td>
            <td><b>${j.principal}</b></td>

            <!-- PLACAR -->
            <td>
                ${j.golsC !== undefined && j.golsF !== undefined
                ? `${j.golsC} x ${j.golsF}`
                : `
                    <input id="resC-${i}" type="number" style="width:40px;">
                    x
                    <input id="resF-${i}" type="number" style="width:40px;">
                    <button onclick="validarPlacar(${i})">✔</button>
                `}
            </td>

            <td>R$ ${lucro.toFixed(2)}</td>

            <td>
                <button onclick="excluir(${i})">🗑️</button>
            </td>
        </tr>`;
    }).join('');

    // ✅ CALCULO FINAL
    const saldoAtual = bancaBase + lucroTotal;

    document.getElementById('lucroTotal').innerText =
        `Lucro: R$ ${lucroTotal.toFixed(2)}`;

    document.getElementById('saldoAtual').innerText =
        `Saldo Atual: R$ ${saldoAtual.toFixed(2)}`;
}

function excluir(index) {

    const confirmar = confirm("Deseja excluir esta análise?");

    if (!confirmar) return;

    let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];

    historico.splice(index, 1);

    localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));

    renderizarTabela();
}

function limparHistorico() {

    let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];

    if (historico.length === 0) {
        alert("Não há nada para limpar.");
        return;
    }

    const confirmar = confirm("⚠️ Isso apagará TODO o histórico. Deseja continuar?");

    if (!confirmar) return;

    localStorage.removeItem('meuHistoricoApostas');

    renderizarTabela();

    alert("🧹 Histórico apagado com sucesso!");
}

function validarPlacar(index) {

    let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    let jogo = historico[index];

    if (!jogo) return;

    const bancaBase = 100;

    const gC = parseInt(document.getElementById(`resC-${index}`)?.value);
    const gF = parseInt(document.getElementById(`resF-${index}`)?.value);

    if (isNaN(gC) || isNaN(gF)) {
        alert("Preencha o placar!");
        return;
    }

    // 🔥 SALVA O PLACAR (ESSENCIAL)
    jogo.golsC = gC;
    jogo.golsF = gF;

    let nomeLimpo = jogo.time.split(" (")[0];
    jogo.time = `${nomeLimpo} (${gC} x ${gF})`;

    const totalGols = gC + gF;
    const aposta = jogo.principal;

    let deuGreen = false;

    if (aposta === "Over 2.5" && totalGols > 2) deuGreen = true;
    else if (aposta === "BTTS" && gC > 0 && gF > 0) deuGreen = true;
    else if (aposta === "Casa" && gC > gF) deuGreen = true;
    else if (aposta === "Empate" && gC === gF) deuGreen = true;
    else if (aposta === "Fora" && gF > gC) deuGreen = true;

    let stake = Number(jogo.stake) || 0;
    let valorApostado = 100 * (stake / 100);

    if (deuGreen) {
        jogo.lucro = (Number(jogo.odd) - 1) * valorApostado;
        jogo.resultado = "Green";
    } else {
        jogo.lucro = -valorApostado;
        jogo.resultado = "Red";
    }

    localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));
    renderizarTabela();
}

function exportarCSV() {

    const historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];

    if (historico.length === 0) {
        alert("Não há dados para exportar!");
        return;
    }

    // 🔥 CABEÇALHO COMPLETO
    let csv = "Time;EV;Odd;Stake;Casa;Empate;Fora;BTTS;Over 2.5;Exp Gols;Aposta;Placar;Lucro\n";

    historico.forEach(j => {

        const placar = (j.golsC !== undefined && j.golsF !== undefined)
            ? `${j.golsC} x ${j.golsF}`
            : "-";

        csv += `${j.time || ""};`;
        csv += `${Number(j.ev).toFixed(2)};`;
        csv += `${Number(j.odd).toFixed(2)};`;
        csv += `${Number(j.stake).toFixed(1)}%;`;
        csv += `${Number(j.pC).toFixed(1)}%;`;
        csv += `${Number(j.pE).toFixed(1)}%;`;
        csv += `${Number(j.pF).toFixed(1)}%;`;
        csv += `${Number(j.pB).toFixed(1)}%;`;
        csv += `${Number(j.pO).toFixed(1)}%;`;
        csv += `${Number(j.expGols).toFixed(2)};`;
        csv += `${j.principal || ""};`;
        csv += `${placar};`;
        csv += `${Number(j.lucro).toFixed(2)}\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function limparCampos() {
    document.querySelectorAll('input').forEach(i => i.value = "");
    document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
    document.getElementById('painelResultado').innerHTML = "";
}

window.onload = renderizarTabela;

// EXEMPLO
function preencherExemplo() {

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`Campo não encontrado: ${id}`);
            return;
        }
        el.value = val;
    };

    // 🔥 ODDS (formato com ponto para evitar NaN)
    set('oddCasa', "2.05");
    set('oddEmpate', "3.40");
    set('oddFora', "3.80");
    set('oddOver', "1.90");
    set('oddBTTS', "1.72");

    // 🏠 CASA
    set('golsMCasa', "2,1,1,0,3");
    set('golsSCasa', "0,1,1,2,0");
    set('ataqueCasa', "1.8");
    set('defesaCasa', "1.2");

    // 🚀 FORA
    set('golsMFora', "1,1,2,0,1");
    set('golsSFora', "1,2,1,1,3");
    set('ataqueFora', "1.2");
    set('defesaFora', "1.6");

    // ⚙️ AJUSTES
    set('mediaLiga', "2.5");

    // 🔥 MOTIVAÇÃO REAL (corrigida)
    set('motivacao', "0.90"); // decisivo = menos gols

    // 🏷️ NOME DO JOGO
    set('nomeJogo', "Flamengo x Palmeiras");

    // 🔥 LIMPA RESULTADO ANTIGO
    const painel = document.getElementById('painelResultado');
    if (painel) painel.innerHTML = "";

    console.log("✅ Exemplo carregado corretamente");
}


// LIMPAR FORMULÁRIO
function limparCampos() {

    document.querySelectorAll('input').forEach(i => i.value = "");
    document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);

    const painel = document.getElementById('painelResultado');
    if (painel) painel.innerHTML = "";

    console.log("Campos limpos");
}






