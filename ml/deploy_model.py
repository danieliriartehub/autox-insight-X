import os
import logging
from pathlib import Path

import httpx

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent / "model.pkl"
BUCKET_NAME = "modelos-ia"
OBJECT_NAME = "model-v4.pkl"

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("VITE_SUPABASE_SERVICE_KEY", "")


def upload_model() -> str:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError("VITE_SUPABASE_URL y VITE_SUPABASE_SERVICE_KEY deben estar definidas en .env")
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Modelo no encontrado en {MODEL_PATH}. Ejecuta primero ml.train")

    log.info(f"Subiendo {MODEL_PATH} a Supabase Storage...")

    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY,
    }

    with open(MODEL_PATH, "rb") as f:
        data = f.read()

    resp = httpx.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{OBJECT_NAME}",
        headers={**headers, "Content-Type": "application/octet-stream"},
        content=data,
    )
    resp.raise_for_status()
    log.info(f"Modelo subido exitosamente ({len(data)} bytes)")
    return resp.json().get("Id", "")


def download_model(dest: Path = MODEL_PATH) -> Path:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError("VITE_SUPABASE_URL y VITE_SUPABASE_SERVICE_KEY deben estar definidas en .env")

    log.info(f"Descargando modelo desde Supabase Storage...")

    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY,
    }

    resp = httpx.get(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{OBJECT_NAME}",
        headers=headers,
    )
    resp.raise_for_status()

    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "wb") as f:
        f.write(resp.content)
    log.info(f"Modelo descargado en {dest} ({len(resp.content)} bytes)")
    return dest


if __name__ == "__main__":
    upload_model()
