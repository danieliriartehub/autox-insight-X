import os
import logging
from pathlib import Path
from datetime import datetime

import pandas as pd
import numpy as np
from supabase import create_client, Client

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")

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


def extract_with_pagination(sb: Client, table: str, limit: int = 1000) -> pd.DataFrame:
    log.info(f"Extrayendo {table}...")
    all_rows = []
    offset = 0
    while True:
        resp = sb.table(table).select("*").range(offset, offset + limit - 1).execute()
        batch = resp.data
        if not batch:
            break
        all_rows.extend(batch)
        offset += limit
        log.info(f"  {len(batch)} filas (total acumulado: {len(all_rows)})")
    df = pd.DataFrame(all_rows)
    log.info(f"Total {table}: {len(df)} filas")
    return df


def extract_ots(sb: Client) -> pd.DataFrame:
    return extract_with_pagination(sb, "ot_repuesto")


def extract_repuestos(sb: Client) -> pd.DataFrame:
    df = extract_with_pagination(sb, "repuesto")
    if not df.empty and "c_repuesto" in df.columns:
        df["c_repuesto"] = df["c_repuesto"].str.strip()
    return df


def extract_stock(sb: Client) -> pd.DataFrame:
    return extract_with_pagination(sb, "stock")


def extract_ordenes_trabajo(sb: Client) -> pd.DataFrame:
    return extract_with_pagination(sb, "orden_trabajo")


def build_demanda_mensual(ots: pd.DataFrame, repuestos: pd.DataFrame, stock: pd.DataFrame, ots_header: pd.DataFrame) -> pd.DataFrame:
    log.info("Agregando demanda mensual por repuesto...")
    df = ots.copy()

    # Filter out SIN_CODIGO
    df = df[df["producto_id"] != "SIN_CODIGO"].copy()

    # Parse fecha from fecha_registro_ts
    df["fecha"] = pd.to_datetime(df["fecha_registro_ts"])
    df["anio"] = df["fecha"].dt.year
    df["mes"] = df["fecha"].dt.month

    # Join KM data from orden_trabajo
    if not ots_header.empty:
        ot_km = ots_header[["n_ot", "km"]].dropna()
        df = df.merge(ot_km, on="n_ot", how="left")

    # Aggregate by producto_id + anio + mes
    agg_dict = {
        "demanda_total": ("cantidad", "sum"),
        "n_ots": ("id", "count"),
        "precio_unitario_promedio": ("precio_unitario", "mean"),
    }
    if "km" in df.columns:
        agg_dict["km_promedio"] = ("km", "mean")

    mensual = df.groupby(["producto_id", "anio", "mes"], as_index=False).agg(**agg_dict)
    mensual.rename(columns={"producto_id": "codigo"}, inplace=True)

    # Ensure km_promedio exists even if no OT join
    if "km_promedio" not in mensual.columns:
        mensual["km_promedio"] = np.nan

    # Join repuesto data (marca only)
    if not repuestos.empty:
        # Drop duplicate c_repuesto keeping first, strip not needed (already done in extract)
        rep_dedup = repuestos.drop_duplicates(subset="c_repuesto", keep="first")
        rep_dict = rep_dedup.set_index("c_repuesto")[["marca"]].to_dict("index")
        mensual["marca"] = mensual["codigo"].map(lambda c: rep_dict.get(c, {}).get("marca", "DESCONOCIDA"))
    else:
        mensual["marca"] = "DESCONOCIDA"

    # Join stock data
    if not stock.empty:
        stock = stock.copy()
        if "c_repuesto" in stock.columns:
            stock["c_repuesto"] = stock["c_repuesto"].str.strip()
        stock_dedup = stock.drop_duplicates(subset="c_repuesto", keep="first")
        stock_dict = stock_dedup.set_index("c_repuesto")[["stock", "stock_minimo", "stock_maximo"]].to_dict("index")
        mensual["stock_actual"] = mensual["codigo"].map(lambda c: stock_dict.get(c, {}).get("stock", 0))
        mensual["stock_minimo"] = mensual["codigo"].map(lambda c: stock_dict.get(c, {}).get("stock_minimo", 0))
        mensual["stock_maximo"] = mensual["codigo"].map(lambda c: stock_dict.get(c, {}).get("stock_maximo", 0))
    else:
        mensual["stock_actual"] = 0.0
        mensual["stock_minimo"] = 0.0
        mensual["stock_maximo"] = 0.0

    mensual["fecha"] = pd.to_datetime(mensual["anio"].astype(str) + "-" + mensual["mes"].astype(str).str.zfill(2) + "-01")
    mensual.sort_values(["codigo", "fecha"], inplace=True)
    mensual.reset_index(drop=True, inplace=True)

    return mensual


def run_etl() -> pd.DataFrame:
    DATA_RAW.mkdir(parents=True, exist_ok=True)
    DATA_CLEAN.mkdir(parents=True, exist_ok=True)

    sb = get_supabase()
    ots = extract_ots(sb)
    repuestos = extract_repuestos(sb)
    stock = extract_stock(sb)
    ots_header = extract_ordenes_trabajo(sb)

    mensual = build_demanda_mensual(ots, repuestos, stock, ots_header)

    csv_path = DATA_CLEAN / "demanda_mensual.csv"
    mensual.to_csv(csv_path, index=False)
    log.info(f"Demanda mensual guardada en {csv_path} ({len(mensual)} filas, {mensual.codigo.nunique()} SKUs)")
    return mensual


if __name__ == "__main__":
    run_etl()
