# Plataforma de Cursos — cursos.acordesgaditanos.com

## Documento de Arquitectura Actualizado (v2)

---

# 1. Visión General

Plataforma de cursos de guitarra flamenca independiente accesible desde:

```txt
cursos.acordesgaditanos.com
```

Orientada al mercado español y centrada en:

- Venta de cursos individuales y packs
- Acceso de por vida
- Contenido premium protegido
- Captación orgánica desde YouTube
- Costes mínimos hasta escalar
- Diseño artesanal y flamenco
- Infraestructura simple y mantenible

---

# 2. Filosofía del Proyecto

La prioridad es:

```txt
Lanzar rápido + validar negocio + mantener simplicidad
```

Se elimina toda complejidad innecesaria para la v1.

---

# 3. Arquitectura Final Recomendada

```txt
Frontend / Backend  → Next.js 14
Base de datos       → Supabase PostgreSQL
Auth                → Supabase Auth
Pagos               → Redsys
Vídeo premium       → Bunny.net Stream
PDFs y recursos     → Supabase Storage
Emails              → Resend
Hosting             → Netlify
Analytics           → Reutilizar analytics de acordesgaditanos.com
Comunidad           → Discord
Estilos             → CSS manual
```

---

# 4. Cambios Importantes Respecto al Documento Original

## Eliminado

- Foro interno
- Blog integrado
- Prisma
- NextAuth
- Tailwind CSS
- Bunny Storage
- Complejidad innecesaria en comunidad

## Mantenido

- Admin panel completo
- Reviews y puntuaciones
- Comentarios por lección
- Packs
- Descuentos
- Analytics
- Sistema de progreso
- SEO
- Videos gratis + premium

## Añadido

- Discord como comunidad
- CSS manual completo
- Arquitectura más limpia
- Mejor sistema de autorización
- Mejor tracking de analytics
- Mejor modelo de progreso

---

# 5. Dominio y Hosting

## Recomendación

Usar subdominio:

```txt
cursos.acordesgaditanos.com
```

## Hosting

Deploy en Netlify.

## Configuración DNS

```txt
cursos  CNAME  proyecto.netlify.app
```

## Ventajas

- Refuerza la marca principal
- Mejor SEO
- Más confianza
- No requiere comprar dominio nuevo
- Configuración trivial

---

# 6. Costes Reales

| Servicio            | Coste            |
| ------------------- | ---------------- |
| Subdominio          | 0€               |
| Netlify             | 0€               |
| Supabase            | 0€ inicialmente  |
| Bunny Stream        | Pago por uso     |
| Resend              | 0€ inicialmente  |
| Redsys              | \~0.8% por venta |
| Discord             | 0€               |
| Total fijo estimado | \~2-5€/mes       |

---

# 7. Stack Tecnológico Final

| Capa          | Tecnología                               |
| ------------- | ---------------------------------------- |
| Framework     | Next.js 14                               |
| Lenguaje      | TypeScript                               |
| Base de datos | Supabase PostgreSQL                      |
| Auth          | Supabase Auth                            |
| Pagos         | Redsys                                   |
| Vídeo premium | Bunny.net Stream                         |
| Recursos      | Supabase Storage                         |
| Emails        | Resend                                   |
| Hosting       | Netlify                                  |
| Analytics     | GA4 / Plausible / actual stack existente |
| Comunidad     | Discord                                  |
| Estilos       | CSS manual                               |

---

# 8. Estructura Recomendada del Proyecto

```txt
src/
├── app/
├── components/
├── features/
├── services/
├── repositories/
├── styles/
├── lib/
├── types/
└── middleware.ts
```

---

# 9. Arquitectura CSS

NO se utilizará Tailwind.

## Estructura CSS

```txt
styles/
├── globals.css
├── variables.css
├── typography.css
├── layout.css
├── utilities.css
├── components/
│   ├── buttons.css
│   ├── cards.css
│   ├── forms.css
│   ├── player.css
│   └── sidebar.css
└── pages/
```

## Filosofía visual

- Oscuro cálido
- Flamenco elegante
- Artesanal
- Minimalista
- Nada de aspecto SaaS genérico

---

# 10. Variables Globales CSS

```css
:root {
  --bg-primary: #0f0d0b;
  --bg-secondary: #1a1612;
  --bg-elevated: #241e18;

  --gold: #c9922a;
  --gold-light: #e8b84b;
  --gold-muted: #6b4e1a;

  --text-primary: #f0e8d8;
  --text-secondary: #a89070;
  --text-muted: #6b5840;

  --success: #4a9b6f;
  --error: #c94040;
  --star: #e8b84b;
}
```

---

# 11. Sistema de Autenticación

## Decisión final

Usar exclusivamente:

```txt
Supabase Auth
```

## NO usar

- NextAuth
- Prisma

## Motivo

Reduce complejidad y mantenimiento.

---

# 12. Base de Datos

## Decisión

Usar directamente PostgreSQL de Supabase.

Sin Prisma.

---

# 13. Modelos Principales

## User

```txt
Usuarios y roles
```

## Course

```txt
Cursos
```

## Lesson

```txt
Lecciones
```

## Purchase

```txt
Compras
```

## Review

```txt
Valoraciones
```

## LessonComment

```txt
Comentarios simples por lección
```

## Progress

```txt
Progreso detallado
```

---

# 14. Modelo de Progreso Mejorado

El sistema original era demasiado básico.

## Nuevo modelo recomendado

```txt
progressPercent
lastPositionSeconds
completedAt
```

Esto permite:

- Continuar exactamente donde el usuario lo dejó
- Analizar abandono
- Mejor UX

---

