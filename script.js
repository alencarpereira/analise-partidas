function executarAnalise() {
    const bancaTotal = 100;
    const getVal = (id) => parseFloat(document.getElementById(id).value) || 0;

    const mercado = {
        casa: getVal('oddCasa'),
        empate: getVal('oddEmpate'),
        fora: getVal('oddFora'),
        over: getVal('oddOver'),
        btts: getVal('oddBTTS')
    };

    const calcularMediaAjustada = (id) => {
        const input = document.getElementById(id).value;
        if (!input) return 0;
        const v = input.split(',').map(Number);
        return (v[0] + v[1] + v[2] + (v[3] * 1.5) + (v[4] * 1.5)) / 6;
    };

    const expGolsCasa = (calcularMediaAjustada('golsMCasa') + getVal('forcaAtaqueCasa')) / 2;
    const expGolsFora = (calcularMediaAjustada('golsMFora') + getVal('forcaAtaqueFora')) / 2;

    const fatorMotivacao = getVal('motivacao') || 1;
    const lambdaCasa = expGolsCasa * fatorMotivacao;
    const lambdaFora = expGolsFora * fatorMotivacao;

    const poisson = (lambda, k) => (Math.exp(-lambda) * Math.pow(lambda, k)) / [1, 1, 2, 6, 24, 120][k];

    let pCasa = 0, pFora = 0, pEmpate = 0, pOver = 0, pBTTS = 0;
    const rho = -0.05;
    let somaTotalProb = 0;

    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            let probPlacar = poisson(lambdaCasa, i) * poisson(lambdaFora, j);
            if (i === 0 && j === 0) probPlacar *= (1 - (lambdaCasa * lambdaFora * rho));
            else if (i === 0 && j === 1) probPlacar *= (1 + (lambdaCasa * rho));
            else if (i === 1 && j === 0) probPlacar *= (1 + (lambdaFora * rho));
            else if (i === 1 && j === 1) probPlacar *= (1 - rho);

            somaTotalProb += probPlacar;
            if (i > j) pCasa += probPlacar;
            else if (i < j) pFora += probPlacar;
            else pEmpate += probPlacar;
            if ((i + j) > 2.5) pOver += probPlacar;
            if (i > 0 && j > 0) pBTTS += probPlacar;
        }
    }

    pCasa /= somaTotalProb; pFora /= somaTotalProb; pEmpate /= somaTotalProb;
    pOver /= somaTotalProb; pBTTS /= somaTotalProb;

    const calcularKelly = (prob, odd) => {
        if (!odd || odd <= 1) return 0;
        const b = odd - 1;
        const kellyBruto = ((b * prob) - (1 - prob)) / b;
        let stakeSugerida = kellyBruto * 0.10 * 100;
        return kellyBruto > 0 ? parseFloat(Math.min(stakeSugerida, 5.0).toFixed(1)) : 0;
    };

    // --- AQUI ESTÁ A CORREÇÃO: CRIAR AS VARIÁVEIS ANTES ---
    const evCasa = (pCasa * mercado.casa);
    const evBTTS = (pBTTS * mercado.btts);
    const evOver = (pOver * mercado.over);
    const kCasa = calcularKelly(pCasa, mercado.casa);
    const kBTTS = calcularKelly(pBTTS, mercado.btts);
    const kOver = calcularKelly(pOver, mercado.over);

    exibirResultados(
        pCasa * 100, pEmpate * 100, pFora * 100, pBTTS * 100, pOver * 100,
        evCasa, evBTTS, evOver,
        kCasa, kBTTS, kOver,
        lambdaCasa + lambdaFora
    );

    // --- LÓGICA PARA DEFINIR APOSTA PRINCIPAL ---
    let principalNome = "Casa";
    let maiorEV = evCasa;
    let oddFinal = mercado.casa;
    let stakeFinal = kCasa;

    if (evBTTS > maiorEV) {
        maiorEV = evBTTS; principalNome = "BTTS"; oddFinal = mercado.btts; stakeFinal = kBTTS;
    }
    if (evOver > maiorEV) {
        maiorEV = evOver; principalNome = "Over 2.5"; oddFinal = mercado.over; stakeFinal = kOver;
    }

    // --- OBJETO QUE VAI PARA A TABELA ---
    // Pega o nome digitado ou coloca a hora se estiver vazio
    const nomeDoTime = document.getElementById('nomeJogo').value || "Jogo " + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const dadosParaSalvar = {
        time: nomeDoTime, // <--- Agora ele usa o nome que você digitou!
        ev: maiorEV,
        odd: oddFinal,
        stake: stakeFinal,
        pC: pCasa * 100,
        pE: pEmpate * 100,
        pF: pFora * 100,
        pB: pBTTS * 100,
        pO: pOver * 100,
        expGols: lambdaCasa + lambdaFora,
        principal: principalNome,
        lucro: 0,
        resultado: "Pendente"
    };


    // Inserindo o botão no painel de resultados
    document.getElementById('painelResultado').innerHTML += `
        <button onclick='salvarResultado(${JSON.stringify(dadosParaSalvar)})' 
                style="width:100%; margin-top:15px; padding:12px; background:#1a237e; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">
            💾 SALVAR NA TABELA DE RELATÓRIO
        </button>
    `;
}

