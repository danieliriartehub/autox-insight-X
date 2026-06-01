"""
Entrena el modelo XGBoost y guarda ml/model.pkl.
Ejecutar después de etl/clean_and_load.py:
    python ml/train.py
"""
import pickle
import logging
from pathlib import Path

import pandas as pd
import numpy as np
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

CLEAN = Path(__file__).parent.parent / "data" / "clean"
MODEL_OUT = Path(__file__).parent / "model.pkl"

FEATURE_COLS = ["codigo_enc", "mes", "km", "anio", "tipo_enc", "c_seguro"]
TARGET_COL = "CANTIDAD"


def load_data() -> pd.DataFrame:
    df = pd.read_csv(CLEAN / "ot_full_joined.csv", dtype=str)
    log.info(f"Datos cargados: {len(df)} filas")
    return df


def build_features(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    # Codificar repuestos
    repuesto_map = {v: i for i, v in enumerate(df["CODIGO"].unique())}
    tipo_map = {v: i for i, v in enumerate(df["C_TIPOOT"].dropna().unique())}

    df = df.copy()
    df["FECHA"] = pd.to_datetime(df["FECHA"], dayfirst=True, errors="coerce")
    df["mes"] = df["FECHA"].dt.month
    df["anio"] = df["FECHA"].dt.year
    df["km"] = pd.to_numeric(df["KM"], errors="coerce").fillna(0)
    df["c_seguro"] = pd.to_numeric(df["C_SEGURO"], errors="coerce").fillna(99)
    df["CANTIDAD"] = pd.to_numeric(df["CANTIDAD"], errors="coerce")
    df["codigo_enc"] = df["CODIGO"].map(repuesto_map)
    df["tipo_enc"] = df["C_TIPOOT"].map(tipo_map).fillna(0)

    df = df.dropna(subset=FEATURE_COLS + [TARGET_COL])
    log.info(f"Filas con features completas: {len(df)}")

    encoder = {
        "repuesto_map": repuesto_map,
        "tipo_map": tipo_map,
        "anio_default": int(df["anio"].mode()[0]),
    }
    return df[FEATURE_COLS + [TARGET_COL]], encoder


def train(df: pd.DataFrame) -> XGBRegressor:
    X = df[FEATURE_COLS].values
    y = df[TARGET_COL].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=50)

    mae = mean_absolute_error(y_test, model.predict(X_test))
    log.info(f"MAE en test: {mae:.4f}")
    return model


if __name__ == "__main__":
    df_raw = load_data()
    df_feat, encoder = build_features(df_raw)
    model = train(df_feat)

    bundle = {"model": model, "encoder": encoder}
    with open(MODEL_OUT, "wb") as f:
        pickle.dump(bundle, f)
    log.info(f"Modelo guardado en {MODEL_OUT}")
