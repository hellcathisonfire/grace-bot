// npm run hashpass -- "sua senha"  →  imprime o valor para a variável OFFENDERS_PASSWORD_HASH
import { randomBytes, scryptSync } from "node:crypto";
const pw = process.argv[2];
if (!pw) { console.error('Uso: npm run hashpass -- "sua senha"'); process.exit(1); }
const salt = randomBytes(16).toString("hex");
console.log(`scrypt$${salt}$${scryptSync(pw, salt, 32).toString("hex")}`);
