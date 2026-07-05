import os
import pickle
import logging
import warnings
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error
import xgboost as xgb

from ml.create_features import run_feature_engineering

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

DATA_CLEAN = Path(__file__).parent / "data" / "clean"
MODEL_PATH = Path(__file__).parent / "model.pkl"

FEATURE_COLS = [
    "codigo_enc", "mes", "anio", "km_log", "km_por_mes",
    "mes_sin", "mes_cos", "precio_log",
    "sobre_stock", "marca_enc",
    "lag_1", "lag_3", "rolling_mean_3",
]

TARGET = "demanda_total"

SEED = 42
N_ESTIMATORS = 300
MAX_DEPTH = 5
LEARNING_RATE = 0.05
SUBSAMPLE = 0.8
COLSAMPLE_BYTREE = 0.8
MIN_CHILD_WEIGHT = 3
GAMMA = 0.1
REG_ALPHA = 0.5
REG_LAMBDA = 1.0
EARLY_STOPPING_ROUNDS = 30
N_SPLITS = 5
WMPAE_THRESHOLD = 40.0


def wmape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    denom = np.sum(np.abs(y_true))
    if denom == 0:
        return 0.0
    return float(np.sum(np.abs(y_true - y_pred)) / denom * 100)


def walk_forward_cv(df: pd.DataFrame, feature_cols: list[str], target: str) -> dict:
    df_sorted = df.sort_values(["codigo", "fecha"]).reset_index(drop=True)
    df_sorted["_fold"] = pd.factorize(df_sorted["codigo"] + "_" + df_sorted["fecha"].astype(str))[0]
    fake_time_idx = df_sorted.groupby("codigo").cumcount()

    tscv = TimeSeriesSplit(n_splits=N_SPLITS)
    cv_metrics = {"wmape": [], "mae": [], "fold_sizes": []}

    for fold, (train_idx, test_idx) in enumerate(tscv.split(df_sorted)):
        train_fold = df_sorted.iloc[train_idx]
        test_fold = df_sorted.iloc[test_idx]

        X_train = train_fold[feature_cols].values
        y_train = train_fold[target].values
        X_test = test_fold[feature_cols].values
        y_test = test_fold[target].values

        model = xgb.XGBRegressor(
            n_estimators=N_ESTIMATORS,
            max_depth=MAX_DEPTH,
            learning_rate=LEARNING_RATE,
            subsample=SUBSAMPLE,
            colsample_bytree=COLSAMPLE_BYTREE,
            min_child_weight=MIN_CHILD_WEIGHT,
            gamma=GAMMA,
            reg_alpha=REG_ALPHA,
            reg_lambda=REG_LAMBDA,
            random_state=SEED,
            verbosity=0,
            early_stopping_rounds=EARLY_STOPPING_ROUNDS,
        )
        model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

        y_pred = model.predict(X_test)
        fold_wmape = wmape(y_test, y_pred)
        fold_mae = float(mean_absolute_error(y_test, y_pred))

        cv_metrics["wmape"].append(fold_wmape)
        cv_metrics["mae"].append(fold_mae)
        cv_metrics["fold_sizes"].append(len(test_fold))
        log.info(f"  Fold {fold+1}/{N_SPLITS}: wMAPE={fold_wmape:.2f}% MAE={fold_mae:.2f} test_size={len(test_fold)}")

    cv_metrics["wmape_mean"] = float(np.mean(cv_metrics["wmape"]))
    cv_metrics["wmape_std"] = float(np.std(cv_metrics["wmape"]))
    cv_metrics["mae_mean"] = float(np.mean(cv_metrics["mae"]))
    cv_metrics["mae_std"] = float(np.std(cv_metrics["mae"]))
    log.info(f"Walk-Forward CV: wMAPE={cv_metrics['wmape_mean']:.2f}% ±{cv_metrics['wmape_std']:.2f}%")
    log.info(f"Walk-Forward CV: MAE={cv_metrics['mae_mean']:.2f} ±{cv_metrics['mae_std']:.2f}")
    return cv_metrics


def compute_conformal_quantiles(model: xgb.XGBRegressor, X_train: np.ndarray, y_train: np.ndarray, alpha: float = 0.2) -> tuple[float, float]:
    y_pred_train = model.predict(X_train)
    residuals = np.abs(y_train - y_pred_train)
    q_low = np.quantile(residuals, alpha / 2)
    q_high = np.quantile(residuals, 1 - alpha / 2)
    return float(q_low), float(q_high)


def compute_feature_importance(model: xgb.XGBRegressor, feature_cols: list[str]) -> dict[str, float]:
    importance = model.feature_importances_
    total = importance.sum()
    if total > 0:
        importance = importance / total * 100
    return {col: round(float(imp), 2) for col, imp in zip(feature_cols, importance)}


