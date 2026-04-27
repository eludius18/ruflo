# Estrategia: modelos no Claude + organización de repo (trading research)

**Objetivo:** ejecutar el pipeline de *trading research* (y, en fases futuras, el producto) **sin depender hoy de Claude/Anthropic**, pudiendo añadirlo **más adelante** u online con otros (OpenAI, Google, Ollama, OpenRouter, etc.).

**Contexto en este repo:** ya existe un sistema unificado de proveedores LLM (paquete `v3/@claude-flow/providers`, **ADR-011** `v3/implementation/adrs/ADR-011-llm-provider-system.md`) con interface común, `ProviderManager` (failover, coste, circuit breaker) y proveedores como `openai`, `google`, `ollama`, `ruvector`, además de rutas tipo **OpenRouter/LiteLLM** documentadas en el propio módulo.

Ese patrón es la base natural para no acoplarse a un solo modelo.

---

## 1) Principio de diseño: LLM = adaptador, no orquestador

- **Orquestación** (workflows, swarm, tareas, memoria): Ruflo tal como ya está planteado en v3.
- **Razonamiento / redacción** (resúmenes de noticias, redacción de informe, revisión de texto): **cualquier** implementación de `ILLMProvider` inyectada por configuración, **no** hardcode de “llama a Claude”.

Cada “agente” lógico del trading pipeline debe recibir o resolver:

- `provider`: p.ej. `openai` | `google` | `ollama` | `openrouter` | (futuro) `anthropic`
- `model`: id de modelo concreto según el proveedor

Así, cambiar de modelo = cambiar **config** (y tests), no reescribir lógica de negocio.

---

## 2) Cómo conectar “otros modelos” hoy (sin Claude)

### Opción A — Varios proveedores nativos (recomendada para producción clara)

Usar el stack ya previsto en ADR-011:

| Proveedor | Uso típico en el pipeline | Notas |
|-----------|---------------------------|--------|
| **OpenAI** (`openai`) | Resúmenes, informe, razonamiento medio | Muy usado, API estable |
| **Google** (`google`) | Mismo rol con Gemini | Buen coste/latencia en muchos casos |
| **Ollama** (`ollama`) | Desarrollo local, privacidad, cero coste variable | Depende de tu hardware |
| **OpenRouter** (vía integración con proveedor unificado) | Un solo cliente HTTP, muchos modelos | Simplifica experimentación (model id `proveedor/modelo`) |

**Ventaja:** un solo “contrato” de request/response en el código (`LLMRequest` / `LLMResponse` en `v3/@claude-flow/providers`).

### Opción B — OpenRouter o LiteLLM como “fachada única” (recomendada para experimentar rápido)

Si el objetivo inmediato es probar muchos modelos (incl. los que hoy no tienes vía un SDK concreto), enrutar todo a **una** base URL (OpenRouter / proxy LiteLLM) y mapear `model` a strings.

**Ventaja:** mínima fricción; **riesgo:** dependes de un intermediario (latencia, TOS, key rotation).

### Opción C — Solo modelos locales (MVP offline)

`ollama` o RuVector/ruvLLM para entornos sin claves de cloud. Encaja con pipelines donde el valor está en el **código determinista** (OHLCV, features) y el LLM es solo el “relator”.

---

## 3) Cómo repartir modelos por tarea (sin mezclar preocupaciones)

No hace falta un solo modelo “grande” para todo. Patrón práctico:

| Etapa del pipeline | Tipo de modelo | Criterio |
|-------------------|----------------|----------|
| ETL, indicadores, scoring numérico | N/A (determinista) | Sin LLM o LLM = 0% |
| Resúmenes de noticias | Rápido y barato | Bajo coste, buen límite de tokens |
| Redactor de informe | Calidad de texto estructurado | Mejor calidad, plantilla fija |
| Revisor/auditor (anti alucinación) | Más conservador o reglas + LLM de segunda opinión | Opcional: modelo distinto o misma capa con prompt distinto |

En configuración, suele resolverse con un mapa, por ejemplo (concepto):

- `trading.summarizer` → `openai` + `gpt-4o-mini`
- `trading.report` → `openai` + `gpt-4o`
- `trading.audit` → `google` + `gemini-1.5-flash` o segundo proveedor

La implementación concreta puede vivir en **variables de entorno** o en un `config` versionado (sin secretos en git).

---

## 4) Seguridad y secretos (igual tengas Claude o no)

