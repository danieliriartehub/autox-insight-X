import os
import pickle
import math
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent.parent / "ml" / "model.pkl"
model_bundle: dict = {}
_model_loaded = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model_loaded
    log.info("AutoX Insight API v4.0 iniciando...")
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            model_bundle.update(pickle.load(f))
        _model_loaded = True
        log.info(f"Modelo v{model_bundle.get('version', '?')} cargado desde {MODEL_PATH}")
    else:
        log.warning(f"model.pkl no encontrado en {MODEL_PATH}")
    yield
    model_bundle.clear()
    _model_loaded = False
    log.info("AutoX Insight API detenida.")


app = FastAPI(
    title="AutoX Insight API",
    description="API de predicción de demanda de repuestos para bpA Motors — demand-forecast v4.0",
    version="4.0.0",
    lifespan=lifespan,
)

_ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "https://autox-insight-x.vercel.app,http://localhost:3000,http://localhost:8080",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


class PredictRequest(BaseModel):
    codigo_repuesto: str = Field(..., description="Código del repuesto (ej. FILTRO01)")
    mes: int = Field(..., ge=1, le=12, description="Mes 1-12")
    anio: Optional[int] = Field(None, description="Año objetivo")
    km: Optional[float] = Field(0, ge=0, description="Kilometraje promedio")


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


class MLMetrics(BaseModel):
    mae: float | None = None
    mape_global: float | None = None
    wmape: float | None = None
    mape_alta_rotacion: float | None = None
    mae_alta_rotacion: float | None = None
    wmape_gate: float | None = None
    feature_importance: dict[str, float] | None = None


class MLStatusResponse(BaseModel):
    modelo_cargado: bool
    algoritmo: str
    modelo: str
    version: str | None = None
    repuestos_conocidos: int | None = None
    entrenado_en: str | None = None
    features: list[str] = []
    umbral_alta_confiabilidad: float = 0.8
    metrics: MLMetrics | None = None


class RetrainRequest(BaseModel):
    correr_etl: bool = False
    forzar_promocion: bool = False


class RetrainResponse(BaseModel):
    promovido: bool
    forzado: bool
    version: str
    entrenado_en: str
    repuestos_conocidos: int
    modelo_recargado: bool
    metrics: dict
    mensaje: str


class PurchaseProposal(BaseModel):
    codigo_repuesto: str
    descripcion: str | None = None
    marca: str | None = None
    stock_actual: float = 0
    stock_minimo: float = 0
    stock_maximo: float = 0
    demanda_ia: float = 0
    deficit: float = 0
    compra_sugerida: float = 0
    confianza_ia: float = 0
    etiqueta_confianza: str = ""
    repuesto_conocido: bool = True
    en_quiebre: bool = False


class SuggestionsResponse(BaseModel):
    resumen: dict
    propuestas: list[PurchaseProposal]


class GenerateOCRequest(BaseModel):
    items: list[dict]
    observacion: Optional[str] = None


class GenerateOCResponse(BaseModel):
    n_oc: str
    items_insertados: int
    detalle: list
    mensaje: str


