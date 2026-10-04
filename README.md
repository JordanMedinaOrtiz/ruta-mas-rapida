# La ruta más rápida

Dos juegos para dos jugadores hechos con **Astro**, **Tailwind CSS** y **GSAP**.
En los dos, cada jugador escoge un punto sobre una línea, salen del mismo lugar al mismo
tiempo y gana el que tarde menos en llegar a la meta.

| Juego | Qué pasa | Qué se aprende |
| --- | --- | --- |
| **01 · La cancha** | Esquina → punto de la línea de fondo → centro de la cancha, a velocidad constante. | Con la misma velocidad gana el camino más corto. |
| **02 · Playa y mar** | Torre → punto de la orilla → salvavidas. En la arena se corre rápido y en el mar se nada lento. | El camino más corto no siempre es el más rápido. |

La fórmula de todo el proyecto es `tiempo = distancia ÷ velocidad`.

## Cómo correrlo

Se necesita [Node.js](https://nodejs.org) 22 o más nuevo.

```bash
npm install
```

```bash
npm run dev
```

Y se abre en el navegador: http://localhost:4321

Otros comandos:

- `npm test` corre las pruebas de los cálculos.
- `npm run build` genera la página final (HTML, CSS y JS) en la carpeta `dist/`.
- `npm run preview` muestra lo que quedó en `dist/`.

## Cómo se juega

1. **Jugador 1** arrastra sobre la línea amarilla (o usa el control deslizante / las flechas del teclado) y confirma. Su punto queda en secreto.
2. **Jugador 2** escoge el suyo y confirma. Empieza la cuenta regresiva.
3. Los dos corren al mismo tiempo. El cronómetro marca el tiempo real de cada uno y gana el menor.
4. Al final se puede ver la **ruta óptima** y qué tan lejos quedó cada quien. El marcador se guarda entre rondas.

Las velocidades se pueden cambiar en el panel antes de cada carrera.

## Dónde está cada cosa

```
src/
├─ scripts/
│  ├─ escenarios.js   Medidas, salida, meta y velocidades de cada juego
│  ├─ fisica.js       Los cálculos: distancias, tiempos, posición y punto óptimo
│  ├─ juego.js        El motor: turnos, arrastre, carrera animada y resultado
│  └─ entrada.js      Animación de entrada de las páginas
├─ components/
│  ├─ MarcoJuego.astro      Estructura de la página de un juego
│  ├─ PanelJuego.astro      Panel con el turno, cronómetros y velocidades
│  ├─ CapaJugadores.astro   Fichas, rutas y marcadores (dentro del SVG)
│  ├─ EscenaCancha.astro    Dibujo de la cancha
│  └─ EscenaPlaya.astro     Dibujo de la playa y el mar
├─ layouts/Layout.astro     Menú, pie de página y fuentes
├─ pages/                   index (inicio), cancha y playa
└─ styles/global.css        Colores, fuentes y estilos compartidos
pruebas/fisica.test.js      Pruebas de los cálculos
```

## Cómo funciona la carrera

- El tablero es un SVG donde **1 unidad = 1 metro**, así las distancias se calculan directo con Pitágoras.
- GSAP anima un cronómetro de `0` al tiempo del jugador más lento con `ease: 'none'`
  (avance lineal), y en cada cuadro se calcula dónde va cada jugador según ese tiempo.
  Por eso la velocidad en pantalla es realmente constante, y en la playa se nota el cambio al entrar al mar.
- La animación va acelerada (×3 en la cancha, ×4 en la playa) para no esperar tanto, pero los
  tiempos que se muestran son los reales.
- El punto óptimo se busca con búsqueda ternaria. En la cancha coincide con reflejar la meta en la
  línea de fondo (da 35 m) y en la playa coincide con la ley de Snell.
