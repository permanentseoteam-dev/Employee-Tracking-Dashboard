"""
WorkPulse Desktop Agent (Windows)
Privacy-focused, lightweight attendance, activity aggregator & screenshot agent.

Zero Keylogging: Tracks atomic keypress and click counts ONLY.
Local Queue: Offline-first SQLite persistence with exponential backoff sync.
WebP Compression: Client-side resize and WebP encoding before network upload.
"""

import os
import sys
import time
import json
import uuid
import socket
import platform
import sqlite3
import logging
import threading
from io import BytesIO
from datetime import datetime, timezone
from pathlib import Path

import requests
from PIL import Image, ImageGrab
from pynput import keyboard, mouse

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("WorkPulseAgent")

# Default Config
CONFIG_FILE = Path(__file__).resolve().parent / "config.json"
DEFAULT_CONFIG = {
    "server_url": "http://127.0.0.1:8000",
    "employee_code": "EMP001",
    "device_token": None,
    "device_id": None,
    "sync_interval_seconds": 60,      # Default 1 minute for responsive test/demo
    "screenshot_interval_seconds": 600, # 10 minutes default
    "screenshot_quality": 65,
    "screenshot_max_width": 1280,
    "screenshot_max_height": 720,
    "grid_cols": 20,
    "grid_rows": 12,
    "idle_threshold_seconds": 60,
    "max_queue_items": 1000,
}


def load_config() -> dict:
    config = DEFAULT_CONFIG.copy()
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                user_conf = json.load(f)
                config.update(user_conf)
        except Exception as e:
            logger.warning(f"Failed to read config.json: {e}")
    else:
        save_config(config)
    return config


def save_config(config: dict):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        logger.warning(f"Failed to write config.json: {e}")


def get_hardware_uuid() -> str:
    """Returns a stable hardware identifier based on MAC/machine node."""
    node = uuid.getnode()
    return f"HW-{hex(node)[2:].upper()}"


class LocalQueue:
    """Local SQLite queue ensuring offline persistence and backpressure."""

    def __init__(self, db_path: str = "agent_queue.db", max_items: int = 1000):
        self.db_path = Path(__file__).resolve().parent / db_path
        self.max_items = max_items
        self._init_db()

    def _get_conn(self):
        return sqlite3.connect(str(self.db_path), timeout=10.0)

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS queue_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_type TEXT NOT NULL, -- 'BATCH' or 'SCREENSHOT'
                    payload TEXT NOT NULL,   -- JSON string or metadata
                    binary_blob BLOB,        -- WebP binary bytes for screenshots
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def enqueue_batch(self, payload: dict):
        with self._get_conn() as conn:
            self._enforce_limit(conn)
            conn.execute(
                "INSERT INTO queue_events (item_type, payload, binary_blob) VALUES (?, ?, NULL)",
                ("BATCH", json.dumps(payload)),
            )
            conn.commit()

    def enqueue_screenshot(self, metadata: dict, image_bytes: bytes):
        with self._get_conn() as conn:
            self._enforce_limit(conn)
            conn.execute(
                "INSERT INTO queue_events (item_type, payload, binary_blob) VALUES (?, ?, ?)",
                ("SCREENSHOT", json.dumps(metadata), image_bytes),
            )
            conn.commit()

    def fetch_pending(self, limit: int = 10) -> list[tuple]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, item_type, payload, binary_blob FROM queue_events ORDER BY id ASC LIMIT ?",
                (limit,),
            )
            return cursor.fetchall()

    def remove_items(self, item_ids: list[int]):
        if not item_ids:
            return
        placeholders = ",".join("?" for _ in item_ids)
        with self._get_conn() as conn:
            conn.execute(f"DELETE FROM queue_events WHERE id IN ({placeholders})", item_ids)
            conn.commit()

    def _enforce_limit(self, conn):
        cursor = conn.cursor()
        cursor.execute("SELECT count(*) FROM queue_events")
        count = cursor.fetchone()[0]
        if count >= self.max_items:
            # Drop oldest 100 items to protect disk
            conn.execute("DELETE FROM queue_events WHERE id IN (SELECT id FROM queue_events ORDER BY id ASC LIMIT 100)")


