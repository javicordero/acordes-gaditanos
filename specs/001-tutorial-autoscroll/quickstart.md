# Quickstart: Tutorial interactivo de autoscroll

## Archivos a modificar

| Acción | Archivo |
|--------|---------|
| CREAR | `src/components/page/TutorialAutoscroll.astro` |
| MODIFICAR | `src/components/page/AcordeCard.astro` |
| MODIFICAR | `src/components/ads/EncuestaModal.astro` |

## Orden de implementación sugerido

1. Crear `TutorialAutoscroll.astro` con template, JS y estilos
2. Modificar `AcordeCard.astro`: importar componente + botón "?" + estilos
3. Modificar `EncuestaModal.astro`: escuchar evento de coordinación

## Verificación rápida

```bash
npm run dev
# Navegar a /acordes/[cualquier-id]
# Verificar que el tutorial aparece, se cierra, y no reaparece
# Clic en botón "?" → verificar re-apertura
# Redimensionar a móvil → verificar posicionamiento
# Verificar que EncuestaModal espera al tutorial
```

## Detalles clave

- Clave localStorage: `ag_tutorial_autoscroll_visto`
- Flag global: `window.__tutorialAutoscrollActive`
- Evento de coordinación: `ag:tutorial-completed`
- Eventos analytics: `tutorial_autoscroll_*` en dataLayer
- Accesibilidad: focus trap, ARIA dialog, foco gestionado
- Z-index del overlay: 10001 (por encima de EncuestaModal que usa 10000)
