"""
WebSocket pipeline integration test.
Run with: MOCK_MODE=true python scripts/test_websocket.py [--host localhost] [--port 8001]
"""
import asyncio
import json
import sys
import argparse
import httpx
import websockets


async def run_test(base_url: str, ws_url: str):
    results = []

    def check(name, condition, detail=""):
        status = "PASS" if condition else "FAIL"
        results.append((status, name, detail))
        print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))

    print(f"\n=== WebSocket Pipeline Test ({base_url}) ===\n")

    # 1. Create session
    print("Step 1: Create session via REST API")
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{base_url}/api/sessions",
                               json={"scenario_id": "paris-restaurant-01", "user_id": "ws-test"})
    check("Session creation (HTTP 200)", r.status_code == 200, f"status={r.status_code}")
    if r.status_code != 200:
        print("  Cannot continue without a session. Aborting.")
        return results

    session_id = r.json()["id"]
    print(f"  Session ID: {session_id}")

    # 2. Connect WebSocket
    print("\nStep 2: WebSocket connection + session_started")
    uri = f"{ws_url}/ws/session/{session_id}"
    try:
        async with websockets.connect(uri) as ws:
            check("WebSocket connected", True)

            # Expect session_started message
            raw = await asyncio.wait_for(ws.recv(), timeout=5)
            msg = json.loads(raw)
            check("Received session_started", msg["type"] == "session_started",
                  f"got type={msg['type']}")

            # May also receive npc_audio for opening line
            # drain any opening audio
            try:
                while True:
                    raw = await asyncio.wait_for(ws.recv(), timeout=2)
                    msg2 = json.loads(raw)
                    if msg2["type"] not in ("npc_audio",):
                        break
            except asyncio.TimeoutError:
                pass

            # 3. Send text_input
            print("\nStep 3: Send text_input and receive NPC pipeline messages")
            await ws.send(json.dumps({
                "type": "text_input",
                "data": {"text": "Bonjour, je voudrais un café s'il vous plaît"}
            }))

            received = {}
            deadline = asyncio.get_event_loop().time() + 10
            while asyncio.get_event_loop().time() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=3)
                    msg = json.loads(raw)
                    received[msg["type"]] = msg
                    if "transcription" in received and "npc_text" in received and "npc_audio" in received:
                        break
                except asyncio.TimeoutError:
                    break

            check("Received transcription", "transcription" in received,
                  received.get("transcription", {}).get("data", {}).get("text", "missing"))
            check("Received npc_text", "npc_text" in received,
                  received.get("npc_text", {}).get("data", {}).get("text", "missing")[:60])
            check("Received npc_audio", "npc_audio" in received,
                  f"audio bytes present={bool(received.get('npc_audio',{}).get('data',{}).get('audio'))}")

            # 4. End session and get evaluation
            print("\nStep 4: Send end action and receive evaluation")
            await ws.send(json.dumps({
                "type": "user_action",
                "data": {"action": "end"}
            }))

            eval_msg = None
            deadline = asyncio.get_event_loop().time() + 15
            while asyncio.get_event_loop().time() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=5)
                    msg = json.loads(raw)
                    if msg["type"] == "evaluation":
                        eval_msg = msg
                        break
                except asyncio.TimeoutError:
                    break

            check("Received evaluation", eval_msg is not None)
            if eval_msg:
                report = eval_msg["data"]["report"]
                check("Evaluation has overall_score",
                      "overall_score" in report,
                      f"score={report.get('overall_score')}")
                check("Evaluation has cefr_estimate",
                      "cefr_estimate" in report,
                      f"cefr={report.get('cefr_estimate')}")

    except Exception as e:
        check("WebSocket test (no exception)", False, str(e))

    # Summary
    passed = sum(1 for s, _, _ in results if s == "PASS")
    failed = sum(1 for s, _, _ in results if s == "FAIL")
    print(f"\n{'='*40}")
    print(f"Result: {passed} passed, {failed} failed")
    print("OVERALL: PASS" if failed == 0 else "OVERALL: FAIL")
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", default=8001, type=int)
    args = parser.parse_args()

    base = f"http://{args.host}:{args.port}"
    ws = f"ws://{args.host}:{args.port}"

    results = asyncio.run(run_test(base, ws))
    failed = sum(1 for s, _, _ in results if s == "FAIL")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
