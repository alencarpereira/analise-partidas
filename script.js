function executarAnalise() {
    const getVal = id => parseFloat(document.getElementById(id)?.value) || 0;

    // 🎯 CONFIGURAÇÕES DE ENTRADA
    const motivacaoEl = document.getElementById('motivacao');
    let motivacao = parseFloat(motivacaoEl?.value) || 1;

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

    // 📊 CÁLCULO DE FORMA
    const media = id => {
        const el = document.getElementById(id);
        if (!el || !el.value) return 0;
        const v = el.value.split(',').map(Number);
        if (v.length < 5) return 0;
        return (v[0] + v[1] + v[2] + v[3] * 1.3 + v[4] * 1.3) / 5.6;
    };

    const formaCasa = media('golsMCasa');
    const formaFora = media('golsMFora');

    // 🔒 SUAVIZAÇÃO
    const suavizar = (valor, mediaLiga) => {
        const pesoForma = 0.30;
        const pesoLiga = 0.70;
        return Math.max((valor * pesoForma) + (mediaLiga * pesoLiga), mediaLiga * 0.25);
    };

    const ataqueCasaSafe = suavizar(ataqueCasa, mediaLiga);
    const defesaCasaSafe = suavizar(defesaCasa, mediaLiga);
    const ataqueForaSafe = suavizar(ataqueFora, mediaLiga);
    const defesaForaSafe = suavizar(defesaFora, mediaLiga);

    // 🎯 CÁLCULO DAS LAMBDAS BASE
    let lambdaCasa = (ataqueCasaSafe / mediaLiga) * ((defesaForaSafe / mediaLiga) * 0.95) * mediaLiga;
    let lambdaFora = (ataqueForaSafe / mediaLiga) * ((defesaCasaSafe / mediaLiga) * 0.95) * mediaLiga;

    if (formaCasa > 0) lambdaCasa *= (1 + ((formaCasa - mediaLiga) / mediaLiga) * 0.08);
    if (formaFora > 0) lambdaFora *= (1 + ((formaFora - mediaLiga) / mediaLiga) * 0.08);

    // 🚧 LIMITADOR DINÂMICO
    let totalPre = lambdaCasa + lambdaFora;
    let minGols = mediaLiga * 0.85;
    let maxGols = mediaLiga * 1.25;

    if (totalPre > maxGols) {
        const f = maxGols / totalPre;
        lambdaCasa *= f;
        lambdaFora *= f;
    }
    if (totalPre < minGols) {
        const f = minGols / totalPre;
        lambdaCasa *= f;
        lambdaFora *= f;
    }

    // 🏠 FATOR CASA (equilibrado 🔥)
    lambdaCasa *= 1.06;
    lambdaFora *= 0.94;

    // 🚀 APLICAÇÃO DA MOTIVAÇÃO
    lambdaCasa *= motivacao;
    lambdaFora *= motivacao;

    // 🔧 AJUSTE FINAL
    lambdaCasa *= 1.01;
    lambdaFora *= 1.01;

    // 📊 TOTAL DE GOLS ESPERADOS
    let totalLambda = lambdaCasa + lambdaFora;

    // 📐 POISSON
    const fatorial = n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
    const poisson = (l, k) => (Math.exp(-l) * Math.pow(l, k)) / fatorial(k);

    let pC = 0, pF = 0, pE = 0, pO = 0, pB = 0, pU = 0, soma = 0;
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
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

    pC /= soma; pF /= soma; pE /= soma;
    pO /= soma; pU /= soma; pB /= soma;
    let soma1x2 = pC + pE + pF;
    pC /= soma1x2; pE /= soma1x2; pF /= soma1x2;

    // 💰 EV e KELLY
    let evC = (pC * mercado.casa) - 1;
    let evE = (pE * mercado.empate) - 1;
    let evF = (pF * mercado.fora) - 1;
    let evB = (pB * mercado.btts) - 1;
    let evO = (pO * mercado.over) - 1;
    let evU = (pU * mercado.under) - 1;

    const kelly = (p, o) => {
        if (!o || o <= 1) return 0;

        const b = o - 1;
        const k = ((b * p) - (1 - p)) / b;

        if (k <= 0) return 0;

        let stake = k * 0.25 * 100;

        // 🔥 CONTROLE POR ODD
        if (o >= 3.0) stake *= 0.5;   // corta pela metade
        if (o >= 4.0) stake *= 0.5;   // corta mais ainda

        return Math.min(stake, 5);
    };
    let evList = [
        { nome: "Casa", ev: evC, prob: pC, odd: mercado.casa, stake: kelly(pC, mercado.casa) },
        { nome: "Empate", ev: evE, prob: pE, odd: mercado.empate, stake: kelly(pE, mercado.empate) },
        { nome: "Fora", ev: evF, prob: pF, odd: mercado.fora, stake: kelly(pF, mercado.fora) },
        { nome: "BTTS", ev: evB, prob: pB, odd: mercado.btts, stake: kelly(pB, mercado.btts) },
        { nome: "Over 2.5", ev: evO, prob: pO, odd: mercado.over, stake: kelly(pO, mercado.over) },
        { nome: "Under 2.5", ev: evU, prob: pU, odd: mercado.under, stake: kelly(pU, mercado.under) }
    ];

    // 🔥 AJUSTE EV (mais inteligente)
    evList.forEach(i => {
        if (i.nome === "Over 2.5" || i.nome === "BTTS") {
            if ((lambdaCasa + lambdaFora) < 2.6) {
                i.ev *= 0.90; // penaliza jogo fechado
            } else {
                i.ev *= 0.97; // leve ajuste padrão
            }
        }
    });

    let melhor = { nome: "Sem valor", ev: 0, odd: 0, stake: 0, prob: 0 };

    // 🎯 ==========================
    // 1️⃣ CASA / FORA (PRIORIDADE)
    // ==========================
    const fatorCasa = 1.05;

    let pri1x2 = evList
        .filter(i => i.nome === "Casa" || i.nome === "Fora")
        .map(i => {
            let probAjustada = i.prob;

            if (i.nome === "Casa") {
                probAjustada *= fatorCasa;
            }

            return { ...i, probAjustada };
        })
        .filter(i => {
            const edge = i.ev * i.probAjustada;

            return (
                edge >= 0.02 &&
                i.probAjustada >= 0.42 &&
                i.probAjustada <= 0.70
            );
        })
        .sort((a, b) => b.probAjustada - a.probAjustada)[0];


    // 🧠 ==========================
    // 2️⃣ DECISÃO FINAL INTELIGENTE
    // ==========================
    const totalGols = lambdaCasa + lambdaFora;

    if (pri1x2) {

        // 🥇 PRIORIDADE ABSOLUTA
        melhor = pri1x2;

    } else {

        // 🔥 ==========================
        // DETECÇÃO DE ESTILO DE JOGO
        // ==========================

        // 🚀 JOGO MUITO ABERTO → OVER
        if (totalGols >= 3.20) {

            let priOver = evList.find(i =>
                i.nome === "Over 2.5" &&
                i.ev >= 0.03 &&
                i.prob >= 0.60
            );

            if (priOver) melhor = priOver;
        }

        // ⚖️ JOGO EQUILIBRADO → BTTS
        else if (totalGols >= 2.40 && totalGols < 3.10) {

            let priBTTS = evList.find(i =>
                i.nome === "BTTS" &&
                i.ev >= 0.02 &&
                i.prob >= 0.52 &&
                i.prob <= 0.66
            );

            if (priBTTS) melhor = priBTTS;
        }

        // 🧱 JOGO FECHADO → UNDER
        else {

            let priUnder = evList.find(i =>
                i.nome === "Under 2.5" &&
                i.ev >= 0.03 &&
                i.prob >= 0.55
            );

            if (priUnder) melhor = priUnder;
        }
    }

    exibirResultados(pC * 100, pE * 100, pF * 100, pB * 100, pO * 100, pU * 100, evC, evE, evF, evB, evO, evU, kelly(pC, mercado.casa), kelly(pE, mercado.empate), kelly(pF, mercado.fora), kelly(pB, mercado.btts), kelly(pO, mercado.over), kelly(pU, mercado.under), lambdaCasa + lambdaFora, melhor);
}


