// ---------------------------------------------------------------
// ANIMACIÓN DE ENTRADA
// Todo lo que tenga el atributo data-entrada aparece al cargar la
// página: sube un poquito y se va haciendo visible, uno tras otro.
// ---------------------------------------------------------------
import gsap from 'gsap';

export function animarEntrada() {
  const elementos = document.querySelectorAll('[data-entrada]');
  if (!elementos.length) return;

  // Si la persona pidió menos movimiento, solo los mostramos y ya
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.set(elementos, { opacity: 1 });
    return;
  }

  gsap.fromTo(
    elementos,
    { y: 28, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: 0.7,
      stagger: 0.09, // este es el retraso entre un elemento y el siguiente
      ease: 'power3.out',
      clearProps: 'transform', // al terminar quitamos el transform para no afectar las sombras
    },
  );
}
