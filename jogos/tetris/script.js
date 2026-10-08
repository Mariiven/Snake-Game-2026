const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const T = 20;                       // tamanho do quadrado
const N = canvas.width / T;         // quadrados por lado

const DIFICULDADES = {
  facil:   { vel: 170, paredes: false, obstaculos: 0 },
  medio:   { vel: 130, paredes: true,  obstaculos: 0 },
  dificil: { vel: 100, paredes: true,  obstaculos: 2 }
};
const VETOR = { cima:{x:0,y:-1}, baixo:{x:0,y:1}, esquerda:{x:-1,y:0}, direita:{x:1,y:0} };
const OPOSTA = { cima:'baixo', baixo:'cima', esquerda:'direita', direita:'esquerda' };

let cobra = [], direcao = 'direita', fila = [], comida = null, bonus = null, obstaculos = [];
let pontos = 0, estrelas = 0, nivel = 1, combo = 1, ticksDesdeComida = 0;
let estado = 'pronto';              // pronto | jogando | pausado | fim | vitoria
let cfg = DIFICULDADES.medio, chaveDif = 'medio', timer = null, recorde = 0;
let particulas = [], somLigado = true, audioCtx = null, novoRecorde = false;

const $ = id => document.getElementById(id);

// ---------- Recorde (um por dificuldade) ----------
function carregarRecorde() {
  try { recorde = parseInt(localStorage.getItem('recordeCobrinha_' + chaveDif), 10) || 0; }
  catch (e) { recorde = 0; }
  $('recorde').textContent = recorde;
}
function salvarRecorde() {
  try { localStorage.setItem('recordeCobrinha_' + chaveDif, recorde); } catch (e) {}
}
$('dificuldade').addEventListener('change', e => {
  if (estado === 'jogando' || estado === 'pausado') { e.target.value = chaveDif; return; }
  chaveDif = e.target.value; carregarRecorde();
});

// ---------- Som ----------
function bip(freq, dur, tipo = 'square', vol = 0.05) {
  if (!somLigado) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = tipo; o.frequency.value = freq; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}
function alternarSom() { somLigado = !somLigado; $('btnSom').innerHTML = somLigado ? '&#128266;' : '&#128263;'; }

// ---------- Início ----------
function iniciarJogo() {
  chaveDif = $('dificuldade').value; cfg = DIFICULDADES[chaveDif]; carregarRecorde();
  cobra = [{x:10,y:10},{x:9,y:10},{x:8,y:10}];
  direcao = 'direita'; fila = []; obstaculos = []; bonus = null; particulas = [];
  pontos = 0; estrelas = 0; nivel = 1; combo = 1; ticksDesdeComida = 99; novoRecorde = false;
  estado = 'jogando';
  for (let i = 0; i < cfg.obstaculos; i++) adicionarObstaculo();
  comida = posicaoLivre();
  atualizarPainel();
  clearTimeout(timer);
  agendar();
  bip(520, .12, 'triangle');
}

function velocidade() { return Math.max(55, cfg.vel - (nivel - 1) * 9); }
function agendar() { clearTimeout(timer); timer = setTimeout(tick, velocidade()); }

// ---------- Posições ----------
function ocupado(x, y) {
  return cobra.some(p => p.x === x && p.y === y) ||
         obstaculos.some(p => p.x === x && p.y === y) ||
         (comida && comida.x === x && comida.y === y) ||
         (bonus && bonus.x === x && bonus.y === y);
}
function posicaoLivre(distMinCabeca = 0) {
  const livres = [];
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
    if (ocupado(x, y)) continue;
    if (cobra.length && distMinCabeca &&
        Math.abs(x - cobra[0].x) + Math.abs(y - cobra[0].y) < distMinCabeca) continue;
    livres.push({ x, y });
  }
  return livres.length ? livres[Math.floor(Math.random() * livres.length)] : null;
}
function adicionarObstaculo() {
  const p = posicaoLivre(6);
  if (p) obstaculos.push(p);
}

