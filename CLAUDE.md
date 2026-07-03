# AutoX Insight X — Frontend (bpA Motors)

Proyecto universitario USIL para **bpA Motors**, taller automotriz multimarca en Surquillo (Lima).
Plataforma web periférica de analítica predictiva para la cadena de suministro (SCM Intelligence).

## Stack

- **Frontend** (este repo): React + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Router. Recharts para gráficos. Desplegado en Vercel (Lovable).
- **Backend**: FastAPI + XGBoost, desplegado en Railway → `autox-insight-backend`.
- **Datos**: PostgreSQL en Supabase (Auth JWT + tablas transaccionales). El frontend lee datos directo vía `@/lib/supabase`; las predicciones y acciones IA van al backend Railway.

## Módulo de IA (el núcleo del proyecto)

El objetivo es: **ETL → modelo XGBoost → API → integración con el frontend** para predecir demanda de repuestos.
Modelo `demand-forecast v3` (XGBoost Regressor). Datos históricos reales de OTs (2023–2026).

### Servicios IA — `src/services/predict.ts`
| Función | Endpoint backend | Requerimiento |
|---|---|---|
| `fetchPrediction` | `POST /api/v1/ml/predict` | RF-09 (predicción con km) + RF-10 (confianza real) |
| `fetchMLStatus` | `GET /api/v1/ml/status` | RF-11 (salud del modelo + métricas) |
| `retrainModel` | `POST /api/v1/ml/retrain` | RF-15 (reentrenar con gate de calidad + hot-reload) |
| `fetchPurchaseSuggestions` | `GET /api/v1/purchase-orders/suggestions` | RF-12 (cruza stock vs demanda IA) |
| `generatePurchaseOrder` | `POST /api/v1/purchase-orders/generate` | RF-12 (persiste OC en `orden_compra_detalle`) |

Las llamadas protegidas (retrain, generar OC) envían el JWT de Supabase (`supabase.auth.getSession()`).

### Confianza (RF-10)
Ya **no es un valor fijo**: el backend calcula la confianza por densidad histórica del SKU +
magnitud de demanda. Un SKU se etiqueta `"Alta Confiabilidad"` si supera el umbral del 80%;
de lo contrario advierte que es una extrapolación de baja confianza.

### Sobre las métricas
La demanda de repuestos es **intermitente** (~45% de registros son de 1 unidad), por lo que el MAPE
clásico se dispara y NO es representativo. El modelo reporta y "gatea" con **wMAPE** (error ponderado
por volumen) y **MAPE de alta rotación** (SKUs con demanda ≥5, donde el % sí es significativo).

## Página clave
`src/routes/prediccion.tsx` — Centro de Comando SCM Predictivo: banner de salud del modelo con
métricas reales + botón de reentrenamiento, predictor puntual con confianza real, y generador de
Órdenes de Compra que persiste de verdad en la base de datos.

## Verificación
- Typecheck: `npx tsc --noEmit`
- Build: `npx vite build`
