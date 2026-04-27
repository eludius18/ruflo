# Propuesta técnica: orquestación multi‑agente para *trading research* sobre Ruflo

**Estado**: propuesta inicial (sin implementación)  
**Objetivo**: sistema de *research* y detección de oportunidades (no ejecución real) con explicación, evidencias, scoring y auditoría.  
**Repo base**: Ruflo (monorepo con `v3/` como arquitectura DDD + MCP-first + plugins + memory + swarms/workflows).

**Relacionado:** multi‑proveedor LLM (no Claude requerido) y repo → `docs/trading-llm-and-repo-strategy.md`.

---

## Análisis del repositorio actual (estructura y capacidades relevantes)

### Estructura de alto nivel del repo

- **Raíz**: paquete `claude-flow` (rebrandeado como Ruflo) con tooling y empaquetado principal.
- **`v3/`**: monorepo modular (DDD + microkernel + MCP-first). Es la base más natural para construir un sistema de orquestación “productizable”.
- **`v2/`**: versión anterior con muchos ejemplos y artefactos (incluye workflows JSON orientados a research).
- **`ruflo/`**: wrapper CLI/bridge (paquete `ruflo`) para ejecutar lo mismo que `claude-flow`, y componentes auxiliares.
- **`.claude/` y `.agents/`**: catálogo de agentes/skills/comandos/plantillas e integración con flujos de trabajo para operación.
- **`tests/`**: suites de integración/regresión (Vitest en `v3/`, múltiples tests en repo).

### Mecanismos internos de orquestación ya existentes (reutilizables)

#### 1) Coordinación de agentes (Swarm)

- **Coordinación con topologías**: `mesh` y `hierarchical` (y variantes en la plataforma).
- En `v3` existe una decisión explícita de **motor canónico**:
  - ADR‑003 establece `UnifiedSwarmCoordinator` como **motor de coordinación canónico** (con `SwarmHub` como compatibilidad).  
    Ver `v3/implementation/adrs/ADR-003-CONSOLIDATION-COMPLETE.md`.

Relevancia para trading research:
- necesitamos paralelizar análisis (técnico, noticias, cuant, riesgo) y luego **sintetizar** con un coordinador.
- necesitamos **anti‑drift** y separación de responsabilidades: topología jerárquica + roles especializados encaja.

#### 2) Motor de workflows

En `v3/src/task-execution/application/WorkflowEngine.ts` existe un motor con:
- dependencias entre tareas
- ejecución paralela (`executeParallel`)
- soporte para *rollback* (cuando aplica)
- event logging y snapshots

Relevancia para trading research:
- el pipeline de oportunidad es un workflow (recoger datos → señales → scoring → auditoría → informe).
- la ejecución puede ser **mixta**: etapas paralelas + gating secuencial (auditoría antes de publicar).

#### 3) Plugins / microkernel

`v3/src/infrastructure/plugins/PluginManager.ts` + ADR‑004 (`v3/implementation/adrs/ADR-004-PLUGIN-ARCHITECTURE.md`) formalizan:
- **core pequeño** y extensiones por plugin (ext points)
- lifecycle (load/unload) y versioning básico

Relevancia para trading research:
- conectores de datos (precios, noticias), scoring, almacenamiento, “compliance/no‑advice” y exportadores de reporte deben ser **plugins** para aislar riesgos y facilitar evolución.

#### 4) Memoria unificada (cache y trazabilidad)

ADR‑006 define `MemoryService` con backends pluggables (`sqlite`, `agentdb`, `hybrid`) y TTL/metadata.  
ADR‑009 describe el enfoque híbrido (SQLite + vector search) para consultas estructuradas + semánticas.

Relevancia para trading research:
- cache de velas/precios y resultados de features (determinista)
- cache/almacén de “evidencias” y “rationale” (texto) indexables semánticamente
- histórico de señales, revisiones y decisiones (auditoría)

#### 5) Event sourcing / auditabilidad

ADR‑007 recomienda event sourcing para cambios críticos:
- lifecycle de agentes
- cambios de tarea
- decisiones de coordinación

Relevancia para trading research:
- una señal de trading debe ser **auditable** y reproducible: inputs → features → señal → revisión → publicación.

