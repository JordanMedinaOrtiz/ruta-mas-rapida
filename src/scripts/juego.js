// ---------------------------------------------------------------
// MOTOR DEL JUEGO
// Este archivo controla todo lo que pasa en pantalla: los turnos,
// el arrastre del punto, la carrera animada y el resultado.
// Lo usan los dos juegos (cancha y playa); lo único que cambia es
// el "escenario" que se le manda.
//
// Las fases del juego van en este orden:
//   elige1 -> elige2 -> cuenta -> carrera -> resultado -> (otra ronda)
//
// Las animaciones están hechas con GSAP (https://gsap.com).
// ---------------------------------------------------------------
import gsap from 'gsap';
import {
  calcularRuta,
  posicionEnTiempo,
  puntosHastaDistancia,
  puntoOptimo,
  decidirGanador,
  limitar,
} from './fisica.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const JUGADORES = [1, 2];

// Color de cada jugador (el 0 es para el empate)
const COLOR = { 0: 'var(--color-oro)', 1: 'var(--color-j1)', 2: 'var(--color-j2)' };

// Desfase de las fichas en la salida para que no queden una encima de otra
const ABANICO = { 1: { x: -1.5, y: -1.1 }, 2: { x: 1.5, y: 1.1 } };

// Si la persona tiene activado "reducir movimiento" en su sistema,
// nos saltamos las animaciones que son puro adorno.
const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Funciones cortitas para dar formato a los números
const segundos = (t) => `${t.toFixed(2)} s`;
const metros = (d) => `${d.toFixed(1)} m`;
// Convierte una lista de puntos al texto que pide <polyline points="...">
const aTexto = (puntos) => puntos.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

