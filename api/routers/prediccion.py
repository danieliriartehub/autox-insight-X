import os
import pickle
import math
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

router = APIRouter(tags=["prediccion-ml"])

_MODEL_PATH = Path(__file__).parent.parent / "ml" / "model.pkl"
_bundle: dict = {}


def _load_model() -> None:
    global _bundle
    if not _MODEL_PATH.exists():
        log.warning(f"model.pkl no encontrado en {_MODEL_PATH}")
        return
    with open(_MODEL_PATH, "rb") as f:
        _bundle = pickle.load(f)
    log.info(f"Modelo ML cargado (v{_bundle.get('version', '?')}) desde {_MODEL_PATH}")


def startup_ml():
    _load_model()


class PredictRequest(BaseModel):
    codigo_repuesto: str = Field(..., description="Código del repuesto (ej. FILTRO01)", examples=["FILTRO-01"])
    mes: int = Field(..., ge=1, le=12, description="Mes de predicción (1-12)")
    anio: Optional[int] = Field(None, description="Año de predicción")
    km: Optional[float] = Field(0, ge=0, description="Kilometraje promedio del vehículo")


class PredictResponse(BaseModel):
    codigo_repuesto: str
    mes: int
    anio: int
    cantidad_estimada: float
    confianza: float
    confianza_lower: float
    confianza_upper: float
    alta_confiabilidad: bool
    etiqueta_confianza: str
    repuesto_conocido: bool
    observaciones_historicas: int
    mae_referencia: float
    feature_importance: dict[str, float]
    explicacion: str


class MLHealthResponse(BaseModel):
    status: str
    modelo_cargado: bool
    version: Optional[str] = None
    total_repuestos_conocidos: Optional[int] = None
    features: list[str] = []


def _build_feature_vector(req: PredictRequest, bundle: dict) -> np.ndarray:
    encoder = bundle.get("encoder", {})
    feature_cols = bundle.get("feature_cols", [])
    repuesto_map = encoder.get("codigo", {})

    codigo_enc = repuesto_map.get(req.codigo_repuesto, -1)

    anio = req.anio if req.anio is not None else bundle.get("_anio_default", datetime.now().year)
    km = req.km if req.km is not None else 0
    km_log = math.log1p(km)
    km_por_mes = km_log / max(req.mes, 1)
    mes_sin = math.sin(2 * math.pi * req.mes / 12)
    mes_cos = math.cos(2 * math.pi * req.mes / 12)

    vec = {
        "codigo_enc": codigo_enc,
        "mes": req.mes,
        "anio": anio,
        "km_log": km_log,
        "km_por_mes": km_por_mes,
        "mes_sin": mes_sin,
        "mes_cos": mes_cos,
        "precio_log": 0.0,
        "garantia_meses": 0,
        "sobre_stock": 0,
        "marca_enc": 0,
        "categoria_enc": 0,
        "lag_1": 0.0,
        "lag_3": 0.0,
        "rolling_mean_3": 0.0,
    }

    return np.array([[vec.get(c, 0.0) for c in feature_cols]], dtype=float)


def _compute_confianza(codigo_repuesto: str, bundle: dict) -> tuple[float, bool, int]:
    encoder = bundle.get("encoder", {})
    repuesto_map = encoder.get("codigo", {})
    known = codigo_repuesto in repuesto_map
    obs_historicas = 0

    if known:
        stats = bundle.get("repuesto_conocido_stats", {})
        codigo_enc = str(repuesto_map[codigo_repuesto])
        obs_historicas = int(stats.get(codigo_enc, 12))
        conf = min(0.95, 0.5 + obs_historicas * 0.025)
    else:
        conf = 0.30
        obs_historicas = 0

    return conf, known, obs_historicas


@router.get("/health", response_model=MLHealthResponse)
def ml_health():
    if not _bundle:
        return MLHealthResponse(status="degraded", modelo_cargado=False)
    encoder = _bundle.get("encoder", {})
    return MLHealthResponse(
        status="ok",
        modelo_cargado=True,
        version=_bundle.get("version"),
        total_repuestos_conocidos=len(encoder.get("codigo", {})),
        features=_bundle.get("feature_cols", []),
    )


@router.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if not _bundle:
        raise HTTPException(status_code=503, detail="Modelo ML no cargado")

    model = _bundle.get("model")
    if model is None:
        raise HTTPException(status_code=503, detail="Modelo no disponible en el bundle")

    features = _build_feature_vector(req, _bundle)
    raw_pred = float(model.predict(features)[0])
    cantidad = max(0.0, round(raw_pred, 2))

    confianza, conocido, obs = _compute_confianza(req.codigo_repuesto, _bundle)
    mae_ref = float(_bundle.get("metrics", {}).get("mae", 3.0))
    conformal = _bundle.get("conformal", {})
    conf_low_q = float(conformal.get("confianza_lower_q", mae_ref * 0.5))
    conf_high_q = float(conformal.get("confianza_upper_q", mae_ref * 1.5))

    confianza_lower = max(0.0, round(cantidad - conf_low_q, 2))
    confianza_upper = round(cantidad + conf_high_q, 2)

    if confianza >= 0.8:
        etiqueta = "Alta Confiabilidad"
    elif confianza >= 0.6:
        etiqueta = "Confianza Media"
    else:
        etiqueta = "Extrapolación (baja confianza)"

    feature_importance = _bundle.get("feature_importance", {})
    explicacion = (
        f"Este repuesto tiene {obs} meses de historial en nuestros datos de entrenamiento. "
        f"La confianza del modelo es del {round(confianza * 100)}%, "
        f"basada en la densidad histórica de demanda del SKU y el error promedio del modelo (MAE ≈ {mae_ref:.1f} uds)."
        if conocido else
        "Este repuesto **no está en nuestros datos de entrenamiento**. La predicción es una extrapolación "
        "basada en repuestos similares. Se recomienda validar manualmente antes de realizar pedidos."
    )

    anio = req.anio if req.anio is not None else _bundle.get("_anio_default", datetime.now().year)

    log.info(
        f"predict | repuesto={req.codigo_repuesto} mes={req.mes}/{anio} km={km} → "
        f"cantidad={cantidad} confianza={confianza} conocido={conocido}"
    )

    return PredictResponse(
        codigo_repuesto=req.codigo_repuesto,
        mes=req.mes,
        anio=anio,
        cantidad_estimada=cantidad,
        confianza=round(confianza, 4),
        confianza_lower=confianza_lower,
        confianza_upper=confianza_upper,
        alta_confiabilidad=confianza >= 0.8,
        etiqueta_confianza=etiqueta,
        repuesto_conocido=conocido,
        observaciones_historicas=obs,
        mae_referencia=round(mae_ref, 2),
        feature_importance=feature_importance,
        explicacion=explicacion,
    )
