import { resolve } from 'node:path';
import { createBookingApi, openBookingDb } from './booking-api.mjs';
import { officialServices, mergeOfficialServices } from './official-services.mjs';

const db = openBookingDb(process.env.AROLDO_DB_PATH || resolve('data', 'bookings.sqlite'));
try {
  const api = createBookingApi(db);
  api.updateSettings(mergeOfficialServices(api.settings()));
  console.log(`Catálogo oficial aplicado: ${officialServices.length} serviços com preços; durações provisórias para novos serviços.`);
} finally {
  db.close();
}
