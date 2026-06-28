import asyncio
import base64
import json
import logging
import mimetypes
import os
import shutil
import subprocess
import tempfile
import uuid
from collections import deque
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Configure logging.  Possible logging levels are:
#   - logging.DEBUG
#   - logging.INFO
#   - logging.WARNING
#   - logging.ERROR
#   - logging.CRITICAL
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

static_dir = os.getenv('NIIVUE_BUILD_DIR')
data_dir = os.getenv('DATA_DIR')
scene_schema_id = os.getenv('SCENE_SCHEMA_ID')
imaging_extensions_str = os.getenv('IMAGING_EXTENSIONS', '["*.nii", "*.nii.gz"]')
imaging_extensions = json.loads(imaging_extensions_str)
surface_patterns_str = os.getenv('SURFACE_PATTERNS', '["lh.white", "rh.white", "lh.pial", "rh.pial", "lh.white.preaparc", "rh.white.preaparc", "lh.inflated", "rh.inflated", "lh.orig", "rh.orig", "lh.sphere", "rh.sphere"]')
surface_patterns = json.loads(surface_patterns_str)
# Optional separate directory for surface files. Falls back to data_dir if not set.
surface_data_dir = os.getenv('SURFACE_DATA_DIR') or data_dir
serverless_mode = os.getenv('SERVERLESS_MODE', 'false').lower() == 'true'

logger.info(f"NIIVUE_BUILD_DIR: {static_dir}")
logger.info(f"DATA_DIR: {data_dir}")
logger.info(f"SURFACE_DATA_DIR: {surface_data_dir}")
logger.info(f"SCENE_SCHEMA_ID: {scene_schema_id}")
logger.info(f"IMAGING_EXTENSIONS: {imaging_extensions}")
logger.info(f"SURFACE_PATTERNS: {surface_patterns}")
logger.info(f"SERVERLESS_MODE: {serverless_mode}")

# Register the MIME type so that .gz files (or .nii.gz files) are served correctly.
mimetypes.add_type("application/gzip", ".nii.gz", strict=True)

# In-memory list of absolute paths for user-specified surface files.
# Empty means fall back to DATA_DIR pattern scan.
_surface_files: list[str] = []


class SetupSurfacesRequest(BaseModel):
    files: list[str]  # absolute paths on the cluster filesystem


class SaveSceneRequest(BaseModel):
    filename: str
    data: dict

class SaveVolumeRequest(BaseModel):
    filename: str
    data: str  # base64 encoded NIfTI data

class SaveVolumeInPlaceRequest(BaseModel):
    originalPath: str  # data/wm.mgz, /data/wm.mgz, or full URL — all accepted
    data: str          # base64 encoded NIfTI data


class ChatMessage(BaseModel):
    role: str  # "agent" | "user"
    content: str


_chat_history: deque = deque(maxlen=200)
_sse_clients: list[asyncio.Queue] = []

app = FastAPI()

# Define API routes BEFORE static file mounts to prevent catch-all behavior
@app.get("/nvd")
def list_niivue_documents():
    if serverless_mode:
        raise HTTPException(status_code=404, detail="Endpoint not available in serverless mode")
    nvd_dir = os.path.join(data_dir)
    logger.debug(f"Looking for niivue documents (.nvd) files recursivly in {nvd_dir}")
    nvd_files = []
    try:
      for filepath in Path(nvd_dir).rglob('*.nvd'):
        rel_filepath = str(filepath.relative_to(nvd_dir))
        nvd_file = {
            "filename": rel_filepath,
            "url": "data/" + rel_filepath
        }
        nvd_files.append(nvd_file)
    except Exception as e:
        return {"error": str(e)}
    return sorted(nvd_files, key=lambda x: x["url"])

@app.post("/api/surfaces/setup")
def setup_surfaces(request: SetupSurfacesRequest):
    """Register a list of surface file paths to serve via /surface-data/<name>."""
    global _surface_files
    missing = [f for f in request.files if not Path(f).exists()]
    if missing:
        raise HTTPException(status_code=400, detail=f"Files not found: {missing}")
    _surface_files = list(request.files)
    logger.info(f"Surface files set up: {_surface_files}")
    return {"success": True, "count": len(_surface_files),
            "files": [Path(f).name for f in _surface_files]}


@app.delete("/api/surfaces/cleanup")
def cleanup_surfaces():
    """Clear the in-memory surface file list."""
    global _surface_files
    _surface_files = []
    logger.info("Surface file list cleared")
    return {"success": True}


@app.get("/surface-data/{filename}")
def serve_surface_file(filename: str):
    """Serve a surface file from the in-memory list by its basename."""
    for abs_path in _surface_files:
        if Path(abs_path).name == filename:
            return FileResponse(abs_path, media_type="application/octet-stream")
    raise HTTPException(status_code=404, detail=f"Surface file not found: {filename}")


