// ---------------------------------------------------------------
// FÍSICA DEL JUEGO
// Aquí pusimos puras funciones de cálculo (sin tocar la página),
// así las podemos probar por separado con "npm test".
//
// La fórmula base es la de velocidad constante:
//      tiempo = distancia / velocidad
// ---------------------------------------------------------------

// Distancia entre dos puntos con el teorema de Pitágoras.
export function distancia(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Esta función la usamos para que un valor no se salga de un rango
// (por ejemplo, que el punto elegido no se salga de la línea).
export function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}

// Punto intermedio entre "a" y "b". Con f = 0 da "a", con f = 1 da "b".
export function interpolar(a, b, f) {
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
  };
}

// Aquí calculamos toda la ruta de un jugador a partir de la "x" que escogió.
// La ruta tiene dos tramos:
//   tramo 1: de la salida al punto elegido sobre la línea
//   tramo 2: del punto elegido a la meta
// Cada tramo puede tener su propia velocidad (en la playa cambia al entrar al mar).
export function calcularRuta(escenario, x) {
  const punto = { x, y: escenario.lineaY };

  const d1 = distancia(escenario.inicio, punto);
  const d2 = distancia(punto, escenario.meta);

  const t1 = d1 / escenario.velocidad1;
  const t2 = d2 / escenario.velocidad2;

  return {
    punto,
    d1,
    d2,
    t1,
    t2,
    distanciaTotal: d1 + d2,
    tiempoTotal: t1 + t2,
  };
}

// Aquí puse esta función para saber dónde va el jugador en el segundo "t".
// Como la velocidad es constante en cada tramo, la posición avanza de forma
// lineal con el tiempo: fracción recorrida = tiempo transcurrido / tiempo del tramo.
export function posicionEnTiempo(escenario, ruta, t) {
  if (t <= 0) return { ...escenario.inicio };
  if (t >= ruta.tiempoTotal) return { ...escenario.meta };

  if (t <= ruta.t1) {
    return interpolar(escenario.inicio, ruta.punto, t / ruta.t1);
  }
  return interpolar(ruta.punto, escenario.meta, (t - ruta.t1) / ruta.t2);
}

// Lo mismo pero midiendo por distancia recorrida en vez de tiempo.
// Devuelve la lista de puntos de la línea ya dibujada (la usamos para
// ir "pintando" la ruta óptima poco a poco).
export function puntosHastaDistancia(escenario, ruta, d) {
  const recorrida = limitar(d, 0, ruta.distanciaTotal);

  if (recorrida <= ruta.d1) {
    return [escenario.inicio, interpolar(escenario.inicio, ruta.punto, recorrida / ruta.d1)];
  }
  return [
    escenario.inicio,
    ruta.punto,
    interpolar(ruta.punto, escenario.meta, (recorrida - ruta.d1) / ruta.d2),
  ];
}

// Busca el punto de la línea con el que se tarda MENOS.
// El tiempo en función de x tiene forma de "U" (un solo mínimo), entonces
// usamos búsqueda ternaria: partimos el rango en tres y vamos descartando
// el tercio donde seguro no está el mínimo, hasta encerrarlo.
//
// Dato curioso: en la cancha esto coincide con "reflejar" la meta en la línea
// de fondo y trazar una recta, y en la playa coincide con la ley de Snell
// (la misma que sigue la luz cuando pasa del aire al agua).
export function puntoOptimo(escenario) {
  let izquierda = escenario.xMin;
  let derecha = escenario.xMax;

  for (let i = 0; i < 100; i++) {
    const m1 = izquierda + (derecha - izquierda) / 3;
    const m2 = derecha - (derecha - izquierda) / 3;

    if (calcularRuta(escenario, m1).tiempoTotal < calcularRuta(escenario, m2).tiempoTotal) {
      derecha = m2;
    } else {
      izquierda = m1;
    }
  }

  const x = (izquierda + derecha) / 2;
  return { x, ruta: calcularRuta(escenario, x) };
}

// Decide quién ganó comparando los tiempos.
// Regresa 1 o 2 (el jugador ganador) o 0 si fue empate.
// La tolerancia es porque en pantalla solo mostramos 2 decimales:
// si la diferencia ni se alcanza a ver, lo contamos como empate.
export function decidirGanador(tiempo1, tiempo2, tolerancia = 0.005) {
  if (Math.abs(tiempo1 - tiempo2) < tolerancia) return 0;
  return tiempo1 < tiempo2 ? 1 : 2;
}
