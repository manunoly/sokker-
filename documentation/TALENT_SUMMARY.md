# Resumen de talento (entreno directo sin subir)

Bloque que aparece encima de la tabla del panel **General Skills ++** (history tooltip, `#sokkerpp-history-tooltip`). Para cada skill muestra cuántos entrenos directos lleva el jugador desde su última subida y estima su **talento**: cada cuántos entrenos directos sube.

- Cálculo: `src/core/talent.ts` → `computeTalentSummary(history)` (función pura, sin DOM ni red).
- Render: `src/content/tooltip.ts` → `renderTalentSummary(summary)`.
- Tests: `src/core/talent.test.ts`, `src/content/tooltip.test.ts`.
- Datos: el historial semanal ya guardado en IndexedDB (`PlayerHistoryEntry`: `week`, `skills`, `training`). No hace llamadas nuevas a la API.

## Conceptos de Sokker

- **Entreno avanzado** (`kind: 'individual'`, 🎯 en la tabla): entrena una skill concreta. Es el único que se usa para medir el talento.
- **Entreno de formación** (`kind: 'formation'`, 📋): se considera **entreno general (GT)**. Nunca cuenta como directo.
- **Talento**: número aproximado de entrenos directos que necesita una skill para subir un nivel. No es exacto:
  - varía con la edad (los jóvenes suben más rápido; los mayores necesitan más entrenos);
  - cada skill tiene su propio ritmo (p. ej. Pace cada ~5, Playmaking cada ~4).

## Reglas

### R1 — Entreno directo

Una semana cuenta como **entreno directo** para la skill X si y solo si se cumplen las tres condiciones:

| Condición | Valor |
|---|---|
| Tipo de entreno | `training.kind === 'individual'` |
| Skill entrenada | `training.skill === X` |
| Efectividad | `training.intensity >= 50` |

- Los **minutos jugados no cuentan**: un jugador con 0 minutos puede recibir el 50 % del entreno en la intensidad, y eso es válido.
- Las semanas sin `training` (entradas *carry-over* o *roster-fallback*) no cuentan.
- Una semana que no cumple las condiciones no suma, pero tampoco reinicia el contador.

### R2 — Subida (pop)

Hay **subida** de la skill X en la semana W cuando `skills[X]` de W es mayor que el de la entrada anterior del historial, con el historial ordenado por `week` ascendente.

- El valor de W ya incluye el entreno de W. Por eso, si W fue un entreno directo, ese entreno cuenta para el tramo que termina en esa subida.
- Es la misma detección que pinta en verde las celdas de la tabla.

### R3 — Reinicio del contador

**Cualquier subida reinicia el contador a 0**, venga del entreno directo o del GT.

### R4 — Contador "sin subir"

`sinceLastPop` = entrenos directos acumulados desde la última subida de esa skill.

- Si no hay ninguna subida de esa skill en el historial, el contador es un mínimo y se muestra como `≥ N`, porque el historial solo cubre unas 25 semanas.

### R5 — Tramos completos

Un **tramo** es el número de entrenos directos entre dos subidas consecutivas observadas.

- El tramo anterior a la **primera** subida observada es incompleto (no se sabe cuándo empezó) y **no se usa**.
- Los tramos con **0 entrenos directos** (subida solo por GT) **no se usan** para el talento, para no rebajarlo artificialmente.

### R6 — Talento por skill

`talent` = media de los tramos completos de esa skill (R5). Si no hay ninguno, el talento es desconocido (`?`).

### R7 — Talento global del jugador

`overallTalent` = suma de todos los tramos usados de todas las skills ÷ número de esos tramos. Pondera cada subida por igual. Si no hay tramos, es desconocido (`?`).

### R8 — Skills que se listan y orden

1. **Kp (keeper)** primero, solo si el último valor de keeper del historial es **mayor que 6**. Así se considera que el jugador es portero. Con 6 o menos no aparece.
2. Después, siempre en este orden: **Pc** (pace), **Tec** (technique), **Pas** (passing), **Def** (defending), **Plm** (playmaking), **Str** (striker).
3. **Stamina nunca aparece.**
4. Se muestran todas las skills de la lista aunque tengan 0 entrenos, para que el bloque tenga siempre la misma forma.

## Presentación

```
 DIRECT TRAINING SINCE LAST POP                    Est. talent ≈ 4.5
  Pc    ■■□□□   2 / ~5    last pop wk 1182 · after 5
  Tec   □□□□□   ≥ 0 / ?   no pop in history
  Plm   ■■■■□   4 / ~4    last pop wk 1176 · after 4             ▲?
```

| Elemento | Significado |
|---|---|
| `2 / ~5` | contador (R4) / talento de la skill (R6) |
| `≥ 0` | sin subida en el historial: el contador es un mínimo |
| `?` | talento desconocido (no hay tramos completos) |
| Barra `■□` | progreso del contador hacia el talento de la skill. Si la skill no tiene talento propio, usa el global (R7). Si no hay ninguno, no se pinta. Se redondea al entero más cercano. |
| `last pop wk W · after N` | semana de la última subida y entrenos directos del tramo que terminó en ella (se omite `after` si fue la primera subida observada) |
| `▲?` | subida probable: el contador ya alcanzó el talento estimado |
| `Est. talent ≈ X` | talento global del jugador (R7) |

- El texto del panel está en inglés, como el resto del tooltip.
- Números con `font-variant-numeric: tabular-nums`. La barra es decorativa (`aria-hidden="true"`). Cada fila tiene un `title` que explica el cálculo.

## Limitaciones conocidas

- El historial cubre como máximo ~25 semanas. Con poco historial, el talento será `?` o se basará en pocos tramos.
- El talento real cambia con la edad: una media de tramos antiguos puede sobrestimar la velocidad de un jugador que ha envejecido.
- Si el historial tiene semanas faltantes rellenadas como *carry-over*, esas semanas no suman entrenos directos. El contador puede quedar por debajo del real.
