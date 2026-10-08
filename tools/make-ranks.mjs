// npm run ranks — gera os emblemas de rank (PNG 128x128) em assets/ranks/. Rode só se quiser mudar o visual.
// Precisa do pacote "sharp" (npm i -D sharp). Os PNGs gerados já vão no repositório, então o bot NÃO precisa do sharp.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const TIERS = {
  tin:       { rim: ["#d5d9e0", "#6f7683"], body: ["#b9bfca", "#59606d"], gem: ["#f2f4f8", "#aab0ba"], k: 0.62 },
  bronze:    { rim: ["#ffc58a", "#8a4a1c"], body: ["#e39a56", "#7a3f14"], gem: ["#ffe2c2", "#e39a56"], k: 0.72 },
  silver:    { rim: ["#ffffff", "#7d8798"], body: ["#e4e9f1", "#7d8798"], gem: ["#ffffff", "#c9d1de"], k: 0.82 },
  gold:      { rim: ["#fff0a8", "#9a6a00"], body: ["#ffd75e", "#a8730a"], gem: ["#fff7cf", "#ffd75e"], k: 0.92 },
  platinum:  { rim: ["#c8fff6", "#1f8d80"], body: ["#6df0dc", "#168275"], gem: ["#e2fffb", "#6df0dc"], k: 1.0 },
  diamond:   { rim: ["#d6ecff", "#2b5fa8"], body: ["#7cc4ff", "#2a5fb0"], gem: ["#f0f9ff", "#7cc4ff"], k: 1.08 },
  valhallan: { rim: ["#ffe3ec", "#b01e55"], body: ["#ff7aa2", "#a3194f"], gem: ["#fff0f5", "#ff9fbc"], k: 1.12, wings: true },
};

const SHIELD = "M64 8 L104 22 V62 C104 90 86 110 64 122 C42 110 24 90 24 62 V22 Z";
const INK = "#0d0b14";

function svg(t) {
  const k = t.k, gx = 64, gy = 62;                       // gema centralizada, escala por tier
  const gem = (x, y) => `${gx + (x - 64) * k},${gy + (y - 62) * k}`;
  const P = (pts) => pts.map(([x, y]) => gem(x, y)).join(" ");
  const wing = (side) => [-82, -58, -34].map((a, i) =>
    `<g transform="translate(${side < 0 ? 33 : 95} ${56 + i * 4}) rotate(${side < 0 ? a : -a})"><ellipse cx="0" cy="-17" rx="${6.5 - i * 0.3}" ry="${17 - i * 0.5}" fill="url(#rim)" stroke="${INK}" stroke-width="2.4"/></g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<defs>
  <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.rim[0]}"/><stop offset="1" stop-color="${t.rim[1]}"/></linearGradient>
  <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.body[0]}"/><stop offset="1" stop-color="${t.body[1]}"/></linearGradient>
  <linearGradient id="gem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.gem[0]}"/><stop offset="1" stop-color="${t.gem[1]}"/></linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.45" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
${t.wings ? wing(-1) + wing(1) : ""}
<path d="${SHIELD}" fill="url(#rim)" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
<path d="${SHIELD}" fill="url(#body)" transform="translate(64 64) scale(0.8) translate(-64 -64)" stroke="${INK}" stroke-opacity="0.55" stroke-width="2"/>
<circle cx="64" cy="58" r="30" fill="url(#glow)"/>
<polygon points="${P([[64, 28], [92, 58], [64, 98], [36, 58]])}" fill="url(#gem)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<polygon points="${P([[64, 28], [92, 58], [36, 58]])}" fill="#fff" fill-opacity="0.55"/>
<polygon points="${P([[36, 58], [64, 98], [64, 58]])}" fill="#000" fill-opacity="0.16"/>
<polygon points="${P([[92, 58], [64, 98], [64, 58]])}" fill="#000" fill-opacity="0.06"/>
<path d="M${gem(64, 28)} L${gem(64, 98)} M${gem(36, 58)} L${gem(92, 58)}" stroke="${INK}" stroke-opacity="0.35" stroke-width="1.4" fill="none"/>
</svg>`;
}

await mkdir(new URL("../assets/ranks/", import.meta.url), { recursive: true });
for (const [name, t] of Object.entries(TIERS)) {
  const png = await sharp(Buffer.from(svg(t)), { density: 288 }).resize(128, 128).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(new URL(`../assets/ranks/${name}.png`, import.meta.url), png);
  console.log(name, png.length, "bytes");
}
