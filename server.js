const http = require('http');

// Cores ANSI compatíveis com CMD e Terminal
const RESET = '\x1b[0m';
const GREEN_BRIGHT = '\x1b[92m';
const GREEN_DARK = '\x1b[32m';
const WHITE_BRIGHT = '\x1b[97m';
const GRAY = '\x1b[90m';

// ============================================================================
// 1. ESCUDO CLÁSSICO DO "P" (25x27) - LIMPO, LEGÍVEL E COM PROFUNDIDADE 3D
// ============================================================================
const SHIELD_GRID = [
  "         GGGWWWGGG         ",
  "       GWWWGGGGGWWWG       ",
  "      GWGGGGGGGGGGGWG      ",
  "    GWWGGGGGGGGGGGGGWWG    ",
  "    WWGGGGGGGGGGGGGGGWW    ",
  "   GWGGWWGGGWWWWWGGGGGWG   ",
  "  GWGGGWWWGWWWWWWWGGGGGWG  ",
  "  WGGGGGWWWWWGGGWWWGGGGGW  ",
  " GWGGGGGGWWWGGGGGWWWGGGGWG ",
  " GWGGGGGGWWWGGGGGWWWGGGGWG ",
  " GGGGGGGGWWWGGGGGWWWGGGGGG ",
  " WGGGGGGGWWWGGGGGWWWGGGGGW ",
  " WGGGGGGGWWWGGGGWWWGGGGGGW ",
  " WGGGGGGGWWWWWWWWWGGGGGGGW ",
  " GGGGGGGGWWWWWWWWGGGGGGGGG ",
  " GWGGGGGGWWWGGGGGGGGGGGGWG ",
  " GWGGGGGGWWWGGGGGGGGGGGGWG ",
  "  WGGGGGGWWWGGGGGGGGGGGGW  ",
  "  GWGGGGGWWWGGGGGGGGGGGWG  ",
  "   GWGGGWWWWGGGGGGGGGGWG   ",
  "    WWGWWGGWWGGGGGGGGWW    ",
  "    GWWGGGGGGGGGGGGGWWG    ",
  "      GWGGGGGGGGGGGWG      ",
  "       GWWWGGGGGWWWG       ",
  "         GGGWWWGGG         "
];

const shieldVoxels = [];
const heightGrid = SHIELD_GRID.length;
const widthGrid = SHIELD_GRID[0].length;
const halfY = Math.floor(heightGrid / 2);
const halfX = Math.floor(widthGrid / 2);
const depthLayers = [-2, -1, 0, 1, 2]; // Espessura 3D real no eixo Z

for (let y = 0; y < heightGrid; y++) {
  for (let x = 0; x < widthGrid; x++) {
    const cell = SHIELD_GRID[y][x];
    if (cell === ' ') continue;

    for (const z of depthLayers) {
      const isFace = Math.abs(z) === 2;
      shieldVoxels.push({
        x: x - halfX,
        y: y - halfY,
        z: z,
        type: isFace ? cell : (cell === 'W' ? 'W' : 'S'),
        buildOrder: (heightGrid - y) * 10 + Math.abs(x - halfX)
      });
    }
  }
}

shieldVoxels.sort((a, b) => a.buildOrder - b.buildOrder);

// ============================================================================
// 2. FONTE MINI (3x4) PARA "TIME SEM MUNDIAL" CABER COM FOLGA EM 58 COLUNAS
// ============================================================================
const MINI_FONT = {
  T: [
    "███",
    " █ ",
    " █ ",
    " █ "
  ],
  I: [
    "█",
    "█",
    "█",
    "█"
  ],
  M: [
    "█ █",
    "███",
    "█ █",
    "█ █"
  ],
  E: [
    "███",
    "██ ",
    "█  ",
    "███"
  ],
  S: [
    " ██",
    "█  ",
    "  █",
    "██ "
  ],
  U: [
    "█ █",
    "█ █",
    "█ █",
    "███"
  ],
  N: [
    "██ █",
    "█ ██",
    "█  █",
    "█  █"
  ],
  D: [
    "██ ",
    "█ █",
    "█ █",
    "██ "
  ],
  A: [
    " █ ",
    "█ █",
    "███",
    "█ █"
  ],
  L: [
    "█  ",
    "█  ",
    "█  ",
    "███"
  ],
  ' ': [
    "  ",
    "  ",
    "  ",
    "  "
  ]
};

const PHRASE = "TIME SEM MUNDIAL";
const textParticles = [];
let cursorX = 0;

for (let i = 0; i < PHRASE.length; i++) {
  const ch = PHRASE[i];
  const glyph = MINI_FONT[ch] || MINI_FONT[' '];
  const charW = glyph[0].length;

  for (let gy = 0; gy < glyph.length; gy++) {
    for (let gx = 0; gx < charW; gx++) {
      if (glyph[gy][gx] === '█') {
        const worldX = cursorX + gx;
        textParticles.push({
          x: worldX,
          y: gy,
          buildOrder: worldX * 10 + (4 - gy)
        });
      }
    }
  }
  cursorX += charW + 1;
}

