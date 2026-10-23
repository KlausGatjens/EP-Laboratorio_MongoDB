# MongoDB — Logs del sistema

Este repositorio usa Node.js y el driver oficial de MongoDB. Solo crea la colección `logs`.
Requiere Node.js 20.6 o superior y MongoDB local o Atlas.

## Inicializar

Dentro de esta carpeta:

```powershell
npm install
Copy-Item .env.example .env
# Editar .env con la conexión de MongoDB.
npm run inicializar
```

Las variables son `MONGO_URI` y `MONGO_DATABASE`; por defecto los ejemplos usan `RestauranteLogs`.
Usar los mismos valores en el `.env` del backend.

`inicializar.js` conecta, verifica la conexión, ejecuta `esquemas.js` y `carga_inicial.js`, y cierra
la conexión incluso si ocurre un error. No necesita tener el backend iniciado.

El esquema se actualiza si logs ya existe. Al repetir la carga, solo se reemplazan los ejemplos
marcados con `datos.origen: 'carga-inicial'`; se conservan los logs reales. No elimina otras colecciones existentes.

## Esquema flexible y BSON

Todos los eventos tienen `tipo`, `nivel`, `fecha` y `datos`. `datos` admite campos distintos según el evento:

```js
{ tipo: 'peticion', nivel: 'info', fecha: new Date(),
  datos: { metodo: 'POST', ruta: '/api/v1/reservas', estado: 201 } }

{ tipo: 'error', nivel: 'warn', fecha: new Date(),
  datos: { estado: 400, mensaje: 'Faltan datos de la reserva' } }

{ tipo: 'sistema', nivel: 'info', fecha: new Date(),
  datos: { mensaje: 'Servidor iniciado', puerto: 3000 } }
```

El driver guarda los documentos como BSON, incluyendo `fecha` como una fecha nativa y `_id` como ObjectId.
No se restringe `tipo` a una lista cerrada, por lo que se pueden agregar nuevos eventos sin cambiar el esquema.
No hay comentarios, calificaciones, estadísticas ni eliminación automática de logs.

## Consultar y probar

En MongoDB Compass, abrir `RestauranteLogs` y la colección `logs`. También se puede consultar mediante
`GET http://localhost:3000/api/v1/logs` cuando la API está iniciada.

`npm test` comprueba el inicializador con una conexión simulada: creación y actualización del esquema,
repetición de la carga sin perder logs reales, fechas BSON y cierre ante errores. No modifica una base real.
