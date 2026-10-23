import assert from 'node:assert/strict';
import { it } from 'node:test';
import { BSON } from 'mongodb';
import { inicializar } from './inicializar.js';

const simular = ({ existe = false, falla = false } = {}) => {
    const estado = { creado: 0, actualizado: 0, cerrado: false, documentos: [
        { tipo: 'sistema', nivel: 'info', fecha: new Date(), datos: { mensaje: 'Log real' } }
    ] };
    const base = {
        listCollections: () => ({ toArray: async () => existe ? [{ name: 'logs' }] : [] }),
        command: async (opciones) => {
            if (falla) throw new Error('Fallo simulado');
            if (opciones.collMod) { estado.actualizado++; estado.esquema = opciones.validator; }
        },
        createCollection: async (nombre, opciones) => {
            assert.equal(nombre, 'logs');
            estado.creado++;
            estado.esquema = opciones.validator;
        },
        collection: (nombre) => {
            assert.equal(nombre, 'logs');
            return {
                deleteMany: async (filtro) => {
                    estado.documentos = estado.documentos.filter((d) => d.datos.origen !== filtro['datos.origen']);
                },
                insertMany: async (docs) => estado.documentos.push(...docs)
            };
        }
    };
    class Cliente {
        async connect() {}
        db(nombre) { assert.equal(nombre, 'Pruebas'); return base; }
        async close() { estado.cerrado = true; }
    }
    return { estado, Cliente };
};
it('carga eventos BSON distintos y conserva los logs reales al repetir', async () => {
    const { estado, Cliente } = simular();
    const config = { uri: 'mongodb://pruebas', database: 'Pruebas' };
    await inicializar(config, Cliente);
    await inicializar(config, Cliente);
    assert.equal(estado.documentos.length, 4);
    assert.ok(estado.documentos.some((d) => d.datos.mensaje === 'Log real'));
    assert.deepEqual(estado.documentos.slice(1).map((d) => d.tipo), ['sistema', 'peticion', 'error']);
    assert.equal(estado.esquema.$jsonSchema.properties.datos.additionalProperties, undefined);
    assert.ok(BSON.deserialize(BSON.serialize(estado.documentos[1])).fecha instanceof Date);
    assert.equal(estado.cerrado, true);
});
it('actualiza el esquema si logs ya existe', async () => {
    const { estado, Cliente } = simular({ existe: true });
    await inicializar({ uri: 'mongodb://pruebas', database: 'Pruebas' }, Cliente);
    assert.equal(estado.creado, 0);
    assert.equal(estado.actualizado, 1);
});
it('cierra al fallar y rechaza configuración incompleta', async () => {
    const { estado, Cliente } = simular({ falla: true });
    await assert.rejects(inicializar({ uri: 'mongodb://pruebas', database: 'Pruebas' }, Cliente));
    assert.equal(estado.cerrado, true);
    await assert.rejects(inicializar({}, Cliente), /Faltan MONGO_URI/);
});
