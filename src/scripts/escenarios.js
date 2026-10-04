// ---------------------------------------------------------------
// ESCENARIOS
// Aquí guardamos los datos de cada juego (medidas, punto de salida,
// meta, velocidades...). Lo separamos del resto del código para que
// los dos juegos usen exactamente el mismo motor y solo cambien
// estos números.
//
// Todas las medidas están en METROS y las velocidades en m/s.
// El origen (0, 0) es la esquina superior izquierda y la "y" crece
// hacia abajo, igual que en la pantalla.
// ---------------------------------------------------------------

// Juego 1: la cancha de fútbol (medidas oficiales 105 x 68 m).
// Los jugadores salen de la esquina superior izquierda, tocan un punto
// de la línea de fondo (la de abajo) y luego van al centro.
export const CANCHA = {
  id: 'cancha',
  ancho: 105,
  alto: 68,
  inicio: { x: 0, y: 0 },
  meta: { x: 52.5, y: 34 },

  // La línea donde se escoge el punto es la de abajo (y = 68)
  lineaY: 68,
  xMin: 0,
  xMax: 105,

  // Como aquí la velocidad es constante, los dos tramos van igual
  velocidad1: 8,
  velocidad2: 8,

  // Cuántas veces más rápido se reproduce la animación.
  // (Si no, habría que esperar como 15 segundos reales por carrera.)
  aceleracion: 3,

  tramos: ['→ Línea', '→ Centro'],
  verbos: ['Va a la línea', 'Va al centro'],
  nombreLinea: 'la línea de fondo',
  agua: false,

  // Controles de velocidad que aparecen en el panel.
  // "claves" dice qué velocidades cambia cada control: aquí uno solo
  // mueve las dos porque la velocidad es la misma en toda la cancha.
  controles: [
    {
      etiqueta: 'Velocidad de los jugadores',
      claves: ['velocidad1', 'velocidad2'],
      min: 4,
      max: 10,
      paso: 0.5,
    },
  ],
};

// Juego 2: la playa y el mar.
// Arriba está la arena (se corre rápido) y abajo el mar (se nada lento).
// El punto se escoge sobre la orilla, que es la línea que los divide.
export const PLAYA = {
  id: 'playa',
  ancho: 100,
  alto: 60,
  inicio: { x: 6, y: 5 },
  meta: { x: 84, y: 51 },

  // La orilla queda justo a la mitad (y = 30)
  lineaY: 30,
  xMin: 0,
  xMax: 100,

  velocidad1: 7, // corriendo en la arena
  velocidad2: 2, // nadando en el mar

  aceleracion: 4,

  tramos: ['Arena', 'Mar'],
  verbos: ['Corriendo', 'Nadando'],
  nombreLinea: 'la orilla',
  agua: true,

  controles: [
    { etiqueta: 'Velocidad en la arena', claves: ['velocidad1'], min: 4, max: 10, paso: 0.5 },
    { etiqueta: 'Velocidad en el mar', claves: ['velocidad2'], min: 1, max: 3.5, paso: 0.5 },
  ],
};