#### 6) CLI y MCP-first

El repo está orientado a **MCP-first** (ADR‑005) y CLI como wrapper:
- `v3/@claude-flow/cli/src/commands/workflow.ts` muestra el patrón: comando → llamada MCP `workflow_run` con opciones (`parallel`, `maxAgents`, `dryRun`, etc.).
- Esto sugiere una integración natural: exponer el sistema de trading research como **workflow template** (en el futuro), y opcionalmente como herramientas MCP.

#### 7) Ejemplos de workflows “research”

En `v2` hay workflows JSON que modelan pipelines de investigación con:
- agentes explícitos
- tareas con `depends`, `parallel`
- prompts y outputs estructurados

Ejemplos:
- `v2/examples/02-workflows/research-workflow.json`
- `v2/src/workflows/examples/research-workflow.json`

Esto es directamente reutilizable como **molde** conceptual para un “Market Opportunity Research Workflow”.

---

## Qué partes de Ruflo se pueden reutilizar para el caso de *trading research*

### Agentes (catálogo y patrón)

Reutilizable:
- patrón de **roles especializados** (researcher/analyst/reviewer/coordinator)
- política anti‑drift (jerárquico + coordinación + revisión)

No reutilizable “tal cual”:
- el contenido de los agentes actuales está orientado a ingeniería de software; para trading hace falta redefinir prompts, entradas/salidas y “capabilities”.

### Workflows

Muy reutilizable:
- modelado de workflow con `depends`, `parallel`, stages, timeout
- templates de tipo `research` ya existentes en CLI (aunque hoy orientados a software)

### Plugins

Altamente reutilizable:
- encapsular **data providers**, **feature extractors**, **scorers**, **auditors**, **report exporters**
- evitar acoplar lógica de mercado en el core de coordinación

### Comandos / MCP tools

Reutilizable a futuro (no ahora):
- `workflow run` como interfaz principal de ejecución
- `memory` para persistir resultados, “evidencias” y caching
- `hooks` para asegurar disciplina (pre-task routing, post-task capture)

### Configuración

Reutilizable:
- topologías (hierarchical vs mesh) y límites de agentes
- memory backend híbrido por defecto
- “tool grouping” (ADR‑035) como idea para que el sistema no exponga capacidades peligrosas (ej. “ejecutar órdenes”) si existieran en el futuro

### Testing

Reutilizable:
- Vitest e infraestructura de mocks/fixtures en `v3/` (sin añadir dependencias ahora)
- enfoque TDD/London School para nuevos módulos: mock de data providers, tests deterministas de indicadores/feature engineering

### Documentación y ADRs

Reutilizable:
- ADR‑004/006/007/009 dan guía fuerte para auditabilidad, memoria y extensibilidad.

---

## Arquitectura propuesta (adaptada a los patrones del repo)

### Principio rector

**Implementar “Trading Research” como un bounded context nuevo en `v3/src/`**, integrado por:
- workflow(s) que orquestan tareas
- coordinación vía `UnifiedSwarmCoordinator`
- persistencia/auditabilidad vía `MemoryService` (backend híbrido) + eventos
- extensibilidad vía plugins (data providers, scorers, auditoría, exportadores)

Esto respeta:
- **DDD** (ADR‑002)
- **Single Coordination Engine** (ADR‑003)
- **Plugin microkernel** (ADR‑004)
- **MCP-first** (ADR‑005)
- **Unified memory + hybrid** (ADR‑006/009)
- **Event sourcing** para decisiones críticas (ADR‑007)

### Bounded contexts propuestos (futuros, no implementación ahora)

Dentro de `v3/src/` (o como plugin oficial en `v3/plugins/`), crearíamos un dominio:

