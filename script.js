function executarAnalise() {

    const getVal = id => parseFloat(document.getElementById(id)?.value) || 0;

    // 🎯 MOTIVAÇÃO
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

    // 📊 FORMA
    const media = id => {
        const el = document.getElementById(id);
        if (!el || !el.value) return 0;
        const v = el.value.split(',').map(Number);
        if (v.length < 5) return 0;
        return (v[0] + v[1] + v[2] + v[3] * 1.3 + v[4] * 1.3) / 5.6; // Reduzi o peso dos últimos jogos de 1.5 para 1.3
    };

    const formaCasa = media('golsMCasa');
    const formaFora = media('golsMFora');

    // 🔒 SUAVIZAÇÃO DINÂMICA
    // Agora o peso se ajusta: ligas com mais gols permitem que o ataque individual apareça mais
    const suavizar = (valor, mediaLiga) => {
        const pesoForma = 0.30;
        const pesoLiga = 0.70;
        let ajustado = (valor * pesoForma) + (mediaLiga * pesoLiga);
        // O piso agora é 25% da média da liga, evitando Under extremo em ligas over
        return Math.max(ajustado, mediaLiga * 0.25);
    };

    const ataqueCasaSafe = suavizar(ataqueCasa, mediaLiga);
    const defesaCasaSafe = suavizar(defesaCasa, mediaLiga);
    const ataqueForaSafe = suavizar(ataqueFora, mediaLiga);
    const defesaForaSafe = suavizar(defesaFora, mediaLiga);

    // ✅ NORMALIZAÇÃO
    const ataqueCasaAdj = ataqueCasaSafe / mediaLiga;
    const defesaCasaAdj = defesaCasaSafe / mediaLiga;
    const ataqueForaAdj = ataqueForaSafe / mediaLiga;
    const defesaForaAdj = defesaForaSafe / mediaLiga;

    // 🎯 LAMBDAS (Removido boosts excessivos)
    let lambdaCasa = ataqueCasaAdj * (defesaForaAdj * 0.95) * mediaLiga; // Era 0.90 e tinha boost 1.05
    let lambdaFora = ataqueForaAdj * (defesaCasaAdj * 0.95) * mediaLiga; // Era 0.90

    lambdaCasa *= motivacao;
    lambdaFora *= motivacao;

    // Peso da forma na Lambda reduzido de 0.15 para 0.08
    if (formaCasa > 0) {
        lambdaCasa *= (1 + ((formaCasa - mediaLiga) / mediaLiga) * 0.08);
    }
    if (formaFora > 0) {
        lambdaFora *= (1 + ((formaFora - mediaLiga) / mediaLiga) * 0.08);
    }

    // 🚀 BOOST ANTI-UNDER REDUZIDO (De 1.03 para 1.01)
    lambdaCasa *= 1.01;
    lambdaFora *= 1.01;

    // 🚧 LIMITADOR DE GOLS DINÂMICO (A grande mudança)
    // Em vez de 2.1 e 3.0 fixos, usamos margens baseadas na própria liga escolhida
    let total = lambdaCasa + lambdaFora;
    let minGols = mediaLiga * 0.85; // Permite até 15% abaixo da média
    let maxGols = mediaLiga * 1.25; // Permite até 25% acima da média

    if (total > maxGols) {
        const f = maxGols / total;
        lambdaCasa *= f;
        lambdaFora *= f;
    }
    if (total < minGols) {
        const f = minGols / total;
        lambdaCasa *= f;
        lambdaFora *= f;
    }
    // 📐 POISSON (Mantido)
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

    // 🔄 REAJUSTE FINAL
    let soma1x2 = pC + pE + pF;
    pC /= soma1x2; pE /= soma1x2; pF /= soma1x2;

    // 💰 EV e KELLY (Mantidos)
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
        return k > 0 ? Math.min(k * 0.25 * 100, 5) : 0;
    };

    let evList = [
        { nome: "Casa", ev: evC, prob: pC, odd: mercado.casa, stake: kelly(pC, mercado.casa) },
        { nome: "Empate", ev: evE, prob: pE, odd: mercado.empate, stake: kelly(pE, mercado.empate) },
        { nome: "Fora", ev: evF, prob: pF, odd: mercado.fora, stake: kelly(pF, mercado.fora) },
        { nome: "BTTS", ev: evB, prob: pB, odd: mercado.btts, stake: kelly(pB, mercado.btts) },
        { nome: "Over 2.5", ev: evO, prob: pO, odd: mercado.over, stake: kelly(pO, mercado.over) },
        { nome: "Under 2.5", ev: evU, prob: pU, odd: mercado.under, stake: kelly(pU, mercado.under) }
    ];

    let candidatos = evList.filter(i => {
        let evMinimo = (i.nome === "Casa" || i.nome === "Fora") ? 0.05 : 0.08;
        return i.ev >= evMinimo && (i.prob >= 0.40 || ((i.nome === "Casa" || i.nome === "Fora") && i.prob >= 0.35));
    });

    let melhor = { nome: "Sem valor", ev: 0, odd: 0, stake: 0 };
    let prioridade1x2 = candidatos.find(i => (i.nome === "Casa" || i.nome === "Fora") && i.prob >= 0.41);

    if (prioridade1x2) {
        melhor = prioridade1x2;
    } else if (candidatos.length > 0) {
        candidatos.sort((a, b) => b.ev - a.ev); // Prioriza o puro EV agora que as Lambdas são estáveis
        melhor = candidatos[0];
    }

    exibirResultados(pC * 100, pE * 100, pF * 100, pB * 100, pO * 100, pU * 100, evC, evE, evF, evB, evO, evU, kelly(pC, mercado.casa), kelly(pE, mercado.empate), kelly(pF, mercado.fora), kelly(pB, mercado.btts), kelly(pO, mercado.over), kelly(pU, mercado.under), lambdaCasa + lambdaFora, melhor);
}