// ---------- Loop lógico ----------
function tick() {
  if (estado !== 'jogando') return;
  if (fila.length) direcao = fila.shift();

  const v = VETOR[direcao];
  const h = { x: cobra[0].x + v.x, y: cobra[0].y + v.y };

  if (cfg.paredes) {
    if (h.x < 0 || h.x >= N || h.y < 0 || h.y >= N) return fimDeJogo();
  } else {
    h.x = (h.x + N) % N; h.y = (h.y + N) % N;
  }

  const comeuComida = comida && h.x === comida.x && h.y === comida.y;
  const comeuBonus = bonus && h.x === bonus.x && h.y === bonus.y;
  const cresce = comeuComida || comeuBonus;

  // a ponta do rabo libera a casa neste turno, então não conta como colisão
  const corpo = cresce ? cobra : cobra.slice(0, -1);
  if (corpo.some(p => p.x === h.x && p.y === h.y) ||
      obstaculos.some(p => p.x === h.x && p.y === h.y)) return fimDeJogo();

  cobra.unshift(h);
  if (!cresce) cobra.pop();

  ticksDesdeComida++;
  if (bonus && --bonus.ticks <= 0) bonus = null;

  if (comeuComida) {
    combo = ticksDesdeComida <= 25 ? Math.min(5, combo + 1) : 1;
    ticksDesdeComida = 0;
    pontos += 10 * combo; estrelas++;
    explodir(h, '#FFD84F'); bip(600 + combo * 80, .1);
    const nivelNovo = Math.floor(estrelas / 5) + 1;
    if (nivelNovo > nivel) {
      nivel = nivelNovo; bip(900, .25, 'triangle', .07);
      if (cfg.obstaculos) for (let i = 0; i < 2; i++) adicionarObstaculo();
    }
    comida = posicaoLivre();
    if (estrelas % 5 === 0 && !bonus) { const b = posicaoLivre(); if (b) bonus = { ...b, ticks: 40 }; }
    if (!comida) return vitoria();
  } else if (comeuBonus) {
    pontos += 50; bonus = null;
    explodir(h, '#ff8fd8'); bip(1100, .25, 'triangle', .07);
  } else if (ticksDesdeComida > 25) combo = 1;

  atualizarPainel();
  agendar();
}

function atualizarPainel() {
  if (pontos > recorde) { recorde = pontos; novoRecorde = true; salvarRecorde(); }
  $('pontos').textContent = pontos; $('recorde').textContent = recorde;
  $('nivel').textContent = nivel; $('combo').textContent = 'x' + combo;
}

function fimDeJogo() { estado = 'fim'; clearTimeout(timer); explodir(cobra[0], '#7AF0ED'); bip(150, .5, 'sawtooth', .08); }
function vitoria() { estado = 'vitoria'; clearTimeout(timer); atualizarPainel(); bip(1200, .5, 'triangle', .07); }

function pausarJogo() {
  if (estado === 'jogando') { estado = 'pausado'; clearTimeout(timer); }
  else if (estado === 'pausado') { estado = 'jogando'; agendar(); }
}

// ---------- Controles ----------
function mudarDirecao(nova) {
  if (estado !== 'jogando') return;
  const ultima = fila.length ? fila[fila.length - 1] : direcao;
  if (nova === ultima || nova === OPOSTA[ultima]) return;
  if (fila.length < 2) fila.push(nova);   // fila de comandos evita perder viradas rápidas
}

const TECLAS = { ArrowUp:'cima', w:'cima', W:'cima', ArrowDown:'baixo', s:'baixo', S:'baixo',
                 ArrowLeft:'esquerda', a:'esquerda', A:'esquerda', ArrowRight:'direita', d:'direita', D:'direita' };
document.addEventListener('keydown', e => {
  if (TECLAS[e.key]) { e.preventDefault(); mudarDirecao(TECLAS[e.key]); }
  else if (e.key === ' ') { e.preventDefault(); pausarJogo(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (estado !== 'jogando' && estado !== 'pausado') iniciarJogo(); }
});

let toque = null;
canvas.addEventListener('touchstart', e => { toque = e.touches[0]; }, { passive: true });
canvas.addEventListener('touchend', e => {
  if (!toque) return;
  const t = e.changedTouches[0], dx = t.clientX - toque.clientX, dy = t.clientY - toque.clientY;
  toque = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) { if (estado === 'pronto' || estado === 'fim') iniciarJogo(); return; }
  mudarDirecao(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'direita' : 'esquerda') : (dy > 0 ? 'baixo' : 'cima'));
});

