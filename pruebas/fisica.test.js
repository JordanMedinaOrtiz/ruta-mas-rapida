// ---------------------------------------------------------------
// PRUEBAS DE LA FÍSICA
// Se corren con:  npm test
// Las hicimos para estar seguros de que los cálculos están bien
// antes de confiar en lo que se ve en la animación.
// ---------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CANCHA, PLAYA } from '../src/scripts/escenarios.js';
import {
  distancia,
  limitar,
  calcularRuta,
  posicionEnTiempo,
  puntosHastaDistancia,
  puntoOptimo,
  decidirGanador,
} from '../src/scripts/fisica.js';

// Para comparar decimales sin que falle por redondeos
function casiIgual(real, esperado, margen = 1e-6) {
  assert.ok(
    Math.abs(real - esperado) <= margen,
    `se esperaba ${esperado} y salió ${real} (margen ${margen})`,
  );
}

test('distancia: triángulo 3-4-5', () => {
  casiIgual(distancia({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('limitar: no deja salirse del rango', () => {
  assert.equal(limitar(-5, 0, 105), 0);
  assert.equal(limitar(200, 0, 105), 105);
  assert.equal(limitar(40, 0, 105), 40);
});

test('cancha: tiempo = distancia / velocidad', () => {
  const ruta = calcularRuta(CANCHA, 35);
  // Con x = 35 los dos tramos quedan en línea recta con la meta reflejada,
  // así que la distancia total es la hipotenusa de 52.5 y 102.
  casiIgual(ruta.distanciaTotal, Math.hypot(52.5, 102));
  casiIgual(ruta.tiempoTotal, Math.hypot(52.5, 102) / 8);
  casiIgual(ruta.t1 + ruta.t2, ruta.tiempoTotal);
});

test('cancha: el punto óptimo es x = 35 m (método de la reflexión)', () => {
  const optimo = puntoOptimo(CANCHA);
  casiIgual(optimo.x, 35, 1e-4);
});

test('cancha: cambiar la velocidad no mueve el punto óptimo, solo el tiempo', () => {
  const lento = puntoOptimo({ ...CANCHA, velocidad1: 4, velocidad2: 4 });
  const rapido = puntoOptimo({ ...CANCHA, velocidad1: 10, velocidad2: 10 });
  casiIgual(lento.x, rapido.x, 1e-4);
  casiIgual(lento.ruta.tiempoTotal, rapido.ruta.tiempoTotal * 2.5, 1e-6);
});

test('playa: el punto óptimo cumple la ley de Snell', () => {
  const { x, ruta } = puntoOptimo(PLAYA);
  // seno del ángulo de cada tramo respecto a la perpendicular a la orilla
  const seno1 = (x - PLAYA.inicio.x) / ruta.d1;
  const seno2 = (PLAYA.meta.x - x) / ruta.d2;
  casiIgual(seno1 / PLAYA.velocidad1, seno2 / PLAYA.velocidad2, 1e-5);
});

test('playa: conviene correr más por la arena que irse en línea recta', () => {
  const optimo = puntoOptimo(PLAYA);
  // x donde la recta salida-meta cruza la orilla
  const f = (PLAYA.lineaY - PLAYA.inicio.y) / (PLAYA.meta.y - PLAYA.inicio.y);
  const xRecta = PLAYA.inicio.x + (PLAYA.meta.x - PLAYA.inicio.x) * f;

  assert.ok(optimo.x > xRecta, 'el óptimo debe quedar más cerca de la meta que la recta');
  assert.ok(optimo.ruta.tiempoTotal < calcularRuta(PLAYA, xRecta).tiempoTotal);
});

test('playa: si se nada igual de rápido que se corre, lo mejor es la línea recta', () => {
  const mismaVelocidad = { ...PLAYA, velocidad1: 5, velocidad2: 5 };
  const optimo = puntoOptimo(mismaVelocidad);
  casiIgual(optimo.ruta.distanciaTotal, distancia(PLAYA.inicio, PLAYA.meta), 1e-6);
});

test('ningún otro punto de la línea le gana al óptimo', () => {
  for (const escenario of [CANCHA, PLAYA]) {
    const mejor = puntoOptimo(escenario).ruta.tiempoTotal;
    for (let x = escenario.xMin; x <= escenario.xMax; x += 0.1) {
      assert.ok(calcularRuta(escenario, x).tiempoTotal >= mejor - 1e-9, `falló en x = ${x}`);
    }
  }
});

test('posición: empieza en la salida, pasa por el punto y termina en la meta', () => {
  for (const escenario of [CANCHA, PLAYA]) {
    const ruta = calcularRuta(escenario, 60);

    assert.deepEqual(posicionEnTiempo(escenario, ruta, 0), escenario.inicio);
    assert.deepEqual(posicionEnTiempo(escenario, ruta, ruta.tiempoTotal), escenario.meta);
    // aunque el reloj siga corriendo, el jugador se queda en la meta
    assert.deepEqual(posicionEnTiempo(escenario, ruta, ruta.tiempoTotal + 10), escenario.meta);

    const enLaLinea = posicionEnTiempo(escenario, ruta, ruta.t1);
    casiIgual(enLaLinea.x, 60);
    casiIgual(enLaLinea.y, escenario.lineaY);
  }
});

test('posición: la velocidad es constante en cada tramo', () => {
  const ruta = calcularRuta(PLAYA, 70);

  // en la arena: en 1 segundo debe avanzar velocidad1 metros
  const a = posicionEnTiempo(PLAYA, ruta, 2);
  const b = posicionEnTiempo(PLAYA, ruta, 3);
  casiIgual(distancia(a, b), PLAYA.velocidad1);

  // en el mar: en 1 segundo debe avanzar velocidad2 metros
  const c = posicionEnTiempo(PLAYA, ruta, ruta.t1 + 1);
  const d = posicionEnTiempo(PLAYA, ruta, ruta.t1 + 2);
  casiIgual(distancia(c, d), PLAYA.velocidad2);
});

test('puntosHastaDistancia: dibuja 2 puntos en el primer tramo y 3 en el segundo', () => {
  const ruta = calcularRuta(CANCHA, 35);

  const mitadTramo1 = puntosHastaDistancia(CANCHA, ruta, ruta.d1 / 2);
  assert.equal(mitadTramo1.length, 2);
  casiIgual(distancia(mitadTramo1[0], mitadTramo1[1]), ruta.d1 / 2);

  const completo = puntosHastaDistancia(CANCHA, ruta, ruta.distanciaTotal + 50);
  assert.equal(completo.length, 3);
  casiIgual(completo[2].x, CANCHA.meta.x);
  casiIgual(completo[2].y, CANCHA.meta.y);
});

test('ganador: gana el que tarda menos, y empate si es lo mismo', () => {
  assert.equal(decidirGanador(14.2, 15.9), 1);
  assert.equal(decidirGanador(22.31, 21.87), 2);
  assert.equal(decidirGanador(14.34, 14.34), 0);
  assert.equal(decidirGanador(14.341, 14.343), 0); // diferencia que no se ve con 2 decimales
});

test('jugadas espejo en la cancha NO empatan (la meta no está centrada respecto a la salida)', () => {
  const a = calcularRuta(CANCHA, 20).tiempoTotal;
  const b = calcularRuta(CANCHA, 85).tiempoTotal;
  assert.equal(decidirGanador(a, b), 1);
});
