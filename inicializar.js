import { MongoClient } from 'mongodb';
import { crearEsquemas } from './esquemas.js';
import { cargarDatosIniciales } from './carga_inicial.js';

// npm run inicializar carga estas variables desde .env.
const { MONGO_URI, MONGO_DATABASE } = process.env;

if (!MONGO_URI || !MONGO_DATABASE) {
    console.error('Faltan MONGO_URI o MONGO_DATABASE. Revisa el archivo .env.');
    process.exitCode = 1;
} else {
    const cliente = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    try {
        await cliente.connect();
        const base = cliente.db(MONGO_DATABASE);
        await base.command({ ping: 1 });
        await crearEsquemas(base);
        await cargarDatosIniciales(base);
        console.log(`Base ${MONGO_DATABASE} inicializada correctamente.`);
    } catch (error) {
        // Evita imprimir credenciales que pudieran aparecer en la URI.
        console.error(`No se pudo inicializar MongoDB (${error.name}). Revisa la conexión, los permisos y el archivo .env.`);
        process.exitCode = 1;
    } finally {
        await cliente.close();
    }
}
