import streamlit as st
from supabase import create_client
from deepface import DeepFace
import numpy as np
from PIL import Image
import io
import json
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

st.set_page_config(page_title="Panel de Administración - Fotografía", layout="centered")

# Control de Autenticación por Contraseña
if "authenticated" not in st.session_state:
    st.session_state["authenticated"] = False

if not st.session_state["authenticated"]:
    st.title("🔒 Panel de Administración")
    password_input = st.text_input("Introduce la contraseña de acceso:", type="password")
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")
    
    if st.button("Ingresar"):
        if password_input == admin_pass:
            st.session_state["authenticated"] = True
            st.rerun()
        else:
            st.error("Contraseña incorrecta.")
    st.stop()

st.title("📸 Panel de Administración y Gestión")
st.write("Gestiona eventos, sube fotografías masivas con **ArcFace**, administra precios y elimina álbumes completos.")

# --- SECCIÓN 1: CREAR NUEVO EVENTO ---
st.subheader("1️⃣ Crear Nuevo Evento")
nombre_evento = st.text_input("Nombre del Evento (ej. Casamiento Juan y María)")
fecha_evento = st.date_input("Fecha del Evento")
portada_file = st.file_uploader("Imagen de Portada del Álbum", type=["jpg", "jpeg", "png"], key="portada_uploader")
precio_str = st.text_input("Precio por Fotografía por Defecto ($)", value="1500")

if st.button("Crear Evento"):
    if nombre_evento:
        try:
            # 1. Insertar el evento primero para obtener su ID generado
            res = supabase.table("eventos").insert({
                "nombre": nombre_evento,
                "fecha": str(fecha_evento),
                "portada_url": ""  # Valor temporal
            }).execute()

            if res.data:
                evento_id = res.data[0]["id"]

                # 2. Si se subió imagen de portada, guardarla en storage y actualizar el registro
                if portada_file:
                    portada_bytes = portada_file.read()
                    file_path = f"{evento_id}/portada_{portada_file.name}"
                    supabase.storage.from_("fotos_eventos").upload(file_path, portada_bytes, file_options={"contentType": portada_file.type, "upsert": "true"})
                    portada_url = supabase.storage.from_("fotos_eventos").get_public_url(file_path)

                    supabase.table("eventos").update({"portada_url": portada_url}).eq("id", evento_id).execute()

            st.success(f"¡Evento '{nombre_evento}' creado con éxito!")
            st.rerun()
        except Exception as e:
            st.error(f"Error al crear evento: {e}")
    else:
        st.warning("Por favor ingresa un nombre para el evento.")

st.divider()

# --- SECCIÓN 2: SUBIR FOTOS A UN EVENTO ---
st.subheader("2️⃣ Subir Fotos a un Evento")
try:
    eventos_res = supabase.table("eventos").select("*").execute()
    eventos = eventos_res.data
except Exception:
    eventos = []

if eventos:
    evento_dict = {ev["nombre"]: ev["id"] for ev in eventos}
    evento_seleccionado = st.selectbox("Selecciona el Evento para Subir Fotos", list(evento_dict.keys()), key="select_subir")
    evento_id_activo = evento_dict[evento_seleccionado]

    uploaded_files = st.file_uploader("Selecciona las imágenes de la galería", type=["jpg", "jpeg", "png"], accept_multiple_files=True)

    if st.button("Procesar y Subir Fotografías"):
        if uploaded_files:
            progress_bar = st.progress(0)
            total_files = len(uploaded_files)

            try:
                precio_foto = float(precio_str.replace(".", "").replace(",", "").strip())
            except:
                precio_foto = 1500.0

            for i, uploaded_file in enumerate(uploaded_files):
                try:
                    bytes_data = uploaded_file.read()
                    
                    # Generar vector facial con ArcFace y mtcnn (512 dimensiones)
                    image_pil = Image.open(io.BytesIO(bytes_data)).convert('RGB')
                    img_np = np.array(image_pil)
                    
                    vector_rostro = []
                    try:
                        representaciones = DeepFace.represent(img_np, model_name="ArcFace", detector_backend="mtcnn", enforce_detection=False)
                        if representaciones and "embedding" in representaciones[0]:
                            vector_rostro = representaciones[0]["embedding"]
                    except Exception:
                        vector_rostro = []

                    # Subir imagen a Supabase Storage
                    file_path = f"{evento_id_activo}/{uploaded_file.name}"
                    supabase.storage.from_("fotos_eventos").upload(file_path, bytes_data, file_options={"contentType": uploaded_file.type, "upsert": "true"})
                    
                    # Obtener URL pública
                    public_url = supabase.storage.from_("fotos_eventos").get_public_url(file_path)

                    # Registrar en la tabla de fotos con su vector ArcFace
                    supabase.table("fotos").insert({
                        "evento_id": evento_id_activo,
                        "url_preview": public_url,
                        "precio": precio_foto,
                        "vector_rostro": json.dumps(vector_rostro) if vector_rostro else None
                    }).execute()

                except Exception as ex:
                    st.warning(f"No se pudo procesar {uploaded_file.name}: {ex}")

                progress_bar.progress((i + 1) / total_files)

            st.success("¡Todas las fotografías han sido procesadas y subidas con éxito!")
        else:
            st.warning("Selecciona al menos una fotografía para subir.")