def _build_feature_vector(req: PredictRequest, bundle: dict) -> np.ndarray:
    encoder = bundle.get("encoder", {})
    feature_cols = bundle.get("feature_cols", [])
    repuesto_map = encoder.get("codigo", {})

    codigo_enc = repuesto_map.get(req.codigo_repuesto, -1)
    marca_enc_raw = encoder.get("marca", {})
    categoria_enc_raw = encoder.get("categoria", {})
    marca_enc = max(marca_enc_raw.values()) + 1 if not marca_enc_raw else 0
    categoria_enc = max(categoria_enc_raw.values()) + 1 if not categoria_enc_raw else 0

    anio = req.anio if req.anio is not None else bundle.get("_anio_default", datetime.now().year)
    km = req.km if req.km is not None else 0
    km_log = math.log1p(km)
    km_por_mes = km_log / max(req.mes, 1)
    mes_sin = math.sin(2 * math.pi * req.mes / 12)
    mes_cos = math.cos(2 * math.pi * req.mes / 12)
    precio_log = 0.0
    garantia_meses = 0
    sobre_stock = 0
    lag_1 = 0.0
    lag_3 = 0.0
    rolling_mean_3 = 0.0

    vec = {
        "codigo_enc": codigo_enc,
        "mes": req.mes,
        "anio": anio,
        "km_log": km_log,
        "km_por_mes": km_por_mes,
        "mes_sin": mes_sin,
        "mes_cos": mes_cos,
        "precio_log": precio_log,
        "garantia_meses": garantia_meses,
        "sobre_stock": sobre_stock,
        "marca_enc": marca_enc,
        "categoria_enc": categoria_enc,
        "lag_1": lag_1,
        "lag_3": lag_3,
        "rolling_mean_3": rolling_mean_3,
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


def _mae_referencia(bundle: dict) -> float:
    metrics = bundle.get("metrics", {})
    return float(metrics.get("mae", metrics.get("train_mae", 3.0)))


def _predict(bundle: dict, req: PredictRequest) -> PredictResponse:
    model = bundle.get("model")
    if model is None:
        raise HTTPException(status_code=503, detail="Modelo no cargado")

    features = _build_feature_vector(req, bundle)
    raw_pred = float(model.predict(features)[0])
    cantidad = max(0.0, round(raw_pred, 2))

    confianza, conocido, obs = _compute_confianza(req.codigo_repuesto, bundle)
    mae_ref = _mae_referencia(bundle)
    conformal = bundle.get("conformal", {})
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

    feature_importance = bundle.get("feature_importance", {})

    explicacion = (
        f"Este repuesto tiene {obs} meses de historial en nuestros datos de entrenamiento. "
        f"La confianza del modelo es del {round(confianza * 100)}%, "
        f"basada en la densidad histórica de demanda del SKU y el error promedio del modelo (MAE ≈ {mae_ref:.1f} uds)."
        if conocido else
        "Este repuesto **no está en nuestros datos de entrenamiento**. La predicción es una extrapolación "
        "basada en repuestos similares. Se recomienda validar manualmente antes de realizar pedidos."
    )

    anio = req.anio if req.anio is not None else bundle.get("_anio_default", datetime.now().year)

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


@app.get("/health")
def health():
    return {"status": "ok", "modelo_cargado": _model_loaded, "version": model_bundle.get("version", "4.0")}


@app.get("/api/v1/health")
def api_health():
    return {"status": "ok", "modelo_cargado": _model_loaded, "version": model_bundle.get("version", "4.0")}


@app.post("/api/v1/ml/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    return _predict(model_bundle, req)


@app.get("/api/v1/ml/status", response_model=MLStatusResponse)
def ml_status():
    if not model_bundle:
        return MLStatusResponse(
            modelo_cargado=False, algoritmo="XGBoost Regressor", modelo="demand-forecast"
        )
    encoder = model_bundle.get("encoder", {})
    metrics_dict = model_bundle.get("metrics", {})
    fi = model_bundle.get("feature_importance", {})

    metrics = MLMetrics(
        mae=metrics_dict.get("mae"),
        mape_global=metrics_dict.get("wmape"),
        wmape=metrics_dict.get("wmape"),
        mape_alta_rotacion=metrics_dict.get("mape_alta_rotacion"),
        mae_alta_rotacion=metrics_dict.get("mae_alta_rotacion"),
        wmape_gate=metrics_dict.get("wmape_gate"),
        feature_importance=fi if fi else None,
    )

    return MLStatusResponse(
        modelo_cargado=True,
        algoritmo="XGBoost Regressor",
        modelo="demand-forecast",
        version=model_bundle.get("version"),
        repuestos_conocidos=model_bundle.get("n_repuestos_conocidos", len(encoder.get("codigo", {}))),
        entrenado_en=model_bundle.get("entrenado_en"),
        features=model_bundle.get("feature_cols", []),
        umbral_alta_confiabilidad=model_bundle.get("umbral_alta_confiabilidad", 0.8),
        metrics=metrics,
    )


@app.post("/api/v1/ml/retrain", response_model=RetrainResponse)
def retrain(req: RetrainRequest):
    try:
        from ml.train import train as train_model
    except ImportError:
        raise HTTPException(status_code=500, detail="No se pudo importar el módulo de entrenamiento")

    try:
        bundle = train_model()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en entrenamiento: {e}")

    if not bundle:
        raise HTTPException(status_code=500, detail="El entrenamiento no produjo un modelo válido")

    metrics = bundle.get("metrics", {})
    wmape = metrics.get("wmape", 100.0)
    gate_passed = wmape <= 40.0
    promovido = gate_passed or req.forzar_promocion

    if promovido:
        model_bundle.clear()
        model_bundle.update(bundle)
        _model_loaded = True
        mensaje = (
            f"Modelo reentrenado exitosamente v{bundle.get('version')}. "
            f"wMAPE={wmape:.1f}%. "
            f"{'(Promovido forzosamente)' if req.forzar_promocion and not gate_passed else ''}"
        )
    else:
        mensaje = (
            f"Modelo entrenado pero NO promovido. wMAPE={wmape:.1f}% supera el umbral de 40%. "
            "Usa forzar_promocion=true para promoverlo manualmente."
        )

    return RetrainResponse(
        promovido=promovido,
        forzado=req.forzar_promocion,
        version=str(bundle.get("version", "4.0")),
        entrenado_en=str(bundle.get("entrenado_en", datetime.now().isoformat())),
        repuestos_conocidos=int(bundle.get("n_repuestos_conocidos", 0)),
        modelo_recargado=promovido,
        metrics={k: v for k, v in metrics.items() if v is not None},
        mensaje=mensaje,
    )


@app.get("/api/v1/purchase-orders/suggestions", response_model=SuggestionsResponse)
def purchase_suggestions(
    mes: int = Query(..., ge=1, le=12),
    anio: Optional[int] = Query(None),
    km: Optional[float] = Query(0),
    solo_quiebres: bool = Query(True),
    limite: int = Query(50, ge=1, le=200),
):
    if not model_bundle:
        raise HTTPException(status_code=503, detail="Modelo no cargado")

    encoder = model_bundle.get("encoder", {})
    repuesto_map = encoder.get("codigo", {})
    suggestions = []
    target_anio = anio if anio else datetime.now().year

    for codigo, _ in list(repuesto_map.items())[:limite]:
        pred_req = PredictRequest(codigo_repuesto=codigo, mes=mes, anio=target_anio, km=km)
        pred = _predict(model_bundle, pred_req)

        stock_actual = 0
        stock_minimo = 0
        stock_maximo = 0
        deficit = max(0, pred.cantidad_estimada - stock_actual)
        compra_sugerida = math.ceil(deficit * 1.15) if deficit > 0 else 0

        prop = PurchaseProposal(
            codigo_repuesto=codigo,
            descripcion=None,
            marca=None,
            stock_actual=stock_actual,
            stock_minimo=stock_minimo,
            stock_maximo=stock_maximo,
            demanda_ia=pred.cantidad_estimada,
            deficit=deficit,
            compra_sugerida=compra_sugerida,
            confianza_ia=pred.confianza,
            etiqueta_confianza=pred.etiqueta_confianza,
            repuesto_conocido=pred.repuesto_conocido,
            en_quiebre=deficit > 0,
        )
        suggestions.append(prop)

    if solo_quiebres:
        suggestions = [s for s in suggestions if s.en_quiebre]

    resumen = {
        "total_propuestas": len(suggestions),
        "en_quiebre": sum(1 for s in suggestions if s.en_quiebre),
        "unidades_a_comprar": round(sum(s.compra_sugerida for s in suggestions)),
        "mes": mes,
        "anio": target_anio,
    }

    return SuggestionsResponse(resumen=resumen, propuestas=suggestions)


@app.post("/api/v1/purchase-orders/generate", response_model=GenerateOCResponse)
def generate_oc(req: GenerateOCRequest):
    try:
        from supabase import create_client
        sb_url = os.getenv("VITE_SUPABASE_URL", "")
        sb_key = os.getenv("VITE_SUPABASE_ANON_KEY", "")
        if not sb_url or not sb_key:
            raise ValueError("Supabase credentials not configured")
        sb = create_client(sb_url, sb_key)
        n_oc = f"OC-IA-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        detalle = []
        for item in req.items:
            detalle.append({
                "n_oc": n_oc,
                "codigo_repuesto": item.get("codigo_repuesto"),
                "cantidad": item.get("compra_sugerida", 0),
                "origen": "IA",
                "created_at": datetime.now().isoformat(),
            })
        return GenerateOCResponse(
            n_oc=n_oc,
            items_insertados=len(detalle),
            detalle=detalle,
            mensaje=f"OC {n_oc} generada con {len(detalle)} ítems (origen: IA)",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando OC: {e}")
