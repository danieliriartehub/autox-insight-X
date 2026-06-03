# Resumen Técnico de Arquitectura: AutoX Insight X

## 1. Descripción General
**AutoX Insight X** es una aplicación Full-Stack moderna que integra un modelo de Machine Learning en un entorno web interactivo. La arquitectura está dividida claramente en componentes funcionales especializados: una interfaz de usuario frontend (SPA/SSR), una API backend servida en Python para inferencia de modelos, un pipeline ETL para el procesamiento de datos, y un módulo dedicado al entrenamiento de modelos de Machine Learning. El sistema utiliza **Supabase** como base de datos central y servicio de backend-as-a-service (BaaS).

## 2. Estructura de Carpetas Principal
El proyecto sigue una estructura modular que separa las responsabilidades del ciclo de vida del dato y de la aplicación:

```text
autox-insight-X/
├── api/                # Backend API (FastAPI) para inferencia de Machine Learning.
│   ├── main.py         # Punto de entrada de la API y definición de endpoints.
│   └── requirements.txt# Dependencias de Python para la API.
├── data/               # Almacenamiento local temporal de datasets (crudos o procesados).
├── etl/                # Pipeline de Extracción, Transformación y Carga.
│   └── clean_and_load.py # Script para limpiar datos y subirlos a la base de datos.
├── ml/                 # Pipeline de Machine Learning.
│   └── train.py        # Script para el entrenamiento de modelos predictivos.
├── src/                # Código fuente del Frontend (Aplicación Web).
│   ├── components/     # Componentes de UI reutilizables (basados en Shadcn UI).
│   ├── hooks/          # Custom React hooks.
│   ├── lib/            # Utilidades y configuración de clientes (ej. cliente de Supabase).
│   ├── routes/         # Definición de rutas y vistas (TanStack Router).
│   ├── services/       # Lógica de conexión con la API externa o backend.
│   ├── main.tsx        # Punto de entrada del cliente React.
│   └── server.ts / start.ts # Configuración de renderizado y servidor SSR (TanStack Start).
├── package.json        # Dependencias y scripts del Frontend (Node.js/Bun).
└── vite.config.ts      # Configuración del bundler y entorno de desarrollo.
```

## 3. Dependencias Clave (Tech Stack)

### Frontend (TypeScript / Node.js)
- **Framework & Bundler:** React 19, Vite.
- **Enrutamiento y Estado:** `@tanstack/react-router` y `@tanstack/react-start` para un enrutamiento robusto (Full-stack React framework), junto con `@tanstack/react-query` para el manejo del estado asíncrono y caché.
- **Estilos y UI:** Tailwind CSS v4, componentes accesibles mediante Radix UI (arquitectura tipo Shadcn UI), y `lucide-react` para iconos.
- **Visualización de Datos:** Recharts (`recharts`).
- **Base de Datos / BaaS:** `@supabase/supabase-js` para autenticación y base de datos en tiempo real.

### Backend API (Python)
- **Framework:** FastAPI (`fastapi`, `uvicorn`) para crear endpoints rápidos y asíncronos.
- **Validación de Datos:** Pydantic.
- **Integración:** `supabase` (cliente de Python para interactuar con la BD).

### Machine Learning & ETL (Python)
- **Manipulación de Datos:** Pandas (`pandas`), NumPy (`numpy`).
- **Modelado Predictivo:** Scikit-Learn (`scikit-learn`), XGBoost (`xgboost`).

## 4. Interacción entre Componentes (Data Flow)

1. **Gestión de Datos (ETL):** El script `etl/clean_and_load.py` toma datos crudos (posiblemente de la carpeta `data/` o fuentes externas), realiza la limpieza y transformación necesaria (con Pandas), y carga los datos estructurados en la base de datos centralizada de **Supabase**.
2. **Entrenamiento (ML):** El módulo `ml/train.py` consume los datos limpios, entrena un modelo predictivo (utilizando Scikit-Learn y XGBoost), y serializa/guarda el modelo resultante para su uso en producción.
3. **Inferencia (Backend API):** La aplicación **FastAPI** en `api/main.py` carga el modelo pre-entrenado. Expone endpoints HTTP(S) que reciben datos de entrada desde el frontend, realizan validaciones a través de Pydantic, ejecutan el modelo predictivo, y devuelven los resultados al cliente. También puede comunicarse con Supabase si necesita consultar información adicional.
4. **Interfaz de Usuario (Frontend):** La aplicación React en `src/` interactúa directamente con **Supabase** para tareas de autenticación (login/registro) y operaciones CRUD estándar (lectura y escritura de datos). Para obtener predicciones o análisis complejos, el frontend realiza peticiones HTTP a la **API de FastAPI**, y luego visualiza estos resultados interactivos utilizando herramientas como Recharts.
