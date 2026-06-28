#!/usr/bin/env python3
"""Send a message to the freeview chat panel via the backend SSE channel.

Usage (from agent or shell):
    python post-chat.py "QC1 passed — skull strip looks good" [--role agent] [--url http://localhost:8000]
    python post-chat.py "User said: looks clean" --role user
"""
import argparse
import json
import sys
import urllib.error
import urllib.request


def post_message(content: str, role: str = "agent", base_url: str = "http://localhost:8000") -> dict:
    url = f"{base_url}/api/chat"
    payload = json.dumps({"role": role, "content": content}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except urllib.error.URLError as e:
        print(f"[post-chat] Could not reach {url}: {e}", file=sys.stderr)
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Post a message to the freeview chat panel")
    parser.add_argument("content", help="Message text")
    parser.add_argument("--role", default="agent", choices=["agent", "user"])
    parser.add_argument("--url", default="http://localhost:8000", help="Backend base URL")
    args = parser.parse_args()
    result = post_message(args.content, args.role, args.url)
    print(result)
