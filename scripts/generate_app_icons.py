from pathlib import Path

from PIL import Image

SRC = Path(
    r"C:\Users\ok\.cursor\projects\f-Tracking-Dashboard\assets\employee-tracking-icon-master.jpg"
)

img = Image.open(SRC).convert("RGBA")
w, h = img.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
img = img.crop((left, top, left + side, top + side))

tauri = Path(r"F:\Tracking Dashboard\src-tauri\icons")
public = Path(r"F:\Tracking Dashboard\public")
assets = Path(r"F:\Tracking Dashboard\src\assets")
for d in (tauri, public, assets):
    d.mkdir(parents=True, exist_ok=True)


def save_png(path: Path, size: int) -> None:
    img.resize((size, size), Image.Resampling.LANCZOS).save(path, "PNG")


save_png(assets / "app-icon.png", 1024)
save_png(assets / "brand-mark.png", 256)
save_png(public / "app-icon-192.png", 192)
save_png(public / "app-icon-512.png", 512)
save_png(public / "favicon.png", 32)
save_png(tauri / "32x32.png", 32)
save_png(tauri / "128x128.png", 128)
save_png(tauri / "128x128@2x.png", 256)
save_png(tauri / "icon.png", 512)

ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_images = [img.resize(s, Image.Resampling.LANCZOS) for s in ico_sizes]
ico_images[0].save(tauri / "icon.ico", format="ICO", sizes=ico_sizes, append_images=ico_images[1:])

fav_sizes = [(16, 16), (32, 32), (48, 48)]
fav_images = [img.resize(s, Image.Resampling.LANCZOS) for s in fav_sizes]
fav_images[0].save(public / "favicon.ico", format="ICO", sizes=fav_sizes, append_images=fav_images[1:])

print("OK")
for p in sorted(list(tauri.glob("*")) + list(public.glob("*")) + [assets / "app-icon.png", assets / "brand-mark.png"]):
    print(f"{p.stat().st_size:8d}  {p}")
