// Configuración de Astro.
// Aquí conectamos Tailwind (versión 4) usando su plugin de Vite,
// que es la forma recomendada ahora en lugar de la integración vieja.
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Apagamos la barrita de herramientas de Astro para que no estorbe al presentar
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
