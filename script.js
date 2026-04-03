function executarAnalise() {
    // 1. Captura de Odds e Banca
    const bancaTotal = 1000;
    const mercado = {
        casa: parseFloat(document.getElementById('oddCasa').value),
        empate: parseFloat(document.getElementById('oddEmpate').value),
        fora: parseFloat(document.getElementById('oddFora').value),
        over: parseFloat(document.getElementById('oddOver').value),
        btts: parseFloat(document.getElementById('oddBTTS').value) // Adicionado BTTS
    };

    // 2. Médias de Gols
    const calcularMediaAjustada = (id) => {
        const v = document.getElementById(id).value.split(',').map(Number);
        return (v[0] + v[1] + v[2] + (v[3] * 1.5) + (v[4] * 1.5)) / 6;
    };

    const expGolsCasa = (calcularMediaAjustada('golsMCasa') + parseFloat(document.getElementById('forcaAtaqueCasa').value)) / 2;
    const expGolsFora = (calcularMediaAjustada('golsMFora') + parseFloat(document.getElementById('forcaAtaqueFora').value)) / 2;

    const fatorMotivacao = parseFloat(document.getElementById('motivacao').value);
    const lambdaCasa = expGolsCasa * fatorMotivacao;
    const lambdaFora = expGolsFora * fatorMotivacao;

    // 3. Cálculo de Probabilidades (Poisson)
    const poisson = (lambda, k) => (Math.exp(-lambda) * Math.pow(lambda, k)) / [1, 1, 2, 6, 24, 120][k];

    let pCasa = 0, pFora = 0, pEmpate = 0;

    // Probabilidade de cada time NÃO marcar (0 gols)
    const probCasaZero = poisson(lambdaCasa, 0);
    const probForaZero = poisson(lambdaFora, 0);

    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            const probPlacar = poisson(lambdaCasa, i) * poisson(lambdaFora, j);
            if (i > j) pCasa += probPlacar;
            else if (i < j) pFora += probPlacar;
            else pEmpate += probPlacar;
        }
    }

    // Cálculo BTTS (Ambas Marcam): 1 - (Chance Casa 0) - (Chance Fora 0) + (Chance 0x0)
    const pBTTS = (1 - probCasaZero - probForaZero + (probCasaZero * probForaZero));

    // 4. Cálculo de Valor (+EV) e Kelly
    const calcularKelly = (prob, odd) => {
        const b = odd - 1;
        const kelly = ((b * prob) - (1 - prob)) / b;
        return kelly > 0 ? (kelly * 0.25 * 100).toFixed(1) : 0;
    };

    const evCasa = (pCasa * mercado.casa);
    const evBTTS = (pBTTS * mercado.btts); // EV do BTTS

    const kellyCasa = calcularKelly(pCasa, mercado.casa);
    const kellyBTTS = calcularKelly(pBTTS, mercado.btts);

    exibirResultados(pCasa * 100, pEmpate * 100, pFora * 100, pBTTS * 100, evCasa, evBTTS, kellyCasa, kellyBTTS, lambdaCasa + lambdaFora);
}

function exibirResultados(pC, pE, pF, pBTTS, evC, evB, kellyC, kellyB, totalGols) {
    const painel = document.getElementById('painelResultado');
    document.getElementById('resultado').style.display = 'block';

    let html = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: bold; font-size: 0.9em;">
            <span>🏠 Casa: ${pC.toFixed(1)}%</span>
            <span>🤝 Empate: ${pE.toFixed(1)}%</span>
            <span>🚀 Fora: ${pF.toFixed(1)}%</span>
        </div>
        <div style="text-align: center; color: #1565c0; font-weight: bold; margin-bottom: 15px;">
            ⚽ Ambas Marcam (BTTS): ${pBTTS.toFixed(1)}%
        </div>
    `;

    // Sugestão para Match Odds
    if (evC > 1.05) {
        html += `<div style="background:#e8f5e9; padding:12px; border-radius:8px; border:2px solid #2e7d32; margin-bottom: 10px;">
            <b style="color:#2e7d32;">🔥 VALOR EM CASA</b><br>
            Stake Sugerida: <b>${kellyC}%</b>
        </div>`;
    }

    // Sugestão para BTTS
    if (evB > 1.05) {
        html += `<div style="background:#e3f2fd; padding:12px; border-radius:8px; border:2px solid #1565c0;">
            <b style="color:#1565c0;">💎 VALOR EM AMBAS MARCAM</b><br>
            Stake Sugerida: <b>${kellyB}%</b>
        </div>`;
    }

    if (evC <= 1.05 && evB <= 1.05) {
        html += `<div style="background:#ffebee; padding:12px; border-radius:8px; text-align:center;">⚠️ Sem valor claro no mercado.</div>`;
    }

    html += `<p style="font-size: 0.8em; margin-top: 10px; color: #666; text-align:center;">Expectativa Total: <b>${totalGols.toFixed(2)} gols</b></p>`;

    painel.innerHTML = html;
}



// Função para preencher com um cenário de exemplo (ex: Flamengo vs Palmeiras)
function preencherExemplo() {
    // Odds do Mercado
    document.getElementById('oddCasa').value = "2.05";
    document.getElementById('oddEmpate').value = "3.40";
    document.getElementById('oddFora').value = "3.80";
    document.getElementById('oddOver').value = "1.90";
    document.getElementById('oddUnder').value = "1.90";

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







