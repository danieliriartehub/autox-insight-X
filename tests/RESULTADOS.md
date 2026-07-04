# Resultados de Pruebas — Frontend (AutoX Insight X)

**Proyecto:** AutoX Insight X — bpA Motors · SCM Intelligence
**Componente:** Frontend SPA (React + TypeScript + Vite + TanStack Router)
**Fecha de ejecución:** 2026-07-04
**Comando ejecutado:** `npx vitest run --config vitest.config.ts --reporter=verbose`
**Resultado global:** `Test Files 3 passed (3) · Tests 20 passed (20)`

---

## Stack tecnológico de pruebas (versiones exactas verificadas en ejecución)

| Capa | Herramienta | Versión | Rol en las pruebas |
|---|---|---|---|
| Runtime | **Node.js** | 24.13.1 | Ejecución |
| Framework de test | **Vitest** | 4.1.9 | Runner, aserciones, mocks |
| Render de componentes | **@testing-library/react** | 16.3.2 | Montaje de componentes en el DOM |
| Matchers de DOM | **@testing-library/jest-dom** | 6.9.1 | `toBeInTheDocument`, etc. |
| DOM simulado | **jsdom** | 29.1.1 | Entorno de navegador headless |
| Plugin React | **@vitejs/plugin-react** | 5.2.0 | Transformación JSX/TSX |
| Cobertura | **@vitest/coverage-v8** | 4.1.9 | Medición de líneas ejecutadas |
| UI framework | **React** | 19.2.0 | Componentes bajo prueba |
| Lenguaje | **TypeScript** | 5.8.3 | Tipado de tests y código |
| Bundler | **Vite** | 7.3.1 | Resolución de módulos y alias |

**Arquitectura de la suite:**
- `tests/setup.ts` **mockea `@/lib/supabase`** (incluido `auth.getSession` que devuelve un JWT falso) y hace stub de `VITE_API_URL` → los tests no requieren backend ni credenciales.
- El objeto global **`fetch` se mockea por prueba** (`vi.fn()`), de modo que se verifica el contrato de las llamadas (URL, método, headers, body) sin salir a la red.
- `vitest.config.ts` resuelve el alias `@/ → src/` y usa el entorno `jsdom` con `globals:true`.

---

## Resumen ejecutivo

| Categoría | Pruebas | Pasan | Fallan | Estado |
|---|---:|---:|---:|:---:|
| Unitarias | 8 | 8 | 0 | ✅ |
| Funcionales | 9 | 9 | 0 | ✅ |
| Rendimiento | 4 | 4 | 0 | ✅ |
| **TOTAL** | **20** | **20** | **0** | ✅ **100%** |

**Cobertura de código:** **93.5% de líneas** en los módulos probados (`predict.ts` 93%, `TopBar` 100%). Detalle en §5.

---

## 1. Pruebas Unitarias (8) — servicios de IA (`predict.ts`)

> **Qué prueban:** construcción de requests y parseo de respuestas con `fetch` mockeado.

| Prueba | Tiempo | Hallazgo verificado |
|---|---:|---|
| `fetchPrediction envía payload correcto` | 12ms | ✅ Hace **POST a `/api/v1/ml/predict`** con `codigo_repuesto`, `mes` y `km` en el body; parsea `alta_confiabilidad` y `etiqueta_confianza` (RF-09/10). |
| `fetchPrediction propaga error no-OK` | 3ms | ✅ Un **503** del backend lanza excepción con el código → el frontend puede mostrar "Modelo no disponible". |
| `fetchMLStatus devuelve métricas` | 1ms | ✅ Parsea correctamente `modelo_cargado` y las **métricas (wMAPE 33.54)** del bundle (RF-11). |
| `retrainModel envía JWT` | 2ms | ✅ Incluye el header **`Authorization: Bearer fake-jwt-token`** y el body `correr_etl:false` (RF-15) → el reentrenamiento va autenticado. |
| `retrainModel propaga detalle de error` | 2ms | ✅ Cuando el backend rechaza por gate, el **mensaje "gate falló" llega al usuario** en vez de un error genérico. |
| `fetchPurchaseSuggestions arma query string` | 2ms | ✅ Construye la URL con **`mes`, `km`, `solo_quiebres`, `limite`** correctamente codificados (RF-12). |
| `generatePurchaseOrder envía items + auth` | 4ms | ✅ Envía **2 items + JWT**; devuelve un folio con formato **`OC-IA-…`** (RF-12) → la OC queda trazada como origen IA. |