- `market-research/`
  - `domain/`
    - entidades: `Instrument`, `MarketSnapshot`, `Signal`, `Evidence`, `RiskAssessment`, `OpportunityReport`
    - value objects: `Timeframe`, `CandleSeries`, `Score`, `Confidence`, `DataFreshness`
    - eventos: `SignalGenerated`, `SignalRejected`, `OpportunityPublished`
  - `application/`
    - casos de uso: `RunOpportunityScan`, `AnalyzeInstrument`, `GenerateReport`, `AuditSignal`
  - `infrastructure/`
    - adaptadores: `PriceProvider`, `NewsProvider`, `UniverseProvider`
    - repositorios: `SignalRepository`, `CacheRepository` (usando MemoryService)
  - `api/`
    - `mcp/`: tools de “scan” / “report” (fase futura)
    - `cli/`: comando(s) opcionales (fase futura)

Y/o plugins:
- `v3/plugins/market-data/`
- `v3/plugins/news-intelligence/`
- `v3/plugins/trading-risk/`
- `v3/plugins/signal-audit/`
- `v3/plugins/report-export/`

---

## Agentes recomendados (y responsabilidades)

> Nota: aquí “agente” se refiere a rol dentro del workflow/swarm. En implementación real puede mapearse a tipos existentes + prompts especializados, o a tipos nuevos (más adelante).

### Núcleo (mínimo para MVP)

- **Agent: MarketData**
  - **Responsabilidad**: obtener/cachar precios/velas y metadata del instrumento (ISIN/ticker/exchange, currency, horarios).
  - **Salida**: dataset normalizado + “data quality” (lag, gaps).
  - **Determinista**: sí (ETL, normalización, validaciones).

- **Agent: TechnicalAnalysis**
  - **Responsabilidad**: features técnicas deterministas (MA/EMA, RSI, MACD, ATR, pivots, soportes/resistencias heurísticas).
  - **Salida**: features + explicación “mecánica” (no narrativa LLM) y gráficos (fase posterior).
  - **Determinista**: sí.

- **Agent: QuantAnalysis**
  - **Responsabilidad**: features cuantitativas (retornos, volatilidad, z-scores, régimen simple, momentum vs mean-reversion, correlaciones).
  - **Salida**: features + tests de sanidad y supuestos.
  - **Determinista**: sí (para MVP, modelos simples).

- **Agent: Risk**
  - **Responsabilidad**: sizing “teórico” (sin órdenes), riesgo por volatilidad, stops “propuestos” como *what-if*, drawdown histórico aproximado, concentración, correlación con benchmark.
  - **Salida**: `RiskAssessment` con banderas (alto apalancamiento implícito, iliquidez, gaps).
  - **Determinista**: mayoritariamente sí (reglas).

- **Agent: NewsSentiment (opcional MVP)**
  - **Responsabilidad**: resumir noticias y detectar eventos relevantes.
  - **Salida**: lista de noticias con “relevancia” y extractos citables.
  - **LLM**: probablemente sí (resumen), con fuerte *grounding* en fuentes.

- **Agent: SignalSynthesizer**
  - **Responsabilidad**: combinar features (TA/Quant/Risk/News) en una **propuesta de oportunidad** con scoring y umbrales.
  - **Salida**: `SignalCandidate` + rationale basado en evidencias estructuradas (no solo texto).
  - **Mixto**: combinación determinista + narrativa LLM controlada.

- **Agent: Auditor/Reviewer**
  - **Responsabilidad**: verificación cruzada, detección de alucinación, checks de consistencia, chequeo “no financial advice”, y veto.
  - **Salida**: `AuditResult` (approve/reject + razones + evidencias faltantes).
  - **Mixto**: determinista para checks, LLM solo para redacción/cobertura de riesgos.

- **Agent: ReportWriter**
  - **Responsabilidad**: generar informe final (Markdown) con: tesis, evidencias, score, riesgos, disclaimers, y trazabilidad.
  - **LLM**: sí, pero con plantilla rígida + referencias a evidencias.

### Agentes opcionales (post‑MVP)

- **Universe/Screening Agent**
  - filtra universo (acciones/ETFs) por liquidez, volatilidad, gaps, sector, etc.
- **Backtesting Agent**
  - aplica reglas sobre histórico (sin optimización compleja al principio).
- **Portfolio Context Agent**
  - incorpora exposición/correlaciones desde watchlists/portfolio simulado.
- **Compliance Agent**
  - asegura límites de “no asesoramiento”, no órdenes, no recomendaciones personalizadas.

---