const totalTextWidth = cursorX - 1;
textParticles.sort((a, b) => a.buildOrder - b.buildOrder);

// ============================================================================
// 3. RENDERIZAÇÃO DE QUADROS (MONTAGEM 360° -> 1s PARADO -> DESMONTAGEM)
// ============================================================================
function renderFrame(tick) {
  // Cada frame = 75ms (~13.3 FPS)
  // 0..69   (~5.2s): Monta o escudo girando 360° + constrói a frase
  // 70..82  (~1.0s): Fica parado perfeitamente de frente com tudo completo
  // 83..152 (~5.2s): Desmonta o escudo girando 360° + desmonta a frase
  // 153..162(~0.7s): Pausa limpa antes de reiniciar
  const CYCLE_LEN = 163;
  const phase = tick % CYCLE_LEN;

  let progress = 0;
  let angleY = 0;

  if (phase < 70) {
    progress = phase / 70;
    angleY = progress * Math.PI * 2;
  } else if (phase < 83) {
    progress = 1;
    angleY = 0;
  } else if (phase < 153) {
    const downP = (phase - 83) / 70;
    progress = 1 - downP;
    angleY = downP * Math.PI * 2;
  } else {
    progress = 0;
    angleY = 0;
  }

  const activeShieldCount = Math.floor(shieldVoxels.length * progress);
  const activeTextCount = Math.floor(textParticles.length * progress);

  // Largura 76 x Altura 29 (cabe sem cortar na janela padrão de 80x30 do CMD)
  const WIDTH = 76;
  const HEIGHT = 29;
  const screen = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(' '));
  const zBuffer = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(-999));

  const centerX = Math.floor(WIDTH / 2);
  const shieldCenterY = 12;
  const cosA = Math.cos(angleY);
  const sinA = Math.sin(angleY);

  const fov = 34;
  const viewerDist = 33;

  // Renderiza o escudo 3D
  for (let i = 0; i < activeShieldCount; i++) {
    const v = shieldVoxels[i];

    const rotX = v.x * cosA - v.z * sinA;
    const rotZ = v.x * sinA + v.z * cosA;
    const rotY = v.y;

    const scale = fov / (viewerDist + rotZ);
    const projX = Math.round(centerX + rotX * scale * 1.9);
    const projY = Math.round(shieldCenterY + rotY * scale * 0.85);

    if (projX >= 0 && projX < WIDTH && projY >= 0 && projY < 23) {
      if (rotZ > zBuffer[projY][projX]) {
        zBuffer[projY][projX] = rotZ;

        let char = '@';
        if (rotZ < -1.5) char = '.';
        else if (rotZ < 0) char = '+';
        else if (rotZ < 1.2) char = '#';
        else char = '@';

        let color = GREEN_BRIGHT;
        if (v.type === 'W') color = WHITE_BRIGHT;
        else if (v.type === 'D') color = GREEN_DARK;
        else if (v.type === 'S') color = GRAY;

        screen[projY][projX] = `${color}${char}${RESET}`;
      }
    }
  }

  // Renderiza "TIME SEM MUNDIAL" centralizado em 58 colunas
  const textStartX = Math.max(0, Math.floor((WIDTH - totalTextWidth) / 2));
  const textStartY = 24;
  const buildChars = ['.', '+', '#', '@'];

  for (let i = 0; i < activeTextCount; i++) {
    const p = textParticles[i];
    const px = textStartX + p.x;
    const py = textStartY + p.y;

    if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
      const distFromTip = activeTextCount - i;
      let glyphChar = '@';
      if (progress < 1 && distFromTip < 10) {
        glyphChar = buildChars[Math.min(3, Math.floor(distFromTip / 3))];
      }
      screen[py][px] = `${WHITE_BRIGHT}${glyphChar}${RESET}`;
    }
  }

  let output = '\x1b[2J\x1b[H';
  for (let y = 0; y < HEIGHT; y++) {
    output += screen[y].join('') + '\n';
  }
  return output;
}

const server = http.createServer((req, res) => {
  const userAgent = req.headers['user-agent'] || '';

  if (!userAgent.includes('curl') && !userAgent.includes('Wget')) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(
      'Animacao 3D ASCII pronta!\n\n' +
      'Abra o CMD (Prompt de Comando) e digite:\n' +
      `curl -L ${req.headers.host}\n`
    );
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache'
  });

  res.write('\x1b[?25l');

  let tick = 0;
  const interval = setInterval(() => {
    res.write(renderFrame(tick));
    tick++;
  }, 75);

  req.on('close', () => {
    clearInterval(interval);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor 3D ASCII rodando na porta ${PORT}`);
});