function exibirResultados(pC, pE, pF, pBTTS, pOver, pUnder, evC, evE, evF, evB, evO, evU, kC, kE, kF, kB, kO, kU, totalGols, melhor) {
    const painel = document.getElementById('painelResultado');
    if (!painel) return;

    const linha = (nome, prob, ev = null) => {
        let cor = prob >= 60 ? "#2e7d32" : (prob <= 40 ? "#c62828" : "#333");
        return `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span>${nome}</span>
            <span>
                <b style="color:${cor}">${prob.toFixed(1)}%</b>
                ${ev !== null ? `<small style="margin-left:6px;color:#666;">EV: ${ev.toFixed(2)}</small>` : ""}
            </span>
        </div>`;
    };

    let html = `<h3>📊 Probabilidades</h3>${linha("🏠 Casa", pC, evC)}${linha("🤝 Empate", pE, evE)}${linha("🚀 Fora", pF, evF)}<hr>
                <h3>📈 Mercados</h3>${linha("⚽ BTTS", pBTTS, evB)}${linha("📈 Over 2.5", pOver, evO)}${linha("📉 Under 2.5", pUnder, evU)}<hr>
                <p>🔢 Gols esperados: <b>${totalGols.toFixed(2)}</b></p>`;

    if (!melhor.nome || melhor.nome === "Sem valor") {
        html += `<div style="margin-top:15px;padding:12px;background:#ffebee;border-radius:8px;border-left:5px solid #c62828;">⚠️ Sem valor matemático</div>`;
        window.dadosTemp = null;
    } else {
        // Dentro da função exibirResultados:
        // Dentro de exibirResultados, logo antes do cartão verde:
        const ehPri1x2 = (melhor.nome === "Casa" || melhor.nome === "Fora");

        const ehPriOver = (melhor.nome === "Over 2.5") && melhor.prob >= 0.55;

        const ehPriBTTS = (melhor.nome === "BTTS") && melhor.prob >= 0.55;

        const etiqueta = ehPri1x2 ? "🎯 ODD DE VALOR" :
            (ehPriOver ? "📈 PRIORIDADE OVER" :
                (ehPriBTTS ? "⚽ PRIORIDADE BTTS" : "💰 MAIOR EV"));



        html += `
        <div style="margin-top:15px;padding:12px;background:#e8f5e9;border-radius:8px;border-left:5px solid #2e7d32;">
            <small style="background:#1a237e;color:white;padding:2px 5px;border-radius:3px">${etiqueta}</small><br>
            <b>Aposta:</b> ${melhor.nome}<br>
            <b>EV:</b> ${melhor.ev.toFixed(2)} | <b>Stake:</b> ${melhor.stake.toFixed(1)}%
        </div>`;

        window.dadosTemp = {
            time: document.getElementById('nomeJogo')?.value || "Jogo",
            ev: melhor.ev, odd: melhor.odd, stake: melhor.stake,
            pC, pE, pF, pB: pBTTS, pO: pOver, pU: pUnder,
            expGols: totalGols, principal: melhor.nome, lucro: 0
        };
    }

    html += `<button onclick="${window.dadosTemp ? 'salvarResultado()' : 'alert(\'Sem valor\')'}" style="margin-top:15px;width:100%;padding:12px;background:#1a237e;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">💾 SALVAR NA TABELA</button>`;
    painel.innerHTML = html;
}

