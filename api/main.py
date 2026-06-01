import os
import pickle
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent.parent / "ml" / "model.pkl"

# Estado global del modelo (cargado al arrancar)
model_bundle: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── startup ──
    if not MODEL_PATH.exists():
        log.warning(f"model.pkl no encontrado en {MODEL_PATH}. /predict no estará disponible hasta entrenar.")
    else:
        with open(MODEL_PATH, "rb") as f:
            model_bundle.update(pickle.load(f))
        log.info(f"Modelo cargado desde {MODEL_PATH}")
    yield
    # ── shutdown ──
    model_bundle.clear()


app = FastAPI(
    title="AutoX Insight API",
    description="API de predicción de demanda de repuestos para BPA Motors",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ajustar al dominio de Vercel en producción
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    codigo_repuesto: str = Field(..., description="Código del repuesto (ej. FILTRO01)")
    mes: int = Field(..., ge=1, le=12, description="Mes de la predicción (1-12)")
    km: float = Field(..., ge=0, description="Kilometraje del vehículo")
    anio: Optional[int] = Field(None, description="Año de la predicción")
    tipo_ot: Optional[str] = Field(None, description="Tipo de orden de trabajo (R, M, ...)")
    c_seguro: Optional[int] = Field(None, description="Código de seguro")


class PredictResponse(BaseModel):
    codigo_repuesto: str
    cantidad_estimada: float
    confianza: float = Field(..., ge=0.0, le=1.0, description="Confianza de la predicción (0-1)")


class HealthResponse(BaseModel):
    status: str
    modelo_cargado: bool


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_feature_vector(req: PredictRequest, encoder: dict) -> np.ndarray:
    """Construye el vector de features en el mismo orden usado al entrenar."""
    codigo_enc = encoder.get("repuesto_map", {}).get(req.codigo_repuesto, -1)
    tipo_enc = encoder.get("tipo_map", {}).get(req.tipo_ot or "", 0)
    anio = req.anio if req.anio is not None else encoder.get("anio_default", 2024)
    seguro = req.c_seguro if req.c_seguro is not None else 99

    # Orden: debe coincidir exactamente con el orden de columnas en train.py
    return np.array([[codigo_enc, req.mes, req.km, anio, tipo_enc, seguro]], dtype=float)


def _confianza(codigo_repuesto: str, encoder: dict) -> float:
    """Alta confianza si el repuesto fue visto en entrenamiento, baja si es nuevo."""
    known = encoder.get("repuesto_map", {})
    return 0.87 if codigo_repuesto in known else 0.45


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["infra"])
def health():
    return {"status": "ok", "modelo_cargado": bool(model_bundle)}


@app.post("/predict", response_model=PredictResponse, tags=["prediccion"])
def predict(req: PredictRequest):
    if not model_bundle:
        raise HTTPException(
            status_code=503,
            detail="Modelo no cargado. Ejecuta ml/train.py primero.",
        )

    model = model_bundle["model"]
    encoder = model_bundle.get("encoder", {})

    features = _build_feature_vector(req, encoder)
    raw_pred = float(model.predict(features)[0])

    # La cantidad no puede ser negativa
    cantidad = max(0.0, round(raw_pred, 2))
    confianza = _confianza(req.codigo_repuesto, encoder)

    log.info(
        f"predict | repuesto={req.codigo_repuesto} mes={req.mes} km={req.km} "
        f"→ cantidad={cantidad} confianza={confianza}"
    )

    return PredictResponse(
        codigo_repuesto=req.codigo_repuesto,
        cantidad_estimada=cantidad,
        confianza=confianza,
    )
