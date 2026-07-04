# Resultados de Pruebas — Frontend (AutoX Insight X)

**Proyecto:** AutoX Insight X — bpA Motors · SCM Intelligence
**Componente:** Frontend SPA (React + TypeScript + Vite + TanStack Router)
**Fecha de ejecución:** 2026-07-03
**Entorno:** Vitest 4.1.9 · jsdom · Node 24 · @testing-library/react
**Comando:** `npm test` (`vitest run --config vitest.config.ts`)

---

## Resumen ejecutivo

| Categoría | Pruebas | Pasan | Fallan | Estado |
|---|---:|---:|---:|:---:|
| Unitarias | 8 | 8 | 0 | ✅ |
| Funcionales | 9 | 9 | 0 | ✅ |
| Rendimiento | 4 | 4 | 0 | ✅ |
| **TOTAL** | **20** | **20** | **0** | ✅ **100%** |

> Las pruebas de **usabilidad** (heurísticas de Nielsen aplicadas a la UI) se documentan en la sección 4.

---

## 1. Pruebas Unitarias (8) — servicios de IA (`predict.ts`)

Prueban la construcción de requests y el parseo de respuestas con `fetch` mockeado.

| Prueba | Qué valida | Resultado |
|---|---|:---:|
| `fetchPrediction` envía payload correcto | POST a `/ml/predict` con `codigo_repuesto`, `mes`, `km` (RF-09) | ✅ |
| `fetchPrediction` propaga error no-OK | Un 503 del backend lanza excepción | ✅ |
| `fetchMLStatus` devuelve métricas | Parseo de wMAPE/MAPE/MAE (RF-11) | ✅ |
| `retrainModel` envía JWT | Header `Authorization: Bearer <token>` presente (RF-15) | ✅ |
| `retrainModel` propaga detalle de error | El mensaje de gate fallido llega al usuario | ✅ |
| `fetchPurchaseSuggestions` arma query string | `mes`, `km`, `solo_quiebres`, `limite` en la URL (RF-12) | ✅ |
| `generatePurchaseOrder` envía items + auth | Items y JWT enviados; devuelve folio `OC-IA-…` (RF-12) | ✅ |

---

## 2. Pruebas Funcionales (9) — componentes de UI

Renderizan componentes reales en jsdom y verifican lo que ve el usuario.

### 2.1 Componente TopBar
| Prueba | Qué valida | Resultado |
|---|---|:---:|
| Muestra título y subtítulo | Los props se renderizan | ✅ |
| Muestra usuario autenticado | Nombre y cargo del `useAuth` | ✅ |
| Omite subtítulo si no se pasa | Renderizado condicional | ✅ |

### 2.2 Lógica de negocio de los indicadores IA
| Prueba | Qué valida | Resultado |
|---|---|:---:|
| wMAPE 33.54% → 66.5% de precisión | Traducción error→precisión para el usuario final | ✅ |
| MAPE 27.02% → 73.0% (redondeo) | Redondeo a 1 decimal | ✅ |
| 0% error → 100% precisión | Caso límite | ✅ |
| Confianza ≥ 0.80 → "alta" | Umbral de negocio (RF-10) | ✅ |
| Confianza 0.70 → "media" | Rango intermedio | ✅ |
| Confianza 0.40 → "baja" | Extrapolación | ✅ |

---

## 3. Pruebas de Rendimiento (4) — renderizado y datos en cliente (RNF-03)

**Requerimiento (RNF-03):** la SPA debe cargar y renderizar gráficos en **< 1.5 s**.

### Métricas medidas

| Operación | Tiempo medido | Umbral | Estado |
|---|---:|---:|:---:|
| Render de TopBar | 37 ms | 100 ms | ✅ |
| 50 renders consecutivos (media) | ~2.9 ms/render | 50 ms | ✅ |
| Agrupar + ordenar **5000 registros** de inventario | **6 ms** | 200 ms | ✅ **33× margen** |
| Chart Top-10 (filtro+sort+slice) sobre **600 SKUs** | **1 ms** | 50 ms | ✅ **50× margen** |

| Prueba | Qué valida | Resultado |
|---|---|:---:|
| `renderiza TopBar en < 100 ms` | Costo de montaje de componente | ✅ |
| `50 renders no degradan (media < 50 ms)` | Sin fuga de rendimiento | ✅ |
| `agrupa+ordena 5000 registros < 200 ms` | Procesamiento de inventario real en cliente | ✅ |
| `chart Top-10 sobre 600 SKUs < 50 ms` | Transformación para el gráfico de la página IA | ✅ |

> **Interpretación:** las transformaciones de datos que corren en el navegador (las que alimentan las tablas y gráficos) se completan en **milisegundos de un dígito**, muy lejos del presupuesto de 1.5 s. El cuello de botella real en producción será la latencia de red hacia Supabase/Railway, no el procesamiento en cliente.

---

## 4. Usabilidad (heurísticas de Nielsen aplicadas a la UI)

Evaluación de la página **Centro de Comando SCM Predictivo** contra las 10 heurísticas de Jakob Nielsen:

| # | Heurística | Cumple | Evidencia en la UI |
|---|---|:---:|---|
| 1 | Visibilidad del estado del sistema | ✅ | Badge "Modelo activo/Conectando/No disponible"; spinner "Reentrenando…"; barra de progreso al generar OC |
| 2 | Correspondencia sistema–mundo real | ✅ | Se tradujeron términos técnicos (wMAPE) a lenguaje de negocio ("Precisión global"); métricas como "Quiebres inminentes", "Días de cobertura" |
| 3 | Control y libertad del usuario | ✅ | Selector de escenarios (Regular/Campaña/Crisis); botón "Cerrar"/"Reintentar" en el modal de OC |
| 4 | Consistencia y estándares | ✅ | Colores semánticos uniformes (verde=ok, rojo=alerta, ámbar=advertencia) en toda la app |
| 5 | Prevención de errores | ✅ | Validación de km/mes; botón "Generar OC" deshabilitado si no hay repuestos a comprar |
| 6 | Reconocer mejor que recordar | ✅ | **Tooltips (ⓘ)** en cada indicador IA explican qué significa sin que el usuario tenga que saberlo de memoria |
| 7 | Flexibilidad y eficiencia | ✅ | Consulta predictiva puntual + generación masiva de OC; filtros por escenario |
| 8 | Diseño estético y minimalista | ✅ | Jerarquía visual clara (patrón F): banner → KPIs → gráfico → tabla |
| 9 | Ayuda a reconocer y recuperarse de errores | ✅ | Mensajes de error legibles (no códigos crudos); estado "error" en el modal con opción de reintentar |
| 10 | Ayuda y documentación | ✅ | Tooltips contextuales + explicación de la confianza en el resultado de cada predicción |

### Hallazgos de usabilidad y mejoras aplicadas
- **Problema detectado:** el usuario final (Jefe de Taller) no entendía "wMAPE 33.5%".
- **Mejora aplicada:** se convirtió a **"Precisión global 66.5%"** (100 − error) + tooltip explicativo. Un valor de "precisión" alto se interpreta como positivo, mientras que un "error" alto asustaba.

---

## Cómo reproducir

```bash
cd autox-insight-X
npm install          # incluye las devDependencies de test (vitest, testing-library)
npm test             # corre las 20 pruebas
npm run test:watch   # modo watch para desarrollo
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