function salvarResultado() {
    console.log("🚨 salvarResultado chamada");

    if (!window.dadosTemp) {
        alert("Nenhuma análise válida para salvar!");
        return;
    }

    const confirmar = window.confirm(
        `Deseja salvar a análise de: ${window.dadosTemp.time}?`
    );

    if (!confirmar) return;

    // 🔥 PROB DO MERCADO PRINCIPAL
    let probPrincipal = 0;

    if (window.dadosTemp.principal.includes("Casa")) probPrincipal = window.dadosTemp.pC;
    else if (window.dadosTemp.principal.includes("Fora")) probPrincipal = window.dadosTemp.pF;
    else if (window.dadosTemp.principal.includes("BTTS")) probPrincipal = window.dadosTemp.pB;
    else if (window.dadosTemp.principal.includes("Over")) probPrincipal = window.dadosTemp.pO;
    else if (window.dadosTemp.principal.includes("Under")) probPrincipal = window.dadosTemp.pU;

    // 📊 EDGE REAL
    const edge = (window.dadosTemp.ev || 0) * (probPrincipal / 100);

    // 🧠 CLASSIFICAÇÃO (ÚNICA E CORRETA)
    let nivel = "🔴 RISCO";
    let cor = "#c62828";

    if (edge >= 0.04) {
        nivel = "🟢 VALOR";
        cor = "#2e7d32";
    } else if (edge >= 0.02) {
        nivel = "🟡 NEUTRO";
        cor = "#f9a825";
    }

    try {
        let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];

        window.dadosTemp.data = new Date().toLocaleString('pt-BR');

        window.dadosTemp.nivel = nivel;
        window.dadosTemp.edge = edge;
        window.dadosTemp.cor = cor; // 🔥 IMPORTANTE

        historico.unshift(window.dadosTemp);

        localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));

        window.dadosTemp = null;

        renderizarTabela();

        console.log("✅ salvo com sucesso");
        alert(`Análise salva! Classificação: ${nivel}`);

    } catch (e) {
        console.error("Erro ao salvar", e);
        alert("Erro ao salvar!");
    }
}

