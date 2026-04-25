function executarAnalise() {
    const getVal = id => parseFloat(document.getElementById(id)?.value) || 0;
    const motivacao = getVal('motivacao') || 1;

    const mercado = {
        casa: getVal('oddCasa'),
        empate: getVal('oddEmpate'),
        fora: getVal('oddFora'),
        over: getVal('oddOver'),
        btts: getVal('oddBTTS'),
        under: getVal('oddUnder')
    };

    const ataqueCasa = getVal('ataqueCasa');
    const ataqueFora = getVal('ataqueFora');
    const defesaCasa = getVal('defesaCasa');
    const defesaFora = getVal('defesaFora');
    const mediaLiga = getVal('mediaLiga') || 2.5;

    // Cálculo de média ponderada (forma recente)
    const media = id => {
        const el = document.getElementById(id);
        if (!el || !el.value) return 0;
        const v = el.value.split(',').map(Number);
        if (v.length < 5) return 0;
        return (v[0] + v[1] + v[2] + v[3] * 1.5 + v[4] * 1.5) / 6;
    };

    const formaCasa = media('golsMCasa');
    const formaFora = media('golsMFora');

    const forcaAtaqueCasa = (ataqueCasa - mediaLiga) / mediaLiga;
    const forcaAtaqueFora = (ataqueFora - mediaLiga) / mediaLiga;
    const forcaDefesaCasa = (mediaLiga - defesaCasa) / mediaLiga;
    const forcaDefesaFora = (mediaLiga - defesaFora) / mediaLiga;

    const clamp = x => Math.max(0.3, 1 + x);
    const ajusteMotivacao = 1 + ((motivacao - 1) * 0.5);

    let lambdaCasa = mediaLiga * clamp(forcaAtaqueCasa) * clamp(forcaDefesaFora) * 1.10 * ajusteMotivacao;
    let lambdaFora = mediaLiga * clamp(forcaAtaqueFora) * clamp(forcaDefesaCasa) * ajusteMotivacao;

    if (formaCasa > 0) lambdaCasa = lambdaCasa * 0.7 + formaCasa * 0.3;
    if (formaFora > 0) lambdaFora = lambdaFora * 0.7 + formaFora * 0.3;

    const fatorial = n => {
        let r = 1;
        for (let i = 2; i <= n; i++) r *= i;
        return r;
    };

    const poisson = (l, k) => (Math.exp(-l) * Math.pow(l, k)) / fatorial(k);

    let pC = 0, pF = 0, pE = 0, pO = 0, pB = 0, pU = 0, soma = 0;

    for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
            const p = poisson(lambdaCasa, i) * poisson(lambdaFora, j);
            soma += p;
            if (i > j) pC += p;
            else if (i < j) pF += p;
            else pE += p;

            if (i + j >= 3) pO += p;
            if (i + j <= 2) pU += p;
            if (i > 0 && j > 0) pB += p;
        }
    }

    pC /= soma; pF /= soma; pE /= soma; pO /= soma; pB /= soma; pU /= soma;

    // Cálculo de EV (Valor Esperado)
    let evC = (pC * mercado.casa) - 1;
    let evE = (pE * mercado.empate) - 1;
    let evF = (pF * mercado.fora) - 1;
    let evB = (pB * mercado.btts) - 1;
    let evO = (pO * mercado.over) - 1;
    let evU = (pU * mercado.under) - 1;

    // Critério de Kelly (0.25 fracionado)
    const kelly = (p, o) => {
        if (!o || o <= 1) return 0;
        const b = o - 1;
        const k = ((b * p) - (1 - p)) / b;
        return k > 0 ? Math.min(k * 0.25 * 100, 5) : 0;
    };

    const kC = kelly(pC, mercado.casa);
    const kE = kelly(pE, mercado.empate);
    const kF = kelly(pF, mercado.fora);
    const kB = kelly(pB, mercado.btts);
    const kO = kelly(pO, mercado.over);
    const kU = kelly(pU, mercado.under);

    // --- 🎯 LÓGICA DE FILTRAGEM POR ELIMINAÇÃO ---
    const EV_MIN = 0.05;    // 1ª Eliminação: Menor que 5%
    const EV_TETO = 0.22;   // 2ª Eliminação: Maior que 22% (Anomalia)
    const EV_IDEAL = 0.15;  // Alvo: Próximo de 15%

    let evList = [
        { nome: "Casa", ev: evC, odd: mercado.casa, stake: kC },
        { nome: "Empate", ev: evE, odd: mercado.empate, stake: kE },
        { nome: "Fora", ev: evF, odd: mercado.fora, stake: kF },
        { nome: "BTTS", ev: evB, odd: mercado.btts, stake: kB },
        { nome: "Over 2.5", ev: evO, odd: mercado.over, stake: kO },
        { nome: "Under 2.5", ev: evU, odd: mercado.under, stake: kU }
    ];

    // ETAPA 1: O funil de segurança
    let candidatosSeguros = evList.filter(item => item.ev >= EV_MIN && item.ev <= EV_TETO);

    // ETAPA 2: A escolha técnica (Busca pelo Ideal)
    let melhor = { nome: "Sem valor", ev: 0, odd: 0, stake: 0 };
    const maiorEVBruto = Math.max(evC, evE, evF, evB, evO, evU);

    if (candidatosSeguros.length > 0) {
        // Ordena para que o primeiro item seja o mais próximo de 0.15
        candidatosSeguros.sort((a, b) => Math.abs(a.ev - EV_IDEAL) - Math.abs(b.ev - EV_IDEAL));
        melhor = candidatosSeguros[0];
    } else if (maiorEVBruto > EV_TETO) {
        // Se nenhum passou no filtro, mas existe um EV gigante
        melhor = { nome: "⚠️ Anomalia (Eliminado)", ev: maiorEVBruto, odd: 0, stake: 0 };
    }

    // Saída para o painel e salvamento
    exibirResultados(
        pC * 100, pE * 100, pF * 100,
        pB * 100, pO * 100, pU * 100,
        evC, evE, evF, evB, evO, evU, // Passei TODOS os 6 EVs na ordem
        kC, kE, kF, kB, kO, kU,       // Passei TODOS os 6 Kellys na ordem
        lambdaCasa + lambdaFora,
        melhor
    );


    window.dadosTemp = {
        time: document.getElementById('nomeJogo')?.value || "Jogo",
        ev: Number(melhor.ev),
        odd: Number(melhor.odd),
        stake: Number(melhor.stake),
        pC: pC * 100, pE: pE * 100, pF: pF * 100,
        pB: pB * 100, pO: pO * 100, pU: pU * 100,
        expGols: lambdaCasa + lambdaFora,
        principal: melhor.nome,
        lucro: 0,
        resultado: "Pendente"
    };
}

