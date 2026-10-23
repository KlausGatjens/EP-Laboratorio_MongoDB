export const cargarDatosIniciales = async (base) => {
    // Solo reemplaza sus propios ejemplos; conserva los logs reales de la API.
    const origen = 'carga-inicial';
    const eventos = [
        { tipo: 'sistema', nivel: 'info', datos: { origen, mensaje: 'Base inicializada' } },
        { tipo: 'peticion', nivel: 'info', datos: { origen, metodo: 'GET', ruta: '/api/v1/mesas', estado: 200 } },
        { tipo: 'error', nivel: 'warn', datos: { origen, estado: 400, mensaje: 'Faltan datos de la reserva' } }
    ];
    const logs = base.collection('logs');
    await logs.deleteMany({ 'datos.origen': origen });
    await logs.insertMany(eventos.map((evento) => ({ ...evento, fecha: new Date() })));
};