window.executarAnalise = executarAnalise;
window.exibirResultados = exibirResultados;
window.salvarResultado = salvarResultado;

function renderizarTabela() {
    const hist = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    const corpo = document.getElementById('corpoTabela');

    if (!corpo) return;

    let lucroTotal = 0;
    const bancaBase = 100;

    corpo.innerHTML = hist.map((j, i) => {
        const lucro = Number(j.lucro) || 0;
        lucroTotal += lucro;

        const corLucro = lucro > 0 ? "green" : (lucro < 0 ? "red" : "black");

        return `
<tr style="border-left:5px solid ${j.cor || '#ccc'}; background:${j.cor ? j.cor + '15' : 'transparent'};">
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

    <td style="color: ${corLucro}; font-weight: bold;">
        R$ ${lucro.toFixed(2)}
    </td>

    <td>
        <button onclick="excluir(${i})">🗑️</button>
    </td>
</tr>`;
    }).join('');

    const saldoAtual = bancaBase + lucroTotal;
    const totalInvestido = hist.reduce((acc, j) => acc + (bancaBase * (Number(j.stake) / 100)), 0);
    const roi = totalInvestido > 0 ? (lucroTotal / totalInvestido) * 100 : 0;

    if (document.getElementById('lucroTotal')) document.getElementById('lucroTotal').innerText = `Lucro: R$ ${lucroTotal.toFixed(2)}`;
    if (document.getElementById('saldoAtual')) document.getElementById('saldoAtual').innerText = `Saldo Atual: R$ ${saldoAtual.toFixed(2)}`;
    if (document.getElementById('roi')) document.getElementById('roi').innerText = `ROI: ${roi.toFixed(2)}%`;
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
    if (confirm("Tem certeza que deseja excluir esta análise?")) {
        let hist = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
        hist.splice(index, 1);
        localStorage.setItem('meuHistoricoApostas', JSON.stringify(hist));
        renderizarTabela();
    }
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