function salvarResultado(dados) {
    let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    historico.unshift(dados);
    localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));
    renderizarTabela();
}

function limparHistorico() {
    if (confirm("Isso apagará todas as análises salvas. Confirma?")) {
        localStorage.removeItem('meuHistoricoApostas');
        renderizarTabela();
    }
}


function exibirResultados(pC, pE, pF, pBTTS, pOver, evC, evB, evO, kellyC, kellyB, kellyO, totalGols) {
    const painel = document.getElementById('painelResultado');
    document.getElementById('resultado').style.display = 'block';

    const fairC = (100 / pC).toFixed(2);
    const fairE = (100 / pE).toFixed(2);
    const fairF = (100 / pF).toFixed(2);
    const fairB = (100 / pBTTS).toFixed(2);
    const fairO = (100 / pOver).toFixed(2);

    let html = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: bold; font-size: 0.9em;">
            <span>🏠 Casa: ${pC.toFixed(1)}% <small style="color:#666">(${fairC})</small></span>
            <span>🤝 Empate: ${pE.toFixed(1)}% <small style="color:#666">(${fairE})</small></span>
            <span>🚀 Fora: ${pF.toFixed(1)}% <small style="color:#666">(${fairF})</small></span>
        </div>
        <div style="display: flex; justify-content: space-around; margin-bottom: 15px; font-size: 0.85em;">
            <span style="color: #1565c0;">⚽ BTTS: <b>${pBTTS.toFixed(1)}%</b> <small>(${fairB})</small></span>
            <span style="color: #e65100;">📈 Over 2.5: <b>${pOver.toFixed(1)}%</b> <small>(${fairO})</small></span>
        </div>
    `;

    // Cards de Valor (Refatorados para serem limpos)
    const criarCard = (titulo, ev, fair, stake, cor) => {
        if (ev <= 1.02) return "";
        return `<div style="background:${cor}15; padding:12px; border-radius:8px; border:2px solid ${cor}; margin-bottom: 10px;">
            <b style="color:${cor}; uppercase;">🔥 ${titulo} (EV: ${ev.toFixed(2)})</b><br>
            Sua Odd: ${fair} | Stake: <b>${stake}%</b>
        </div>`;
    };

    html += criarCard("Valor em Casa", evC, fairC, kellyC, "#2e7d32");
    html += criarCard("Valor em BTTS", evB, fairB, kellyB, "#1565c0");
    html += criarCard("Valor em Over 2.5", evO, fairO, kellyO, "#ef6c00");

    if (evC <= 1.02 && evB <= 1.02 && evO <= 1.02) {
        html += `<div style="background:#ffebee; padding:12px; border-radius:8px; text-align:center;">⚠️ Sem valor claro (Margem < 2%).</div>`;
    }

    html += `<p style="font-size: 0.8em; margin-top: 10px; color: #666; text-align:center;">Expectativa Total: <b>${totalGols.toFixed(2)} gols</b></p>`;
    painel.innerHTML = html;
}
// 1. FUNÇÃO PARA SALVAR (Garante que os números entrem limpos)
function salvarResultado(dados) {
    let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    // Adiciona campos iniciais de controle
    dados.resultado = "Pendente";
    dados.lucro = 0;

    historico.unshift(dados);
    localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));
    renderizarTabela();
    alert("Análise salva com sucesso!");
}

// 2. FUNÇÃO PARA CALCULAR GREEN/RED (Arruma a última coluna)
function marcarResultado(index, tipo) {
    let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    let jogo = historico[index];
    const bancaBase = 100; // Valor da sua banca para o cálculo

    // Converte a stake para valor financeiro (ex: 1.8% de 1000 = 18.00)
    let valorApostado = bancaBase * (Number(jogo.stake) / 100);

    if (tipo === 'Green') {
        // Lucro Líquido: (Odd - 1) * Valor Apostado
        jogo.lucro = (Number(jogo.odd) - 1) * valorApostado;
        jogo.resultado = "Green";
    } else {
        // Prejuízo: Valor Apostado negativo
        jogo.lucro = -valorApostado;
        jogo.resultado = "Red";
    }

    localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));
    renderizarTabela(); // Atualiza o R$ na tela na hora
}

// 3. FUNÇÃO PARA RENDERIZAR (O visual da tabela)
function renderizarTabela() {
    const historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    const corpo = document.getElementById('corpoTabela');
    if (!corpo) return;

    let somaLucro = 0;

    corpo.innerHTML = historico.map((jogo, index) => {
        const ev = Number(jogo.ev) || 0;
        const odd = Number(jogo.odd) || 0;
        const stake = Number(jogo.stake) || 0;
        const lucro = Number(jogo.lucro) || 0;
        somaLucro += lucro;

        let bgLinha = "#fff9c4"; // Pendente (Amarelo)
        if (jogo.resultado === "Green") bgLinha = "#e8f5e9";
        if (jogo.resultado === "Red") bgLinha = "#ffebee";

        return `
            <tr style="background: ${bgLinha}; border-bottom: 1px solid #ddd; text-align: center;">
                <td style="padding:8px; font-weight:bold; border: 1px solid #ddd;">${jogo.time}</td>
                <td style="border: 1px solid #ddd;">${ev.toFixed(2)}</td>
                <td style="border: 1px solid #ddd;">${odd.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; color: #1565c0; font-weight:bold;">${stake.toFixed(1)}%</td>
                <td style="border: 1px solid #ddd;">${Number(jogo.pC).toFixed(1)}%</td>
                <td style="border: 1px solid #ddd;">${Number(jogo.pE).toFixed(1)}%</td>
                <td style="border: 1px solid #ddd;">${Number(jogo.pF).toFixed(1)}%</td>
                <td style="border: 1px solid #ddd;">${Number(jogo.pB).toFixed(1)}%</td>
                <td style="border: 1px solid #ddd;">${Number(jogo.pO).toFixed(1)}%</td>
                <td style="border: 1px solid #ddd;">${Number(jogo.expGols).toFixed(2)}</td>
                <td style="border: 1px solid #ddd; background: #fffde7;"><b>${jogo.principal}</b></td>
            
<td style="border: 1px solid #ddd; min-width: 140px; padding: 5px;">
    <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
        <input type="number" id="resC-${index}" 
               style="width: 45px; height: 25px; text-align: center; border: 1px solid #999; border-radius: 4px; font-weight: bold; font-size: 1.1em; appearance: textfield;" 
               value="${jogo.golsC !== undefined ? jogo.golsC : ''}">
        
        <span style="font-weight: bold; font-size: 1.1em;">×</span>
        
        <input type="number" id="resF-${index}" 
               style="width: 45px; height: 25px; text-align: center; border: 1px solid #999; border-radius: 4px; font-weight: bold; font-size: 1.1em; appearance: textfield;" 
               value="${jogo.golsF !== undefined ? jogo.golsF : ''}">
        
        <button onclick="validarPlacar(${index})" 
                style="background: #1a237e; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.2s;">
            OK
        </button>
    </div>
</td>


                <td style="border: 1px solid #ddd; font-weight:bold; color: ${lucro >= 0 ? '#2e7d32' : '#c62828'}">
                    R$ ${lucro.toFixed(2)}
                </td>
                <td style="border: 1px solid #ddd;">
                    <button onclick="excluirLinha(${index})" style="background:none; border:none; cursor:pointer; font-size:1.2em;">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    // Atualiza Painel de Saldo
    const bancaInicial = 100;
    const lucroTotalElem = document.getElementById('lucroTotal');
    const saldoAtualElem = document.getElementById('saldoAtual');

    if (lucroTotalElem) lucroTotalElem.innerHTML = `Lucro Total: ${somaLucro >= 0 ? '+' : ''} R$ ${somaLucro.toFixed(2)}`;
    if (saldoAtualElem) saldoAtualElem.innerHTML = `Saldo Atual: R$ ${(bancaInicial + somaLucro).toFixed(2)}`;
}





// 3. LIMPAR TUDO
function limparHistorico() {
    if (confirm("Deseja apagar todas as análises salvas?")) {
        localStorage.removeItem('meuHistoricoApostas');
        renderizarTabela();
    }
}

// Chamar ao carregar a página
window.onload = renderizarTabela;

function excluirLinha(index) {
    if (confirm("Deseja excluir esta análise permanentemente?")) {
        let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
        historico.splice(index, 1); // Remove 1 item na posição index
        localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));
        renderizarTabela(); // Atualiza a tela
    }
}