---

## 2. Pruebas Funcionales (9) — componentes de UI y lógica de negocio

> **Qué prueban:** render de componentes reales en jsdom + la lógica de los indicadores IA.

### 2.1 Componente TopBar

| Prueba | Tiempo | Hallazgo verificado |
|---|---:|---|
| `muestra el título y subtítulo` | 76ms | ✅ Los props `title`/`subtitle` se renderizan visibles en el DOM. |
| `muestra usuario autenticado` | 10ms | ✅ Renderiza **"Oscar Perez" y "Jefe de Taller"** desde el contexto de auth mockeado. |
| `no renderiza subtítulo si no se pasa` | 7ms | ✅ Renderizado condicional correcto (sin subtítulo no rompe). |

### 2.2 Lógica de los indicadores IA (traducción error→precisión, RF-10/11)

| Prueba | Tiempo | Hallazgo verificado |
|---|---:|---|
| `wMAPE 33.54% → 66.5% de precisión` | 1ms | ✅ La conversión `100 − error` que ve el usuario final da **66.5%** (número positivo y comprensible). |
| `MAPE 27.02% → 73.0% (redondeo)` | 0ms | ✅ `72.98` se redondea a **73.0** con `.toFixed(1)` → sin decimales raros en pantalla. |
| `0% error → 100% precisión` | 0ms | ✅ Caso límite: un modelo perfecto se mostraría como 100%. |
| `Confianza ≥ 0.80 → "alta"` | 0ms | ✅ El umbral de negocio de RF-10 se aplica correctamente. |
| `Confianza 0.70 → "media"` | 0ms | ✅ Rango intermedio bien clasificado. |
| `Confianza 0.40 → "baja"` | 0ms | ✅ Extrapolación correctamente etiquetada como baja. |

---

## 3. Pruebas de Rendimiento (4) — renderizado y datos en cliente (RNF-03)

> **Requerimiento (RNF-03):** la SPA debe cargar y renderizar gráficos en **< 1.5 s**.

### Métricas medidas en esta ejecución

| Operación | Tiempo medido | Umbral | Margen |
|---|---:|---:|:---:|
| Render de TopBar | **45 ms** | 100 ms | ✅ 2.2× |
| 50 renders consecutivos (total) | **179 ms** (~3.6 ms/render) | 50 ms/render | ✅ |
| Agrupar + ordenar **5000 registros** de inventario | **6 ms** | 200 ms | ✅ **33× margen** |
| Chart Top-10 (filtro+sort+slice) sobre **600 SKUs** | **2 ms** | 50 ms | ✅ **25× margen** |

| Prueba | Tiempo | Hallazgo verificado |
|---|---:|---|
| `renderiza TopBar en < 100 ms` | 45ms | ✅ El montaje de un componente es rápido. |
| `50 renders no degradan (media < 50 ms)` | 179ms | ✅ **Sin fuga de rendimiento**: la media por render se mantiene baja tras 50 ciclos. |
| `agrupa+ordena 5000 registros < 200 ms` | 6ms | ✅ El **procesamiento del volumen real de inventario** (5000 SKUs) en cliente es casi instantáneo. |
| `chart Top-10 sobre 600 SKUs < 50 ms` | 2ms | ✅ La transformación que alimenta el gráfico de la página IA cuesta **2 ms**. |

> **Interpretación:** las transformaciones que corren en el navegador (las que alimentan tablas y gráficos) se completan en **milisegundos de un dígito**, muy lejos del presupuesto de 1.5 s. El cuello de botella real en producción será la latencia de red hacia Supabase/Railway, no el procesamiento en cliente.

---

## 4. Usabilidad (heurísticas de Nielsen aplicadas a la UI)

Evaluación de la página **Centro de Comando SCM Predictivo** contra las 10 heurísticas de Jakob Nielsen:

| # | Heurística | Cumple | Evidencia en la UI |
|---|---|:---:|---|
| 1 | Visibilidad del estado del sistema | ✅ | Badge "Modelo activo/Conectando/No disponible"; spinner "Reentrenando…"; barra de progreso al generar OC |
| 2 | Correspondencia sistema–mundo real | ✅ | Términos técnicos traducidos ("wMAPE"→"Precisión global"); métricas como "Quiebres inminentes", "Días de cobertura" |
| 3 | Control y libertad del usuario | ✅ | Selector de escenarios (Regular/Campaña/Crisis); botones "Cerrar"/"Reintentar" en el modal de OC |
| 4 | Consistencia y estándares | ✅ | Colores semánticos uniformes (verde=ok, rojo=alerta, ámbar=advertencia) |
| 5 | Prevención de errores | ✅ | Validación de km/mes; botón "Generar OC" deshabilitado si no hay repuestos a comprar |
| 6 | Reconocer mejor que recordar | ✅ | **Tooltips (ⓘ)** en cada indicador IA explican su significado sin exigir memoria |
| 7 | Flexibilidad y eficiencia | ✅ | Consulta puntual + generación masiva de OC; filtros por escenario |
| 8 | Diseño estético y minimalista | ✅ | Jerarquía visual clara (patrón F): banner → KPIs → gráfico → tabla |
| 9 | Reconocer y recuperarse de errores | ✅ | Mensajes legibles (no códigos crudos); estado "error" en el modal con opción de reintentar |
| 10 | Ayuda y documentación | ✅ | Tooltips contextuales + explicación de la confianza en cada predicción |

### Hallazgo de usabilidad y mejora aplicada
- **Problema detectado:** el usuario final (Jefe de Taller) no entendía "wMAPE 33.5%".
- **Mejora aplicada:** convertido a **"Precisión global 66.5%"** (100 − error) + tooltip explicativo. Un valor de "precisión" alto se interpreta como positivo; un "error" alto asustaba.

---

## 5. Cobertura de código

Medida con `@vitest/coverage-v8` sobre los módulos ejercitados por las pruebas.

| Métrica | Cobertura |
|---|---:|
| **Líneas** | **93.5%** (29/31) |
| Sentencias | 81.6% (31/38) |
| Funciones | 77.8% (7/9) |
| Ramas | 61.1% (22/36) |

### Detalle por módulo

| Módulo | % Líneas | % Funciones | Rol |
|---|---:|---:|---|
| `src/components/TopBar.tsx` | **100%** | 100% | Barra superior |
| `src/services/predict.ts` | **93.1%** | 75% | Servicios de IA (RF-09/10/11/12/15) |

> **El servicio que concentra toda la comunicación con el motor de IA (`predict.ts`) está cubierto al 93% de líneas.** Las 2 líneas sin cubrir (198-199) son el manejo de un error poco frecuente en la generación de OC.

> **Alcance de la medición:** corresponde a los módulos con pruebas (servicios + componente). Las páginas completas (`prediccion.tsx`, `almacen.tsx`, etc.) y los componentes de shadcn no tienen pruebas de render end-to-end; su comportamiento se valida manualmente mediante los recorridos funcionales del informe. La estrategia priorizó cubrir la **capa de servicios de IA** (lógica de negocio crítica) sobre el render presentacional.

---

## Cómo reproducir

```bash
cd autox-insight-X
npm install
npm test                                          # 20 pruebas
npx vitest run --config vitest.config.ts --reporter=verbose   # con timing por prueba
npx vitest run --config vitest.config.ts --coverage \
  --coverage.include='src/services/**' --coverage.include='src/components/TopBar.tsx'  # cobertura
```

## Cobertura de requerimientos

| Requerimiento | Cubierto por |
|---|---|
| RF-09 (predicción con km) | Unitaria `fetchPrediction` |
| RF-10 (confianza + etiqueta) | Funcional 2.2 (umbral 80%) |
| RF-11 (estado del modelo) | Unitaria `fetchMLStatus` |
| RF-12 (OC inteligente) | Unitaria `fetchPurchaseSuggestions` + `generatePurchaseOrder` |
| RF-15 (reentrenamiento) | Unitaria `retrainModel` (JWT + error) |
| RNF-03 (UI < 1.5 s) | Rendimiento 3 |
| Usabilidad | Sección 4 (heurísticas de Nielsen) |
