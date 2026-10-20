import { randomBytes } from 'node:crypto';

const count = Math.max(1, Number.parseInt(process.argv[2] ?? '1', 10) || 1);
for (let i = 0; i < count; i += 1) {
  console.log(randomBytes(24).toString('base64url'));
}
