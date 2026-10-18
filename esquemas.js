/* =============================================================================
   RESTAURANTE SAZÓN CRIOLLA · Sistema de Reservas de Mesas
   MongoDB · Archivo de esquemas
   -----------------------------------------------------------------------------
   Crea la base RestauranteLogs con dos colecciones:
     - logs        : actividad del sistema (peticiones, auditoría, errores...).
     - comentarios : reseñas de los clientes sobre su visita (una por reserva).
   Cada colección tiene un validador $jsonSchema y sus índices.

   Ejecutar con mongosh (o pegarlo en la pestaña mongosh de MongoDB Compass):
     mongosh "mongodb://127.0.0.1:27017" esquemas.js

   Re-ejecutable: si la colección ya existe, solo actualiza su validador.
   ============================================================================= */

const NOMBRE_BASE = 'RestauranteLogs';
const DIAS_RETENCION_LOGS = 90;

const base = db.getSiblingDB(NOMBRE_BASE);

const calificacion = (descripcion) => ({ bsonType: 'int', minimum: 1, maximum: 5, description: descripcion });

/* ---------- Validadores $jsonSchema ---------- */
const esquemas = {
    /*
     * logs: ESQUEMA FLEXIBLE.
     * Solo se exigen los campos comunes { tipo, nivel, fecha }. El subdocumento
     * `datos` es libre: cada tipo de evento guarda su propia estructura BSON y se
     * pueden agregar tipos nuevos sin modificar el esquema ni migrar datos.
     */
    logs: {
        $jsonSchema: {
            bsonType: 'object',
            title: 'Evento del sistema',
            required: ['tipo', 'nivel', 'fecha'],
            properties: {
                tipo: {
                    bsonType: 'string',
                    minLength: 1,
                    description: 'peticion | auditoria | error | sistema | ... (abierto a nuevos tipos)'
                },
                nivel: { enum: ['info', 'warn', 'error'], description: 'Gravedad del evento' },
                fecha: { bsonType: 'date', description: 'Momento del evento (UTC)' },
                datos: { bsonType: 'object', description: 'Contenido libre según el tipo de evento' }
            }
        }
    },

    /*
     * comentarios: reseña de una visita al restaurante.
     * Los datos de la mesa y del autor se EMBEBEN (desnormalización intencional):
     * se leen las reseñas sin consultar SQL Server. `aspectos`, `etiquetas` y
     * `respuesta` son opcionales: no todos los documentos tienen la misma forma.
     */
    comentarios: {
        $jsonSchema: {
            bsonType: 'object',
            title: 'Reseña de una visita',
            required: ['idReserva', 'mesa', 'autor', 'calificacion', 'texto', 'fecha'],
            properties: {
                idReserva: { bsonType: 'int', minimum: 1, description: 'idReserva de SQL Server (una reseña por reserva)' },
                mesa: {
                    bsonType: 'object',
                    required: ['idMesa', 'numero', 'zona'],
                    properties: {
                        idMesa: { bsonType: 'int', minimum: 1 },
                        numero: { bsonType: 'int', minimum: 1 },
                        zona: { bsonType: 'string' }
                    }
                },
                autor: {
                    bsonType: 'object',
                    required: ['idUsuario', 'nombre'],
                    properties: {
                        idUsuario: { bsonType: 'int', minimum: 1 },
                        nombre: { bsonType: 'string', minLength: 1 }
                    }
                },
                calificacion: calificacion('Calificación general de 1 a 5'),
                aspectos: {
                    bsonType: 'object',
                    additionalProperties: false,
                    description: 'Calificación opcional por aspecto',
                    properties: {
                        comida: calificacion('Calidad de la comida'),
                        servicio: calificacion('Atención del personal'),
                        ambiente: calificacion('Ambiente del local')
                    }
                },
                texto: { bsonType: 'string', minLength: 1, maxLength: 500 },
                etiquetas: { bsonType: 'array', maxItems: 5, items: { bsonType: 'string' } },
                fechaVisita: { bsonType: 'date', description: 'Inicio de la reserva reseñada' },
                fecha: { bsonType: 'date', description: 'Fecha de la reseña' },
                respuesta: {
                    bsonType: 'object',
                    required: ['texto', 'fecha'],
                    description: 'Respuesta opcional del restaurante',
                    properties: { texto: { bsonType: 'string' }, fecha: { bsonType: 'date' } }
                }
            }
        }
    }
};

/* ---------- Colecciones ---------- */
const existentes = base.getCollectionNames();

for (const [nombre, validator] of Object.entries(esquemas)) {
    const opciones = { validator, validationLevel: 'strict', validationAction: 'error' };
    if (existentes.includes(nombre)) {
        base.runCommand({ collMod: nombre, ...opciones });
        print(`Colección "${nombre}": validador actualizado`);
    } else {
        base.createCollection(nombre, opciones);
        print(`Colección "${nombre}": creada`);
    }
}

/* ---------- Índices de logs ---------- */
// TTL: MongoDB borra automáticamente los logs con más de DIAS_RETENCION_LOGS días.
const segundosRetencion = DIAS_RETENCION_LOGS * 24 * 60 * 60;
const indiceTtl = base.logs.getIndexes().find((indice) => indice.name === 'ttl_fecha');
if (indiceTtl && indiceTtl.expireAfterSeconds !== segundosRetencion) {
    base.runCommand({ collMod: 'logs', index: { name: 'ttl_fecha', expireAfterSeconds: segundosRetencion } });
} else if (!indiceTtl) {
    base.logs.createIndex({ fecha: 1 }, { name: 'ttl_fecha', expireAfterSeconds: segundosRetencion });
}

// Filtrar por tipo o por nivel, del más reciente al más antiguo (GET /logs?tipo=&nivel=).
base.logs.createIndex({ tipo: 1, fecha: -1 }, { name: 'tipo_fecha' });
base.logs.createIndex({ nivel: 1, fecha: -1 }, { name: 'nivel_fecha' });

// Correlación: todos los eventos (petición, auditoría, error) de una misma petición HTTP.
base.logs.createIndex({ 'datos.idPeticion': 1 }, { name: 'id_peticion', sparse: true });

/* ---------- Índices de comentarios ---------- */
// Una sola reseña por reserva (regla de negocio garantizada por la base).
base.comentarios.createIndex({ idReserva: 1 }, { name: 'ux_reserva', unique: true });

// Reseñas de una mesa o de un cliente, más recientes primero.
base.comentarios.createIndex({ 'mesa.idMesa': 1, fecha: -1 }, { name: 'mesa_fecha' });
base.comentarios.createIndex({ 'autor.idUsuario': 1, fecha: -1 }, { name: 'autor_fecha' });

// Búsqueda de texto en español (GET /comentarios?buscar=ceviche).
base.comentarios.createIndex(
    { texto: 'text', etiquetas: 'text' },
    { name: 'texto_busqueda', default_language: 'spanish', weights: { etiquetas: 2, texto: 1 } }
);

/* ---------- Verificación ---------- */
print(`\nBase "${NOMBRE_BASE}" lista.`);
for (const nombre of Object.keys(esquemas)) {
    print(`  ${nombre}: ${base[nombre].getIndexes().map((indice) => indice.name).join(', ')}`);
}