# 15. Sistema de Reviews

## Se mantiene

Porque aporta:

- Conversión
- SEO
- Confianza
- Prueba social

## Reglas

- Solo usuarios compradores
- Una review por curso
- Moderación desde admin
- Estrellas + texto

---

# 16. Comentarios por Lección

Se elimina el foro completo.

## Sustitución

Comentarios simples tipo YouTube.

## Modelo

```txt
LessonComment
```

## Objetivo

- Resolver dudas rápidas
- Interacción ligera
- Sin complejidad de foro

---

# 17. Comunidad

## Decisión final

Usar:

```txt
Discord
```

## Motivos

- Mejor engagement
- Notificaciones ya resueltas
- Cero mantenimiento
- Móvil perfecto
- Canales por curso
- Mucho más rápido de lanzar

---

# 18. Sistema de Pagos

## Redsys

Se mantiene como solución principal.

## Flujo

```txt
Usuario → Checkout → Redsys → Webhook → Activar acceso
```

---

# 19. Mejoras Importantes para Redsys

## Añadir idempotencia

Redsys puede repetir callbacks.

### Obligatorio

```ts
if (purchase.status === 'COMPLETED') return
```

---

## Añadir logs de pagos

Crear tabla:

```txt
PaymentEvent
```

Para:

- Debug
- Conciliación
- Problemas bancarios
- Duplicados

---

# 20. Seguridad

El middleware NO es suficiente.

## Necesario

Centralizar autorización.

## Crear servicios

```txt
canAccessCourse()
canAccessAdmin()
canDownloadResource()
```

Y usarlos:

- APIs
- Server actions
- Pages
- Descargas

---

# 21. Vídeo Premium

## Bunny.net Stream

Se mantiene.

## Razones

- Muy barato
- URLs firmadas
- CDN global
- Streaming adaptativo
- Anti descarga básica

---

# 22. Recursos Descargables

## Cambio importante

Eliminar Bunny Storage.

## Nuevo sistema

```txt
Supabase Storage
```

Para:

- PDFs
- Tablaturas
- Audios
- Recursos

---

# 23. Sistema de Analytics

## Reutilizar analytics existentes

Integrar la plataforma en el mismo ecosistema de analytics de:

```txt
acordesgaditanos.com
```

---

# 24. Eventos Importantes a Trackear

## Funnel de venta

```txt
Visita curso
→ Click comprar
→ Inicio checkout
→ Pago OK
```

## Comportamiento de alumno

```txt
Cursos más vistos
Vídeos más vistos
Dónde abandonan
Porcentaje completado
```

---

# 25. Panel de Administración

## Se mantiene COMPLETO

Porque será clave para operar el negocio.

---

## Módulos del Admin

### Dashboard

- Ventas
- Ingresos
- Nuevos alumnos
- Conversión

### Cursos

- CRUD completo
- Secciones
- Lecciones
- Ordenación
- Publicación

### Packs

- CRUD
- Asociación de cursos

### Usuarios

- Lista
- Compras
- Accesos

### Reviews

- Moderación
- Ocultar/mostrar

### Comentarios

- Moderación
- Eliminación

### Descuentos

- Gestión de ofertas
- Fechas
- Activación

### Analytics

- Conversiones
- Progreso
- Actividad

---

# 26. Funcionalidades Públicas

## Home

- Hero principal
- Cursos destacados
- CTA

## Catálogo

- Lista de cursos
- Filtros simples

## Página de curso

- Descripción
- Temario
- Vídeos gratuitos
- Reviews
- Precio
- Compra

## Profesor

- Bio
- Redes
- Cursos

---

# 27. Funcionalidades Privadas

## Mi área

- Cursos comprados
- Progreso
- Continuar viendo

## Reproductor

- Vídeo
- Recursos
- Comentarios
- Navegación

---

# 28. SEO

## MUY importante

Añadir:

- sitemap.xml
- robots.txt
- metadata dinámica
- Open Graph
- canonical URLs
- schema.org Course
- schema.org VideoObject

---

# 29. Captación

## Flujo principal

```txt
TikTok
↓
YouTube
↓
Página de curso
↓
Compra
```

---

# 30. Estrategia de Contenido

## Vídeos gratuitos

Las primeras lecciones actuarán como:

```txt
Lead magnet
```

con:

- YouTube embebido
- CTA hacia compra

---

# 31. Roadmap Realista

## Fase 1

- Auth
- Catálogo
- Cursos
- Checkout
- Redsys

## Fase 2

- Área privada
- Bunny Stream
- Recursos
- Progreso

## Fase 3

- Admin completo
- Reviews
- Comentarios
- Descuentos

## Fase 4

- SEO
- Analytics
- Optimización
- Discord

---

# 32. Decisiones Finales del Proyecto

## Sí

✅ Subdominio ✅ Netlify ✅ Supabase Auth ✅ Supabase DB ✅ Bunny Stream ✅ Supabase Storage ✅ Redsys ✅ CSS manual ✅ Discord ✅ Reviews ✅ Comentarios ✅ Admin completo ✅ Analytics

## No

❌ Foro interno ❌ Tailwind ❌ Prisma ❌ NextAuth ❌ Blog integrado inicialmente ❌ Bunny Storage

---

# 33. Resultado Final

La plataforma queda:

- Mucho más mantenible
- Más rápida de desarrollar
- Más barata
- Más coherente visualmente
- Más preparada para crecer
- Mucho menos sobreingenierizada

Sin perder:

- capacidad de escalar
- branding
- profesionalidad
- funcionalidades importantes

---

*Documento actualizado para cursos.acordesgaditanos.com — Mayo 2026*