else:
    st.info("No hay eventos creados todavía.")

st.divider()

# --- SECCIÓN 3: VER, GESTIONAR, EDITAR PRECIOS Y ELIMINAR ÁLBUMES ---
st.subheader("3️⃣ Ver Álbumes, Editar Precios y Contenido")
if eventos:
    evento_ver_seleccionado = st.selectbox("Selecciona un Álbum para administrar", list(evento_dict.keys()), key="select_ver")
    evento_ver_id = evento_dict[evento_ver_seleccionado]

    # Subsección: Actualizar precio masivo para todo el álbum
    with st.expander("💰 Cambiar Precio Masivo para este Álbum"):
        nuevo_precio_masivo_str = st.text_input("Nuevo precio para todas las fotos del álbum ($)", value="1500", key="masivo_precio")
        if st.button("Aplicar nuevo precio a todas las fotos"):
            try:
                precio_convertido = float(nuevo_precio_masivo_str.replace(".", "").replace(",", "").strip())
                supabase.table("fotos").update({"precio": precio_convertido}).eq("evento_id", evento_ver_id).execute()
                st.success(f"¡Se actualizó el precio a ${precio_convertido} para todas las fotos del álbum!")
                st.rerun()
            except ValueError:
                st.error("Ingresa un número válido para el precio.")
            except Exception as err:
                st.error(f"Error al actualizar precios masivos: {err}")

    # Botón para eliminar el álbum completo
    if st.button(f"🗑️ Eliminar Álbum Completo ('{evento_ver_seleccionado}')", key=f"del_album_{evento_ver_id}"):
        try:
            supabase.table("fotos").delete().eq("evento_id", evento_ver_id).execute()
            supabase.table("eventos").delete().eq("id", evento_ver_id).execute()
            st.success(f"¡Álbum '{evento_ver_seleccionado}' eliminado con éxito!")
            st.rerun()
        except Exception as err:
            st.error(f"No se pudo eliminar el álbum: {err}")

    try:
        fotos_res = supabase.table("fotos").select("*").eq("evento_id", evento_ver_id).execute()
        fotos_album = fotos_res.data
    except Exception:
        fotos_album = []

    st.write(f"Total de fotos en **{evento_ver_seleccionado}**: `{len(fotos_album)}`")

    if fotos_album:
        cols = st.columns(3)
        for index, foto in enumerate(fotos_album):
            col = cols[index % 3]
            with col:
                st.image(foto["url_preview"], use_container_width=True)
                
                # Edición de precio individual por foto
                precio_actual = foto.get('precio', 1500.0)
                nuevo_precio_ind = st.text_input(f"Precio ID {foto['id'][:4]}...", value=str(precio_actual), key=f"precio_ind_{foto['id']}")
                
                if st.button("Actualizar Precio", key=f"btn_precio_{foto['id']}"):
                    try:
                        precio_val = float(nuevo_precio_ind.replace(".", "").replace(",", "").strip())
                        supabase.table("fotos").update({"precio": precio_val}).eq("id", foto["id"]).execute()
                        st.success("¡Precio actualizado!")
                        st.rerun()
                    except ValueError:
                        st.error("Precio inválido.")
                    except Exception as e:
                        st.error(f"Error: {e}")

                if st.button("🗑️ Eliminar foto", key=f"del_{foto['id']}"):
                    try:
                        supabase.table("fotos").delete().eq("id", foto["id"]).execute()
                        st.success("Foto eliminada.")
                        st.rerun()
                    except Exception as err:
                        st.error(f"No se pudo eliminar: {err}")
    else:
        st.info("Este álbum todavía no tiene fotografías cargadas.")
else:
    st.info("No hay álbumes disponibles para mostrar.")