## Comunicación entre agentes (modelo recomendado)

### Patrón

- **Memoria unificada** como bus de resultados: cada tarea escribe un artefacto estructurado en `MemoryService` (namespace por ejecución).
- **Mensajes/eventos** para coordinación: eventos de workflow y decisiones críticas (event sourcing).
- **Contrato de datos**: cada agente consume outputs de otros agentes mediante referencias (`output:task-id.field` estilo workflows actuales).

### Namespaces sugeridos en memoria

- `market-research/run/{runId}/raw/` (inputs crudos, respuestas de APIs)
- `market-research/run/{runId}/normalized/` (OHLCV normalizado)
- `market-research/run/{runId}/features/` (TA/Quant features)
- `market-research/run/{runId}/signals/` (candidatos y scoring)
- `market-research/run/{runId}/audit/` (checks, rechazos, aprobaciones)
- `market-research/run/{runId}/reports/` (Markdown final)

Con TTL:
- raw/normalized: TTL corto/medio (horas/días)
- signals/audit/reports: TTL largo (semanas/meses) por auditabilidad

---

## Flujo de orquestación recomendado

### Elección

- **Topología**: jerárquica (coordinador central) para anti‑drift y gating.
- **Ejecución**: **mixta** (paralelo para análisis, secuencial para auditoría/publicación).

### Diagrama (Mermaid)

```mermaid
flowchart TD
  A[Trigger: Opportunity Scan\n(universe o lista de tickers)] --> B[Coordinator: Plan + split]

  B --> C1[MarketData Agent\nFetch + normalize + cache]
  B --> C2[News Agent\nFetch + extract + summarize]

  C1 --> D1[TechnicalAnalysis Agent\nIndicators + levels]
  C1 --> D2[QuantAnalysis Agent\nStats + regimes]

  C2 --> D3[Event/News Signals\nrelevance + risk flags]

  D1 --> E[SignalSynthesizer\ncombine features -> SignalCandidate]
  D2 --> E
  D3 --> E

  E --> F[Risk Agent\nrisk checks + what-if stops/targets]
  F --> G[Auditor/Reviewer\nconsistency + anti-hallucination + no-advice]

  G -->|reject| R[Rejected\nstore reasons + missing evidence]
  G -->|approve| H[ReportWriter\nfinal markdown + evidence links]

  H --> I[Publish (internal)\nstore report + scoring + audit trail]
```

---

## Fuentes de datos recomendadas (MVP y evolución)

> Importante: para MVP priorizar **fuentes públicas/freemium**, con posibilidad de *mocking* y caching.

### Universo de instrumentos

- **Trading 212**: si existe API pública estable para universo/metadata y encaja con TOS (revisar límites y condiciones).
  - En MVP: considerar “universe estático” (lista de tickers) para no bloquear por integración.
- Alternativas:
  - listados públicos (exchanges) / datasets de símbolos (según instrumento/mercado)

### Precios y velas (OHLCV)

Opciones típicas (a validar por disponibilidad/TOS/ratelimits):
- **Stooq** (gratis, end‑of‑day; cobertura variable).
- **Alpha Vantage** (freemium, límites duros; útil para MVP pequeño).
- **Twelve Data** (freemium).
- **Polygon.io** (freemium/paid).
- **Yahoo Finance** (no oficial; riesgo de roturas, cuidado con TOS).

Recomendación arquitectónica:
- definir interfaz `PriceProvider` y permitir cambiar proveedor sin tocar el pipeline.

### Noticias / eventos

- **GDELT** (gratis; agregación global, útil para señales por entidad/tema).
- **NewsAPI** (freemium; depende de plan).
- RSS de fuentes oficiales/financieras (freemium; requiere normalización).

MVP pragmático:
- RSS + 1 agregador (GDELT o NewsAPI) + caching agresivo.

### Mocks para MVP

- fixtures JSON con OHLCV y noticias por ticker
- “data replay” desde ficheros para reproducibilidad de señales

---

## Qué partes deben ser deterministas vs LLM

### Deterministas (siempre que sea posible)

