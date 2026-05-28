# Contrato de coordinación: TutorialAutoscroll ↔ EncuestaModal

## Evento: `ag:tutorial-completed`

Disparado por `TutorialAutoscroll` cuando el usuario cierra el tutorial.

```javascript
window.dispatchEvent(new CustomEvent('ag:tutorial-completed'));
```

**Consumidor**: `EncuestaModal`

**Comportamiento esperado**: Si `window.__tutorialAutoscrollActive === true`
en el momento de mostrar la encuesta, esperar a este evento antes de mostrar
el modal.

## Flag global: `window.__tutorialAutoscrollActive`

- Se establece a `true` cuando el tutorial se abre
- Se establece a `false` cuando el tutorial se cierra
- Sirve como señal para que EncuestaModal sepa si debe esperar

## Datos de analytics (dataLayer)

```javascript
window.dataLayer.push({ event: 'tutorial_autoscroll_mostrado' });
window.dataLayer.push({ event: 'tutorial_autoscroll_cerrado' });
window.dataLayer.push({ event: 'tutorial_autoscroll_reabierto' });
```