@app.get("/surfaces")
def list_surface_files():
    if serverless_mode:
        raise HTTPException(status_code=404, detail="Endpoint not available in serverless mode")

    # If the agent has set up specific surface files, serve those.
    if _surface_files:
        result = []
        seen_names: set[str] = set()
        for abs_path in _surface_files:
            p = Path(abs_path)
            name = p.name
            if name in seen_names:
                # Disambiguate with parent dir prefix
                name = f"{p.parent.name}/{p.name}"
            seen_names.add(name)
            result.append({"filename": name, "url": f"surface-data/{p.name}"})
        return sorted(result, key=lambda x: x["filename"])

    # Fallback: scan surface_data_dir for known FreeSurfer surface file names.
    scan_dir = Path(surface_data_dir)
    use_surf_mount = surface_data_dir != data_dir
    url_prefix = "surf-data/" if use_surf_mount else "data/"
    logger.debug(f"Looking for surface files {surface_patterns} recursively in {scan_dir}")
    surface_files = []
    seen: set[str] = set()
    try:
        for pattern in surface_patterns:
            for filepath in scan_dir.rglob(pattern):
                rel_filepath = str(filepath.relative_to(scan_dir))
                if rel_filepath not in seen:
                    seen.add(rel_filepath)
                    surface_files.append({
                        "filename": rel_filepath,
                        "url": url_prefix + rel_filepath,
                    })
    except Exception as e:
        return {"error": str(e)}
    return sorted(surface_files, key=lambda x: x["url"])

@app.get("/imaging")
def list_imaging_files():
    if serverless_mode:
        raise HTTPException(status_code=404, detail="Endpoint not available in serverless mode")
    imaging_dir = os.path.join(data_dir)
    logger.debug(f"Looking for imaging files {imaging_extensions} recursively in {imaging_dir}")
    imaging_files = []
    try:
        for pattern in imaging_extensions:
            for filepath in Path(imaging_dir).rglob(pattern):
                rel_filepath = str(filepath.relative_to(imaging_dir))
                imaging_file = {
                    "filename": rel_filepath,
                    "url": "data/" + rel_filepath
                }
                imaging_files.append(imaging_file)
    except Exception as e:
        return {"error": str(e)}
    return sorted(imaging_files, key=lambda x: x["url"])

@app.post("/nvd")
def save_scene(request: SaveSceneRequest):
    """
    Save scene data to a file in the DATA_DIR directory.

    Args:
        request: Contains filename and scene data

    Returns:
        Success message or error
    """
    if serverless_mode:
        raise HTTPException(status_code=404, detail="Endpoint not available in serverless mode")
    try:
        # Validate filename
        if not request.filename:
            raise HTTPException(status_code=400, detail="Filename is required")
        
        # Ensure filename ends with .nvd
        if not request.filename.endswith('.nvd'):
            filename = request.filename + '.nvd'
        else:
            filename = request.filename
        
        # Create full file path
        file_path = Path(data_dir) / filename
        
        # Create directory if it doesn't exist
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write the JSON data to file
        with open(file_path, 'w') as f:
            json.dump(request.data, f, indent=2)
        
        logger.info(f"Scene saved successfully to {file_path}")
        
        return {
            "success": True,
            "message": f"Scene saved successfully to {filename}",
            "file_path": str(file_path.relative_to(data_dir))
        }
        
    except Exception as e:
        logger.error(f"Error saving scene: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save scene: {str(e)}")