- adquisición/normalización de OHLCV y validación de data quality
- cálculo de indicadores técnicos y features cuantitativas
- reglas de scoring base y umbrales
- checks de riesgo (volatilidad, gaps, drawdown aproximado, liquidez si hay datos)
- auditoría de consistencia (ej. “si dices RSI<30, muéstrame el valor calculado y timestamp”)

### LLM (con límites y *grounding*)

- resumen de noticias (siempre citando fuente/fecha/título)
- redacción del informe final (a partir de evidencia estructurada)
- generación de hipótesis “explicativas” **solo** si:
  - están marcadas como hipótesis
  - no contradicen datos deterministas
  - incluyen “what to verify next”

---

## Qué datos guardar/cachear (y por qué)

### Cache de datos de mercado

- OHLCV por ticker/timeframe
- metadata del instrumento (currency, exchange, tipo)
- timestamps de última actualización

### Artefactos de ejecución (audit trail)

- features calculadas (TA/Quant) con versión de cálculo (hash de configuración)
- scoring intermedio (por sub‑señal) y score final
- decisiones del auditor (approve/reject + razones)
- reporte final y referencias

### Indexación semántica

- “evidencias textuales” (noticias, rationale, auditoría) para búsqueda posterior (“¿qué señales fallaron por X?”)

---

## Cómo evitar alucinaciones (diseño anti‑hallucination)

- **Evidence‑first**: todo claim en el reporte debe apuntar a evidencia estructurada:
  - indicador numérico con timestamp
  - noticia con URL/fuente/fecha
  - métrica de riesgo con método de cálculo
- **Auditor como gate**: si faltan evidencias → reject automático.
- **Plantillas rígidas** en ReportWriter:
  - secciones fijas
  - campos obligatorios (fuentes, supuestos, límites)
- **Separación “facts vs hypotheses”**:
  - facts: outputs deterministas
  - hypotheses: texto marcado como hipótesis
- **Reproducibilidad**:
  - guardar inputs (o referencias cacheadas) + versión de reglas + timestamps

---

## Cómo auditar las señales (gates recomendados)

### Auditoría determinista (checks automáticos)

- consistencia temporal (datos recientes vs stale)
- coherencia numérica (si score usa RSI/ATR, deben existir)
- sanity checks (volatilidad extrema, gaps, series incompletas)
- detección de overfitting (si hay backtesting futuro)
- validación de “no ejecución” (no hay endpoints/acciones que envíen órdenes)

### Auditoría semántica (LLM opcional, acotada)

- revisar que el texto no haga afirmaciones no soportadas por evidencias
- revisar que el lenguaje incluya disclaimers y no sea prescriptivo/personalizado

---

## Cómo evitar ejecución real de órdenes (límite explícito)

Diseño propuesto:
- **no** incluir conectores a brokers para órdenes en el bounded context `market-research`
- separar desde el inicio el concepto:
  - `Signal` (investigación) ≠ `Order` (ejecución)
- si en el futuro existiera “paper trading” o ejecución:
  - será **otro bounded context** con permisos/claims y tool groups separados (inspiración: “tool grouping” de ADR‑035 para reducir superficie)

---

## Aprendizaje: qué es posible y qué requiere diseño explícito

**Respuesta corta:** los agentes lógicos del pipeline **no** deben asumirse como entidades que “aprenden solas” de forma fiable. En Ruflo, la mejora en el tiempo es **opt‑in**: depende de qué almacenéis, bajo qué criterio etiquetéis resultados, y con qué gates reutilizáis o ajustáis heurísticas.

### Qué significa “aprender” en este contexto (sin confundir con magia)

| Tipo | Qué hace | ¿Automático? |
|------|----------|--------------|
| **Cache y memoria** (OHLCV, features, señales, reportes) | Acelera runs y deja trazabilidad. | Sí, si el código **persiste** (p. ej. vía `MemoryService`, namespaces, TTL). No es aprendizaje de estrategia. |
| **Búsqueda de patrones similares** (vector / ReasoningBank, según módulo activo) | “¿Hemos visto un caso parecido?” para contexto. | Sí, si **guardáis** y **indexáis** entradas; el valor depende de la calidad de la metadata. |
| **Ajuste de heurísticas / reglas** (umbrales, pesos de scoring) | Mejora medible con datos. | **No** por defecto: hace falta bucle explícito (señal → desempeño al cabo de T) + revisión. |
| **Re‑entrenamiento o routing neuronal** (SONA, hooks de post‑task, etc. en Ruflo) | Puede reforzar rutas o patrones. | Módulos y **política**; no sustituyen validación en mercado ni compliance. |

