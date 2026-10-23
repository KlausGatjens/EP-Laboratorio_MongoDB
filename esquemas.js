// Solo se valida la parte común. Cada tipo de evento puede tener datos distintos.
export const crearEsquemas = async (base) => {
    const opciones = {
        validator: { $jsonSchema: {
            bsonType: 'object', required: ['tipo', 'nivel', 'fecha', 'datos'],
            properties: {
                tipo: { bsonType: 'string', minLength: 1 },
                nivel: { enum: ['info', 'warn', 'error'] },
                fecha: { bsonType: 'date' },
                datos: { bsonType: 'object' }
            }
        } },
        validationLevel: 'strict', validationAction: 'error'
    };
    const existentes = await base.listCollections({ name: 'logs' }).toArray();
    if (existentes.length) await base.command({ collMod: 'logs', ...opciones });
    else await base.createCollection('logs', opciones);
};