// ---------- Partículas ----------
function explodir(p, cor) {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.5;
    particulas.push({ x: p.x * T + T / 2, y: p.y * T + T / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vida: 1, cor });
  }
}

// ---------- Desenho (independente da lógica) ----------
function estrela(cx, cy, r, cor) {
  ctx.fillStyle = cor; ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5, raio = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(ang) * raio, cy + Math.sin(ang) * raio);
  }
  ctx.closePath(); ctx.fill();
}

function texto(t, y, tam, cor = 'white') {
  ctx.fillStyle = cor; ctx.font = `bold ${tam}px Arial`; ctx.textAlign = 'center';
  ctx.fillText(t, canvas.width / 2, y);
}
function cobertura() { ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height); }

function desenhar() {
  const agora = Date.now();
  ctx.fillStyle = '#090522'; ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(99,97,199,.35)'; ctx.lineWidth = 0.5; ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    ctx.moveTo(i * T, 0); ctx.lineTo(i * T, canvas.height);
    ctx.moveTo(0, i * T); ctx.lineTo(canvas.width, i * T);
  }
  ctx.stroke();

  // bordas avisam se a parede mata (vermelho) ou é atravessável (azul)
  ctx.strokeStyle = cfg.paredes ? 'rgba(255,90,90,.6)' : 'rgba(122,240,237,.4)';
  ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);

  obstaculos.forEach(o => {
    ctx.fillStyle = '#5a4b8a'; ctx.fillRect(o.x * T + 1, o.y * T + 1, T - 2, T - 2);
    ctx.fillStyle = '#7d6bb8'; ctx.fillRect(o.x * T + 4, o.y * T + 4, T - 8, T - 8);
  });

  if (comida) estrela(comida.x * T + T / 2, comida.y * T + T / 2, T / 2 - 1 + Math.sin(agora / 200) * 1.5, '#FFD84F');
  if (bonus && (bonus.ticks > 12 || Math.floor(agora / 150) % 2)) {
    estrela(bonus.x * T + T / 2, bonus.y * T + T / 2, T / 2 + 1 + Math.sin(agora / 120) * 2, '#ff8fd8');
  }

  cobra.forEach((p, i) => {
    ctx.fillStyle = i === 0 ? '#7AF0ED' : '#4A9AB0';
    ctx.beginPath(); ctx.roundRect(p.x * T + 1, p.y * T + 1, T - 2, T - 2, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(p.x * T + 3, p.y * T + 3, T / 2 - 1, T / 2 - 1);
  });
  if (cobra.length) {   // olhos
    const h = cobra[0], v = VETOR[direcao], px = -v.y, py = v.x;
    ctx.fillStyle = '#090522';
    [-1, 1].forEach(l => {
      ctx.beginPath();
      ctx.arc(h.x * T + T / 2 + v.x * 4 + px * 4 * l, h.y * T + T / 2 + v.y * 4 + py * 4 * l, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  particulas = particulas.filter(p => p.vida > 0);
  particulas.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vida -= 0.04;
    ctx.globalAlpha = Math.max(0, p.vida); ctx.fillStyle = p.cor; ctx.fillRect(p.x, p.y, 3, 3);
  });
  ctx.globalAlpha = 1;

  if (estado === 'pronto') {
    cobertura(); texto('Devoradores', 170, 36, '#7AF0ED'); texto('de Estrelas', 210, 36, '#FFD84F');
    texto('Enter ou Iniciar para jogar', 260, 16);
  } else if (estado === 'pausado') {
    cobertura(); texto('Jogo pausado', 205, 32); texto('Espaço para continuar', 240, 16);
  } else if (estado === 'fim' || estado === 'vitoria') {
    cobertura();
    texto(estado === 'vitoria' ? 'VOCÊ VENCEU!' : 'FIM DE JOGO', 170, 38, estado === 'vitoria' ? '#FFD84F' : 'white');
    texto(`Pontuação: ${pontos}  |  Nível: ${nivel}`, 215, 18);
    if (novoRecorde) texto('Novo recorde!', 245, 20, '#e7cc71');
    texto('Enter ou Iniciar para jogar de novo', 285, 15);
  }
  requestAnimationFrame(desenhar);
}

carregarRecorde();
requestAnimationFrame(desenhar);