### Comportamiento por defecto (recomendado para el MVP de research)

- **Sin bucle de aprendizaje de estrategia:** el pipeline es *stateless* salvo caché/memoria de ejecución y artefactos auditables.
- **Nada de auto‑tuning ciego** de parámetros de señal sin: dataset etiquetado, reglas de rollback y pruebas (idealmente backtesting o al menos *sanity* fuera de muestra en fase posterior).

### Qué se puede añadir después (diseñado, no “emergente”)

1. **Cierre de ciclo (supervisado o semi‑supervisado)**  
   - Guardar por cada señal: `signal_id`, input hash, reglas/versión, features clave, timestamp.  
   - Más tarde (tarea batch o operador): añadir **etiqueta de desempeño** (p. ej. MFE/MAE, retorno a T días, drawdown) según definiáis — sin confundir con asesoramiento, solo métrica interna de calidad.  
   - Eso alimenta tablas/namespace `market-research/outcomes/` y permite reportes: “tasa de acierto aproximada bajo supuestos X”.

2. **Reutilización conservadora**  
   - Antes de reutilizar un “patrón” guardado, **consultar otra vez datos frescos** (mercado cambia).  
   - Opcional: priorizar señales similares solo como **sugerencia de contexto** al revisor, no como sustituto de cálculo determinista.

3. **Ajuste de pesos / umbrales (solo con gates)**  
   - Cambios de `weight_RSI` o `score_threshold` solo vía: PR/revisión, tests de regresión, y en fase avanzada **backtesting** acotado (ver roadmap Fase 3).  
   - Límite: no optimizar en exceso sobre pocos datos (riesgo de *overfitting*).

4. **Capas de Ruflo (memory + hooks + neural, si se activan)**  
   - Coherentes con el repo, pero en trading research su uso debería ser **conservador** y secundario al núcleo determinista + auditoría.  
   - Cualquier “patrón aprendido” de texto (LLM) no debe reescribir señales numéricas sin pasar por validación.

### Riesgos si se malinterpreta el “aprendizaje”

- **Falsa mejora:** ajustar reglas a ruido reciente.  
- **Cumplimiento:** personalización implícita a partir de memoria. Mitigar con política explícita (no usamos memoria de usuario para señal personalizada, etc., alineado con sección de no asesoramiento).  
- **Reproducibilidad:** modelos/LLM que varían; por eso se versionan reglas, prompts y, cuando aplique, proveedor+modelo (ver `docs/trading-llm-and-repo-strategy.md`).

### Relación con el documento de proveedores LLM

- Cambiar de modelo o proveedor no es “aprender”: es **configuración** (ver matriz y ADR‑011 allí).  
- El aprendizaje estructurado (outcomes) puede coexistir con **cualquier** proveedor en la capa LLM.

---

## MVP mínimo (recomendación)

### Alcance MVP (2–4 semanas, según dedicación)

- Input: lista explícita de tickers/ISINs (10–50) + timeframes (1D/1H)
- Pipeline:
  - MarketData (fetch + cache)
  - TA + Quant (features deterministas)
  - Risk (checks y banderas)
  - Synthesizer (score + candidate)
  - Auditor (gating)
  - ReportWriter (Markdown)
- Output:
  - `OpportunityReport` por instrumento
  - ranking final (top N) con score y “por qué”
- Persistencia:
  - MemoryService (hybrid) con namespaces por run

### Lo que **NO** entra en MVP

- backtesting completo
- ajuste automático de reglas/umbrales sin revisión (aprendizaje de estrategia no supervisado)
- bucles neurales “optimizando señales” sin métricas y tests explícitos
- alertas push (email/telegram)
- watchlists persistentes multi‑usuario
- paper trading
- ejecución real

---

## Roadmap por fases (evolución)

