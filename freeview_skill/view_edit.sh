#!/bin/bash
# view_edit.sh — stage files into a temp viewer workspace, sync edits back on change
#
# Usage:
#   view_edit.sh [OPTIONS] file1 [file2 ...]
#
# Options:
#   -p PORT    viewer port (default: 8888)
#   -i SECS    poll interval in seconds (default: 5)
#
# Examples:
#   view_edit.sh brain.mgz wm.mgz
#   view_edit.sh /abs/path/brain.mgz /abs/path/wm.mgz
#   view_edit.sh -p 9999 brain.mgz wm.mgz

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON=/nas/longleaf/rhel9/apps/anaconda/2024.02/bin/python
PORT=8888
POLL=5

# --- parse options ---
while getopts "p:i:" opt; do
    case $opt in
        p) PORT="$OPTARG" ;;
        i) POLL="$OPTARG" ;;
        *) echo "Unknown option: -$OPTARG" >&2; exit 1 ;;
    esac
done
shift $((OPTIND - 1))

if [ $# -eq 0 ]; then
    echo "Usage: $0 [-p PORT] [-i POLL_SECS] file1 [file2 ...]"
    exit 1
fi

# --- create temp workspace ---
TMP_DIR=$(mktemp -d /tmp/viewer_XXXXXX)
MAP_FILE="$TMP_DIR/.origins"   # filename -> original_abs_path

echo "Workspace: $TMP_DIR"

# --- copy files in and record origins ---
for f in "$@"; do
    abs=$(realpath "$f")
    if [ ! -f "$abs" ]; then
        echo "ERROR: file not found: $abs" >&2
        rm -rf "$TMP_DIR"
        exit 1
    fi
    fname=$(basename "$abs")
    cp "$abs" "$TMP_DIR/$fname"
    echo "$fname $abs" >> "$MAP_FILE"
    echo "  staged: $fname  ←  $abs"
done

# helper: look up original path for a filename
origin_of() {
    local fname="$1"
    grep "^${fname} " "$MAP_FILE" 2>/dev/null | awk '{print $2}' | head -1
}

# --- snapshot mtimes of all staged files ---
declare -A MTIME
for f in "$TMP_DIR"/*; do
    [[ "$(basename "$f")" == .* ]] && continue
    MTIME["$(basename "$f")"]=$(stat -c %Y "$f")
done

# --- cleanup on exit ---
VIEWER_PID=0
cleanup() {
    echo ""
    echo "Shutting down..."
    sync_back
    [ "$VIEWER_PID" -gt 0 ] && { kill "$VIEWER_PID" 2>/dev/null || true; wait "$VIEWER_PID" 2>/dev/null || true; }
    rm -rf "$TMP_DIR"
    echo "Workspace cleaned up."
}
trap cleanup EXIT INT TERM

# --- sync changed/new files back to origins ---
sync_back() {
    local synced=0
    for f in "$TMP_DIR"/*; do
        [[ "$(basename "$f")" == .* ]] && continue
        local fname
        fname=$(basename "$f")
        local cur_mtime
        cur_mtime=$(stat -c %Y "$f")
        local prev_mtime="${MTIME[$fname]:-0}"

        if [ "$cur_mtime" != "$prev_mtime" ]; then
            local origin
            origin=$(origin_of "$fname")
            if [ -n "$origin" ]; then
                # known file — copy back to original location
                cp "$f" "$origin"
                echo "[$(date '+%H:%M:%S')] synced back: $fname → $origin"
            else
                # new file created by viewer (e.g. wm.mgz.nii.gz)
                # infer destination from a known file in the same dir
                local ref_dir
                ref_dir=$(awk 'NR==1{print $2}' "$MAP_FILE" | xargs dirname)
                cp "$f" "$ref_dir/$fname"
                echo "[$(date '+%H:%M:%S')] new file synced: $fname → $ref_dir/$fname"
                # add to map so future changes sync to same place
                echo "$fname $ref_dir/$fname" >> "$MAP_FILE"
            fi
            MTIME["$fname"]="$cur_mtime"
            synced=1
        fi
    done
}

# --- start viewer in background ---
NIIVUE_BUILD_DIR="${SCRIPT_DIR}/frontend/dist"
export NIIVUE_BUILD_DIR
export DATA_DIR="$TMP_DIR"
export IMAGING_EXTENSIONS='["*.nii", "*.nii.gz", "*.mgz", "*.mgh"]'
export SERVERLESS_MODE=false

NODE=$(hostname -s)
echo ""
echo "============================================"
echo " FreeView Viewer"
echo " Port     : $PORT"
echo " Node     : $NODE"
echo " Sync     : every ${POLL}s"
echo ""
echo " SSH tunnel:"
echo "   ssh -L ${PORT}:127.0.0.1:${PORT} ycli@${NODE}.its.unc.edu"
echo " Browser:"
echo "   http://localhost:${PORT}/"
echo "============================================"
echo ""

cd "${SCRIPT_DIR}/backend/src"
$PYTHON -m uvicorn server:app --host 127.0.0.1 --port "${PORT}" &
VIEWER_PID=$!

# --- poll loop ---
while kill -0 "$VIEWER_PID" 2>/dev/null; do
    sleep "$POLL"
    sync_back
done

echo "Viewer exited."
