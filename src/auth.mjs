// Acesso ao Grace Offenders: só o DONO do bot (qualquer cargo no servidor não vale) + senha.
// - Dono: variável GRACE_OWNER_ID (um ou mais IDs separados por vírgula). Sem ela, usa o dono da aplicação no Discord Developer Portal.
// - Senha: guardada como hash scrypt (nunca em texto puro no código). Para trocar: `npm run hashpass -- "nova senha"`
//   e coloque o resultado na variável OFFENDERS_PASSWORD_HASH (ex.: no Render). Sem a variável, vale a senha padrão abaixo.
import { createHash, scryptSync, timingSafeEqual } from "node:crypto";

const DEFAULT_HASH = "scrypt$9e8c470e6558c4018fb91b8d7e886fde$4aaabba112a8a413f05dff16765db927be52b461d53651b5d1d43c252ba8cf34";

function passwordOk(input) {
  const plain = process.env.OFFENDERS_PASSWORD;                       // alternativa simples: senha em texto na variável de ambiente
  if (plain) {
    const a = createHash("sha256").update(String(input)).digest(), b = createHash("sha256").update(plain).digest();
    return timingSafeEqual(a, b);
  }
  const [alg, salt, hex] = (process.env.OFFENDERS_PASSWORD_HASH || DEFAULT_HASH).split("$");
  if (alg !== "scrypt" || !salt || !hex) return false;
  const want = Buffer.from(hex, "hex");
  const got = scryptSync(String(input), salt, want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

// ---------- tentativas: 5 erros bloqueiam por 15 min (em memória) ----------
const MAX_TRIES = 5, LOCK_MS = 15 * 60_000;
const tries = new Map();                                                // userId -> { n, until }

/** Timestamp (ms) até quando o usuário está bloqueado, ou 0. */
export function lockedUntil(userId) {
  const t = tries.get(userId);
  if (!t?.until) return 0;
  if (t.until > Date.now()) return t.until;
  tries.delete(userId);
  return 0;
}

/** Confere a senha. Retorna { ok, locked, until, left }. */
export function attempt(userId, input) {
  const until = lockedUntil(userId);
  if (until) return { ok: false, locked: true, until, left: 0 };
  if (passwordOk(input)) { tries.delete(userId); return { ok: true, locked: false, until: 0, left: MAX_TRIES }; }
  const t = tries.get(userId) ?? { n: 0, until: 0 };
  t.n += 1;
  if (t.n >= MAX_TRIES) { t.until = Date.now() + LOCK_MS; t.n = 0; }
  tries.set(userId, t);
  return { ok: false, locked: Boolean(t.until), until: t.until, left: t.until ? 0 : MAX_TRIES - t.n };
}

// ---------- dono ----------
let appOwner = null;
export async function ownerIds(client) {
  const env = (process.env.GRACE_OWNER_ID || "").split(/[\s,]+/).filter(Boolean);
  if (env.length) return env;
  if (appOwner) return appOwner;
  const app = await client.application.fetch();
  const id = app.owner?.ownerId ?? app.owner?.id;                       // Team tem ownerId; User tem só id
  if (id) appOwner = [id];
  return appOwner ?? [];
}
export const isOwner = async (i) => (await ownerIds(i.client)).includes(i.user.id);
