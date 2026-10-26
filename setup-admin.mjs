import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve } from 'node:path';
import { openBookingDb, setAdminPassword } from './booking-api.mjs';

const rl = createInterface({ input: stdin, output: stdout });
stdout.write('Crie a senha do painel (mínimo 12 caracteres): ');
const write = rl._writeToOutput.bind(rl);
rl._writeToOutput = () => {};
const password = await rl.question('');
rl._writeToOutput = write;
stdout.write('\n');
rl.close();
setAdminPassword(openBookingDb(process.env.AROLDO_DB_PATH || resolve('data', 'bookings.sqlite')), password);
console.log('Senha administrativa configurada.');
