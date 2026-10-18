/* =============================================================================
   RESTAURANTE SAZÓN CRIOLLA · Sistema de Reservas de Mesas
   MongoDB · Carga inicial (insertMany)
   -----------------------------------------------------------------------------
   Requiere: esquemas.js (validadores e índices).
   Ejecutar con:
     mongosh "mongodb://127.0.0.1:27017" carga_inicial.js

   Las reseñas hacen referencia a las reservas PASADAS 1 a 5 de la carga inicial
   de SQL Server (repositorio EP-Laboratorio_BBDD, DML/05_carga_inicial.sql).
   La reserva 6 queda sin reseña a propósito, para probar POST /comentarios.

   Re-ejecutable: borra solo los documentos de esta carga y los vuelve a insertar.
   ============================================================================= */

const NOMBRE_BASE = 'RestauranteLogs';
const base = db.getSiblingDB(NOMBRE_BASE);

/* ---------- Fechas relativas al día de hoy (igual que en SQL Server) ---------- */
const MS_HORA = 60 * 60 * 1000;
const MS_DIA = 24 * MS_HORA;
const DESFASE_LIMA = 5 * MS_HORA; // Lima = UTC-5

const hoyLima = new Date(Date.now() - DESFASE_LIMA);
hoyLima.setUTCHours(0, 0, 0, 0);

/** Fecha en UTC para un día relativo a hoy y una hora de Lima. */
const enLima = (dia, hora) => new Date(hoyLima.getTime() + dia * MS_DIA + hora * MS_HORA + DESFASE_LIMA);

/* ---------- Comentarios (reseñas de visitas) ----------
   Los documentos no tienen todos la misma forma: algunos califican cada aspecto,
   otros solo una parte, y uno tiene la respuesta del restaurante. */
const comentarios = [
    {
        idReserva: 1,
        mesa: { idMesa: 3, numero: 103, zona: 'Salón principal' },
        autor: { idUsuario: 1, nombre: 'Lucía Ramos Quispe' },
        calificacion: 5,
        aspectos: { comida: 5, servicio: 5, ambiente: 4 },
        texto: 'El ceviche clásico estuvo espectacular y la atención fue muy rápida. Volveremos con toda la familia.',
        etiquetas: ['ceviche', 'familiar'],
        fechaVisita: enLima(-10, 13),
        fecha: enLima(-10, 16),
        respuesta: { texto: '¡Gracias, Lucía! Los esperamos pronto en Sazón Criolla.', fecha: enLima(-9, 10) }
    },
    {
        idReserva: 2,
        mesa: { idMesa: 9, numero: 301, zona: 'Zona VIP' },
        autor: { idUsuario: 2, nombre: 'Carlos Mendoza Flores' },
        calificacion: 4,
        aspectos: { comida: 5, servicio: 4, ambiente: 4 },
        texto: 'Celebramos un cumpleaños en la zona VIP. El lomo saltado, excelente; el postre tardó un poco.',
        etiquetas: ['cumpleaños', 'lomo saltado'],
        fechaVisita: enLima(-7, 20),
        fecha: enLima(-6, 9)
    },
    {
        idReserva: 3,
        mesa: { idMesa: 6, numero: 201, zona: 'Terraza' },
        autor: { idUsuario: 3, nombre: 'Valeria Torres Huamán' },
        calificacion: 3,
        texto: 'La terraza es bonita, pero en la noche hizo frío. Sería bueno tener calefactores.',
        etiquetas: ['terraza'],
        fechaVisita: enLima(-5, 19),
        fecha: enLima(-5, 22)
    },
    {
        idReserva: 4,
        mesa: { idMesa: 11, numero: 401, zona: 'Barra' },
        autor: { idUsuario: 4, nombre: 'Diego Salazar Rojas' },
        calificacion: 5,
        aspectos: { servicio: 5, ambiente: 5 },
        texto: 'Los chilcanos de la barra son los mejores de la zona y el bartender, muy amable.',
        etiquetas: ['pisco', 'cócteles'],
        fechaVisita: enLima(-3, 21),
        fecha: enLima(-2, 11)
    },
    {
        idReserva: 5,
        mesa: { idMesa: 1, numero: 101, zona: 'Salón principal' },
        autor: { idUsuario: 5, nombre: 'Camila Vargas Chávez' },
        calificacion: 2,
        aspectos: { comida: 3, servicio: 2 },
        texto: 'Esperamos 40 minutos por el arroz con mariscos. El sabor estuvo bien, pero la demora fue mucha.',
        etiquetas: ['demora', 'arroz con mariscos'],
        fechaVisita: enLima(-2, 13),
        fecha: enLima(-2, 16)
    }
];

