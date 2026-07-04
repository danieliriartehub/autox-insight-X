# Plan Integral de Ejecución de Pruebas — AutoX Insight X (Frontend)

**Proyecto:** AutoX Insight X — SCM Intelligence para bpA Motors
**Alcance:** Backend (FastAPI + XGBoost) y Frontend (React SPA)
**Este documento:** plan del **Frontend**. El plan espejo del Backend está en `autox-insight-backend/tests/PLAN.md`.

---

## 1. Objetivo

Verificar que la SPA consume correctamente los servicios de IA, renderiza los datos
de forma performante y ofrece una experiencia usable para el usuario final (Jefe de
Taller / Almacén), mediante cuatro tipos de pruebas: **funcionales, unitarias, de
rendimiento y de usabilidad**.

## 2. Estrategia por tipo de prueba

| Tipo | Qué prueba | Herramienta | Archivo |
|---|---|---|---|
| **Unitarias** | Servicios de IA: construcción de requests, parseo, auth | Vitest | `unit.predict.test.ts` |
| **Funcionales** | Componentes de UI renderizados + lógica de negocio de indicadores | Vitest + Testing Library | `functional.ui.test.tsx` |
| **Rendimiento** | Tiempo de render y de procesamiento de datos en cliente (RNF-03) | Vitest + `performance.now` | `performance.render.test.tsx` |
| **Usabilidad** | Heurísticas de Nielsen aplicadas a la UI | Evaluación documentada | `RESULTADOS.md §4` |

## 3. Entorno de pruebas

- Vitest 4 sobre jsdom, `@testing-library/react`.
- **Supabase y `fetch` se mockean** (`setup.ts`) → los tests no requieren backend ni
  credenciales reales; se simulan las respuestas del API.

## 4. Matriz de cobertura (requerimiento → prueba)

| Requerimiento | Tipo de prueba | Caso |
|---|---|---|
| RF-09 (predicción con km) | Unitaria | `fetchPrediction envía payload` |
| RF-10 (confianza + etiqueta) | Funcional | `Etiqueta de confiabilidad por umbral` |
| RF-11 (estado del modelo) | Unitaria | `fetchMLStatus devuelve métricas` |
| RF-12 (OC inteligente) | Unitaria | `fetchPurchaseSuggestions`, `generatePurchaseOrder` |
| RF-15 (reentrenamiento) | Unitaria | `retrainModel envía JWT` |
| RNF-03 (UI < 1.5 s) | Rendimiento | `Rendimiento de renderizado y datos` |
| Usabilidad | Heurística | `RESULTADOS.md §4` (Nielsen) |

## 5. Criterios de aceptación

- ✅ 100% de las pruebas automatizadas pasan.
- ✅ Procesamiento de datos en cliente muy por debajo del presupuesto de 1.5 s.
- ✅ Las llamadas protegidas envían el JWT de Supabase.
- ✅ Los indicadores IA se presentan en lenguaje de negocio comprensible.

## 6. Ejecución

```bash
cd autox-insight-X
npm install
npm test              # 20 pruebas
npm run test:watch    # modo desarrollo
```

## 7. Resultados

Ver **`RESULTADOS.md`** (mismo directorio) para el detalle completo con métricas.
**Última ejecución: 20/20 pruebas ✅ · procesar 5000 registros 6 ms · chart Top-10 1 ms.**

## 8. Riesgos y limitaciones conocidas

- Las pruebas usan `fetch` mockeado; la integración real con el backend Railway se
  valida manualmente (recorridos funcionales del informe).
- El rendimiento medido es de procesamiento en cliente; la latencia percibida real
  depende también de la red hacia Supabase/Railway.
