# EP-Laboratorio_MongoDB · Base de datos MongoDB

Repositorio **3 de 3** del sistema de reservas del **Restaurante Sazón Criolla**. Contiene los scripts de
MongoDB: los **esquemas** (colecciones, validadores e índices) y la **carga inicial** (`insertMany`).

| Repositorio | Contenido |
| --- | --- |
| [EP-Laboratorio_Backend](https://github.com/KlausGatjens/EP-Laboratorio_Backend) | API REST con Node.js + Express |
| [EP-Laboratorio_BBDD](https://github.com/KlausGatjens/EP-Laboratorio_BBDD) | SQL Server: tablas, índices, vistas, procedimientos almacenados y datos |
| **EP-Laboratorio_MongoDB** (este) | MongoDB: esquemas de logs y comentarios y su carga inicial |

> Evaluación Parcial · Desarrollo Web Full Stack Backend · Universidad Autónoma del Perú

---

## ¿Por qué MongoDB además de SQL Server?

| SQL Server (repositorio BBDD) | MongoDB (este repositorio) |
| --- | --- |
| Datos transaccionales: mesas, clientes, reservas | Histórico de actividad (logs) y reseñas |
| Estructura fija, normalizada (3FN) | **Esquema flexible**: cada documento puede tener una forma distinta |
| Integridad referencial y transacciones (ACID) | Escritura rápida y de gran volumen sin bloquear las tablas de reservas |
| Un cambio de estructura requiere `ALTER TABLE` | Un tipo de evento nuevo **no requiere migración** |

## Estructura del repositorio

```text
EP-Laboratorio_MongoDB/
├── esquemas.js           # Archivo de esquemas: colecciones, validadores $jsonSchema e índices
├── carga_inicial.js      # Carga inicial con insertMany (comentarios y logs)
├── consultas_ejemplo.js  # Consultas para la demostración (find, aggregate, $text)
└── README.md
```

## Ejecución

### Requisitos

- MongoDB 6 o 7 (local con MongoDB Compass o un clúster de MongoDB Atlas).
- `mongosh` (MongoDB Shell). También viene integrado en MongoDB Compass (pestaña **_MONGOSH**).

### Pasos

```bash
mongosh "mongodb://127.0.0.1:27017" esquemas.js
mongosh "mongodb://127.0.0.1:27017" carga_inicial.js
mongosh "mongodb://127.0.0.1:27017" consultas_ejemplo.js   # opcional, para la demo
```

Con MongoDB Atlas, reemplazar la URI por `mongodb+srv://usuario:clave@cluster.xxxxx.mongodb.net`.

**Desde MongoDB Compass:** conectarse, abrir la pestaña **_MONGOSH** y escribir
`load("C:/ruta/al/repositorio/esquemas.js")`, y luego lo mismo con `carga_inicial.js`.

Los scripts son **re-ejecutables**: `esquemas.js` actualiza el validador si la colección ya existe y
`carga_inicial.js` borra solo sus propios documentos antes de volver a insertarlos.

## Base `RestauranteLogs`

### Colección `logs`: actividad del sistema (esquema flexible)

Todos los documentos tienen `tipo`, `nivel` y `fecha` (los valida `$jsonSchema`). El subdocumento **`datos` es
libre**: cada tipo de evento guarda su propia estructura en BSON.

```js
// Petición HTTP (la registra el middleware de logging de la API)
{ tipo: 'peticion', nivel: 'info', fecha: ISODate('...'),
  datos: { idPeticion: 'c2f1...', metodo: 'POST', ruta: '/api/v1/reservas', estado: 201,
           duracionMs: 23.4, ip: '127.0.0.1', agente: 'vscode-restclient' } }

// Auditoría: qué se cambió (la registran los controladores)
{ tipo: 'auditoria', nivel: 'info', fecha: ISODate('...'),
  datos: { idPeticion: 'c2f1...', accion: 'crear', entidad: 'reserva', id: '11',
           cambios: { idMesa: 3, idUsuario: 7, numeroPersonas: 4 } } }

// Error (lo registra el manejador global de errores)
{ tipo: 'error', nivel: 'warn', fecha: ISODate('...'),
  datos: { idPeticion: '9a7b...', ruta: '/api/v1/reservas', estado: 409,
           mensaje: 'La mesa ya está reservada en ese horario' } }

// Sistema: arranque y apagado del servidor
{ tipo: 'sistema', nivel: 'info', fecha: ISODate('...'),
  datos: { mensaje: 'Servidor iniciado', puerto: 3000, entorno: 'development' } }
```

El `idPeticion` también se envía en la cabecera HTTP `X-Request-Id`. Con él se pueden **correlacionar** la
petición, su auditoría y su error.

### Colección `comentarios`: reseñas de las visitas

Un cliente puede dejar **una reseña por reserva**, y solo cuando la visita ya terminó (la API lo verifica
consultando SQL Server).

```js
{
  _id: ObjectId('...'),
  idReserva: 1,                                                   // referencia a SQL Server
  mesa:  { idMesa: 3, numero: 103, zona: 'Salón principal' },     // embebido
  autor: { idUsuario: 1, nombre: 'Lucía Ramos Quispe' },          // embebido
  calificacion: 5,
  aspectos: { comida: 5, servicio: 5, ambiente: 4 },              // opcional
  texto: 'El ceviche clásico estuvo espectacular...',
  etiquetas: ['ceviche', 'familiar'],                             // opcional
  fechaVisita: ISODate('...'),
  fecha: ISODate('...'),
  respuesta: { texto: '¡Gracias, Lucía!...', fecha: ISODate('...') }  // opcional
}
```

**Desnormalización intencional:** los datos de la mesa y del autor se copian dentro del documento. Así las
reseñas se listan sin consultar SQL Server, y se conserva cómo eran al momento de la visita.

### Validadores `$jsonSchema`

| Colección | Campos obligatorios | Reglas |
| --- | --- | --- |
| logs | `tipo`, `nivel`, `fecha` | `nivel` ∈ {info, warn, error}; `fecha` de tipo `date`; `datos` es un objeto libre |
| comentarios | `idReserva`, `mesa`, `autor`, `calificacion`, `texto`, `fecha` | Calificaciones enteras de 1 a 5; `texto` de 1 a 500 caracteres; máximo 5 etiquetas; `aspectos` solo admite comida, servicio y ambiente |

### Índices (diseño óptimo)

| Colección | Índice | Propósito |
| --- | --- | --- |
| logs | `ttl_fecha` `{ fecha: 1 }` **TTL 90 días** | MongoDB borra automáticamente los logs antiguos |
| logs | `tipo_fecha` `{ tipo: 1, fecha: -1 }` | Filtrar por tipo, más recientes primero |
| logs | `nivel_fecha` `{ nivel: 1, fecha: -1 }` | Ver errores y advertencias recientes |
| logs | `id_peticion` `{ 'datos.idPeticion': 1 }` | Correlacionar los eventos de una petición |
| comentarios | `ux_reserva` `{ idReserva: 1 }` **único** | Una sola reseña por reserva |
| comentarios | `mesa_fecha` `{ 'mesa.idMesa': 1, fecha: -1 }` | Reseñas de una mesa |
| comentarios | `autor_fecha` `{ 'autor.idUsuario': 1, fecha: -1 }` | Reseñas de un cliente |
| comentarios | `texto_busqueda` (texto, español) | Buscar palabras en las reseñas (`ceviche`, `terraza`...) |

## Carga inicial

| Colección | Documentos | Detalle |
| --- | --- | --- |
| comentarios | 5 | Reseñas de las reservas pasadas 1 a 5 de SQL Server, con formas distintas (con o sin `aspectos`, `respuesta`) |
| logs | 7 | Eventos de los cuatro tipos; los de `demo-0001` y `demo-0002` muestran la correlación por petición |

La **reserva 6** de SQL Server (pasada) queda **sin reseña** a propósito, para probar `POST /comentarios`
desde la API.