function validarPlacar(index) {
    let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    let jogo = historico[index];
    const bancaBase = 100;

    const gC = parseInt(document.getElementById(`resC-${index}`).value);
    const gF = parseInt(document.getElementById(`resF-${index}`).value);

    if (isNaN(gC) || isNaN(gF)) return alert("Preencha o placar!");

    // ATUALIZAÇÃO DO NOME COM O PLACAR
    // Remove placares antigos se houver e coloca o novo
    let nomeLimpo = jogo.time.split(" (")[0];
    jogo.time = `${nomeLimpo} (${gC} x ${gF})`;

    jogo.golsC = gC;
    jogo.golsF = gF;

    let deuGreen = false;
    const totalGols = gC + gF;
    const aposta = jogo.principal;

    if (aposta === "Over 2.5" && totalGols > 2.5) deuGreen = true;
    else if (aposta === "BTTS" && gC > 0 && gF > 0) deuGreen = true;
    else if (aposta === "Casa" && gC > gF) deuGreen = true;
    else if (aposta === "Empate" && gC === gF) deuGreen = true;
    else if (aposta === "Fora" && gF > gC) deuGreen = true;

    let valorApostado = bancaBase * (Number(jogo.stake) / 100);

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
    if (historico.length === 0) return alert("Não há dados para exportar!");

    // Cabeçalho da planilha
    let csv = "Analise do Time;Valor EV;Odd;Stake;Casa;Empate;Fora;BTTS;Over 2.5;Exp Gols;Aposta Principal;Resultado;Lucro (R$)\n";

    historico.forEach(j => {
        // Organiza as colunas separadas por ponto e vírgula (padrão Excel Brasil)
        csv += `${j.time};`;
        csv += `${Number(j.ev).toFixed(2)};`;
        csv += `${Number(j.odd).toFixed(2)};`;
        csv += `${Number(j.stake).toFixed(1)}%;`;
        csv += `${Number(j.pC).toFixed(1)}%;`;
        csv += `${Number(j.pE).toFixed(1)}%;`;
        csv += `${Number(j.pF).toFixed(1)}%;`;
        csv += `${Number(j.pB).toFixed(1)}%;`;
        csv += `${Number(j.pO).toFixed(1)}%;`;
        csv += `${Number(j.expGols).toFixed(2)};`;
        csv += `${j.principal};`;
        csv += `${j.resultado};`;
        csv += `${Number(j.lucro).toFixed(2)}\n`;
    });

    // Cria o arquivo para download
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_apostas_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// Função para preencher com um cenário de exemplo (ex: Flamengo vs Palmeiras)
function preencherExemplo() {
    // Odds do Mercado
    document.getElementById('oddCasa').value = "2.05";
    document.getElementById('oddEmpate').value = "3.40";
    document.getElementById('oddFora').value = "3.80";
    document.getElementById('oddOver').value = "1.90";
    document.getElementById('oddUnder').value = "1.90";
    document.getElementById('oddBTTS').value = "1.72";

    // Dados Time Casa (Média de 1.4 gols marcados)
    document.getElementById('golsMCasa').value = "2,1,1,0,3";
    document.getElementById('golsSCasa').value = "0,1,1,2,0";
    document.getElementById('forcaAtaqueCasa').value = "1.8";

    // Dados Time Fora (Média de 1.0 gol marcado)
    document.getElementById('golsMFora').value = "1,1,2,0,1";
    document.getElementById('golsSFora').value = "1,2,1,1,3";
    document.getElementById('forcaAtaqueFora').value = "1.2";

    // Ajustes
    document.getElementById('pesoH2H').value = "casa";
    document.getElementById('motivacao').value = "1.2"; // Jogo decisivo

    console.log("Dados de exemplo carregados!");
}

// Função para limpar todos os campos
function limparCampos() {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => input.value = "");

    const selects = document.querySelectorAll('select');
    selects.forEach(select => select.selectedIndex = 0);

    document.getElementById('resultado').style.display = 'none';
    document.getElementById('painelResultado').innerHTML = "";

    console.log("Formulário limpo!");
}








