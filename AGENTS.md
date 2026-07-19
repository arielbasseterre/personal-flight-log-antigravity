# Instrucciones Personalizadas para el Agente

## ⚠️ Regla de Oro — Base de Datos Supabase

**Bajo ningún concepto** el agente debe ejecutar acciones destructivas en la base de datos de Supabase (DROP, DELETE, ALTER que elimine columnas, TRUNCATE, etc.).

El agente **NUNCA** debe ejecutar SQL contra Supabase. El usuario es el **único responsable** de copiar el código SQL propuesto y ejecutarlo manualmente en el SQL Editor del portal de Supabase.

**Siempre** que el agente proponga SQL que pueda provocar pérdida de datos (modificar schema, eliminar registros, cambiar tipos de columnas, etc.), debe:
1. Informar explícitamente al usuario del riesgo
2. Indicar claramente qué acciones del SQL son potencialmente destructivas
3. Esperar confirmación explícita del usuario antes de considerar el código como finalizado

## Reglas Generales

- **Actualización del Changelog:** No realices cambios automáticos en la constante `CHANGELOG_DATA` en `src/App.tsx`. Antes de incorporar cualquier registro de cambios al historial, debes preguntar explícitamente al usuario si desea incluir los cambios realizados en dicha sección.

## Referencia Técnica del Proyecto

Para entender la arquitectura, stack, estructura de directorios, cuentas de servicios externos y decisiones técnicas de esta app, consultar:

- `info_para_modelos_IA/AGENTS.md` — Resumen técnico ultra-condensado para IA
- `info_para_modelos_IA/DECISIONES_TECNICAS.md` — Por qué se tomó cada decisión de diseño
- `info_para_modelos_IA/ERRORES_CONOCIDOS.md` — Problemas conocidos y soluciones documentadas
- `Manual_de_la_app_flightlog.md` — Guía completa de arquitectura y funcionamiento

> El agente DEBE leer estos archivos antes de proponer cambios significativos en el proyecto.
