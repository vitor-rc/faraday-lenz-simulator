/**
 * ============================================================================
 * Simulador de Indução Eletromagnética (Faraday-Lenz)
 * Formato 16:9 & Mobile Responsivo • Arco Metálico de 90° • Ímã Fatiado (10 cm)
 * Limite de Raio: 15 cm a 60 cm com Redimensionamento Proporcional Perfeito
 * ============================================================================
 */

(() => {
  'use strict';

  // --- Constantes Físicas Fundamentais ---
  const G = 9.81;
  const RHO_CU = 1.68e-8;
  const BR_NEODYMIUM = 1.25;
  const AIR_DAMPING = 0.032;

  // --- Estado da Simulação ---
  const state = {
    // Geometria da Estrutura em Arco Metálico (Limite R: 15 a 60 cm)
    armLength: 0.30,      // Raio do arco R em metros (30 cm padrão, máx 60 cm)
    arcSpan: 90,          // Extensão angular do arco metálico em graus (90° padrão)
    initialAngle: 90,     // Ângulo inicial de soltura em graus (90° padrão)
    theta: (90 * Math.PI) / 180, // Ângulo instantâneo em radianos
    omega: 0.0,
    alpha: 0.0,
    
    // Parâmetros do Ímã Fatiado em Arco
    magnetLength: 0.10,   // Comprimento do arco magnético (10 cm = 0.10 m)
    magnetDia: 0.005,     // Diâmetro dos discos (5 mm)
    sliceThickness: 0.001,// Espessura de cada fatia (1 mm)
    magnetMass: 0.018,    // kg (~18 g)
    ringMass: 0.020,      // kg (~20 g)
    
    // Parâmetros da Bobina
    turns: 1000,
    wireDia: 0.00025,
    coilLength: 0.020,
    coilInnerDia: 0.010,
    
    // Circuito e Switch
    circuitMode: 'leds',
    seriesResistor: 150,
    
    // Grandezas Elétricas Instantâneas
    emf: 0.0,
    current: 0.0,
    vPeak: 0.0,
    iPeak: 0.0,
    coilResistance: 12.8,
    wireLength: 37.4,
    
    // Visualização e Controles
    isPlaying: true,
    timeScale: 1.0,
    isDragging: false,
    showFieldLines: true,
    showSlices: true,
    showVectors: true,
    
    // LEDs Status
    ledRedBrightness: 0.0,
    ledGreenBrightness: 0.0,
    
    // Timing
    lastTime: performance.now(),
    simTime: 0.0
  };

  // --- Elementos do DOM ---
  const simCanvas = document.getElementById('simCanvas');
  const simCtx = simCanvas.getContext('2d');
  const scopeCanvas = document.getElementById('scopeCanvas');
  const scopeCtx = scopeCanvas.getContext('2d');

  const telVPeak = document.getElementById('telVPeak');
  const telIPeak = document.getElementById('telIPeak');
  const telSpeed = document.getElementById('telSpeed');
  const telAngle = document.getElementById('telAngle');
  const telRCoil = document.getElementById('telRCoil');
  const telWireLength = document.getElementById('telWireLength');

  const hudLedRed = document.getElementById('hudLedRed');
  const hudLedGreen = document.getElementById('hudLedGreen');
  const statusLedRed = document.getElementById('statusLedRed');
  const statusLedGreen = document.getElementById('statusLedGreen');

  const btnPlayPause = document.getElementById('btnPlayPause');
  const iconPlay = document.getElementById('iconPlay');
  const iconPause = document.getElementById('iconPause');
  const labelPlayPause = document.getElementById('labelPlayPause');
  const btnStep = document.getElementById('btnStep');
  const btnRelease = document.getElementById('btnRelease');
  const speedButtons = document.querySelectorAll('.btn-speed');

  const chkFieldLines = document.getElementById('chkFieldLines');
  const chkShowSlices = document.getElementById('chkShowSlices');
  const chkVectors = document.getElementById('chkVectors');

  const slArmLength = document.getElementById('slArmLength');
  const slArcSpan = document.getElementById('slArcSpan');
  const slAngle = document.getElementById('slAngle');
  const slTurns = document.getElementById('slTurns');
  const slWireGauge = document.getElementById('slWireGauge');
  const slMagnetLength = document.getElementById('slMagnetLength');
  const slMagnetDia = document.getElementById('slMagnetDia');
  const slCoilLength = document.getElementById('slCoilLength');
  const slSeriesR = document.getElementById('slSeriesR');

  const valArmLength = document.getElementById('valArmLength');
  const valArcSpan = document.getElementById('valArcSpan');
  const valAngle = document.getElementById('valAngle');
  const valTurns = document.getElementById('valTurns');
  const valWireGauge = document.getElementById('valWireGauge');
  const valMagnetLength = document.getElementById('valMagnetLength');
  const valMagnetDia = document.getElementById('valMagnetDia');
  const valCoilLength = document.getElementById('valCoilLength');
  const valSeriesR = document.getElementById('valSeriesR');

  const resistorControl = document.getElementById('resistorControl');
  const btnClearScope = document.getElementById('btnClearScope');
  const presetButtons = document.querySelectorAll('.btn-preset');
  const modeCards = document.querySelectorAll('.mode-radio-card');

  const MAX_SCOPE_SAMPLES = 420;
  const scopeBuffer = [];

  // ==========================================================================
  // 1. MOTOR DE CÁLCULO FÍSICO
  // ==========================================================================

  function updateCoilSpecs() {
    const rCoilInner = state.coilInnerDia / 2;
    const turnsPerLayer = Math.max(1, Math.floor(state.coilLength / state.wireDia));
    const layers = Math.ceil(state.turns / turnsPerLayer);
    const coilThickness = layers * state.wireDia;
    const rCoilMean = rCoilInner + coilThickness / 2;

    const meanTurnLength = 2 * Math.PI * rCoilMean;
    state.wireLength = state.turns * meanTurnLength;

    const wireArea = Math.PI * Math.pow(state.wireDia / 2, 2);
    state.coilResistance = (RHO_CU * state.wireLength) / wireArea;

    const magVol = Math.PI * Math.pow(state.magnetDia / 2, 2) * state.magnetLength;
    state.magnetMass = Math.max(0.006, magVol * 7500);

    const arcRadSpan = (state.arcSpan * Math.PI) / 180;
    const arcPerimeter = state.armLength * arcRadSpan;
    const arcSectionArea = 0.003 * 0.003;
    state.ringMass = Math.max(0.010, arcPerimeter * arcSectionArea * 2700);

    telRCoil.textContent = `${state.coilResistance.toFixed(1)} Ω`;
    telWireLength.textContent = `${state.wireLength.toFixed(1)} m`;
  }

  function singleLoopFlux(z, rCoil, qm, Lm) {
    const zN = z + Lm / 2;
    const zS = z - Lm / 2;
    const termN = zN / Math.sqrt(zN * zN + rCoil * rCoil);
    const termS = zS / Math.sqrt(zS * zS + rCoil * rCoil);
    return (qm / 2) * (termN - termS);
  }

  function computeElectromagneticInduction(theta, omega) {
    const arcPos = state.armLength * theta;
    const rCoil = state.coilInnerDia / 2 + 0.0015;
    
    const magArea = Math.PI * Math.pow(state.magnetDia / 2, 2);
    const qm = BR_NEODYMIUM * magArea;
    
    const Wc = Math.max(0.005, state.coilLength);
    const Lm = state.magnetLength;

    const fluxAtExit = singleLoopFlux(arcPos + Wc / 2, rCoil, qm, Lm);
    const fluxAtEntry = singleLoopFlux(arcPos - Wc / 2, rCoil, qm, Lm);
    const dPhi_dz = (state.turns / Wc) * (fluxAtExit - fluxAtEntry);

    const vLinear = state.armLength * omega;
    const emf = -dPhi_dz * vLinear;

    return { emf, dPhi_dz, vLinear };
  }

  function solveCircuitAndLenz(emf, dPhi_dz, omega) {
    let current = 0.0;
    let ledRedOn = 0.0;
    let ledGreenOn = 0.0;

    const VF_RED = 1.85;
    const VF_GREEN = 2.10;
    const RD_DIODE = 8.0;

    switch (state.circuitMode) {
      case 'leds': {
        const rTotal = state.coilResistance + RD_DIODE;
        if (emf > VF_RED) {
          current = (emf - VF_RED) / rTotal;
          ledRedOn = Math.min(1.0, current / 0.028);
        } else if (emf < -VF_GREEN) {
          current = (emf + VF_GREEN) / rTotal;
          ledGreenOn = Math.min(1.0, -current / 0.028);
        }
        break;
      }
      case 'resistor': {
        const rTotal = state.coilResistance + RD_DIODE + state.seriesResistor;
        if (emf > VF_RED) {
          current = (emf - VF_RED) / rTotal;
          ledRedOn = Math.min(1.0, current / 0.028);
        } else if (emf < -VF_GREEN) {
          current = (emf + VF_GREEN) / rTotal;
          ledGreenOn = Math.min(1.0, -current / 0.028);
        }
        break;
      }
      case 'short': {
        current = emf / Math.max(0.2, state.coilResistance);
        break;
      }
      case 'open':
      default: {
        current = 0.0;
        break;
      }
    }

    const dPhi_dtheta = dPhi_dz * state.armLength;
    const tauLenz = -dPhi_dtheta * current;

    return { current, ledRedOn, ledGreenOn, tauLenz };
  }

  function physicsStep(dt) {
    if (state.isDragging) return;

    const R = state.armLength;
    const I_total = (state.magnetMass + state.ringMass) * Math.pow(R, 2);

    function getDerivatives(th, om) {
      const { emf, dPhi_dz } = computeElectromagneticInduction(th, om);
      const { tauLenz } = solveCircuitAndLenz(emf, dPhi_dz, om);

      const tauGrav = - (state.magnetMass + state.ringMass * 0.9) * G * R * Math.sin(th);
      const tauAir = -AIR_DAMPING * Math.pow(R, 2) * om;
      const totalTorque = tauGrav + tauAir + tauLenz;

      const alpha = totalTorque / I_total;
      return { dTheta: om, dOmega: alpha };
    }

    const k1 = getDerivatives(state.theta, state.omega);
    const k2 = getDerivatives(state.theta + 0.5 * dt * k1.dTheta, state.omega + 0.5 * dt * k1.dOmega);
    const k3 = getDerivatives(state.theta + 0.5 * dt * k2.dTheta, state.omega + 0.5 * dt * k2.dOmega);
    const k4 = getDerivatives(state.theta + dt * k3.dTheta, state.omega + dt * k3.dOmega);

    state.theta += (dt / 6) * (k1.dTheta + 2 * k2.dTheta + 2 * k3.dTheta + k4.dTheta);
    state.omega += (dt / 6) * (k1.dOmega + 2 * k2.dOmega + 2 * k3.dOmega + k4.dOmega);
    state.alpha = k1.dOmega;

    const { emf, dPhi_dz } = computeElectromagneticInduction(state.theta, state.omega);
    const { current, ledRedOn, ledGreenOn } = solveCircuitAndLenz(emf, dPhi_dz, state.omega);

    state.emf = emf;
    state.current = current;
    state.ledRedBrightness = ledRedOn;
    state.ledGreenBrightness = ledGreenOn;

    if (Math.abs(emf) > state.vPeak) state.vPeak = Math.abs(emf);
    if (Math.abs(current * 1000) > state.iPeak) state.iPeak = Math.abs(current * 1000);

    state.vPeak *= 0.998;
    state.iPeak *= 0.998;

    scopeBuffer.push({
      emf: state.emf,
      current: state.current * 1000,
      time: state.simTime
    });
    if (scopeBuffer.length > MAX_SCOPE_SAMPLES) {
      scopeBuffer.shift();
    }
  }

  // ==========================================================================
  // 2. RENDERIZADOR CANVAS COM REDIMENSIONAMENTO PERFEITO (15cm a 60cm)
  // ==========================================================================

  function getPixelRadius() {
    // Mapeamento proporcional de R in [0.15m, 0.60m] para pixels
    // 0.15m -> 115px | 0.30m -> 165px | 0.60m -> 255px
    const minR = 0.15;
    const maxR = 0.60;
    const minPx = 115;
    const maxPx = 255;

    const clampedR = Math.max(minR, Math.min(maxR, state.armLength));
    const fraction = (clampedR - minR) / (maxR - minR);
    return minPx + fraction * (maxPx - minPx);
  }

  function drawSimulation() {
    const w = simCanvas.width;
    const h = simCanvas.height;
    simCtx.clearRect(0, 0, w, h);

    drawGrid(simCtx, w, h);

    const pivotX = w / 2;
    const pivotY = 48;

    // Raio visual calibrado em pixels
    const armPx = getPixelRadius();
    const pxPerMeter = armPx / state.armLength;

    const coilX = pivotX;
    const coilY = pivotY + armPx;

    // 1. Suporte central no topo & transferidor
    drawStandAndProtractor(pivotX, pivotY);

    // 2. Bancada inferior ancorada dinamicamente à posição da bobina
    drawWorkbench(w, coilY + 34);

    // 3. Bobina e LEDs montados na base
    const coilW_px = Math.max(24, state.coilLength * pxPerMeter * 1.3);
    const coilH_px = Math.max(28, state.coilInnerDia * pxPerMeter * 2.2);
    drawCoilAssembly(coilX, coilY, coilW_px, coilH_px);

    // 4. Estrutura do Arco Metálico (Padrão 90°)
    drawMetallicArcFrame(pivotX, pivotY, armPx, state.theta, state.arcSpan);

    // 5. Linhas de Campo Magnético em Arco
    if (state.showFieldLines) {
      drawCurvedMagneticField(pivotX, pivotY, armPx, state.theta);
    }

    // 6. Ímã Fatiado de 10 cm em Arco
    drawSegmentedCurvedMagnet(pivotX, pivotY, armPx, state.theta, pxPerMeter);

    // 7. Vetor de Força de Lenz
    if (state.showVectors && Math.abs(state.current) > 0.001) {
      drawLenzVectorCurved(pivotX, pivotY, armPx, state.theta);
    }

    // 8. Atualiza LEDs no HUD
    updateHudLeds();
  }

  function drawGrid(ctx, w, h) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 1;
    const step = 28;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  function drawStandAndProtractor(px, py) {
    simCtx.save();

    simCtx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.arc(px, py, 52, Math.PI * 0.1, Math.PI * 0.9);
    simCtx.stroke();

    for (let ang = -90; ang <= 90; ang += 15) {
      const rad = (ang * Math.PI) / 180 + Math.PI / 2;
      const x1 = px + 48 * Math.cos(rad);
      const y1 = py + 48 * Math.sin(rad);
      const x2 = px + 56 * Math.cos(rad);
      const y2 = py + 56 * Math.sin(rad);

      simCtx.strokeStyle = (ang === 0 || Math.abs(ang) === 90) ? 'rgba(0, 229, 255, 0.6)' : 'rgba(255, 255, 255, 0.15)';
      simCtx.beginPath();
      simCtx.moveTo(x1, y1);
      simCtx.lineTo(x2, y2);
      simCtx.stroke();

      if (Math.abs(ang) % 30 === 0) {
        simCtx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        simCtx.font = '8px "JetBrains Mono"';
        simCtx.textAlign = 'center';
        simCtx.fillText(`${Math.abs(ang)}°`, px + 66 * Math.cos(rad), py + 66 * Math.sin(rad) + 3);
      }
    }

    simCtx.fillStyle = '#1e293b';
    simCtx.strokeStyle = '#475569';
    simCtx.lineWidth = 2;
    simCtx.beginPath();
    simCtx.roundRect(px - 38, py - 26, 76, 20, 4);
    simCtx.fill();
    simCtx.stroke();

    simCtx.fillStyle = '#00e5ff';
    simCtx.shadowColor = '#00e5ff';
    simCtx.shadowBlur = 6;
    simCtx.beginPath();
    simCtx.arc(px, py, 5, 0, Math.PI * 2);
    simCtx.fill();
    simCtx.shadowBlur = 0;

    simCtx.restore();
  }

  function drawWorkbench(w, benchY) {
    simCtx.save();
    const benchGrad = simCtx.createLinearGradient(0, benchY, 0, benchY + 24);
    benchGrad.addColorStop(0, '#1e293b');
    benchGrad.addColorStop(1, '#0f172a');

    simCtx.fillStyle = benchGrad;
    simCtx.fillRect(30, benchY, w - 60, 6);

    simCtx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
    simCtx.lineWidth = 1;
    simCtx.strokeRect(30, benchY, w - 60, 6);
    simCtx.restore();
  }

  function drawMetallicArcFrame(px, py, r, theta, arcSpanDeg) {
    simCtx.save();
    simCtx.translate(px, py);
    simCtx.rotate(theta);

    const spanRad = (arcSpanDeg * Math.PI) / 180;
    const startAng = Math.PI / 2 - spanRad / 2;
    const endAng = Math.PI / 2 + spanRad / 2;

    simCtx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    simCtx.lineWidth = 1.8;

    simCtx.beginPath();
    simCtx.moveTo(0, 0);
    simCtx.lineTo(0, r);
    simCtx.stroke();

    simCtx.beginPath();
    simCtx.moveTo(0, 0);
    simCtx.lineTo(r * Math.cos(startAng), r * Math.sin(startAng));
    simCtx.moveTo(0, 0);
    simCtx.lineTo(r * Math.cos(endAng), r * Math.sin(endAng));
    simCtx.stroke();

    const arcGrad = simCtx.createLinearGradient(-r, 0, r, r);
    arcGrad.addColorStop(0, '#94a3b8');
    arcGrad.addColorStop(0.3, '#f1f5f9');
    arcGrad.addColorStop(0.5, '#64748b');
    arcGrad.addColorStop(0.8, '#cbd5e1');
    arcGrad.addColorStop(1, '#94a3b8');

    simCtx.strokeStyle = arcGrad;
    simCtx.lineWidth = 3.5;
    simCtx.beginPath();
    simCtx.arc(0, 0, r, startAng, endAng, false);
    simCtx.stroke();

    simCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.arc(0, 0, r + 2, startAng, endAng, false);
    simCtx.stroke();

    simCtx.restore();
  }

  function drawSegmentedCurvedMagnet(px, py, r, theta, pxPerMeter) {
    simCtx.save();
    simCtx.translate(px, py);
    simCtx.rotate(theta);

    const arcLenM = state.magnetLength;
    const totalAngle = arcLenM / state.armLength;
    const startAngle = Math.PI / 2 - totalAngle / 2;
    const endAngle = Math.PI / 2 + totalAngle / 2;

    const numSlices = Math.max(20, Math.round(arcLenM / state.sliceThickness));
    const dAngSlice = totalAngle / numSlices;
    const magThick_px = Math.max(7, state.magnetDia * pxPerMeter * 1.8);
    const halfSlices = Math.floor(numSlices / 2);

    for (let i = 0; i < numSlices; i++) {
      const ang1 = startAngle + i * dAngSlice;
      const ang2 = ang1 + dAngSlice;
      const isNorth = i < halfSlices;

      if (isNorth) {
        simCtx.fillStyle = (i % 2 === 0) ? '#ff1744' : '#d50000';
      } else {
        simCtx.fillStyle = (i % 2 === 0) ? '#2979ff' : '#1565c0';
      }

      simCtx.beginPath();
      simCtx.arc(0, 0, r - magThick_px / 2, ang1, ang2, false);
      simCtx.arc(0, 0, r + magThick_px / 2, ang2, ang1, true);
      simCtx.closePath();
      simCtx.fill();

      if (state.showSlices) {
        simCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        simCtx.lineWidth = 0.5;
        simCtx.stroke();
      }
    }

    simCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    simCtx.lineWidth = 1.2;
    simCtx.beginPath();
    simCtx.arc(0, 0, r - magThick_px / 2, startAngle, endAngle, false);
    simCtx.arc(0, 0, r + magThick_px / 2, endAngle, startAngle, true);
    simCtx.closePath();
    simCtx.stroke();

    const midAngleN = startAngle + totalAngle * 0.25;
    const midAngleS = startAngle + totalAngle * 0.75;

    simCtx.fillStyle = '#ffffff';
    simCtx.font = 'bold 8px "JetBrains Mono"';
    simCtx.textAlign = 'center';
    simCtx.textBaseline = 'middle';
    simCtx.fillText('N', r * Math.cos(midAngleN), r * Math.sin(midAngleN));
    simCtx.fillText('S', r * Math.cos(midAngleS), r * Math.sin(midAngleS));

    simCtx.restore();
  }

  function drawCurvedMagneticField(px, py, r, theta) {
    simCtx.save();
    simCtx.translate(px, py);
    simCtx.rotate(theta);

    const totalAngle = state.magnetLength / state.armLength;
    const angN = Math.PI / 2 - totalAngle / 2;
    const angS = Math.PI / 2 + totalAngle / 2;

    const xN = r * Math.cos(angN);
    const yN = r * Math.sin(angN);
    const xS = r * Math.cos(angS);
    const yS = r * Math.sin(angS);

    simCtx.strokeStyle = 'rgba(0, 229, 255, 0.16)';
    simCtx.lineWidth = 1;

    for (let d = 14; d <= 36; d += 8) {
      simCtx.beginPath();
      simCtx.moveTo(xN, yN);
      simCtx.bezierCurveTo(xN - d, yN - d, xS + d, yS - d, xS, yS);
      simCtx.stroke();

      simCtx.beginPath();
      simCtx.moveTo(xN, yN);
      simCtx.bezierCurveTo(xN + d, yN + d, xS - d, yS + d, xS, yS);
      simCtx.stroke();
    }

    simCtx.restore();
  }

  function drawCoilAssembly(cx, cy, cw, ch) {
    simCtx.save();

    simCtx.fillStyle = '#1e293b';
    simCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.roundRect(cx - 10, cy + ch / 2, 20, 32, 2);
    simCtx.fill();
    simCtx.stroke();

    simCtx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    simCtx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
    simCtx.lineWidth = 1.2;
    simCtx.strokeRect(cx - cw / 2 - 3, cy - ch / 2 - 3, 3, ch + 6);
    simCtx.strokeRect(cx + cw / 2, cy - ch / 2 - 3, 3, ch + 6);

    const copperGrad = simCtx.createLinearGradient(cx - cw / 2, cy, cx + cw / 2, cy);
    copperGrad.addColorStop(0, '#b45309');
    copperGrad.addColorStop(0.3, '#f59e0b');
    copperGrad.addColorStop(0.5, '#d97706');
    copperGrad.addColorStop(0.8, '#b45309');
    copperGrad.addColorStop(1, '#78350f');

    simCtx.fillStyle = copperGrad;
    simCtx.beginPath();
    simCtx.roundRect(cx - cw / 2, cy - ch / 2, cw, ch, 2);
    simCtx.fill();

    simCtx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    simCtx.lineWidth = 1;
    const numWireLines = Math.min(14, Math.floor(cw / 2.5));
    for (let i = 1; i < numWireLines; i++) {
      const wx = cx - cw / 2 + (cw / numWireLines) * i;
      simCtx.beginPath();
      simCtx.moveTo(wx, cy - ch / 2);
      simCtx.lineTo(wx, cy + ch / 2);
      simCtx.stroke();
    }

    const holeHeight = ch * 0.45;
    simCtx.fillStyle = '#07090e';
    simCtx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.roundRect(cx - cw / 2 - 1, cy - holeHeight / 2, cw + 2, holeHeight, 2);
    simCtx.fill();
    simCtx.stroke();

    const ledBaseY = cy + ch / 2 + 14;
    const ledRedX = cx - 26;
    const ledGreenX = cx + 26;

    simCtx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.moveTo(cx - cw / 2, cy + ch / 4);
    simCtx.lineTo(ledRedX, ledBaseY);
    simCtx.moveTo(cx + cw / 2, cy + ch / 4);
    simCtx.lineTo(ledGreenX, ledBaseY);
    simCtx.stroke();

    drawPhysicalLed(ledRedX, ledBaseY, '#ff1744', state.ledRedBrightness, 'LED 1');
    drawPhysicalLed(ledGreenX, ledBaseY, '#00e676', state.ledGreenBrightness, 'LED 2');

    simCtx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    simCtx.font = '8px "JetBrains Mono"';
    simCtx.textAlign = 'center';
    simCtx.fillText(`Bobina: ${state.turns} espiras • ${state.coilResistance.toFixed(1)} Ω`, cx, cy + ch / 2 + 34);

    simCtx.restore();
  }

  function drawPhysicalLed(x, y, color, glow, label) {
    simCtx.save();

    if (glow > 0.05) {
      const radGlow = simCtx.createRadialGradient(x, y, 2, x, y, 24 * glow);
      radGlow.addColorStop(0, color);
      radGlow.addColorStop(0.4, color);
      radGlow.addColorStop(1, 'transparent');
      simCtx.fillStyle = radGlow;
      simCtx.beginPath();
      simCtx.arc(x, y, 24 * glow, 0, Math.PI * 2);
      simCtx.fill();
    }

    simCtx.fillStyle = '#0f172a';
    simCtx.fillRect(x - 4, y + 2, 8, 2);

    simCtx.fillStyle = glow > 0.1 ? '#ffffff' : color;
    simCtx.strokeStyle = color;
    simCtx.lineWidth = 1.0;

    if (glow > 0.1) {
      simCtx.shadowColor = color;
      simCtx.shadowBlur = 14 * glow;
    }

    simCtx.beginPath();
    simCtx.arc(x, y - 1, 4.5, Math.PI, 0, false);
    simCtx.lineTo(x + 4.5, y + 2);
    simCtx.lineTo(x - 4.5, y + 2);
    simCtx.closePath();
    simCtx.fill();
    simCtx.stroke();

    simCtx.shadowBlur = 0;
    simCtx.fillStyle = glow > 0.1 ? color : 'rgba(255, 255, 255, 0.35)';
    simCtx.font = '7px "JetBrains Mono"';
    simCtx.textAlign = 'center';
    simCtx.fillText(label, x, y + 11);

    simCtx.restore();
  }

  function drawLenzVectorCurved(px, py, r, theta) {
    simCtx.save();
    simCtx.translate(px, py);
    simCtx.rotate(theta);

    const dir = state.omega > 0 ? -1 : 1;
    const len = Math.min(38, Math.abs(state.current) * 1100);
    const tipAngle = Math.PI / 2 + (dir * len) / r;

    simCtx.strokeStyle = '#ff1744';
    simCtx.fillStyle = '#ff1744';
    simCtx.lineWidth = 2.2;

    simCtx.beginPath();
    simCtx.arc(0, 0, r + 12, Math.PI / 2, tipAngle, dir < 0);
    simCtx.stroke();

    simCtx.font = '8px "JetBrains Mono"';
    simCtx.fillStyle = '#fda4af';
    simCtx.textAlign = 'center';
    simCtx.fillText('F_Lenz', 0, r + 22);

    simCtx.restore();
  }

  function updateHudLeds() {
    if (state.ledRedBrightness > 0.1) {
      hudLedRed.querySelector('.led-bulb').classList.add('glowing');
      statusLedRed.textContent = `Aceso (${(state.ledRedBrightness * 100).toFixed(0)}%)`;
      statusLedRed.style.color = '#ff1744';
    } else {
      hudLedRed.querySelector('.led-bulb').classList.remove('glowing');
      statusLedRed.textContent = 'Apagado';
      statusLedRed.style.color = 'var(--text-muted)';
    }

    if (state.ledGreenBrightness > 0.1) {
      hudLedGreen.querySelector('.led-bulb').classList.add('glowing');
      statusLedGreen.textContent = `Aceso (${(state.ledGreenBrightness * 100).toFixed(0)}%)`;
      statusLedGreen.style.color = '#00e676';
    } else {
      hudLedGreen.querySelector('.led-bulb').classList.remove('glowing');
      statusLedGreen.textContent = 'Apagado';
      statusLedGreen.style.color = 'var(--text-muted)';
    }
  }

  // ==========================================================================
  // 3. OSCILOSCÓPIO DIGITAL (COMPACTO)
  // ==========================================================================

  function drawOscilloscope() {
    const w = scopeCanvas.width;
    const h = scopeCanvas.height;
    scopeCtx.clearRect(0, 0, w, h);

    scopeCtx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
    scopeCtx.lineWidth = 1;

    const numDivsX = 10;
    const numDivsY = 4;
    for (let i = 1; i < numDivsX; i++) {
      const gx = (w / numDivsX) * i;
      scopeCtx.beginPath();
      scopeCtx.moveTo(gx, 0);
      scopeCtx.lineTo(gx, h);
      scopeCtx.stroke();
    }
    for (let j = 1; j < numDivsY; j++) {
      const gy = (h / numDivsY) * j;
      scopeCtx.beginPath();
      scopeCtx.moveTo(0, gy);
      scopeCtx.lineTo(w, gy);
      scopeCtx.stroke();
    }

    const midY = h / 2;
    scopeCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    scopeCtx.setLineDash([2, 4]);
    scopeCtx.beginPath();
    scopeCtx.moveTo(0, midY);
    scopeCtx.lineTo(w, midY);
    scopeCtx.stroke();
    scopeCtx.setLineDash([]);

    if (scopeBuffer.length < 2) return;

    const maxVoltageRange = 5.0;
    const maxCurrentRange = 40.0;

    const scaleY_V = (h * 0.42) / maxVoltageRange;
    const scaleY_I = (h * 0.42) / maxCurrentRange;
    const stepX = w / MAX_SCOPE_SAMPLES;

    scopeCtx.save();
    scopeCtx.strokeStyle = '#ffd600';
    scopeCtx.lineWidth = 1.8;
    scopeCtx.shadowColor = '#ffd600';
    scopeCtx.shadowBlur = 4;
    scopeCtx.beginPath();

    for (let i = 0; i < scopeBuffer.length; i++) {
      const sx = i * stepX;
      const sy = midY - scopeBuffer[i].emf * scaleY_V;
      if (i === 0) scopeCtx.moveTo(sx, sy);
      else scopeCtx.lineTo(sx, sy);
    }
    scopeCtx.stroke();
    scopeCtx.restore();

    scopeCtx.save();
    scopeCtx.strokeStyle = '#00e5ff';
    scopeCtx.lineWidth = 1.6;
    scopeCtx.shadowColor = '#00e5ff';
    scopeCtx.shadowBlur = 4;
    scopeCtx.beginPath();

    for (let i = 0; i < scopeBuffer.length; i++) {
      const sx = i * stepX;
      const sy = midY - scopeBuffer[i].current * scaleY_I;
      if (i === 0) scopeCtx.moveTo(sx, sy);
      else scopeCtx.lineTo(sx, sy);
    }
    scopeCtx.stroke();
    scopeCtx.restore();
  }

  // ==========================================================================
  // 4. LOOP PRINCIPAL
  // ==========================================================================

  function mainLoop(now) {
    const rawDt = Math.min(0.05, (now - state.lastTime) / 1000.0);
    state.lastTime = now;

    if (state.isPlaying && !state.isDragging) {
      const dt = (rawDt * state.timeScale) / 8.0;
      for (let s = 0; s < 8; s++) {
        physicsStep(dt);
        state.simTime += dt;
      }
    }

    drawSimulation();
    drawOscilloscope();
    updateTelemetryHUD();

    requestAnimationFrame(mainLoop);
  }

  function updateTelemetryHUD() {
    telVPeak.textContent = `${state.vPeak.toFixed(2)} V`;
    telIPeak.textContent = `${state.iPeak.toFixed(1)} mA`;
    const vLin = Math.abs(state.armLength * state.omega);
    telSpeed.textContent = `${vLin.toFixed(2)} m/s`;
    const angDeg = (state.theta * 180) / Math.PI;
    telAngle.textContent = `${angDeg.toFixed(1)}°`;
  }

  // ==========================================================================
  // 5. INTERATIVIDADE MOUSE / TOUCH (TOUCH-ACTION: NONE)
  // ==========================================================================

  function getCanvasCoords(e) {
    const rect = simCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = simCanvas.width / rect.width;
    const scaleY = simCanvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  // Canvas rotate(theta) maps local (0, r) to world (-r*sin(theta), r*cos(theta))
  // so the magnet world position is (pivotX - armPx*sin(theta), pivotY + armPx*cos(theta))
  function getMagnetWorldPos() {
    const pivotX = simCanvas.width / 2;
    const pivotY = 48;
    const armPx = getPixelRadius();
    return {
      x: pivotX - armPx * Math.sin(state.theta),
      y: pivotY + armPx * Math.cos(state.theta),
      pivotX,
      pivotY
    };
  }

  simCanvas.addEventListener('mousedown', (e) => {
    const { x, y } = getCanvasCoords(e);
    const mag = getMagnetWorldPos();

    const dist = Math.hypot(x - mag.x, y - mag.y);
    if (dist < 65) {
      state.isDragging = true;
      state.omega = 0.0;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!state.isDragging) return;
    const { x, y } = getCanvasCoords(e);
    const pivotX = simCanvas.width / 2;
    const pivotY = 48;

    // atan2(-(x-px), y-py) matches canvas rotate() convention:
    // positive theta = clockwise rotation = pendulum swings LEFT on screen
    let targetAngle = Math.atan2(-(x - pivotX), y - pivotY);
    targetAngle = Math.max(-1.57, Math.min(1.57, targetAngle));

    state.theta = targetAngle;
    state.omega = 0.0;
    state.initialAngle = (Math.abs(targetAngle) * 180) / Math.PI;
    slAngle.value = Math.round(state.initialAngle);
    valAngle.textContent = `${Math.round(state.initialAngle)}°`;
  });

  window.addEventListener('mouseup', () => {
    if (state.isDragging) {
      state.isDragging = false;
      state.omega = 0.0;
    }
  });

  simCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    const mag = getMagnetWorldPos();

    if (Math.hypot(x - mag.x, y - mag.y) < 75) {
      state.isDragging = true;
      state.omega = 0.0;
    }
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!state.isDragging) return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    const pivotX = simCanvas.width / 2;
    const pivotY = 48;
    let targetAngle = Math.atan2(-(x - pivotX), y - pivotY);
    targetAngle = Math.max(-1.57, Math.min(1.57, targetAngle));
    state.theta = targetAngle;
    state.omega = 0.0;
  }, { passive: false });

  window.addEventListener('touchend', () => {
    state.isDragging = false;
  });

  // ==========================================================================
  // 6. EVENTOS DE UI & CONTROLES
  // ==========================================================================

  btnPlayPause.addEventListener('click', () => {
    state.isPlaying = !state.isPlaying;
    if (state.isPlaying) {
      iconPlay.classList.add('hidden');
      iconPause.classList.remove('hidden');
      labelPlayPause.textContent = 'Pausar';
    } else {
      iconPlay.classList.remove('hidden');
      iconPause.classList.add('hidden');
      labelPlayPause.textContent = 'Continuar';
    }
  });

  btnStep.addEventListener('click', () => {
    state.isPlaying = false;
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
    labelPlayPause.textContent = 'Continuar';

    for (let s = 0; s < 10; s++) {
      physicsStep(0.003);
    }
  });

  btnRelease.addEventListener('click', () => {
    state.theta = (state.initialAngle * Math.PI) / 180;
    state.omega = 0.0;
    state.vPeak = 0.0;
    state.iPeak = 0.0;
    scopeBuffer.length = 0;
  });

  speedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      speedButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.timeScale = parseFloat(btn.dataset.speed);
    });
  });

  chkFieldLines.addEventListener('change', (e) => state.showFieldLines = e.target.checked);
  chkShowSlices.addEventListener('change', (e) => state.showSlices = e.target.checked);
  chkVectors.addEventListener('change', (e) => state.showVectors = e.target.checked);

  btnClearScope.addEventListener('click', () => {
    scopeBuffer.length = 0;
    state.vPeak = 0.0;
    state.iPeak = 0.0;
  });

  modeCards.forEach((card) => {
    const radio = card.querySelector('input[type="radio"]');
    card.addEventListener('click', () => {
      modeCards.forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      radio.checked = true;
      state.circuitMode = radio.value;

      if (state.circuitMode === 'resistor') {
        resistorControl.style.display = 'block';
      } else {
        resistorControl.style.display = 'none';
      }
    });
  });

  slArmLength.addEventListener('input', (e) => {
    state.armLength = parseFloat(e.target.value) / 100.0;
    valArmLength.textContent = `${e.target.value} cm`;
    updateCoilSpecs();
  });

  slArcSpan.addEventListener('input', (e) => {
    state.arcSpan = parseInt(e.target.value, 10);
    valArcSpan.textContent = `${state.arcSpan}°`;
    updateCoilSpecs();
  });

  slAngle.addEventListener('input', (e) => {
    state.initialAngle = parseFloat(e.target.value);
    valAngle.textContent = `${e.target.value}°`;
    state.theta = (state.initialAngle * Math.PI) / 180;
    state.omega = 0.0;
  });

  slTurns.addEventListener('input', (e) => {
    state.turns = parseInt(e.target.value, 10);
    valTurns.textContent = state.turns;
    updateCoilSpecs();
  });

  slWireGauge.addEventListener('input', (e) => {
    state.wireDia = parseFloat(e.target.value) / 1000.0;
    valWireGauge.textContent = `${parseFloat(e.target.value).toFixed(2)} mm`;
    updateCoilSpecs();
  });

  slMagnetLength.addEventListener('input', (e) => {
    state.magnetLength = parseFloat(e.target.value) / 100.0;
    valMagnetLength.textContent = `${parseFloat(e.target.value).toFixed(1)} cm`;
    updateCoilSpecs();
  });

  slMagnetDia.addEventListener('input', (e) => {
    state.magnetDia = parseFloat(e.target.value) / 1000.0;
    valMagnetDia.textContent = `${parseFloat(e.target.value).toFixed(1)} mm`;
    updateCoilSpecs();
  });

  slCoilLength.addEventListener('input', (e) => {
    state.coilLength = parseFloat(e.target.value) / 100.0;
    valCoilLength.textContent = `${parseFloat(e.target.value).toFixed(1)} cm`;
    updateCoilSpecs();
  });

  slSeriesR.addEventListener('input', (e) => {
    state.seriesResistor = parseInt(e.target.value, 10);
    valSeriesR.textContent = `${state.seriesResistor} Ω`;
  });

  // Presets (com limite R = 60 cm)
  const presets = {
    compact: {
      armLength: 30,
      arcSpan: 90,
      angle: 90,
      turns: 1000,
      wireGauge: 0.25,
      magnetLength: 10.0,
      magnetDia: 5.0,
      coilLength: 2.0,
      mode: 'leds'
    },
    long: {
      armLength: 60,
      arcSpan: 90,
      angle: 90,
      turns: 1500,
      wireGauge: 0.25,
      magnetLength: 12.0,
      magnetDia: 6.0,
      coilLength: 2.5,
      mode: 'leds'
    },
    lenz: {
      armLength: 30,
      arcSpan: 90,
      angle: 90,
      turns: 1200,
      wireGauge: 0.35,
      magnetLength: 10.0,
      magnetDia: 6.0,
      coilLength: 2.0,
      mode: 'short'
    },
    resistor: {
      armLength: 30,
      arcSpan: 90,
      angle: 90,
      turns: 1000,
      wireGauge: 0.25,
      magnetLength: 10.0,
      magnetDia: 5.0,
      coilLength: 2.0,
      mode: 'resistor',
      resistor: 150
    }
  };

  function applyPreset(pName) {
    const p = presets[pName];
    if (!p) return;

    slArmLength.value = p.armLength;
    valArmLength.textContent = `${p.armLength} cm`;
    state.armLength = p.armLength / 100.0;

    slArcSpan.value = p.arcSpan;
    valArcSpan.textContent = `${p.arcSpan}°`;
    state.arcSpan = p.arcSpan;

    slAngle.value = p.angle;
    valAngle.textContent = `${p.angle}°`;
    state.initialAngle = p.angle;
    state.theta = (p.angle * Math.PI) / 180;
    state.omega = 0.0;

    slTurns.value = p.turns;
    valTurns.textContent = p.turns;
    state.turns = p.turns;

    slWireGauge.value = p.wireGauge;
    valWireGauge.textContent = `${p.wireGauge.toFixed(2)} mm`;
    state.wireDia = p.wireGauge / 1000.0;

    slMagnetLength.value = p.magnetLength;
    valMagnetLength.textContent = `${p.magnetLength.toFixed(1)} cm`;
    state.magnetLength = p.magnetLength / 100.0;

    slMagnetDia.value = p.magnetDia;
    valMagnetDia.textContent = `${p.magnetDia.toFixed(1)} mm`;
    state.magnetDia = p.magnetDia / 1000.0;

    slCoilLength.value = p.coilLength;
    valCoilLength.textContent = `${p.coilLength.toFixed(1)} cm`;
    state.coilLength = p.coilLength / 100.0;

    state.circuitMode = p.mode;
    modeCards.forEach((c) => {
      const r = c.querySelector('input[type="radio"]');
      if (r.value === p.mode) {
        c.classList.add('active');
        r.checked = true;
      } else {
        c.classList.remove('active');
      }
    });

    if (p.mode === 'resistor') {
      resistorControl.style.display = 'block';
      if (p.resistor) {
        slSeriesR.value = p.resistor;
        valSeriesR.textContent = `${p.resistor} Ω`;
        state.seriesResistor = p.resistor;
      }
    } else {
      resistorControl.style.display = 'none';
    }

    updateCoilSpecs();
    scopeBuffer.length = 0;
  }

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      presetButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      applyPreset(btn.dataset.preset);
    });
  });

  // --- Inicialização ---
  updateCoilSpecs();
  requestAnimationFrame(mainLoop);

})();