function exibirResultados(
    pC, pE, pF,
    pBTTS, pOver, pUnder,
    evC, evE, evF, evB, evO, evU,
    kC, kE, kF, kB, kO, kU,
    totalGols,
    melhor
) {
    const painel = document.getElementById('painelResultado');
    if (!painel) return;

    // --- FILTRO DE SEGURANÇA ADICIONAL ---
    // Aplica o bloqueio de Under antes de começar a gerar o HTML
    if (melhor.nome === "Under 2.5" && (pUnder < 58 || evU < 0.08)) {
        melhor = { nome: "Sem valor", ev: 0, odd: 0, stake: 0 };
    }

    const linha = (nome, prob, ev = null) => {
        let cor = "#333";
        if (prob >= 60) cor = "#2e7d32";
        else if (prob <= 40) cor = "#c62828";

        return `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span>${nome}</span>
            <span>
                <b style="color:${cor}">${prob.toFixed(1)}%</b>
                ${ev !== null ? `<small style="margin-left:6px;color:#666;">EV: ${ev.toFixed(2)}</small>` : ""}
            </span>
        </div>
        `;
    };

    let html = `
        <h3>📊 Probabilidades</h3>
        ${linha("🏠 Casa", pC, evC)}
        ${linha("🤝 Empate", pE, evE)}
        ${linha("🚀 Fora", pF, evF)}
        <hr>
        <h3>📈 Mercados</h3>
        ${linha("⚽ BTTS", pBTTS, evB)}
        ${linha("📈 Over 2.5", pOver, evO)}
        ${linha("📉 Under 2.5", pUnder, evU)}
        <hr>
        <p>🔢 Gols esperados: <b>${totalGols.toFixed(2)}</b></p>
    `;

    // --- ÁREA DE RESULTADO FINAL ---
    let cartaoResultado = "";

    if (!melhor.nome || melhor.nome === "Sem valor") {
        cartaoResultado = `
        <div style="margin-top:15px;padding:12px;background:#ffebee;border-radius:8px;border-left:5px solid #c62828;">
            ⚠️ Nenhuma aposta com valor matemático
        </div>`;
        window.dadosTemp = null; // Bloqueia salvamento
    }
    else if (melhor.nome.includes("Anomalia")) {
        cartaoResultado = `
        <div style="margin-top:15px;padding:12px;background:#fff3e0;border-radius:8px;border-left:5px solid #ff9800;">
            <b>⚠️ ${melhor.nome}</b><br>
            EV Bruto: <b>${(melhor.ev || 0).toFixed(2)}</b><br>
            <small>Valor suspeito detectado.</small>
        </div>`;
    }
    else {
        cartaoResultado = `
        <div style="margin-top:15px;padding:12px;background:#e8f5e9;border-radius:8px;border-left:5px solid #2e7d32;">
            <b>🎯 Melhor Aposta:</b> ${melhor.nome}<br>
            EV: <b>${(melhor.ev || 0).toFixed(2)}</b> | Stake: <b>${(melhor.stake || 0).toFixed(1)}%</b>
        </div>`;

        // SALVAR DADOS APENAS SE TIVER VALOR
        window.dadosTemp = {
            time: document.getElementById('nomeJogo')?.value || "Jogo",
            ev: melhor.ev,
            odd: melhor.odd,
            stake: melhor.stake,
            pC, pE, pF, pB: pBTTS, pO: pOver, pU: pUnder,
            expGols: totalGols,
            principal: melhor.nome,
            lucro: 0
        };
    }

    html += cartaoResultado;

    // Botão de salvar (só habilitado se houver valor)
    const btnDisabled = (!melhor.nome || melhor.nome === "Sem valor") ? "opacity:0.5; cursor:not-allowed;" : "";

    html += `
    <button onclick="${window.dadosTemp ? 'salvarResultado()' : 'alert(\'Sem valor para salvar\')'}"
        style="margin-top:15px;width:100%;padding:12px;background:#1a237e;color:#fff;border:none;border-radius:8px;font-weight:bold; ${btnDisabled}">
        💾 SALVAR NA TABELA
    </button>`;

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

    if (!confirmar) {
        console.log("❌ cancelado");
        return;
    }

    try {
        let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];

        // Adiciona ao início da lista
        historico.unshift(window.dadosTemp);

        // Salva de volta no LocalStorage
        localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));

        // Limpa o dado temporário para evitar duplicatas
        window.dadosTemp = null;

        // Atualiza a interface
        renderizarTabela();

        console.log("✅ salvo com sucesso");
        alert("Análise salva no histórico!");

    } catch (e) {
        console.error("Erro ao salvar no localStorage", e);
        alert("Erro ao salvar! Verifique se o navegador permite cookies/armazenamento.");
    }
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

    // 📊 ROI
    const totalInvestido = hist.reduce((acc, j) => acc + (100 * (j.stake / 100)), 0);
    const roi = totalInvestido > 0 ? (lucroTotal / totalInvestido) * 100 : 0;

    document.getElementById('lucroTotal').innerText =
        `Lucro: R$ ${lucroTotal.toFixed(2)}`;

    document.getElementById('saldoAtual').innerText =
        `Saldo Atual: R$ ${saldoAtual.toFixed(2)}`;

    document.getElementById('roi').innerText =
        `ROI: ${roi.toFixed(2)}%`;
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





