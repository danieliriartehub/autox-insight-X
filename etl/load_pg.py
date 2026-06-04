"""
Carga datos a Supabase PostgreSQL usando conexión directa (más robusta que RestAPI)
Uso: python etl/load_pg.py
"""
import os
import logging
import time
import pandas as pd
from dotenv import load_dotenv
import psycopg2
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

CLEAN = os.path.join(os.path.dirname(__file__), "..", "data", "clean")


def get_pg_connection():
    """Parsea SUPABASE_URL para obtener credenciales PostgreSQL."""
    load_dotenv()
    url = os.environ["SUPABASE_URL"]
    service_key = os.environ["SUPABASE_SERVICE_KEY"]

    # Extraer el host de la URL de Supabase
    # Format: https://lgtgjrzfvwcbmvfgpgly.supabase.co
    parsed = urlparse(url)
    host = parsed.netloc  # "lgtgjrzfvwcbmvfgpgly.supabase.co"

    # Conectar a PostgreSQL en Supabase
    # Service role + PostgreSQL password es el JWT (service_key)
    conn = psycopg2.connect(
        host=host,
        port=5432,
        database="postgres",
        user="postgres",
        password=service_key,
        sslmode="require"
    )
    return conn


def load_table(conn, table_name: str, df: pd.DataFrame, mode: str = "upsert") -> None:
    """Carga un DataFrame en una tabla PostgreSQL."""

    # Normalizar columnas a minúsculas
    df.columns = [c.lower() for c in df.columns]

    # Reemplazar NaN con None (NULL)
    df = df.where(pd.notnull(df), None)

    log.info(f"Cargando {len(df)} registros en '{table_name}' ({mode})...")

    with conn.cursor() as cur:
        # Truncar tabla si es insert mode
        if mode == "insert":
            log.info(f"  Truncando '{table_name}'...")
            cur.execute(f"TRUNCATE TABLE {table_name} CASCADE;")

        # Insertar en lotes de 500
        batch_size = 500
        for i in range(0, len(df), batch_size):
            batch = df.iloc[i:i + batch_size]

            # Construir SQL de INSERT
            cols = list(batch.columns)
            cols_str = ", ".join(cols)
            placeholders = ", ".join(["%s"] * len(cols))

            if mode == "upsert":
                # INSERT ... ON CONFLICT DO UPDATE
                pk_col = "id" if "id" in cols else cols[0]
                update_cols = [c for c in cols if c != pk_col]
                updates = ", ".join([f"{c} = EXCLUDED.{c}" for c in update_cols])
                sql = f"""
                    INSERT INTO {table_name} ({cols_str})
                    VALUES ({placeholders})
                    ON CONFLICT ({pk_col}) DO UPDATE SET {updates};
                """
            else:
                sql = f"INSERT INTO {table_name} ({cols_str}) VALUES ({placeholders});"

            # Ejecutar batch
            for _, row in batch.iterrows():
                values = tuple(row)
                try:
                    cur.execute(sql, values)
                except Exception as e:
                    log.warning(f"  Error en fila {i}: {e}")

            conn.commit()
            log.info(f"  Batch {i // batch_size + 1} cargado ({len(batch)} registros)")
            time.sleep(0.5)

    log.info(f"  ✓ '{table_name}' cargada.")


def main():
    try:
        conn = get_pg_connection()
        log.info("Conectado a Supabase PostgreSQL")

        # Cargar tablas
        tables = {
            "ot_cabecera": (pd.read_csv(f"{CLEAN}/ot_cabecera_clean.csv", dtype=str), "upsert"),
            "ot_producto": (pd.read_csv(f"{CLEAN}/ot_producto_clean.csv", dtype=str), "insert"),
            "oc_detalle": (pd.read_csv(f"{CLEAN}/oc_detalle_clean.csv", dtype=str), "upsert"),
            "ot_full_joined": (pd.read_csv(f"{CLEAN}/ot_full_joined.csv", dtype=str), "insert"),
        }

        for table_name, (df, mode) in tables.items():
            load_table(conn, table_name, df, mode)

        conn.close()
        log.info("Carga completada exitosamente!")

    except Exception as e:
        log.error(f"Error: {e}")
        raise


if __name__ == "__main__":
    main()