@app.post("/nii")
def save_volume(request: SaveVolumeRequest):
    """
    Save volume data to a file in the DATA_DIR directory.

    Args:
        request: Contains filename and base64 encoded NIfTI data

    Returns:
        Success message or error
    """
    if serverless_mode:
        raise HTTPException(status_code=404, detail="Endpoint not available in serverless mode")
    try:
        # Validate filename
        if not request.filename:
            raise HTTPException(status_code=400, detail="Filename is required")
        
        # Remove 'data/' prefix if present (frontend URLs vs backend paths)
        filename = request.filename
        if filename.startswith('data/'):
            filename = filename[5:]  # Remove 'data/' prefix
        
        # Ensure filename has .nii or .nii.gz extension
        if not filename.endswith('.nii') and not filename.endswith('.nii.gz'):
            filename = filename + '.nii.gz'  # Default to compressed
        
        # Decode base64 data
        try:
            volume_data = base64.b64decode(request.data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 data: {str(e)}")
        
        # Create full file path
        file_path = Path(data_dir) / filename
        
        # Create directory if it doesn't exist
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write the binary data to file
        with open(file_path, 'wb') as f:
            f.write(volume_data)
        
        logger.info(f"Volume saved successfully to {file_path}")
        
        return {
            "success": True,
            "message": f"Volume saved successfully to {filename}",
            "file_path": str(file_path.relative_to(data_dir))
        }
        
    except Exception as e:
        logger.error(f"Error saving volume: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save volume: {str(e)}")

def _resolve_original_path(original_path: str) -> Path:
    """Normalize any path/URL format to an absolute filesystem path under DATA_DIR."""
    p = original_path

    # Strip full URL down to path component
    if p.startswith("http://") or p.startswith("https://"):
        p = urlparse(p).path  # e.g. /data/wm.mgz

    # Strip /data/ or data/ prefix
    if p.startswith("/data/"):
        p = p[6:]
    elif p.startswith("data/"):
        p = p[5:]
    elif p.startswith("/"):
        p = p[1:]

    return Path(data_dir) / p


@app.post("/api/debug-form")
async def debug_form(request: Request):
    form = await request.form()
    fields = {}
    for key, val in form.multi_items():
        if hasattr(val, 'filename'):
            content = await val.read()
            fields[key] = f"<file: {val.filename}, {len(content)} bytes>"
        else:
            fields[key] = val
    logger.info(f"debug-form fields: {fields}")
    return fields


@app.post("/api/save-volume")
async def save_volume_inplace(request: Request):
    """
    Receive edited NIfTI data (multipart/form-data), convert to the original
    file's format via mri_convert if needed (.nii.gz → .mgz), and overwrite
    the original file in DATA_DIR.
    Accepts any file field name alongside an 'originalPath' form field.
    """
    if serverless_mode:
        raise HTTPException(status_code=404, detail="Endpoint not available in serverless mode")

    form = await request.form()
    logger.info(f"save-volume: form fields = {list(form.keys())}")

    # Extract originalPath from any string field named 'originalPath'
    original_path_str = form.get("originalPath")
    if not original_path_str:
        raise HTTPException(status_code=400, detail="Missing 'originalPath' form field")

    # Find the file — use field named 'data', or fall back to first UploadFile
    file_field = form.get("data")
    if file_field is None:
        for val in form.values():
            if hasattr(val, "read"):
                file_field = val
                break
    if file_field is None:
        raise HTTPException(status_code=400, detail="No file found in form data")

    target_path = _resolve_original_path(original_path_str)
    logger.info(f"save-volume: resolved target → {target_path}")

    try:
        target_path.relative_to(data_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="Target path is outside DATA_DIR")

    nifti_bytes = await file_field.read()

    target_path.parent.mkdir(parents=True, exist_ok=True)
    suffix = "".join(target_path.suffixes)  # e.g. ".mgz" or ".nii.gz"

    if suffix in (".mgz", ".mgh"):
        with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as tmp:
            tmp.write(nifti_bytes)
            tmp_path = tmp.name
        FS_HOME = "/nas/longleaf/apps/freesurfer/7.4.1/freesurfer"
        MRI_CONVERT = os.getenv("MRI_CONVERT", f"{FS_HOME}/bin/mri_convert")
        env = os.environ.copy()
        env.setdefault("FREESURFER_HOME", FS_HOME)
        try:
            result = subprocess.run(
                [MRI_CONVERT, tmp_path, str(target_path)],
                capture_output=True, text=True, env=env
            )
            if result.returncode != 0:
                raise HTTPException(
                    status_code=500,
                    detail=f"mri_convert failed: {result.stderr}"
                )
        finally:
            os.unlink(tmp_path)
    else:
        target_path.write_bytes(nifti_bytes)

    logger.info(f"save-volume: wrote {len(nifti_bytes)} bytes → {target_path}")
    return {
        "success": True,
        "path": str(target_path.relative_to(data_dir)),
    }


@app.post("/api/chat")
async def post_chat_message(msg: ChatMessage):
    """Receive a message from the agent and broadcast it to all connected SSE clients."""
    entry = {"id": str(uuid.uuid4()), "role": msg.role, "content": msg.content}
    _chat_history.append(entry)
    for q in _sse_clients:
        await q.put(entry)
    return {"ok": True}


@app.get("/api/chat/stream")
async def stream_chat(request: Request):
    """SSE endpoint — frontend subscribes here to receive chat messages in real time."""
    q: asyncio.Queue = asyncio.Queue()
    _sse_clients.append(q)

    async def generate():
        for msg in list(_chat_history):
            yield f"data: {json.dumps(msg)}\n\n"
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=25.0)
                    yield f"data: {json.dumps(msg)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            _sse_clients.remove(q)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# /data must be mounted before / to avoid catch-all interception
if not serverless_mode:
    app.mount("/data", StaticFiles(directory=data_dir, html=False), name="data")
    if surface_data_dir != data_dir:
        app.mount("/surf-data", StaticFiles(directory=surface_data_dir, html=False), name="surf-data")

app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
