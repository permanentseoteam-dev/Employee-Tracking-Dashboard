import io
import os
import shutil
import struct
from pathlib import Path
from PIL import Image, ImageDraw

# Master source path uploaded by user
SOURCE_IMG = Path(r"C:\Users\ok\.gemini\antigravity-ide\brain\854b733d-1710-4b82-80db-563c9d03ec6e\.user_uploaded\media_1791618228728.jpg")
WORKSPACE = Path(r"F:\TrackingDashboard")

tauri_dir = WORKSPACE / "src-tauri" / "icons"
public_dir = WORKSPACE / "public"
assets_dir = WORKSPACE / "src" / "assets"

for d in [tauri_dir, public_dir, assets_dir]:
    d.mkdir(parents=True, exist_ok=True)

# Save master original to assets
shutil.copy2(SOURCE_IMG, assets_dir / "logo-master.jpg")

# Open and ensure RGBA
raw_img = Image.open(SOURCE_IMG).convert("RGBA")
w, h = raw_img.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
base_square = raw_img.crop((left, top, left + side, top + side))

# Function to create rounded corner version with smooth anti-aliased alpha
def create_rounded(im: Image.Image, radius_ratio: float = 0.18) -> Image.Image:
    w, h = im.size
    # 4x super-sampled mask for smooth anti-aliased edge
    scale = 4
    mask = Image.new("L", (w * scale, h * scale), 0)
    draw = ImageDraw.Draw(mask)
    r = int(w * scale * radius_ratio)
    draw.rounded_rectangle([0, 0, w * scale - 1, h * scale - 1], radius=r, fill=255)
    mask = mask.resize((w, h), Image.Resampling.LANCZOS)
    
    out = im.copy()
    out.putalpha(mask)
    return out

def build_windows_ico(images_dict: dict[int, Image.Image]) -> bytes:
    """
    Build a standard Windows multi-resolution ICO file with embedded PNG streams.
    Supported natively by Windows Vista, 7, 8, 10, and 11.
    """
    sorted_sizes = sorted(images_dict.keys())
    png_blobs = []
    
    for size in sorted_sizes:
        im = images_dict[size]
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        png_data = buf.getvalue()
        png_blobs.append((size, png_data))
        
    num_images = len(png_blobs)
    header = struct.pack("<HHH", 0, 1, num_images)
    offset = 6 + (16 * num_images)
    
    directory = bytearray()
    image_payloads = bytearray()
    
    for size, data in png_blobs:
        w_byte = 0 if size >= 256 else size
        h_byte = 0 if size >= 256 else size
        data_len = len(data)
        entry = struct.pack(
            "<BBBBHHII",
            w_byte,
            h_byte,
            0,
            0,
            1,
            32,
            data_len,
            offset
        )
        directory.extend(entry)
        image_payloads.extend(data)
        offset += data_len
        
    return bytes(header + directory + image_payloads)

def save_png(im: Image.Image, path: Path, size: int) -> None:
    resized = im.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(path, "PNG")

# Generate base representations
rounded_512 = create_rounded(base_square.resize((512, 512), Image.Resampling.LANCZOS), radius_ratio=0.18)

# 1. Assets folder
save_png(base_square, assets_dir / "app-icon-square.png", 512)
save_png(rounded_512, assets_dir / "app-icon.png", 512)
save_png(rounded_512, assets_dir / "brand-mark.png", 256)
save_png(rounded_512, assets_dir / "app-logo.png", 512)

# 2. Public web & PWA assets
save_png(rounded_512, public_dir / "app-icon-192.png", 192)
save_png(rounded_512, public_dir / "app-icon-512.png", 512)
save_png(rounded_512, public_dir / "favicon.png", 32)
save_png(rounded_512, public_dir / "favicon-48.png", 48)
save_png(rounded_512, public_dir / "logo.png", 512)

# 3. Tauri Desktop icons
save_png(rounded_512, tauri_dir / "32x32.png", 32)
save_png(rounded_512, tauri_dir / "128x128.png", 128)
save_png(rounded_512, tauri_dir / "128x128@2x.png", 256)
save_png(rounded_512, tauri_dir / "icon.png", 512)

# 4. Multi-resolution ICO for web browsers (public/favicon.ico)
fav_sizes = [16, 24, 32, 48, 64]
fav_imgs = {s: create_rounded(base_square.resize((s, s), Image.Resampling.LANCZOS), radius_ratio=0.18) for s in fav_sizes}
fav_ico_bytes = build_windows_ico(fav_imgs)
(public_dir / "favicon.ico").write_bytes(fav_ico_bytes)

# 5. Full Windows shell ICO for Desktop shortcuts & Taskbar (src-tauri/icons/icon.ico)
shell_sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
shell_imgs = {s: create_rounded(base_square.resize((s, s), Image.Resampling.LANCZOS), radius_ratio=0.18) for s in shell_sizes}
shell_ico_bytes = build_windows_ico(shell_imgs)
(tauri_dir / "icon.ico").write_bytes(shell_ico_bytes)

print("Icon generation completed.")
print(f" favicon.ico size: {len(fav_ico_bytes)} bytes ({len(fav_sizes)} layers)")
print(f" icon.ico size:    {len(shell_ico_bytes)} bytes ({len(shell_sizes)} layers)")
