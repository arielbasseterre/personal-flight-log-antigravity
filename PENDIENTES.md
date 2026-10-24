# Pendientes y recordatorios

Lista de tareas de mantenimiento que **no** son urgentes pero conviene no olvidar.
Cuando completes un ítem, marcalo con `[x]` y anotá la fecha.

---

## 🔔 Recordatorio: verificar soporte de Ubuntu 26.04 en Playwright

- [x] **Revisar si Playwright ya soporta Ubuntu 26.04** y, si sí, volver a `ubuntu-latest`.

> ✅ **COMPLETADO el 24/10/2026.** Playwright se actualizó a `1.64.1` (npm + Dockerfile `v1.64.1-jammy`)
> y el workflow volvió a `ubuntu-latest`. Validado con dos runs verdes:
> #577 (`ubuntu-latest` = 24.04) y #578 (`ubuntu-26.04` explícito). Sin acción pendiente.
> Se deja el detalle abajo como referencia histórica / por si hay que repetir el proceso.

| Dato | Valor |
|---|---|
| **Estado** | ✅ Completado (24/10/2026) |
| **Archivo afectado** | `.github/workflows/telegram-bot.yml` |
| **Valor actual** | `runs-on: ubuntu-latest` + `playwright ^1.64.1` |

### Estado del último chequeo

- **2026-10-24**: ✅ **Sí hay soporte.** La última versión publicada es `playwright@1.64.1` y ya incluye
  `ubuntu26.04-x64` tanto en los builds de Chromium (`registry/index.ts`) como en las dependencias
  del sistema (`nativeDeps.ts`). El proyecto usa `1.59.1`, que solo llega a `ubuntu24.04`.
  → Ya no hace falta esperar: se puede encarar el upgrade cuando se quiera (ver "Pasos" abajo).
  Riesgo a validar: el salto 1.59 → 1.64 puede cambiar comportamiento del scraper de ARMS
  (por eso conviene probar con `workflow_dispatch` sobre `ubuntu-26.04` antes de cambiar el pin).

### Por qué

El 19/10/2026 GitHub empezó a migrar el label `ubuntu-latest` de **Ubuntu 24.04 → 26.04**
(completa el 19/11/2026, ver [actions/runner-images#14748](https://github.com/actions/runner-images/issues/14748)).
`playwright@1.59.1` no tiene builds para `ubuntu26.04`, por lo que el cron de Telegram
falló 4 días seguidos (20 al 24/10/2026) hasta que se pineó el runner a `ubuntu-24.04`.

Contexto completo del incidente: `info_para_modelos_IA/ERRORES_CONOCIDOS.md` → sección **14**.

### Cómo verificar (sin instalar nada)

1. **Última versión publicada**:
   ```bash
   npm view playwright version
   ```
2. **Ver si esa versión ya incluye `ubuntu26.04`** (abrir y buscar `ubuntu26.04`):
   ```
   https://unpkg.com/playwright-core@latest/lib/server/registry/index.js
   ```
   Si aparece `ubuntu26.04-x64` → ✅ ya hay soporte.
3. **Alternativa**: revisar los release notes → https://github.com/microsoft/playwright/releases
   (buscar "Ubuntu 26.04" o "ubuntu26.04").

### Si YA hay soporte, pasos para volver a `ubuntu-latest`

1. `npm i playwright@latest` (y commitear `package.json` + `package-lock.json`).
2. Verificar en local: `node_modules/playwright-core/lib/server/registry/index.js` debe contener `ubuntu26.04-x64`.
3. En el workflow, probar primero con `runs-on: ubuntu-26.04` y lanzarlo a mano
   (GitHub → Actions → *Telegram Roster Bot* → **Run workflow**).
4. Si el run da **verde** (los 13 pasos en success) → cambiar a `runs-on: ubuntu-latest`,
   borrar el comentario del pin y commitear.
5. Tachar este recordatorio con la fecha.

### Si todavía NO hay soporte

No hacer nada: el pin a `ubuntu-24.04` sigue funcionando. Reprogramar el chequeo para el mes siguiente.

---

## Otras mejoras opcionales (sin fecha)

- [ ] **Anti-spam de errores del cron**: si el entorno de GitHub vuelve a romperse, hoy se generan
  ~48 correos de "All jobs have failed" por día. Idea: capturar los fallos de *entorno* en
  `telegram/index.ts` (no los de ARMS) con el mismo cooldown de 24 h que ya usa `warn()` en
  `app_config`, avisar 1 sola vez por Telegram y salir con código 0.
- [ ] **Blindar el cron contra cambios de runner**: correr el job dentro del contenedor oficial de
  Playwright (`mcr.microsoft.com/playwright:v1.59.1-noble`). Así el SO y las librerías quedan
  fijados por la imagen y ninguna migración de GitHub vuelve a romperlo.
  Costo: +1-2 min por run (pull de la imagen).