class ActivityTracker:
    """Atomic event collector and 20x12 mouse grid aggregator."""

    def __init__(self, grid_cols: int = 20, grid_rows: int = 12):
        self.lock = threading.Lock()
        self.grid_cols = grid_cols
        self.grid_rows = grid_rows

        self.key_press_count = 0
        self.mouse_click_count = 0
        self.mouse_move_count = 0
        self.grid_matrix: dict[str, int] = {}

        self.last_input_time = time.time()
        self.active_seconds = 0
        self.idle_seconds = 0

        # Screen dimensions
        self.screen_width = 1920
        self.screen_height = 1080
        try:
            primary_screen = ImageGrab.grab()
            self.screen_width, self.screen_height = primary_screen.size
        except Exception:
            pass

    def on_press(self, key):
        # Atomic counter ONLY. Never record key char or text.
        with self.lock:
            self.key_press_count += 1
            self.last_input_time = time.time()

    def on_click(self, x, y, button, pressed):
        if pressed:
            with self.lock:
                self.mouse_click_count += 1
                self.last_input_time = time.time()
                self._record_grid_point(x, y)

    def on_move(self, x, y):
        with self.lock:
            self.mouse_move_count += 1
            self.last_input_time = time.time()
            # Bin move coordinate into grid
            self._record_grid_point(x, y)

    def _record_grid_point(self, x: int, y: int):
        col = min(max(0, int((x / max(1, self.screen_width)) * self.grid_cols)), self.grid_cols - 1)
        row = min(max(0, int((y / max(1, self.screen_height)) * self.grid_rows)), self.grid_rows - 1)
        key = f"{row},{col}"
        self.grid_matrix[key] = self.grid_matrix.get(key, 0) + 1

    def tick_second(self, idle_threshold: int = 60):
        with self.lock:
            now = time.time()
            if now - self.last_input_time > idle_threshold:
                self.idle_seconds += 1
            else:
                self.active_seconds += 1

    def flush_window(self, start_time: datetime, end_time: datetime) -> tuple[dict, dict]:
        """Resets active counters and returns the 5-min batch and heatmap payload."""
        with self.lock:
            activity_batch = {
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "key_press_count": self.key_press_count,
                "mouse_click_count": self.mouse_click_count,
                "mouse_move_count": self.mouse_move_count,
                "active_seconds": self.active_seconds,
                "idle_seconds": self.idle_seconds,
            }
            heatmap_batch = {
                "window_start": start_time.isoformat(),
                "window_end": end_time.isoformat(),
                "screen_width": self.screen_width,
                "screen_height": self.screen_height,
                "grid_cols": self.grid_cols,
                "grid_rows": self.grid_rows,
                "grid_matrix": self.grid_matrix.copy(),
            }

            # Reset window accumulators
            self.key_press_count = 0
            self.mouse_click_count = 0
            self.mouse_move_count = 0
            self.active_seconds = 0
            self.idle_seconds = 0
            self.grid_matrix.clear()

            return activity_batch, heatmap_batch


