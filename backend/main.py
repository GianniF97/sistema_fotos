# main.py (Backend FastAPI completo con Cloudflare R2, Supabase y autenticación segura de admin)
import os
import boto3
from typing import List
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from botocore.exceptions import ClientError

app = FastAPI(title="PixelFlow Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Configurar cliente S3 para Cloudflare R2
s3_client = boto3.client(
    's3',
    endpoint_url=f"https://{os.environ.get('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com",
    aws_access_key_id=os.environ.get('R2_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('R2_SECRET_ACCESS_KEY'),
    region_name='auto'
)
BUCKET_NAME = os.environ.get('R2_BUCKET_NAME', 'sistema-fotos')

def upload_image_to_r2(file_obj, file_name: str, content_type: str) -> str:
    try:
        s3_client.upload_fileobj(
            file_obj,
            BUCKET_NAME,
            file_name,
            ExtraArgs={'ContentType': content_type}
        )
        public_url = f"{os.environ.get('R2_PUBLIC_URL')}/{file_name}"
        return public_url
    except ClientError as e:
        raise Exception(f"Error al subir a Cloudflare R2: {e}")

class AdminAuth(BaseModel):
    password: str

@app.post("/api/admin/verify")
def verify_admin_password(auth: AdminAuth):
    expected_password = os.environ.get("ADMIN_PASSWORD", "fotografo2026")
    if auth.password == expected_password:
        return {"success": True, "message": "Acceso autorizado"}
    else:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")

@app.get("/api/albums")
def get_albums():
    try:
        response = supabase.table("albums").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.delete("/api/albums/{album_id}")
def delete_album(album_id: int):
    try:
        # 1. Opcional: Buscar las fotos vinculadas si deseas borrarlas físicamente de R2
        photos_res = supabase.table("photos").select("url").eq("album_id", album_id).execute()
        
        # 2. Borrar registros de fotos en Supabase
        supabase.table("photos").delete().eq("album_id", album_id).execute()
        
        # 3. Borrar el álbum en Supabase
        res = supabase.table("albums").delete().eq("id", album_id).execute()

        return {"success": True, "message": "Álbum eliminado correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/albums/create")
async def create_album(
    title: str,
    date: str,
    cover: UploadFile = File(...),
    photos: List[UploadFile] = File(...)
):
    try:
        cover_filename = f"covers/{title.lower().replace(' ', '_')}_{cover.filename}"
        cover_url = upload_image_to_r2(cover.file, cover_filename, cover.content_type)

        album_data = {
            "title": title,
            "date": date,
            "image_url": cover_url,
            "photo_count": len(photos)
        }
        album_res = supabase.table("albums").insert(album_data).execute()
        
        if not album_res.data:
            raise HTTPException(status_code=500, detail="No se pudo registrar el álbum en Supabase.")
        
        album_id = album_res.data[0]["id"]

        for photo in photos:
            photo_filename = f"events/{album_id}/{photo.filename}"
            photo_url = upload_image_to_r2(photo.file, photo_filename, photo.content_type)
            
            supabase.table("photos").insert({
                "album_id": album_id,
                "url": photo_url
            }).execute()

        return {
            "success": True,
            "message": f"Álbum '{title}' creado con éxito y {len(photos)} fotos subidas a R2."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))