export function iniciarJuego(raiz, escenarioBase) {
  // Hacemos una copia del escenario porque las velocidades se pueden
  // cambiar con los controles y no queremos modificar el original.
  const escenario = { ...escenarioBase };
  const mitad = (escenario.xMin + escenario.xMax) / 2;

  // ---------- Referencias a los elementos de la página ----------
  const uno = (selector) => raiz.querySelector(selector);
  const todos = (selector) => [...raiz.querySelectorAll(selector)];
  // Para lo que existe una vez por jugador: regresa { 1: elemento, 2: elemento }
  const par = (nombre) => ({ 1: uno(`[data-${nombre}="1"]`), 2: uno(`[data-${nombre}="2"]`) });

  const svg = uno('[data-tablero]');
  const caja = svg.viewBox.baseVal;

  const marcadores = par('marcador');
  const halos = par('halo');
  const pildoras = par('pildora');
  const pildoraTextos = par('pildora-texto');
  const previas = par('previa');
  const estelas = par('estela');
  const estelaBordes = par('estela-borde');
  const fichas = par('ficha');
  const abanicos = par('abanico');
  const cuerpos = par('cuerpo');
  const capaFichas = uno('[data-fichas]');
  const efectos = uno('[data-efectos]');
  const cuenta = uno('[data-cuenta]');

  const optimaLineas = todos('[data-optima]'); // son dos: el borde negro y la dorada
  const optimaMarca = uno('[data-optima-marca]');
  const optimaPildora = uno('[data-optima-pildora]');
  const optimaTexto = uno('[data-optima-texto]');

  const escena = uno('[data-escena]');
  const secciones = {
    elegir: uno('[data-seccion="elegir"]'),
    carrera: uno('[data-seccion="carrera"]'),
    resultado: uno('[data-seccion="resultado"]'),
  };
  const turnoNumero = uno('[data-turno-numero]');
  const avisoSecreto = uno('[data-aviso-secreto]');
  const deslizador = uno('[data-deslizador]');
  const lecturaX = uno('[data-lectura-x]');
  const botonConfirmar = uno('[data-confirmar]');
  const tituloCarrera = uno('[data-titulo-carrera]');
  const ganadorTexto = uno('[data-ganador]');
  const diferenciaTexto = uno('[data-diferencia]');
  const botonRevelar = uno('[data-revelar]');
  const botonNueva = uno('[data-nueva]');
  const optimoInfo = uno('[data-optimo-info]');

  const tarjetas = par('tarjeta');
  const tiempos = par('tiempo');
  const estados = par('estado');
  const victorias = par('victorias');
  const puntos = par('punto');
  const celdas = {
    d1: par('d1'),
    t1: par('t1'),
    d2: par('d2'),
    t2: par('t2'),
    dTotal: par('d-total'),
    tTotal: par('t-total'),
  };

  const controlesVelocidad = todos('[data-velocidad]');

  // ---------- Estado del juego ----------
  // Aquí guardamos todo lo que va cambiando durante la partida.
  const estado = {
    fase: 'elige1',
    x: { 1: mitad, 2: mitad }, // punto elegido por cada jugador
    rutas: null, // rutas calculadas al arrancar la carrera
    victorias: { 0: 0, 1: 0, 2: 0 }, // el 0 cuenta los empates
    optimaRevelada: false,
    animaciones: [], // animaciones vivas, para poder cancelarlas al reiniciar
  };

  // Mostrar u ocultar una pieza del SVG
  const ver = (elemento, visible) => elemento.setAttribute('visibility', visible ? 'visible' : 'hidden');

  const eligiendo = () => estado.fase === 'elige1' || estado.fase === 'elige2';
  const jugadorEnTurno = () => (estado.fase === 'elige2' ? 2 : 1);

  // Convierte la posición del mouse/dedo (pixeles de la pantalla) a
  // coordenadas del tablero (metros). Así no importa de qué tamaño
  // se vea el SVG, siempre sabemos en qué metro se hizo clic.
  function aCoordenadasTablero(evento) {
    const punto = new DOMPoint(evento.clientX, evento.clientY);
    return punto.matrixTransform(svg.getScreenCTM().inverse());
  }

  // ---------- Elegir el punto ----------

  // Aquí puse esta función para mover el marcador del jugador sobre la línea.
  // También actualiza la ruta punteada, la pildorita con los metros y el
  // control deslizante del panel, para que todo marque lo mismo.
  function moverMarcador(jugador, x) {
    // No dejamos que se salga de la línea y redondeamos a 10 cm
    const xLimpia = Math.round(limitar(x, escenario.xMin, escenario.xMax) * 10) / 10;
    estado.x[jugador] = xLimpia;

    marcadores[jugador].setAttribute('transform', `translate(${xLimpia} ${escenario.lineaY})`);
    previas[jugador].setAttribute(
      'points',
      aTexto([escenario.inicio, { x: xLimpia, y: escenario.lineaY }, escenario.meta]),
    );

    acomodarPildora(pildoras[jugador], xLimpia, 6.6);
    pildoraTextos[jugador].textContent = metros(xLimpia);

    deslizador.value = xLimpia;
    lecturaX.textContent = metros(xLimpia);
  }

  // Acomoda la etiqueta de un punto para que no estorbe:
  // - "data-dx" la hace a un lado (en la playa, para no tapar la ruta que
  //   sigue hacia la meta, la ponemos del lado contrario a la meta)
  // - y si queda muy pegada a la orilla del tablero la recorremos para que no se corte
  function acomodarPildora(pildora, x, medioAncho) {
    const lado = x <= escenario.meta.x ? -1 : 1;
    const xDeseada = x + lado * Number(pildora.dataset.dx);
    const xVisible = limitar(xDeseada, caja.x + medioAncho, caja.x + caja.width - medioAncho);
    pildora.setAttribute('transform', `translate(${xVisible - x} ${pildora.dataset.dy})`);
  }

  // Arrastre sobre el tablero (sirve igual con mouse que con el dedo)
  let arrastrando = false;

  svg.addEventListener('pointerdown', (evento) => {
    if (!eligiendo()) return;
    arrastrando = true;
    svg.setPointerCapture(evento.pointerId);
    moverMarcador(jugadorEnTurno(), aCoordenadasTablero(evento).x);
  });

  svg.addEventListener('pointermove', (evento) => {
    if (!arrastrando || !eligiendo()) return;
    moverMarcador(jugadorEnTurno(), aCoordenadasTablero(evento).x);
  });

  const soltar = () => (arrastrando = false);
  svg.addEventListener('pointerup', soltar);
  svg.addEventListener('pointercancel', soltar);

  // El control deslizante hace lo mismo que arrastrar (y sirve con el teclado)
  deslizador.addEventListener('input', () => {
    if (eligiendo()) moverMarcador(jugadorEnTurno(), Number(deslizador.value));
  });
  deslizador.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') confirmar();
  });

  // ---------- Fases ----------

  // Cambia de fase y muestra en el panel solo la sección que toca
  function ponerFase(fase) {
    estado.fase = fase;
    raiz.dataset.fase = fase; // el CSS usa este atributo (cursor, línea animada...)

    const enCarrera = fase === 'cuenta' || fase === 'carrera';
    secciones.elegir.hidden = !eligiendo();
    secciones.carrera.hidden = !enCarrera;
    secciones.resultado.hidden = fase !== 'resultado';

    // Las velocidades solo se pueden mover antes de la carrera
    controlesVelocidad.forEach((control) => (control.disabled = !eligiendo()));
  }

  // Animación de entrada de una sección del panel (los renglones suben uno tras otro)
  function animarSeccion(seccion) {
    if (sinMovimiento) return;
    gsap.fromTo(
      seccion.children,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, stagger: 0.06, ease: 'power3.out', clearProps: 'transform' },
    );
  }

  function empezarTurno(jugador) {
    ponerFase(`elige${jugador}`);

    escena.style.setProperty('--acento', COLOR[jugador]);
    turnoNumero.textContent = jugador;
    avisoSecreto.hidden = jugador !== 2;

    // Solo se ve el marcador del jugador en turno. El del otro se esconde
    // para que la elección del Jugador 1 sea secreta.
    JUGADORES.forEach((j) => {
      const enTurno = j === jugador;
      ver(marcadores[j], enTurno);
      ver(previas[j], enTurno);
      ver(pildoras[j], true);
      tarjetas[j].dataset.activa = enTurno;
      tarjetas[j].dataset.apagada = false;
    });
    estados[jugador].textContent = 'Eligiendo…';

    moverMarcador(jugador, estado.x[jugador]);

    if (!sinMovimiento) {
      gsap.fromTo(turnoNumero, { scale: 0.3, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2.5)' });
      gsap.fromTo(pildoras[jugador], { opacity: 0 }, { opacity: 1, duration: 0.35 });
    }
  }

  function confirmar() {
    if (estado.fase === 'elige1') {
      estados[1].textContent = 'Punto guardado';
      puntos[1].textContent = 'Secreto';
      empezarTurno(2);
      animarSeccion(secciones.elegir);
    } else if (estado.fase === 'elige2') {
      prepararCarrera();
    }
  }
  botonConfirmar.addEventListener('click', confirmar);

  // ---------- Carrera ----------

  function prepararCarrera() {
    ponerFase('cuenta');
    escena.style.setProperty('--acento', COLOR[0]);
    tituloCarrera.textContent = '¡Preparados!';
    animarSeccion(secciones.carrera);

    // Aquí se calculan las dos rutas con las velocidades que haya en ese momento
    estado.rutas = {
      1: calcularRuta(escenario, estado.x[1]),
      2: calcularRuta(escenario, estado.x[2]),
    };

    // Ya se pueden ver los dos puntos elegidos (sin etiqueta para que no se encimen)
    JUGADORES.forEach((j) => {
      marcadores[j].setAttribute('transform', `translate(${estado.x[j]} ${escenario.lineaY})`);
      ver(marcadores[j], true);
      ver(pildoras[j], false);
      ver(previas[j], false);
      puntos[j].textContent = metros(estado.x[j]);
      estados[j].textContent = 'Listo';
      tarjetas[j].dataset.activa = true;
    });

    cuentaRegresiva(correr);
  }

  // 3, 2, 1... ¡YA! en grande sobre el tablero
  function cuentaRegresiva(alTerminar) {
    if (sinMovimiento) {
      alTerminar();
      return;
    }

    ver(cuenta, true);
    const linea = gsap.timeline({
      onComplete: () => {
        ver(cuenta, false);
        alTerminar();
      },
    });

    ['3', '2', '1', '¡YA!'].forEach((texto) => {
      linea
        .call(() => (cuenta.textContent = texto))
        // Animamos el tamaño de letra: entra grande y "cae" a su tamaño
        .fromTo(
          cuenta,
          { attr: { 'font-size': 46 }, opacity: 0 },
          { attr: { 'font-size': 24 }, opacity: 1, duration: 0.3, ease: 'back.out(2)' },
        )
        .to(cuenta, { attr: { 'font-size': 14 }, opacity: 0, duration: 0.2, ease: 'power2.in' }, '+=0.2');
    });

    estado.animaciones.push(linea);
  }

  function correr() {
    ponerFase('carrera');
    tituloCarrera.textContent = '¡Corren!';

    const rutas = estado.rutas;
    const tiempoMaximo = Math.max(rutas[1].tiempoTotal, rutas[2].tiempoTotal);

    // Para acordarnos de qué ya le pasó a cada jugador durante la carrera
    const avance = {
      1: { cruzo: false, llego: false, ultimaOnda: 0 },
      2: { cruzo: false, llego: false, ultimaOnda: 0 },
    };

    // Las fichas se juntan en el punto exacto de salida y empiezan a "trotar"
    gsap.to([abanicos[1], abanicos[2]], { x: 0, y: 0, duration: 0.35, ease: 'power2.out' });
    const trote = gsap.to([cuerpos[1], cuerpos[2]], {
      scale: 1.13,
      svgOrigin: '0 0',
      duration: 0.2,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });

    // Aquí puse esta función para hacer que avance el jugador.
    // Recibe el tiempo del cronómetro y con eso coloca la ficha, dibuja
    // la estela y actualiza su reloj.
    function avanzarJugador(j, t) {
      const ruta = rutas[j];
      const tiempoJugador = Math.min(t, ruta.tiempoTotal); // al llegar, su reloj se detiene
      const posicion = posicionEnTiempo(escenario, ruta, tiempoJugador);

      fichas[j].setAttribute('transform', `translate(${posicion.x.toFixed(3)} ${posicion.y.toFixed(3)})`);

      // La estela pasa por el punto elegido solo si ya lo cruzó
      const camino =
        tiempoJugador > ruta.t1 ? [escenario.inicio, ruta.punto, posicion] : [escenario.inicio, posicion];
      estelas[j].setAttribute('points', aTexto(camino));
      estelaBordes[j].setAttribute('points', aTexto(camino));

      tiempos[j].textContent = segundos(tiempoJugador);

      // Cuando toca la línea empieza el segundo tramo
      if (!avance[j].cruzo && t >= ruta.t1) {
        avance[j].cruzo = true;
        avance[j].ultimaOnda = t;
        estados[j].textContent = escenario.verbos[1];
        onda(ruta.punto, { color: 'white', radio: 5, grosor: 0.7 });
      }

      // En el mar va dejando onditas en el agua mientras nada
      if (escenario.agua && avance[j].cruzo && !avance[j].llego && t - avance[j].ultimaOnda > 1.1) {
        avance[j].ultimaOnda = t;
        onda(posicion, { color: 'white', radio: 3.2, grosor: 0.35 });
      }

      if (!avance[j].llego && t >= ruta.tiempoTotal) {
        avance[j].llego = true;
        llegada(j);
      }
    }

    JUGADORES.forEach((j) => (estados[j].textContent = escenario.verbos[0]));

    // Este es el cronómetro de la carrera. GSAP va subiendo "t" de 0 al
    // tiempo del jugador más lento. Lo importante es ease: 'none', que
    // significa avance lineal = VELOCIDAD CONSTANTE (sin acelerar ni frenar).
    // La duración se divide entre "aceleracion" solo para no esperar tanto.
    const reloj = { t: 0 };
    const carrera = gsap.to(reloj, {
      t: tiempoMaximo,
      duration: tiempoMaximo / escenario.aceleracion,
      ease: 'none',
      onUpdate: () => JUGADORES.forEach((j) => avanzarJugador(j, reloj.t)),
      onComplete: () => {
        trote.kill();
        gsap.to([cuerpos[1], cuerpos[2]], { scale: 1, svgOrigin: '0 0', duration: 0.2 });
        mostrarResultado();
      },
    });

    estado.animaciones.push(trote, carrera);
  }

  // Efecto cuando un jugador llega a la meta
  function llegada(j) {
    estados[j].textContent = '¡Llegó!';
    onda(escenario.meta, { color: COLOR[j], radio: 9, grosor: 1 });
    if (!sinMovimiento) {
      gsap.fromTo(tiempos[j], { scale: 1.25 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', transformOrigin: 'left center' });
    }
  }

  // ---------- Efectos ----------

  // Dibuja un círculo que crece y se desvanece (salpicón, llegada, etc.)
  function onda(punto, { color, radio, grosor }) {
    if (sinMovimiento) return;

    const circulo = document.createElementNS(SVG_NS, 'circle');
    circulo.setAttribute('cx', punto.x);
    circulo.setAttribute('cy', punto.y);
    circulo.setAttribute('r', 0.5);
    circulo.setAttribute('fill', 'none');
    circulo.setAttribute('stroke-width', grosor);
    circulo.style.stroke = color;
    efectos.appendChild(circulo);

    gsap.to(circulo, {
      attr: { r: radio },
      opacity: 0,
      duration: 0.9,
      ease: 'power2.out',
      onComplete: () => circulo.remove(),
    });
  }

  // Papelitos de colores que salen volando desde la meta
  function confeti(punto, colores) {
    if (sinMovimiento) return;

    for (let i = 0; i < 40; i++) {
      const papel = document.createElementNS(SVG_NS, 'rect');
      papel.setAttribute('x', -0.5);
      papel.setAttribute('y', -0.8);
      papel.setAttribute('width', 1);
      papel.setAttribute('height', 1.6);
      papel.setAttribute('rx', 0.2);
      papel.style.fill = gsap.utils.random(colores);
      efectos.appendChild(papel);

      // Cada papelito sale en una dirección y distancia al azar
      const angulo = gsap.utils.random(0, Math.PI * 2);
      const alcance = gsap.utils.random(6, 24);
      const duracion = gsap.utils.random(0.9, 1.7);

      gsap.fromTo(
        papel,
        { x: punto.x, y: punto.y, rotation: gsap.utils.random(0, 360), scale: 0.3, svgOrigin: '0 0' },
        {
          x: punto.x + Math.cos(angulo) * alcance,
          y: punto.y + Math.sin(angulo) * alcance + 5, // el +5 es para que "caigan" un poco
          rotation: `+=${gsap.utils.random(-540, 540)}`,
          scale: 1,
          duration: duracion,
          ease: 'power3.out',
        },
      );
      gsap.to(papel, {
        opacity: 0,
        duration: duracion * 0.4,
        delay: duracion * 0.6,
        onComplete: () => papel.remove(),
      });
    }
  }

  // ---------- Resultado ----------

  function mostrarResultado() {
    const rutas = estado.rutas;
    const ganador = decidirGanador(rutas[1].tiempoTotal, rutas[2].tiempoTotal);
    const diferencia = Math.abs(rutas[1].tiempoTotal - rutas[2].tiempoTotal);

    estado.victorias[ganador] += 1;
    ponerFase('resultado');
    escena.style.setProperty('--acento', COLOR[ganador]);

    if (ganador === 0) {
      ganadorTexto.textContent = '¡Empate!';
      diferenciaTexto.textContent = 'Los dos tardaron exactamente lo mismo. Nadie suma punto.';
    } else {
      const perdedor = ganador === 1 ? 2 : 1;
      ganadorTexto.textContent = `Gana Jugador ${ganador}`;
      diferenciaTexto.textContent = `Llegó ${diferencia.toFixed(2)} s antes que el Jugador ${perdedor}.`;
    }

    // Llenamos la tablita de cada jugador con sus distancias y tiempos
    JUGADORES.forEach((j) => {
      const ruta = rutas[j];
      celdas.d1[j].textContent = ruta.d1.toFixed(1);
      celdas.t1[j].textContent = ruta.t1.toFixed(2);
      celdas.d2[j].textContent = ruta.d2.toFixed(1);
      celdas.t2[j].textContent = ruta.t2.toFixed(2);
      celdas.dTotal[j].textContent = ruta.distanciaTotal.toFixed(1);
      celdas.tTotal[j].textContent = ruta.tiempoTotal.toFixed(2);

      victorias[j].textContent = estado.victorias[j];
      estados[j].textContent = ganador === 0 ? 'Empate' : ganador === j ? 'Ganó' : 'Perdió';
      tarjetas[j].dataset.activa = ganador === j;
      tarjetas[j].dataset.apagada = ganador !== 0 && ganador !== j;
    });

    // Como los dos terminan en la meta, ponemos al ganador hasta arriba
    // y dejamos al otro medio transparente.
    if (ganador !== 0) {
      const perdedor = ganador === 1 ? 2 : 1;
      capaFichas.appendChild(fichas[ganador]);
      gsap.to(fichas[perdedor], { opacity: 0.45, duration: 0.3 });
      if (!sinMovimiento) {
        gsap.fromTo(
          cuerpos[ganador],
          { scale: 1.6 },
          { scale: 1, svgOrigin: '0 0', duration: 0.8, ease: 'elastic.out(1, 0.45)', overwrite: true },
        );
        gsap.fromTo(victorias[ganador], { scale: 2 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' });
      }
    }

    confeti(escenario.meta, ganador === 0 ? [COLOR[1], COLOR[2], 'white'] : [COLOR[ganador], COLOR[0], 'white']);

    if (!sinMovimiento) {
      gsap.fromTo(
        todos('[data-resultado-item]'),
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power3.out', clearProps: 'transform' },
      );
    }
  }

  // Dibuja la mejor ruta posible y dice qué tan lejos quedó cada quien
  function revelarOptima() {
    if (estado.fase !== 'resultado' || estado.optimaRevelada) return;
    estado.optimaRevelada = true;
    botonRevelar.disabled = true;

    const optimo = puntoOptimo(escenario);

    // La línea dorada se va pintando desde la salida hasta la meta
    const pluma = { d: 0 };
    const pintar = () => {
      const trazo = aTexto(puntosHastaDistancia(escenario, optimo.ruta, pluma.d));
      optimaLineas.forEach((linea) => linea.setAttribute('points', trazo));
    };
    pintar();
    optimaLineas.forEach((linea) => ver(linea, true));

    if (sinMovimiento) {
      pluma.d = optimo.ruta.distanciaTotal;
      pintar();
    } else {
      estado.animaciones.push(
        gsap.to(pluma, { d: optimo.ruta.distanciaTotal, duration: 1.3, ease: 'power2.inOut', onUpdate: pintar }),
      );
    }

    // Marca del punto óptimo sobre la línea
    optimaMarca.setAttribute('transform', `translate(${optimo.x.toFixed(2)} ${escenario.lineaY})`);
    acomodarPildora(optimaPildora, optimo.x, 10);
    optimaTexto.textContent = `ÓPTIMO ${metros(optimo.x)}`;
    ver(optimaMarca, true);
    if (!sinMovimiento) {
      gsap.fromTo(optimaMarca, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.5 });
    }

    // Datos en el panel
    uno('[data-optimo-x]').textContent = metros(optimo.x);
    uno('[data-optimo-tiempo]').textContent = segundos(optimo.ruta.tiempoTotal);
    JUGADORES.forEach((j) => {
      const tiempoExtra = estado.rutas[j].tiempoTotal - optimo.ruta.tiempoTotal;
      const lejania = Math.abs(estado.x[j] - optimo.x);
      uno(`[data-optimo-extra="${j}"]`).textContent = `+${tiempoExtra.toFixed(2)} s · a ${metros(lejania)}`;
    });
    optimoInfo.hidden = false;
    if (!sinMovimiento) {
      gsap.fromTo(optimoInfo, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
    }
  }
  botonRevelar.addEventListener('click', revelarOptima);

  // ---------- Reiniciar ----------

  // Deja todo como al principio (pero el marcador de victorias se conserva)
  function nuevaRonda() {
    // Cancelamos cualquier animación que siga viva de la ronda anterior
    estado.animaciones.forEach((animacion) => animacion.kill());
    estado.animaciones = [];
    gsap.killTweensOf([...efectos.children]);
    efectos.replaceChildren();

    estado.rutas = null;
    estado.optimaRevelada = false;
    estado.x = { 1: mitad, 2: mitad };

    JUGADORES.forEach((j) => {
      fichas[j].setAttribute('transform', `translate(${escenario.inicio.x} ${escenario.inicio.y})`);
      gsap.set(fichas[j], { opacity: 1 });
      gsap.set(abanicos[j], { x: ABANICO[j].x, y: ABANICO[j].y });
      gsap.set(cuerpos[j], { scale: 1, svgOrigin: '0 0' });

      estelas[j].setAttribute('points', '');
      estelaBordes[j].setAttribute('points', '');

      tiempos[j].textContent = segundos(0);
      estados[j].textContent = 'En espera';
      puntos[j].textContent = '—';
      Object.values(celdas).forEach((celda) => (celda[j].textContent = '—'));
    });
    // El Jugador 1 vuelve a quedar encima en la salida
    capaFichas.appendChild(fichas[2]);
    capaFichas.insertBefore(fichas[1], fichas[2]);

    optimaLineas.forEach((linea) => {
      ver(linea, false);
      linea.setAttribute('points', '');
    });
    ver(optimaMarca, false);
    ver(cuenta, false);
    optimoInfo.hidden = true;
    gsap.set(optimoInfo, { clearProps: 'transform,opacity' });
    botonRevelar.disabled = false;

    empezarTurno(1);
  }

  botonNueva.addEventListener('click', () => {
    nuevaRonda();
    animarSeccion(secciones.elegir);
  });

  uno('[data-reiniciar-marcador]').addEventListener('click', () => {
    estado.victorias = { 0: 0, 1: 0, 2: 0 };
    JUGADORES.forEach((j) => (victorias[j].textContent = 0));
  });

  // ---------- Controles de velocidad ----------

  controlesVelocidad.forEach((control, i) => {
    control.addEventListener('input', () => {
      const velocidad = Number(control.value);
      // Un mismo control puede mover una o las dos velocidades (ver escenarios.js)
      escenario.controles[i].claves.forEach((clave) => (escenario[clave] = velocidad));

      uno(`[data-velocidad-valor="${i}"]`).textContent = `${velocidad} m/s`;
      todos(`[data-vel-texto="${i}"]`).forEach((texto) => (texto.textContent = `${velocidad} m/s`));
    });
  });

  // ---------- Adornos que se mueven todo el tiempo ----------

  function animarDecoracion() {
    if (sinMovimiento) return;

    // Halo que late alrededor del marcador para que se note que se puede mover
    JUGADORES.forEach((j) => {
      gsap.fromTo(
        halos[j],
        { attr: { r: 1.3 }, opacity: 0.6 },
        { attr: { r: 3.6 }, opacity: 0, duration: 1.2, repeat: -1, ease: 'power1.out' },
      );
    });

    // Anillos que laten (la meta). data-pulso dice hasta qué radio crecen.
    todos('[data-pulso]').forEach((anillo) => {
      gsap.fromTo(
        anillo,
        { opacity: 0.9 },
        { attr: { r: Number(anillo.dataset.pulso) }, opacity: 0, duration: 1.6, repeat: -1, ease: 'power1.out' },
      );
    });

    // Olas: se recorren exactamente una "longitud de onda" y repiten,
    // por eso parece que nunca se acaban.
    todos('[data-ola]').forEach((ola) => {
      gsap.to(ola, {
        x: -Number(ola.dataset.ola),
        duration: Number(ola.dataset.duracion),
        repeat: -1,
        ease: 'none',
      });
    });

    // Cosas que flotan en el agua (suben y bajan suavecito)
    todos('[data-flota]').forEach((cosa) => {
      gsap.to(cosa, { y: 0.5, rotation: 5, svgOrigin: '0 0', duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    });

    // Las fichas "caen" a la salida cuando carga la página
    gsap.from([cuerpos[1], cuerpos[2]], {
      scale: 0,
      svgOrigin: '0 0',
      duration: 0.7,
      delay: 0.5,
      stagger: 0.12,
      ease: 'back.out(2.2)',
    });
  }

  // ---------- Arranque ----------
  // Primero dejamos todo en su lugar y luego prendemos los adornos
  nuevaRonda();
  animarDecoracion();
}
