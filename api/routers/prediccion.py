# ── Router de predicción ML ────────────────────────────────────────────────────
# Endpoints para el modelo de Machine Learning (XGBoost).
# Se monta en main.py con prefix "/ml".
#
# Endpoints:
#   GET  /ml/health   → estado del modelo
#   POST /ml/predict  → predicción individual de demanda

import pickle
import logging
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

router = APIRouter(tags=["prediccion-ml"])

# ── Carga del modelo ──────────────────────────────────────────────────────────
# Busca model.pkl en ../../ml/model.pkl relativo a este archivo
_MODEL_PATH = Path(__file__).parent.parent / "ml" / "model.pkl"
_bundle: dict = {}


def _load_model() -> None:
    """Carga el modelo serializado en memoria. Se invoca desde el lifespan."""
    global _bundle
    if not _MODEL_PATH.exists():
        log.warning(
            f"model.pkl no encontrado en {_MODEL_PATH}. "
            "El endpoint /ml/predict no estará disponible."
        )
        return
    with open(_MODEL_PATH, "rb") as f:
        _bundle = pickle.load(f)
    log.info(f"Modelo ML cargado (v{_bundle.get('version', '?')}) desde {_MODEL_PATH}")


# Función para invocar desde el startup del backend principal
def startup_ml():
    _load_model()


# ── Schemas ───────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    codigo_repuesto: str = Field(
        ...,
        description="Codigo del repuesto (ej. FILTRO-01)",
        examples=["FILTRO-01"]
    )
    mes: int = Field(..., ge=1, le=12, description="Mes de prediccion (1-12)")
    anio: Optional[int] = Field(None, description="Anio de prediccion (default: anio del entrenamiento)")
    km: Optional[float] = Field(0, ge=0, description="Kilometraje promedio del vehiculo")


class PredictResponse(BaseModel):
    codigo_repuesto: str
    mes: int
    anio: int
    cantidad_estimada: float = Field(..., description="Unidades estimadas a demandar")
    confianza: float = Field(..., ge=0.0, le=1.0, description="Confianza de la predicción (0-1)")
    repuesto_conocido: bool = Field(..., description="True si el repuesto fue visto en entrenamiento")


class MLHealthResponse(BaseModel):
    status: str
    modelo_cargado: bool
    version: Optional[str] = None
    total_repuestos_conocidos: Optional[int] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_feature_vector(req: PredictRequest, encoder: dict) -> np.ndarray:
    """
    Construye el vector de features en el orden exacto usado por train.py:
    [codigo_enc, mes, anio, km_enc]
    """
    import math

    repuesto_map: dict = encoder.get("repuesto_map", {})

    codigo_enc = repuesto_map.get(req.codigo_repuesto, -1)  # -1 = desconocido
    anio = req.anio if req.anio is not None else encoder.get("anio_default", 2025)
    km = req.km if req.km is not None else encoder.get("km_default", 0)
    km_enc = math.log1p(km)  # transformación logarítmica del kilometraje

    return np.array([[codigo_enc, req.mes, anio, km_enc]], dtype=float)


def _compute_confianza(req: PredictRequest, encoder: dict) -> tuple[float, bool]:
    """
    Calcula la confianza según si el repuesto fue visto en entrenamiento:
    - Conocido: 0.87 (alta confianza)
    - Desconocido: 0.45 (baja confianza, extrapolación)
    """
    repuesto_map: dict = encoder.get("repuesto_map", {})
    known = req.codigo_repuesto in repuesto_map
    return (0.87 if known else 0.45), known


# ── Endpoints ─────────────────────────────────────────────────────────────────

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health", response_model=MLHealthResponse)
def ml_health():
    """Retorna el estado del módulo ML: versión, repuestos conocidos, etc."""
    if not _bundle:
        return MLHealthResponse(status="degraded", modelo_cargado=False)
    encoder = _bundle.get("encoder", {})
    return MLHealthResponse(
        status="ok",
        modelo_cargado=True,
        version=_bundle.get("version"),
        total_repuestos_conocidos=len(encoder.get("repuesto_map", {})),
    )


@router.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    """
    Predice la demanda estimada de un repuesto para un mes/año específicos.
    Usa el modelo XGBoost preentrenado y el encoder serializado en model.pkl.
    """
    if not _bundle:
        raise HTTPException(
            status_code=503,
            detail="Modelo ML no cargado. Verifica que ml/model.pkl existe en el servidor."
        )

    model = _bundle["model"]
    encoder = _bundle.get("encoder", {})

    features = _build_feature_vector(req, encoder)
    raw_pred = float(model.predict(features)[0])
    cantidad = max(0.0, round(raw_pred, 2))

    confianza, repuesto_conocido = _compute_confianza(req, encoder)

    anio = req.anio if req.anio is not None else encoder.get("anio_default", 2025)

    log.info(
        f"predict | repuesto={req.codigo_repuesto} mes={req.mes}/{anio} "
        f"km={req.km} tipo={req.tipo_ot} → "
        f"cantidad={cantidad} confianza={confianza} conocido={repuesto_conocido}"
    )

    return PredictResponse(
        codigo_repuesto=req.codigo_repuesto,
        mes=req.mes,
        anio=anio,
        cantidad_estimada=cantidad,
        confianza=confianza,
        repuesto_conocido=repuesto_conocido,
    )