class WorkPulseAgent:
    def __init__(self):
        self.config = load_config()
        self.server_url = self.config["server_url"].rstrip("/")
        self.employee_code = self.config["employee_code"]
        self.queue = LocalQueue(max_items=self.config.get("max_queue_items", 1000))
        self.tracker = ActivityTracker(
            grid_cols=self.config.get("grid_cols", 20),
            grid_rows=self.config.get("grid_rows", 12),
        )
        self.running = True
        self.device_token = self.config.get("device_token")
        self.device_id = self.config.get("device_id")

    def register_or_load_device(self) -> bool:
        """Registers the device with the backend or verifies existing token."""
        if self.device_token:
            logger.info(f"Loaded existing device token for employee {self.employee_code}")
            return True

        device_identifier = get_hardware_uuid()
        hostname = socket.gethostname()
        os_version = f"{platform.system()} {platform.release()}"

        logger.info(f"Registering device {device_identifier} ({hostname}) with server...")
        try:
            resp = requests.post(
                f"{self.server_url}/api/v1/devices/register",
                json={
                    "employee_code": self.employee_code,
                    "device_identifier": device_identifier,
                    "hostname": hostname,
                    "os_version": os_version,
                    "agent_version": "1.0.0-windows",
                },
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                self.device_token = data["api_token"]
                self.device_id = data["device_id"]
                self.config["device_token"] = self.device_token
                self.config["device_id"] = self.device_id
                save_config(self.config)
                logger.info(f"Device successfully registered! Device ID: {self.device_id}")
                return True
            else:
                logger.error(f"Registration failed: HTTP {resp.status_code} - {resp.text}")
                return False
        except Exception as e:
            logger.error(f"Connection error during device registration: {e}")
            return False

    def capture_screenshot_webp(self) -> tuple[dict, bytes] | None:
        """Captures desktop, resizes, and compresses to WebP locally."""
        try:
            screen = ImageGrab.grab()
            orig_w, orig_h = screen.size
            max_w = self.config.get("screenshot_max_width", 1280)
            max_h = self.config.get("screenshot_max_height", 720)
            quality = self.config.get("screenshot_quality", 65)

            # Resize maintaining aspect ratio
            screen.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
            final_w, final_h = screen.size

            buf = BytesIO()
            screen.save(buf, format="WEBP", quality=quality)
            compressed_bytes = buf.getvalue()

            metadata = {
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "width": final_w,
                "height": final_h,
                "original_width": orig_w,
                "original_height": orig_h,
                "file_size": len(compressed_bytes),
            }
            logger.info(f"Captured screen WebP: {final_w}x{final_h} ({len(compressed_bytes) // 1024} KB)")
            return metadata, compressed_bytes
        except Exception as e:
            logger.error(f"Failed to capture desktop screenshot: {e}")
            return None

    def uploader_worker(self):
        """Background daemon processing local SQLite queue and sending heartbeats."""
        backoff_seconds = 5
        last_heartbeat_time = 0

        while self.running:
            time.sleep(2)
            if not self.device_token:
                if not self.register_or_load_device():
                    time.sleep(backoff_seconds)
                    continue

            headers = {
                "X-Device-Token": self.device_token,
            }

            # 1. Heartbeat every 5 minutes
            now = time.time()
            if now - last_heartbeat_time > 300:
                try:
                    hb_resp = requests.post(
                        f"{self.server_url}/api/v1/agent/heartbeat",
                        headers=headers,
                        json={"agent_version": "1.0.0-windows"},
                        timeout=8,
                    )
                    if hb_resp.status_code == 200:
                        last_heartbeat_time = now
                        logger.debug("Heartbeat acknowledged by server.")
                except Exception as e:
                    logger.debug(f"Heartbeat network attempt failed: {e}")

            # 2. Upload pending queue items
            items = self.queue.fetch_pending(limit=5)
            if not items:
                backoff_seconds = 5
                continue

            for item_id, item_type, payload_str, binary_blob in items:
                try:
                    payload = json.loads(payload_str)
                    if item_type == "BATCH":
                        sync_resp = requests.post(
                            f"{self.server_url}/api/v1/agent/sync/batch",
                            headers=headers,
                            json=payload,
                            timeout=15,
                        )
                        if sync_resp.status_code == 200:
                            self.queue.remove_items([item_id])
                            logger.info(f"Synced activity batch #{item_id} to server.")
                            backoff_seconds = 5
                        else:
                            logger.warning(f"Batch sync rejected: HTTP {sync_resp.status_code}")
                            time.sleep(backoff_seconds)

                    elif item_type == "SCREENSHOT" and binary_blob:
                        files = {"file": ("screenshot.webp", binary_blob, "image/webp")}
                        data = {
                            "captured_at": payload.get("captured_at"),
                            "width": payload.get("width", 1280),
                            "height": payload.get("height", 720),
                        }
                        upload_resp = requests.post(
                            f"{self.server_url}/api/v1/agent/screenshots/upload",
                            headers=headers,
                            files=files,
                            data=data,
                            timeout=30,
                        )
                        if upload_resp.status_code in (200, 201):
                            self.queue.remove_items([item_id])
                            logger.info(f"Uploaded screenshot #{item_id} to server.")
                            backoff_seconds = 5
                        else:
                            logger.warning(f"Screenshot upload rejected: HTTP {upload_resp.status_code}")
                            time.sleep(backoff_seconds)

                except requests.exceptions.RequestException as net_err:
                    logger.warning(f"Network unavailable ({net_err}). Retrying in {backoff_seconds}s...")
                    time.sleep(backoff_seconds)
                    backoff_seconds = min(60, backoff_seconds * 2)
                    break
                except Exception as err:
                    logger.error(f"Error processing queue item #{item_id}: {err}")
                    time.sleep(backoff_seconds)

    def start(self):
        logger.info("==========================================")
        logger.info("  WorkPulse Windows Desktop Agent Started ")
        logger.info(f"  Employee Code : {self.employee_code}")
        logger.info(f"  Server URL    : {self.server_url}")
        logger.info("==========================================")

        # Register device
        self.register_or_load_device()

        # Enqueue initial system boot/login event
        init_payload = {
            "system_events": [
                {"event_type": "BOOT", "timestamp": datetime.now(timezone.utc).isoformat()},
                {"event_type": "LOGIN", "timestamp": datetime.now(timezone.utc).isoformat()},
            ],
            "activity_batches": [],
            "heatmap_batches": [],
        }
        self.queue.enqueue_batch(init_payload)

        # Start input hooks in background threads
        k_listener = keyboard.Listener(on_press=self.tracker.on_press)
        m_listener = mouse.Listener(
            on_click=self.tracker.on_click,
            on_move=self.tracker.on_move,
        )
        k_listener.daemon = True
        m_listener.daemon = True
        k_listener.start()
        m_listener.start()

        # Start uploader thread
        uploader = threading.Thread(target=self.uploader_worker, daemon=True)
        uploader.start()

        # Main collection loop
        sync_interval = self.config.get("sync_interval_seconds", 60)
        ss_interval = self.config.get("screenshot_interval_seconds", 600)
        idle_thresh = self.config.get("idle_threshold_seconds", 60)

        last_flush_time = datetime.now(timezone.utc)
        last_ss_time = time.time()

        try:
            while self.running:
                time.sleep(1)
                self.tracker.tick_second(idle_threshold=idle_thresh)

                now_utc = datetime.now(timezone.utc)

                # Check periodic batch flush
                if (now_utc - last_flush_time).total_seconds() >= sync_interval:
                    act_batch, hm_batch = self.tracker.flush_window(last_flush_time, now_utc)
                    batch_payload = {
                        "system_events": [],
                        "activity_batches": [act_batch],
                        "heatmap_batches": [hm_batch],
                    }
                    self.queue.enqueue_batch(batch_payload)
                    logger.info(
                        f"Flushed activity window: {act_batch['key_press_count']} keys, "
                        f"{act_batch['mouse_click_count']} clicks, {act_batch['active_seconds']}s active"
                    )
                    last_flush_time = now_utc

                # Check periodic screenshot capture
                if time.time() - last_ss_time >= ss_interval:
                    ss_data = self.capture_screenshot_webp()
                    if ss_data:
                        meta, blob = ss_data
                        self.queue.enqueue_screenshot(meta, blob)
                    last_ss_time = time.time()

        except KeyboardInterrupt:
            logger.info("Agent stopped by user.")
            self.running = False


if __name__ == "__main__":
    agent = WorkPulseAgent()
    agent.start()