function exibirResultados(
    pC, pE, pF,
    pBTTS, pOver, pUnder,
    evC, evE, evF, evB, evO, evU, // 6 EVs na ordem
    kC, kE, kF, kB, kO, kU,       // 6 Stakes na ordem
    totalGols,
    melhor
) {
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
        ${linha("📉 Under 2.5", pUnder)} 
        <hr>
        <p>🔢 Gols esperados: <b>${totalGols.toFixed(2)}</b></p>
    `;

    // Lógica do Sweet Spot (Filtragem)
    if (melhor.nome.includes("Anomalia")) {
        html += `
        <div style="margin-top:15px;padding:12px;background:#fff3e0;border-radius:8px;border-left:5px solid #ff9800;">
            <b>${melhor.nome}</b><br>
            EV Bruto: <b>${melhor.ev.toFixed(2)}</b><br>
            <small>Valor suspeito detectado pelo filtro de segurança.</small>
        </div>`;
    } else if (melhor.ev >= 0.05) {
        html += `
        <div style="margin-top:15px;padding:12px;background:#e8f5e9;border-radius:8px;border-left:5px solid #2e7d32;">
            <b>🎯 Melhor Aposta (Sweet Spot):</b> ${melhor.nome}<br>
            EV Ideal: <b>${melhor.ev.toFixed(2)}</b> | Stake: <b>${melhor.stake.toFixed(1)}%</b>
        </div>`;
    } else {
        html += `<div style="margin-top:15px;padding:12px;background:#ffebee;border-radius:8px;border-left:5px solid #c62828;">⚠️ Sem valor matemático</div>`;
    }

    html += `<button onclick="salvarResultado()" style="margin-top:15px;width:100%;padding:12px;background:#1a237e;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">💾 SALVAR NA TABELA</button>`;

    painel.innerHTML = html;
}


function salvarResultado() {

    console.log("🚨 salvarResultado chamada");

    if (!window.dadosTemp) {
        alert("Nenhuma análise para salvar!");
        return;
    }

    const confirmar = window.confirm(
        "Deseja salvar esta análise?"
    );

    console.log("Resultado confirmação:", confirmar);

    if (confirmar !== true) {
        console.log("❌ cancelado");
        return;
    }

    let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];

    historico.unshift(window.dadosTemp);

    localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));

    renderizarTabela();

    console.log("✅ salvo");
}

window.executarAnalise = executarAnalise;
window.exibirResultados = exibirResultados;
window.salvarResultado = salvarResultado;

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
            <td>${Number(j.pU || 0).toFixed(1)}%</td>
            <td>${Number(j.expGols).toFixed(2)}</td>
            <td><b>${j.principal}</b></td>

            <td>
                ${j.golsC !== undefined
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

    const saldoAtual = bancaBase + lucroTotal;

    document.getElementById('lucroTotal').innerText =
        `Lucro: R$ ${lucroTotal.toFixed(2)}`;

    document.getElementById('saldoAtual').innerText =
        `Saldo Atual: R$ ${saldoAtual.toFixed(2)}`;
}

function validarPlacar(index) {
    let hist = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    let jogo = hist[index];

    const gC = parseInt(document.getElementById(`resC-${index}`)?.value);
    const gF = parseInt(document.getElementById(`resF-${index}`)?.value);

    if (isNaN(gC) || isNaN(gF)) {
        alert("Preencha o placar!");
        return;
    }

    jogo.golsC = gC;
    jogo.golsF = gF;

    const total = gC + gF;
    const aposta = jogo.principal;
    let green = false;

    // Lógica de validação atualizada
    if (aposta === "Over 2.5" && total > 2) green = true;
    else if (aposta === "Under 2.5" && total < 3) green = true; // <--- Importante para o Under aparecer
    else if (aposta === "BTTS" && gC > 0 && gF > 0) green = true;
    else if (aposta === "Casa" && gC > gF) green = true;
    else if (aposta === "Fora" && gF > gC) green = true;
    else if (aposta === "Empate" && gC === gF) green = true;

    let stake = Number(jogo.stake) || 0;
    let valor = 100 * (stake / 100);

    if (green) {
        jogo.lucro = (Number(jogo.odd) - 1) * valor;
        jogo.resultado = "Green";
    } else {
        jogo.lucro = -valor;
        jogo.resultado = "Red";
    }

    localStorage.setItem('meuHistoricoApostas', JSON.stringify(hist));
    renderizarTabela();
}


function exportarCSV() {

    const hist = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];

    let csv = "Time;EV;Odd;Stake;Casa;Empate;Fora;BTTS;Over;ExpGols;Aposta;Placar;Lucro\n";

    hist.forEach(j => {

        const placar = j.golsC !== undefined
            ? `${j.golsC} x ${j.golsF}`
            : "-";

        csv += `${j.time};`;
        csv += `${j.ev};`;
        csv += `${j.odd};`;
        csv += `${j.stake};`;
        csv += `${j.pC};`;
        csv += `${j.pE};`;
        csv += `${j.pF};`;
        csv += `${j.pB};`;
        csv += `${j.pO};`;
        csv += `${j.expGols};`;
        csv += `${j.principal};`;
        csv += `${placar};`;
        csv += `${j.lucro}\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio.csv";
    a.click();
}