### Fase 0 — Propuesta y contrato de datos (ahora)

- definir entidades/DTOs y el contrato de evidencia
- decidir proveedor de OHLCV del MVP

### Fase 1 — MVP “scan + report”

- workflow template `market-opportunity-research`
- caché + features deterministas + auditoría + reporte

### Fase 2 — Watchlists y alertas

- watchlists por usuario/proyecto
- alertas por umbral de score / eventos de riesgo
- “delta scans” (solo cambios nuevos)

### Fase 3 — Backtesting y evaluación

- backtesting simple de reglas (sin optimización agresiva)
- métricas: hit rate, max drawdown, expectancy, turnover
- separación clara: research vs evaluación
- (opcional) cierre de ciclo: persistir *outcomes* y usar solo para **informes de calidad** y gates de ajuste manual o semi‑supervisado

### Fase 3b — Aprendizaje supervisado / ajuste controlado (opcional, después de 3)

- requisitos: histórico de señales + outcomes etiquetables + reglas de versión
- cambios de heurísticos **solo** con: revisión, tests de regresión, y límites anti–overfitting
- sin sustituir auditoría humana/negocio donde haga falta

### Fase 4 — Paper trading (separado)

- bounded context independiente
- simulación de ejecución (slippage/spread)
- auditoría y permisos

### Fase 5 — Ejecución real (futuro, separado y opt‑in)

- otro bounded context + claims/permisos + tool groups específicos
- hard‑gates humanos (aprobación manual)

---

## Riesgos (técnicos y financieros)

### Técnicos

- **Calidad de datos**: huecos, splits/dividendos, timezones, velas inconsistentes.
- **Rate limits / TOS**: APIs gratuitas pueden cortar o cambiar.
- **Reproducibilidad**: sin versionado de reglas y cache, la señal no se puede auditar.
- **Tool sprawl**: demasiadas capacidades activas aumenta error; mitigar con “tool grouping” y superficies mínimas.

### Financieros / de producto

- **Falsa confianza**: scoring puede interpretarse como recomendación.
- **Sesgo**: noticias/sentimiento pueden ser ruidosos.
- **Riesgo de compliance**: lenguaje prescriptivo o personalizado puede considerarse asesoramiento.

---

## Límites para evitar asesoramiento financiero (y cómo reflejarlos en el sistema)

- siempre incluir disclaimers: “información educativa/investigación”, “no asesoramiento”.
- no personalizar a la situación del usuario (perfil, patrimonio, objetivos) en el motor.
- no recomendar “compra/vende” como mandato; usar lenguaje tipo:
  - “posible escenario”, “hipótesis”, “nivel a vigilar”, “condiciones de invalidación”
- requerir “evidencias” y “riesgos” por cada señal.

---

## Preguntas abiertas / decisiones pendientes

1. **Proveedor OHLCV del MVP**: ¿preferencia por EOD vs intradía? ¿mercados objetivo?
2. **Universo**: ¿acciones US/EU? ¿ETFs? ¿limitado a Trading 212 instruments?
3. **Latencia**: ¿batch diario (EOD) o near‑real‑time?
4. **Formato de salida**: ¿Markdown puro? ¿JSON + Markdown?
5. **Persistencia**: ¿basta con `MemoryService` local o queréis exportar a DB externa en fases futuras?
6. **Política de aprendizaje**: ¿MVP 100% sin ajuste de reglas, o aceptáis cierre de ciclo con outcomes *solo* para análisis interno (no auto‑tuning) desde fase 3?

---

## Anexo: dónde encaja esto en el repo (sin implementar aún)

En una implementación futura, lo más coherente sería:
- **Nuevo bounded context**: `v3/src/market-research/` (DDD como ADR‑002)
- **Workflow template**: cerca del motor de workflows o en un directorio de plantillas (según convención existente del repo)
- **Plugins de datos**: `v3/plugins/*` (siguiendo ADR‑004/ADR‑015)
- **MCP tools** (fase posterior): `v3/mcp/tools/` o plugin que registre MCP tools
- **Tests**: `v3/__tests__/integration/` + tests unitarios en el dominio/plugin correspondiente

