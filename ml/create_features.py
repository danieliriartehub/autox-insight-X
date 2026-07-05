import logging
from pathlib import Path

import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

DATA_CLEAN = Path(__file__).parent / "data" / "clean"
DEMANDA_CSV = DATA_CLEAN / "demanda_mensual.csv"
FEATURES_CSV = DATA_CLEAN / "demanda_features.csv"


def build_lags(df: pd.DataFrame, col: str = "demanda_total", lags: list[int] | None = None) -> pd.DataFrame:
    if lags is None:
        lags = [1, 3, 6, 12]
    result = df.copy()
    for lag in lags:
        result[f"lag_{lag}"] = result.groupby("codigo")[col].shift(lag)
    return result


def build_rolling(df: pd.DataFrame, col: str = "demanda_total", windows: list[int] | None = None) -> pd.DataFrame:
    if windows is None:
        windows = [3, 6]
    result = df.copy()
    for w in windows:
        result[f"rolling_mean_{w}"] = result.groupby("codigo")[col].transform(lambda x: x.rolling(w, min_periods=1).mean())
        result[f"rolling_std_{w}"] = result.groupby("codigo")[col].transform(lambda x: x.rolling(w, min_periods=1).std().fillna(0))
    return result


def build_seasonality(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    result["mes_sin"] = np.sin(2 * np.pi * result["mes"] / 12)
    result["mes_cos"] = np.cos(2 * np.pi * result["mes"] / 12)
    return result


def build_km_features(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    km_col = "km_promedio" if "km_promedio" in result.columns else ("km" if "km" in result.columns else None)
    if km_col:
        result["km_log"] = np.log1p(result[km_col].fillna(0))
        result["km_por_mes"] = result["km_log"] / result["mes"].clip(lower=1)
    else:
        result["km_log"] = 0.0
        result["km_por_mes"] = 0.0
    return result


def build_price_features(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    price_col = "precio_unitario_promedio" if "precio_unitario_promedio" in result.columns else ("precio" if "precio" in result.columns else None)
    if price_col:
        result["precio_log"] = np.log1p(result[price_col].fillna(0))
    else:
        result["precio_log"] = 0.0
    return result


def encode_categorical(df: pd.DataFrame, cols: list[str] | None = None) -> tuple[pd.DataFrame, dict]:
    if cols is None:
        cols = ["codigo", "marca"]
    result = df.copy()
    encoders = {}
    for col in cols:
        if col in result.columns:
            codes, uniques = result[col].factorize()
            result[f"{col}_enc"] = codes
            encoders[col] = {v: i for i, v in enumerate(uniques)}
    return result, encoders


def run_feature_engineering() -> tuple[pd.DataFrame, dict]:
    if not DEMANDA_CSV.exists():
        log.warning(f"{DEMANDA_CSV} no encontrado. Ejecuta primero etl_from_supabase.py")
        return pd.DataFrame(), {}

    log.info(f"Cargando demanda mensual desde {DEMANDA_CSV}")
    df = pd.read_csv(DEMANDA_CSV, parse_dates=["fecha"])
    log.info(f"Filas cargadas: {len(df)}")

    df.sort_values(["codigo", "fecha"], inplace=True)

    df = build_lags(df)
    df = build_rolling(df)
    df = build_seasonality(df)
    df = build_km_features(df)
    df = build_price_features(df)

    if "stock_actual" in df.columns:
        df["sobre_stock"] = (df["stock_actual"] > df["stock_minimo"].fillna(0)).astype(int)

    df, encoders = encode_categorical(df)

    df.dropna(subset=[c for c in df.columns if c.startswith("lag_")], inplace=True)
    df.reset_index(drop=True, inplace=True)

    log.info(f"Filas después de feature engineering: {len(df)}")
    log.info(f"Columnas: {list(df.columns)}")

    FEATURES_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(FEATURES_CSV, index=False)
    log.info(f"Features guardadas en {FEATURES_CSV}")

    return df, encoders


if __name__ == "__main__":
    run_feature_engineering()