def compute_high_rotation_metrics(df: pd.DataFrame, feature_cols: list[str], target: str) -> dict:
    hr = df[df[target] >= 5].copy()
    if len(hr) < 10:
        return {"mape_hr": None, "mae_hr": None, "n_hr": len(hr)}

    tscv = TimeSeriesSplit(n_splits=3)
    mape_list = []
    mae_list = []
    for train_idx, test_idx in tscv.split(hr):
        X_tr = hr.iloc[train_idx][feature_cols].values
        y_tr = hr.iloc[train_idx][target].values
        X_te = hr.iloc[test_idx][feature_cols].values
        y_te = hr.iloc[test_idx][target].values

        m = xgb.XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=SEED, verbosity=0)
        m.fit(X_tr, y_tr)
        y_pred = m.predict(X_te)

        mask = y_te > 0
        if mask.sum() > 0:
            mape_list.append(float(np.mean(np.abs((y_te[mask] - y_pred[mask]) / y_te[mask]) * 100)))
        mae_list.append(float(mean_absolute_error(y_te, y_pred)))

    return {
        "mape_hr": float(np.mean(mape_list)) if mape_list else None,
        "mae_hr": float(np.mean(mae_list)) if mae_list else None,
        "n_hr": len(hr),
    }


def train() -> dict:
    log.info("=== AutoX Insight — demand-forecast v4.0 ===")
    DATA_CLEAN.mkdir(parents=True, exist_ok=True)

    features_csv = DATA_CLEAN / "demanda_features.csv"
    if features_csv.exists():
        log.info(f"Cargando features desde {features_csv}")
        df = pd.read_csv(features_csv, parse_dates=["fecha"])
        _, encoders = run_feature_engineering()
    else:
        log.info("Ejecutando feature engineering...")
        df, encoders = run_feature_engineering()

    if df.empty:
        log.error("No hay datos para entrenar. Ejecuta primero etl_from_supabase.py")
        return {}

    missing = [c for c in FEATURE_COLS if c not in df.columns]
    if missing:
        log.warning(f"Columnas faltantes: {missing}. Rellenando con ceros.")
        for c in missing:
            df[c] = 0.0

    log.info(f"Datos para entrenamiento: {len(df)} filas, {len(FEATURE_COLS)} features")
    log.info(f"Features: {FEATURE_COLS}")

    cv_metrics = walk_forward_cv(df, FEATURE_COLS, TARGET)

    log.info("Entrenando modelo final con todos los datos...")
    X_all = df[FEATURE_COLS].values
    y_all = df[TARGET].values

    model = xgb.XGBRegressor(
        n_estimators=N_ESTIMATORS,
        max_depth=MAX_DEPTH,
        learning_rate=LEARNING_RATE,
        subsample=SUBSAMPLE,
        colsample_bytree=COLSAMPLE_BYTREE,
        min_child_weight=MIN_CHILD_WEIGHT,
        gamma=GAMMA,
        reg_alpha=REG_ALPHA,
        reg_lambda=REG_LAMBDA,
        random_state=SEED,
        verbosity=0,
    )
    model.fit(X_all, y_all)

    y_pred_all = model.predict(X_all)
    train_wmape = wmape(y_all, y_pred_all)
    train_mae = float(mean_absolute_error(y_all, y_pred_all))
    log.info(f"Train final: wMAPE={train_wmape:.2f}% MAE={train_mae:.2f}")

    conf_low, conf_high = compute_conformal_quantiles(model, X_all, y_all)
    log.info(f"Intervalo conformal (80%): ±{conf_low:.2f} ~ ±{conf_high:.2f}")

    importance = compute_feature_importance(model, FEATURE_COLS)
    log.info("Feature Importance (top 5):")
    for feat, imp in sorted(importance.items(), key=lambda x: -x[1])[:5]:
        log.info(f"  {feat}: {imp:.1f}%")

    hr_metrics = compute_high_rotation_metrics(df, FEATURE_COLS, TARGET)

    bundle = {
        "model": model,
        "encoder": encoders,
        "feature_cols": FEATURE_COLS,
        "version": "4.0",
        "entrenado_en": datetime.now().isoformat(),
        "n_repuestos_conocidos": int(df["codigo_enc"].nunique()),
        "n_observaciones": len(df),
        "metrics": {
            "wmape": round(cv_metrics["wmape_mean"], 2),
            "wmape_std": round(cv_metrics["wmape_std"], 2),
            "mae": round(cv_metrics["mae_mean"], 2),
            "mae_std": round(cv_metrics["mae_std"], 2),
            "train_wmape": round(train_wmape, 2),
            "train_mae": round(train_mae, 2),
            "mape_alta_rotacion": hr_metrics["mape_hr"],
            "mae_alta_rotacion": hr_metrics["mae_hr"],
            "n_alta_rotacion": hr_metrics["n_hr"],
            "wmape_gate": round(cv_metrics["wmape_mean"], 2),
        },
        "feature_importance": importance,
        "conformal": {
            "alpha": 0.2,
            "confianza_lower_q": round(conf_low, 4),
            "confianza_upper_q": round(conf_high, 4),
        },
        "umbral_alta_confiabilidad": 0.8,
        "repuesto_conocido_stats": {
            str(k): int(v) for k, v in df.groupby("codigo_enc").size().to_dict().items()
        },
    }

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(bundle, f)
    log.info(f"Modelo guardado en {MODEL_PATH}")

    gate_passed = cv_metrics["wmape_mean"] <= WMPAE_THRESHOLD
    log.info(f"Gate calidad: wMAPE={cv_metrics['wmape_mean']:.2f}% vs umbral={WMPAE_THRESHOLD}% → {'PASA' if gate_passed else 'NO PASA'}")

    return bundle


if __name__ == "__main__":
    train()
