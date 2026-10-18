/* =============================================================================
   RESTAURANTE SAZÓN CRIOLLA · Sistema de Reservas de Mesas
   MongoDB · Consultas de ejemplo (para la demostración)
   -----------------------------------------------------------------------------
   Requiere: esquemas.js y carga_inicial.js.
   Ejecutar con:
     mongosh "mongodb://127.0.0.1:27017" consultas_ejemplo.js
   ============================================================================= */

const base = db.getSiblingDB('RestauranteLogs');

const titulo = (texto) => print(`\n=== ${texto} ===`);

titulo('1. Últimos 5 eventos del sistema (índice ttl_fecha)');
printjson(base.logs.find({}, { _id: 0, tipo: 1, nivel: 1, fecha: 1 }).sort({ fecha: -1 }).limit(5).toArray());

titulo('2. Esquema flexible: un documento de cada tipo, cada uno con distinta forma en "datos"');
for (const tipo of base.logs.distinct('tipo')) {
    printjson(base.logs.findOne({ tipo }, { _id: 0, tipo: 1, datos: 1 }));
}

titulo('3. Todos los eventos de una misma petición HTTP (índice id_peticion)');
printjson(base.logs.find({ 'datos.idPeticion': 'demo-0002' }, { _id: 0, tipo: 1, nivel: 1, datos: 1 }).toArray());

titulo('4. Cantidad de eventos por tipo y nivel (aggregate)');
printjson(base.logs.aggregate([
    { $group: { _id: { tipo: '$tipo', nivel: '$nivel' }, cantidad: { $sum: 1 } } },
    { $project: { _id: 0, tipo: '$_id.tipo', nivel: '$_id.nivel', cantidad: 1 } },
    { $sort: { cantidad: -1 } }
]).toArray());

titulo('5. Reseñas de la mesa 103 (idMesa 3), más recientes primero (índice mesa_fecha)');
printjson(base.comentarios.find({ 'mesa.idMesa': 3 }, { _id: 0, autor: 1, calificacion: 1, texto: 1 })
    .sort({ fecha: -1 }).toArray());

titulo('6. Búsqueda de texto en español: "ceviche" (índice texto_busqueda)');
printjson(base.comentarios.find({ $text: { $search: 'ceviche' } }, { _id: 0, texto: 1, etiquetas: 1 }).toArray());

titulo('7. Promedio de calificación por zona y por aspecto (aggregate)');
printjson(base.comentarios.aggregate([
    {
        $group: {
            _id: '$mesa.zona',
            resenas: { $sum: 1 },
            general: { $avg: '$calificacion' },
            comida: { $avg: '$aspectos.comida' },
            servicio: { $avg: '$aspectos.servicio' },
            ambiente: { $avg: '$aspectos.ambiente' }
        }
    },
    {
        $project: {
            _id: 0,
            zona: '$_id',
            resenas: 1,
            general: { $round: ['$general', 2] },
            comida: { $round: ['$comida', 2] },
            servicio: { $round: ['$servicio', 2] },
            ambiente: { $round: ['$ambiente', 2] }
        }
    },
    { $sort: { general: -1 } }
]).toArray());

titulo('8. El validador $jsonSchema rechaza documentos inválidos (calificación 9)');
try {
    base.comentarios.insertOne({
        idReserva: 999, mesa: { idMesa: 1, numero: 101, zona: 'Salón principal' },
        autor: { idUsuario: 1, nombre: 'Prueba' }, calificacion: 9, texto: 'x', fecha: new Date()
    });
} catch (error) {
    print(`Rechazado: ${error.message.split('\n')[0]}`);
}

titulo('9. El índice único ux_reserva impide dos reseñas para la misma reserva');
try {
    base.comentarios.insertOne({
        idReserva: 1, mesa: { idMesa: 3, numero: 103, zona: 'Salón principal' },
        autor: { idUsuario: 1, nombre: 'Lucía Ramos Quispe' }, calificacion: 4, texto: 'Otra vez', fecha: new Date()
    });
} catch (error) {
    print(`Rechazado: ${error.message.split('\n')[0]}`);
}