function limparCampos() {

    document.querySelectorAll('input').forEach(i => i.value = "");
    document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);

    const painel = document.getElementById('painelResultado');
    if (painel) painel.innerHTML = "";
}

function excluir(index) {

    const confirmar = confirm("Deseja excluir este registro?");

    if (!confirmar) return;

    let hist = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];

    hist.splice(index, 1);

    localStorage.setItem('meuHistoricoApostas', JSON.stringify(hist));

    renderizarTabela();
}

function limparHistorico() {

    const confirmar = confirm("⚠️ Deseja apagar TODO o histórico?");

    if (!confirmar) return;

    localStorage.removeItem('meuHistoricoApostas');

    renderizarTabela();

    console.log("🧹 Histórico apagado");
}

window.executarAnalise = executarAnalise;
window.exibirResultados = exibirResultados;
window.salvarResultado = salvarResultado;
window.renderizarTabela = renderizarTabela;
window.validarPlacar = validarPlacar;
window.exportarCSV = exportarCSV;
window.limparCampos = limparCampos;
window.excluir = excluir;
window.limparHistorico = limparHistorico;

function preencherExemplo() {

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = val;
    };

    // 💰 ODDS
    set('oddCasa', "2.05");
    set('oddEmpate', "3.40");
    set('oddFora', "3.80");
    set('oddOver', "1.90");
    set('oddBTTS', "1.72");
    set('oddUnder', "1.90"); // ✅ faltava esse

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

    // ⚙️ LIGA
    set('mediaLiga', "2.5");
    set('motivacao', "1.0");

    // 🏷️ JOGO
    set('nomeJogo', "Flamengo x Palmeiras");

    // 🧹 limpa painel
    const painel = document.getElementById('painelResultado');
    if (painel) painel.innerHTML = "";

    console.log("✅ Exemplo carregado");
}





