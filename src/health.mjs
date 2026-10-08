// Mini servidor HTTP. O Render (plano grátis) só aceita "Web Service", que precisa de uma porta aberta,
// e põe o serviço para dormir após 15 min sem visitas. Um cron externo chamando /health a cada ~10 min mantém acordado.
import http from "node:http";

export function startHealth(getStatus) {
  const port = Number(process.env.PORT) || 3000;
  http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ name: "Grace", ...getStatus() }));
  }).listen(port, "0.0.0.0", () => console.log(`Servidor de saúde na porta ${port} (/health)`));

  // Reforço: o Render informa o endereço público em RENDER_EXTERNAL_URL; o bot chama a si mesmo a cada 9 min.
  const self = process.env.RENDER_EXTERNAL_URL;
  if (self) setInterval(() => fetch(`${self}/health`, { signal: AbortSignal.timeout(10_000) }).catch(() => {}), 9 * 60_000);
}
