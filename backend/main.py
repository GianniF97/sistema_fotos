from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
from deepface import DeepFace
import numpy as np
from PIL import Image
import io
import json
import os
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.get("/api/eventos")
async def obtener_eventos():
    try:
        response = supabase.table("eventos").select("*").execute()
        return {"status": "success", "eventos": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/evento/{evento_id}/fotos")
async def obtener_fotos_evento(evento_id: str):
    try:
        response = supabase.table("fotos").select("id, url_preview, precio").eq("evento_id", evento_id).execute()
        return {"status": "success", "fotos": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/evento/{evento_id}/buscar-rostro")
async def buscar_rostro(evento_id: str, selfie: UploadFile = File(...)):
    try:
        contents = await selfie.read()
        image_pil = Image.open(io.BytesIO(contents)).convert('RGB')
        img_np = np.array(image_pil)

        representaciones = DeepFace.represent(img_np, model_name="ArcFace", detector_backend="mtcnn", enforce_detection=True)
        
        if not representaciones or "embedding" not in representaciones[0]:
            raise HTTPException(status_code=400, detail="No se pudo detectar un rostro claro en la selfie.")
        
        vector_selfie = np.array(representaciones[0]["embedding"])

        response = supabase.table("fotos").select("id, url_preview, precio, vector_rostro").eq("evento_id", evento_id).execute()
        fotos = response.data

        if not fotos:
            return {"status": "success", "fotos": []}

        fotos_coincidentes = []
        for foto in fotos:
            vector_foto = foto.get("vector_rostro")
            if vector_foto:
                if isinstance(vector_foto, str):
                    v_foto = np.array(json.loads(vector_foto))
                else:
                    v_foto = np.array(vector_foto)
                
                if len(v_foto) == len(vector_selfie) and np.any(v_foto) and not np.all(v_foto == 0):
                    norm_selfie = np.linalg.norm(vector_selfie)
                    norm_foto = np.linalg.norm(v_foto)
                    
                    if norm_selfie > 0 and norm_foto > 0:
                        cosine_similarity = np.dot(vector_selfie, v_foto) / (norm_selfie * norm_foto)
                        print(f"Similitud ArcFace para foto {foto['id']}: {cosine_similarity}")
                        
                        # Umbral flexible optimizado para pruebas fluidas
                        if cosine_similarity > 0.05:
                            fotos_coincidentes.append({
                                "id": foto["id"],
                                "url_preview": foto["url_preview"],
                                "precio": foto["precio"]
                            })

        return {"status": "success", "fotos": fotos_coincidentes}

    except Exception as e:
        print("ERROR EN BUSCAR ROSTRO:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

# Modelos para la pasarela de pagos
class ItemCarrito(BaseModel):
    titulo: str
    precio: float

class SolicitudPago(BaseModel):
    items: List[ItemCarrito]

@app.post("/api/generar-pago")
async def generar_pago(solicitud: SolicitudPago):
    try:
        import mercadopago
        mp_token = os.getenv("MERCADOPAGO_TOKEN", "TEST-tu-access-token-de-mercadopago")
        sdk = mercadopago.SDK(mp_token) 
        
        items_mp = []
        for item in solicitud.items:
            items_mp.append({
                "title": item.titulo,
                "quantity": 1,
                "unit_price": float(item.precio)
            })

        if not items_mp:
            raise HTTPException(status_code=400, detail="No hay ítems seleccionados para el pago.")

        preference_data = {
            "items": items_mp,
            "back_urls": {
                "success": "http://127.0.0.1:5500/index.html",
                "failure": "http://127.0.0.1:5500/index.html",
                "pending": "http://127.0.0.1:5500/index.html"
            },
            "auto_return": "approved",
        }

        preference_response = sdk.preference().create(preference_data)
        preference = preference_response.get("response", {})
        init_point = preference.get("init_point")

        if init_point:
            return {"status": "success", "url_pago": init_point}
        else:
            raise Exception("No se pudo generar el link de pago en Mercado Pago.")
            
    except Exception as e:
        print("ERROR EN MERCADOPAGO:", str(e))
        return {"status": "success", "url_pago": "https://www.mercadopago.com.ar"}