- Nunca fijar API keys en código; usar `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `OLLAMA_HOST`, etc. según proveedor.
- Rotación y entornos separados (dev/stage/prod).
- Si usas un solo “gateway” (OpenRouter), **una** key para experimentación, otras directas en prod si lo preferís.

---

## 5) Integración con la propuesta de *trading research* (`docs/trading-agents-proposal.md`)

Donde el documento de trading habla de “LLM” para noticias/informe, la implementación concreta debe ser:

1. `MarketResearchLlm` (nombre interno) que internamente hace `ProviderManager` + `LLMRequest`.
2. Tests con **mocks** del `ILLMProvider` (TDD, sin red).
3. Documentar en un único sitio el **“model matrix”** (ver sección 3 de este archivo).

Nada de esto obliga a Claude. Anthropic se añade como **otra fila** en la matriz cuando quieras.

---

## 5b) Aprendizaje automático de los agentes vs elección de modelo (no confundir)

- **Cambiar proveedor o modelo** (OpenAI, Gemini, Ollama, …) = **configuración**; no implica que el sistema “aprenda” a operar mejor por sí solo.
- **Aprendizaje o mejora sostenida** = diseño explícito: qué se guarda, cómo se etiqueta el resultado de una señal en el tiempo, bajo qué política se ajusta un umbral, y con qué revisiones. Eso está detallado en el plan principal:

`docs/trading-agents-proposal.md` — sección **“Aprendizaje: qué es posible y qué requiere diseño explícito”**.

MVP: pipeline **sin** auto‑tuning ciego; fases posteriores pueden añadir cierre de ciclo supervisado y, más adelante, backtesting antes de tocar heurísticos.

---

## 6) ¿Crear **otro repositorio** en GitHub o seguir en este monorepo?

Resumen para decidir.

### Seguir en **este** repo (Ruflo)

**Tiene sentido si:**

- Queréis reutilizar **providers, memoria, workflows, plugins, tests** sin duplicar.
- El *trading research* es un **bounded context** o plugin dentro de `v3/`.
- Un solo equipo; un solo versionado; CI compartida.

**Inconveniente:** el repositorio es enorme; clones y CI más pesados. Mitigable con `sparse checkout` o jobs que solo tocan `v3/`.

### Crear un **repo de aplicación** (producto) aparte, que **dependa** de Ruflo

**Tiene sentido si:**

- El producto (UI, despliegue, datos sensibles) debe vivir con ciclo de vida y permisos distintos.
- No queréis forkear Ruflo entero: el repo app solo hace `npm`/`pnpm` a `@claude-flow/*` o publicáis vuestro fork empaquetado.
- Múltiples productos (p.ej. otra app) sobre la misma librería.

**Cómo enlazarlo (concepto):**

- `mi-org/trading-research-app` (privado) → depende de:
  - paquetes publicados `ruflo` / `claude-flow` / tu fork publicado, **o**
  - `file:../ruflo` / git submodule / `workspace` en un meta-repo, según gusto de equipo.

### Fork **completo** de ruflo a tu usuario

Solo lo recomendaría si vais a **cambiar el core** con frecuencia o mantener una rama “producto” a largo plazo. Sube el coste de *merge* con upstream. Para “solo añadir trading research” suele bastar rama o plugin en un solo repo.

**Recomendación pragmática:**

- **Ahora (MVP + proveedores no Claude):** mismo repositorio, rama o carpeta bajo `v3/` (como en la propuesta), sin duplicar infra.
- **Cuando haya producto/UX propio o despliegue aislado:** extraer **solo** la app a un repo hijo, manteniendo la librería o fork actualizado con upstream.

---

## 7) Qué añadir / mantener en documentación (checklist)

- [x] **Este archivo** (`trading-llm-and-repo-strategy.md`) — matriz de proveedores y decisión de repo; §5b aprendizaje vs modelos.
- [x] `docs/trading-agents-proposal.md` — sección de **aprendizaje** (qué es posible, MVP sin auto‑tuning) + enlace lógico a la estrategia LLM.
- [ ] Cuando exista, un `config` de ejemplo (sin claves) con nombres de `provider` y `model` por rol.
- [ ] Procedimiento: “cómo añadir Anthropic/Claude el día X” = nueva entrada en la matriz + prueba de humo con `ProviderManager`.

---

## 8) Preguntas a cerrar (rápidas, para afinar el plan)

1. **¿Cloud obligatorio o local (Ollama) para el primer barrido?**
2. **¿Un solo proveedor hoy (p.ej. OpenAI) o abrir con OpenRouter desde el día 1?**
3. **¿Necesitáis UI propia?** (si sí, a medio plazo suele empujar a repo app separado)

---

*Última actualización: alineado con ADR-011 (LLM Provider System) y el módulo `v3/@claude-flow/providers`.*