/* ---------- Logs: la misma colección guarda eventos con distinta forma ---------- */
const ORIGEN = 'carga-inicial';
const logs = [
    {
        tipo: 'sistema', nivel: 'info', fecha: enLima(-1, 8),
        datos: { origen: ORIGEN, mensaje: 'Servidor iniciado', puerto: 3000, entorno: 'development' }
    },
    {
        tipo: 'peticion', nivel: 'info', fecha: enLima(-1, 9),
        datos: {
            origen: ORIGEN, idPeticion: 'demo-0001', metodo: 'POST', ruta: '/api/v1/reservas',
            estado: 201, duracionMs: 23.4, ip: '127.0.0.1', agente: 'vscode-restclient'
        }
    },
    {
        tipo: 'auditoria', nivel: 'info', fecha: enLima(-1, 9),
        datos: {
            origen: ORIGEN, idPeticion: 'demo-0001', accion: 'crear', entidad: 'reserva', id: '7',
            cambios: { idMesa: 3, idUsuario: 7, numeroPersonas: 4 }
        }
    },
    {
        tipo: 'peticion', nivel: 'warn', fecha: enLima(-1, 10),
        datos: {
            origen: ORIGEN, idPeticion: 'demo-0002', metodo: 'POST', ruta: '/api/v1/reservas',
            estado: 409, duracionMs: 15.8, ip: '127.0.0.1', agente: 'PostmanRuntime/7.43.0'
        }
    },
    {
        tipo: 'error', nivel: 'warn', fecha: enLima(-1, 10),
        datos: {
            origen: ORIGEN, idPeticion: 'demo-0002', metodo: 'POST', ruta: '/api/v1/reservas',
            estado: 409, mensaje: 'La mesa ya está reservada en ese horario'
        }
    },
    {
        tipo: 'auditoria', nivel: 'info', fecha: enLima(-1, 11),
        datos: {
            origen: ORIGEN, idPeticion: 'demo-0003', accion: 'crear', entidad: 'comentario',
            id: 'reseña-reserva-5', cambios: { idReserva: 5, calificacion: 2 }
        }
    },
    {
        tipo: 'sistema', nivel: 'info', fecha: enLima(-1, 23),
        datos: { origen: ORIGEN, mensaje: 'Servidor detenido', senal: 'SIGINT' }
    }
];

/* ---------- Limpieza y carga ---------- */
const idsReservas = comentarios.map((comentario) => comentario.idReserva);
base.comentarios.deleteMany({ idReserva: { $in: idsReservas } });
base.logs.deleteMany({ 'datos.origen': ORIGEN });

const resultadoComentarios = base.comentarios.insertMany(comentarios);
const resultadoLogs = base.logs.insertMany(logs);

/* ---------- Verificación ---------- */
print(`Comentarios insertados: ${Object.keys(resultadoComentarios.insertedIds).length}`);
print(`Logs insertados: ${Object.keys(resultadoLogs.insertedIds).length}`);
print(`Total en "${NOMBRE_BASE}": ${base.comentarios.countDocuments()} comentarios, ${base.logs.countDocuments()} logs`);
