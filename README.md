# Simulador de Indução Eletromagnética (Faraday-Lenz) 🧲⚡

Simulação visual interativa em tempo real (60 FPS) de um experimento de indução eletromagnética com **balanço em arco metálico de 90°**, **ímã de neodímio fatiado em discos de 1 mm (10 cm de extensão)**, **bobina multifilar** e **LEDs antiparalelos**.

---

## 🌟 Funcionalidades

- **Física Analítica em Tempo Real:** Dinâmica não-linear do pêndulo em arco com integração Runge-Kutta de 4ª ordem (RK4), cálculo exato de fluxo magnético $\Phi(\theta)$, tensão induzida $\mathcal{E}(t)$ e frenagem magnética de Lenz (Back-EMF Torque).
- **Chave Seletora de Modos (Switch):**
  - 🔴🟢 **LEDs Antiparalelos:** Demonstra a inversão do sentido da corrente induzida (LED 1 Vermelho na entrada, LED 2 Verde na saída).
  - ⚡ **Curto-Circuito (Freio de Lenz):** Frenagem eletromagnética brusca do balanço em 1–2 ciclos.
  - ⭕ **Circuito Aberto:** $I = 0$, oscilação harmônica livre sem amortecimento magnético.
  - 🎚️ **LEDs + Resistor Série ($10\ \Omega$ a $500\ \Omega$):** Demonstração da redução de corrente e atenuação do brilho dos LEDs.
- **Osciloscópio Digital Live:** Traçado simultâneo da tensão induzida $\mathcal{E}(t)$ e corrente $I(t)$.
- **Layout 16:9 Widescreen & Mobile Touch:** Tela sem rolagem (*zero-scroll*) em monitores desktop 16:9 e layout adaptável com controle por toque no celular/tablet.

---

## 🚀 Como Executar Localmente

Basta clonar o repositório e abrir o arquivo `index.html` em qualquer navegador:

```bash
git clone https://github.com/vitor-rc/faraday-lenz-simulator.git
cd faraday-lenz-simulator
open index.html
```

Não requer Node.js, compilação ou dependências externas (HTML5, Vanilla CSS e Vanilla JS puros).

---

## 📄 Licença

MIT License.
