import { createServer } from './app-server.mjs';

const port = Number(process.env.PORT || 5180);
const host = process.env.HOST || '127.0.0.1';
const server = createServer().listen(port, host, () => console.log(`http://${host}:${port}/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
