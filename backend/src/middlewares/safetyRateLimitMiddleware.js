const VENTANA_MS = 15 * 60 * 1000;
const MAXIMO_SOLICITUDES = 10;

const solicitudesPorUsuario = new Map();

const limpiarVentanasVencidas = (ahora) => {
  for (const [idUsuario, registro] of solicitudesPorUsuario) {
    if (registro.reinicio <= ahora) {
      solicitudesPorUsuario.delete(idUsuario);
    }
  }
};

const limitarCreacionHallazgos = (req, res, next) => {
  const idUsuario = req.usuario?.id_usuario;

  if (!idUsuario) {
    return res.status(401).json({
      mensaje: 'No se pudo identificar al usuario autenticado'
    });
  }

  const ahora = Date.now();

  if (solicitudesPorUsuario.size > 1000) {
    limpiarVentanasVencidas(ahora);
  }

  let registro = solicitudesPorUsuario.get(idUsuario);

  if (!registro || registro.reinicio <= ahora) {
    registro = {
      cantidad: 0,
      reinicio: ahora + VENTANA_MS
    };
  }

  const segundosRestantes = Math.max(
    1,
    Math.ceil((registro.reinicio - ahora) / 1000)
  );

  res.setHeader('RateLimit-Limit', MAXIMO_SOLICITUDES);
  res.setHeader(
    'RateLimit-Remaining',
    Math.max(0, MAXIMO_SOLICITUDES - registro.cantidad - 1)
  );
  res.setHeader('RateLimit-Reset', segundosRestantes);

  if (registro.cantidad >= MAXIMO_SOLICITUDES) {
    res.setHeader('Retry-After', segundosRestantes);

    return res.status(429).json({
      mensaje:
        'Has alcanzado el límite de hallazgos Safety. Intenta nuevamente más tarde',
      reintentar_en_segundos: segundosRestantes
    });
  }

  registro.cantidad += 1;
  solicitudesPorUsuario.set(idUsuario, registro);

  return next();
};

module.exports = limitarCreacionHallazgos;
