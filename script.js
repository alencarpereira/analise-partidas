function executarAnalise() {
    // 1. Captura de Odds e Banca
    const bancaTotal = 1000;
    const mercado = {
        casa: parseFloat(document.getElementById('oddCasa').value),
        empate: parseFloat(document.getElementById('oddEmpate').value),
        fora: parseFloat(document.getElementById('oddFora').value),
        over: parseFloat(document.getElementById('oddOver').value),
        btts: parseFloat(document.getElementById('oddBTTS').value)
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

    let pCasa = 0, pFora = 0, pEmpate = 0, pOver = 0;

    const probCasaZero = poisson(lambdaCasa, 0);
    const probForaZero = poisson(lambdaFora, 0);

    // Loop Único para 1X2 e Over 2.5 (Matriz 6x6)
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            const probPlacar = poisson(lambdaCasa, i) * poisson(lambdaFora, j);

            // Lógica 1X2
            if (i > j) pCasa += probPlacar;
            else if (i < j) pFora += probPlacar;
            else pEmpate += probPlacar;

            // Lógica Over 2.5 (Soma de gols > 2.5)
            if ((i + j) > 2.5) {
                pOver += probPlacar;
            }
        }
    }

    // Cálculo BTTS (Ambas Marcam)
    const pBTTS = (1 - probCasaZero - probForaZero + (probCasaZero * probForaZero));

    // 4. Cálculo de Valor (+EV) e Kelly COM TRAVA DE 5%
    const calcularKelly = (prob, odd) => {
        if (!odd || odd <= 1) return 0;
        const b = odd - 1;
        const kellyBruto = ((b * prob) - (1 - prob)) / b;

        // Ajuste para 0.10 (Kelly 1/10) para ser mais equilibrado
        let stakeSugerida = kellyBruto * 0.10 * 100;

        // Limite máximo de 5% da banca
        if (stakeSugerida > 5.0) stakeSugerida = 5.0;

        return kellyBruto > 0 ? stakeSugerida.toFixed(1) : 0;
    };

    // Cálculos de Valor Esperado (EV)
    const evCasa = (pCasa * mercado.casa);
    const evBTTS = (pBTTS * mercado.btts);
    const evOver = (pOver * mercado.over);

    // Cálculos de Stake (Kelly)
    const kellyCasa = calcularKelly(pCasa, mercado.casa);
    const kellyBTTS = calcularKelly(pBTTS, mercado.btts);
    const kellyOver = calcularKelly(pOver, mercado.over);

    // 5. Envio dos resultados para a função de exibição (Ordem correta dos argumentos)
    exibirResultados(
        pCasa * 100,
        pEmpate * 100,
        pFora * 100,
        pBTTS * 100,
        pOver * 100,
        evCasa,
        evBTTS,
        evOver,
        kellyCasa,
        kellyBTTS,
        kellyOver,
        lambdaCasa + lambdaFora
    );
}

function exibirResultados(pC, pE, pF, pBTTS, pOver, evC, evB, evO, kellyC, kellyB, kellyO, totalGols) {
    const painel = document.getElementById('painelResultado');
    document.getElementById('resultado').style.display = 'block';

    let html = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: bold; font-size: 0.9em;">
            <span>🏠 Casa: ${pC.toFixed(1)}%</span>
            <span>🤝 Empate: ${pE.toFixed(1)}%</span>
            <span>🚀 Fora: ${pF.toFixed(1)}%</span>
        </div>
        <div style="display: flex; justify-content: space-around; margin-bottom: 15px; font-size: 0.85em;">
            <span style="color: #1565c0;">⚽ BTTS: <b>${pBTTS.toFixed(1)}%</b></span>
            <span style="color: #e65100;">📈 Over 2.5: <b>${pOver.toFixed(1)}%</b></span>
        </div>
    `;

    // Valor em Casa
    if (evC > 1.02) {
        html += `<div style="background:#e8f5e9; padding:12px; border-radius:8px; border:2px solid #2e7d32; margin-bottom: 10px;">
            <b style="color:#2e7d32;">🔥 VALOR EM CASA (EV: ${evC.toFixed(2)})</b><br>
            Stake: <b>${kellyC}%</b>
        </div>`;
    }

    // Valor em BTTS
    if (evB > 1.02) {
        html += `<div style="background:#e3f2fd; padding:12px; border-radius:8px; border:2px solid #1565c0; margin-bottom: 10px;">
            <b style="color:#1565c0;">💎 VALOR EM AMBAS MARCAM (EV: ${evB.toFixed(2)})</b><br>
            Stake: <b>${kellyB}%</b>
        </div>`;
    }

    // Valor em OVER 2.5 (NOVO)
    if (evO > 1.02) {
        html += `<div style="background:#fff3e0; padding:12px; border-radius:8px; border:2px solid #ef6c00; margin-bottom: 10px;">
            <b style="color:#e65100;">🚀 VALOR EM OVER 2.5 (EV: ${evO.toFixed(2)})</b><br>
            Stake: <b>${kellyO}%</b>
        </div>`;
    }

    if (evC <= 1.02 && evB <= 1.02 && evO <= 1.02) {
        html += `<div style="background:#ffebee; padding:12px; border-radius:8px; text-align:center;">⚠️ Sem valor claro (Margem < 2%).</div>`;
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








