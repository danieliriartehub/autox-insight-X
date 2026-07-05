import os
import logging
from pathlib import Path
from datetime import datetime

import pandas as pd
import numpy as np
from supabase import create_client, Client

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env.example")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

DATA_RAW = Path(__file__).parent.parent / "data" / "raw"
DATA_CLEAN = Path(__file__).parent.parent / "data" / "clean"

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY", "")


def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY deben estar definidas en .env")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def extract_ots(sb: Client) -> pd.DataFrame:
    log.info("Extrayendo órdenes de trabajo desde Supabase...")
    all_rows = []
    offset = 0
    limit = 5000
    while True:
        resp = sb.table("ot_repuesto").select("*").range(offset, offset + limit - 1).execute()
        batch = resp.data
        if not batch:
            break
        all_rows.extend(batch)
        offset += limit
        log.info(f"  {len(batch)} filas (total acumulado: {len(all_rows)})")
    df = pd.DataFrame(all_rows)
    log.info(f"Extraídas {len(df)} filas de ot_repuesto")
    return df


def extract_repuestos(sb: Client) -> pd.DataFrame:
    log.info("Extrayendo catálogo de repuestos...")
    resp = sb.table("repuesto").select("*").execute()
    df = pd.DataFrame(resp.data)
    log.info(f"Extraídos {len(df)} repuestos")
    return df


def extract_plus(sb: Client) -> pd.DataFrame:
    log.info("Extrayendo datos plus de repuestos (precios, marcas, categorías)...")
    resp = sb.table("repuesto").select("codigo,precio_venta,precio_compra,marca,categoria,garantia_meses,stock_actual,stock_minimo,stock_maximo").execute()
    df = pd.DataFrame(resp.data)
    log.info(f"Extraídos datos plus de {len(df)} repuestos")
    return df


def build_demanda_mensual(ots: pd.DataFrame, repuestos: pd.DataFrame) -> pd.DataFrame:
    log.info("Agregando demanda mensual por repuesto...")
    df = ots.copy()

    if "fecha" in df.columns:
        df["fecha"] = pd.to_datetime(df["fecha"])
    elif "fecha_ot" in df.columns:
        df["fecha"] = pd.to_datetime(df["fecha_ot"])
    elif "created_at" in df.columns:
        df["fecha"] = pd.to_datetime(df["created_at"])
    else:
        df["fecha"] = pd.to_datetime(df.get("fecha_ingreso", df.get("fecha_registro", pd.Timestamp.now())))

    df["anio"] = df["fecha"].dt.year
    df["mes"] = df["fecha"].dt.month

    producto_col = "producto_id" if "producto_id" in df.columns else "codigo_repuesto"
    cantidad_col = "cantidad" if "cantidad" in df.columns else "unidades"

    mensual = df.groupby([producto_col, "anio", "mes"], as_index=False).agg(
        demanda_total=(cantidad_col, "sum"),
        n_ots=(cantidad_col, "count"),
    )
    mensual.rename(columns={producto_col: "codigo"}, inplace=True)

    precio_col = None
    for col in ["precio_venta", "precio_compra", "precio"]:
        if col in repuestos.columns:
            precio_col = col
            break

    if repuestos is not None and not repuestos.empty:
        rep_dict = repuestos.set_index("codigo")[["marca", "categoria", "garantia_meses", "stock_actual", "stock_minimo", "stock_maximo"]].to_dict("index")
        if precio_col:
            precio_dict = repuestos.set_index("codigo")[precio_col].to_dict()
            mensual["precio"] = mensual["codigo"].map(precio_dict)
        mensual["marca"] = mensual["codigo"].map(lambda c: rep_dict.get(c, {}).get("marca", "DESCONOCIDA"))
        mensual["categoria"] = mensual["codigo"].map(lambda c: rep_dict.get(c, {}).get("categoria", "GENERAL"))
        mensual["garantia_meses"] = mensual["codigo"].map(lambda c: rep_dict.get(c, {}).get("garantia_meses", 0))
        mensual["stock_actual"] = mensual["codigo"].map(lambda c: rep_dict.get(c, {}).get("stock_actual", 0))
        mensual["stock_minimo"] = mensual["codigo"].map(lambda c: rep_dict.get(c, {}).get("stock_minimo", 0))
        mensual["stock_maximo"] = mensual["codigo"].map(lambda c: rep_dict.get(c, {}).get("stock_maximo", 0))
    else:
        mensual["precio"] = 0.0
        mensual["marca"] = "DESCONOCIDA"
        mensual["categoria"] = "GENERAL"
        mensual["garantia_meses"] = 0
        mensual["stock_actual"] = 0.0
        mensual["stock_minimo"] = 0.0
        mensual["stock_maximo"] = 0.0

    mensual["fecha"] = pd.to_datetime(mensual["anio"].astype(str) + "-" + mensual["mes"].astype(str) + "-01")
    mensual.sort_values(["codigo", "fecha"], inplace=True)
    mensual.reset_index(drop=True, inplace=True)

    return mensual


def run_etl() -> pd.DataFrame:
    DATA_RAW.mkdir(parents=True, exist_ok=True)
    DATA_CLEAN.mkdir(parents=True, exist_ok=True)

    sb = get_supabase()
    ots = extract_ots(sb)
    repuestos = extract_repuestos(sb)
    plus = extract_plus(sb)

    if not plus.empty:
        for col in plus.columns:
            if col != "codigo":
                repuestos[col] = repuestos["codigo"].map(plus.set_index("codigo")[col])

    mensual = build_demanda_mensual(ots, repuestos)

    csv_path = DATA_CLEAN / "demanda_mensual.csv"
    mensual.to_csv(csv_path, index=False)
    log.info(f"Demanda mensual guardada en {csv_path} ({len(mensual)} filas)")
    return mensual


if __name__ == "__main__":
    run_etl()
