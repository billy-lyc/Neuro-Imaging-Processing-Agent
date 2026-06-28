#!/bin/bash
# Usage: ./start_viewer.sh <data_dir> [<surface_dir>] [<port>]
#   data_dir:    directory containing imaging files (MGZ/NIfTI)
#   surface_dir: optional separate directory for surface files
#   port:        optional port number (default 8888)

DATA_DIR="${1}"

# Detect whether arg2 is a port number or a surface directory path
if [[ "${2}" =~ ^[0-9]+$ ]]; then
    SURFACE_DATA_DIR=""
    PORT="${2:-8888}"
else
    SURFACE_DATA_DIR="${2:-}"
    PORT="${3:-8888}"
fi

if [ -z "$DATA_DIR" ]; then
    echo "Usage: $0 <data_dir> [<surface_dir>] [<port>]"
    echo "  data_dir:    directory containing imaging files"
    echo "  surface_dir: optional separate directory for surface files"
    exit 1
fi

if [ ! -d "$DATA_DIR" ]; then
    echo "Error: directory not found: $DATA_DIR"
    exit 1
fi

if [ -n "$SURFACE_DATA_DIR" ] && [ ! -d "$SURFACE_DATA_DIR" ]; then
    echo "Error: surface directory not found: $SURFACE_DATA_DIR"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NIIVUE_BUILD_DIR="${SCRIPT_DIR}/frontend/dist"

if [ ! -d "$NIIVUE_BUILD_DIR" ]; then
    echo "Error: frontend/dist/ not found at ${NIIVUE_BUILD_DIR}"
    echo "The viewer requires a pre-built frontend. To fix:"
    echo "  1. On a machine with Node.js/npm, run:"
    echo "       cd ${SCRIPT_DIR}/frontend && npm install && npm run build"
    echo "  2. Copy the resulting dist/ folder to ${SCRIPT_DIR}/frontend/"
    exit 1
fi

# Resolve Python: find one that has the required packages
_has_deps() { "$1" -c "import fastapi, uvicorn, pydantic" 2>/dev/null; }

PYTHON=""
for _candidate in \
    "$(command -v python3 2>/dev/null)" \
    "$(command -v python 2>/dev/null)" \
    /nas/longleaf/rhel9/apps/anaconda/2024.02/bin/python; do
    [ -x "$_candidate" ] && _has_deps "$_candidate" && { PYTHON="$_candidate"; break; }
done

if [ -z "$PYTHON" ]; then
    echo "Error: No Python with required packages (fastapi, uvicorn, pydantic) found."
    echo "Install them with:"
    echo "  pip install fastapi uvicorn pydantic"
    echo "Or load the appropriate module (e.g. module load anaconda)."
    exit 1
fi

export NIIVUE_BUILD_DIR
export DATA_DIR
export SURFACE_DATA_DIR
export IMAGING_EXTENSIONS='["*.nii", "*.nii.gz", "*.mgz", "*.mgh"]'
export SURFACE_PATTERNS='["lh.white", "rh.white", "lh.pial", "rh.pial", "lh.white.preaparc", "rh.white.preaparc", "lh.inflated", "rh.inflated", "lh.orig", "rh.orig", "lh.sphere", "rh.sphere"]'
export SERVERLESS_MODE=false

echo "============================================"
echo " FreeView Online Viewer"
echo "============================================"
echo " Data directory    : $DATA_DIR"
echo " Surface directory : ${SURFACE_DATA_DIR:-'(same as data)'}"
echo " Port              : $PORT"
echo ""
echo " To access from your local machine, run:"
echo "   ssh -L ${PORT}:127.0.0.1:${PORT} $(whoami)@$(hostname)"
echo ""
echo " Then open in your browser:"
echo "   http://localhost:${PORT}/"
echo "============================================"
echo ""

cd "${SCRIPT_DIR}/backend/src"
$PYTHON -m uvicorn server:app --host 127.0.0.1 --port "${PORT}" --reload
