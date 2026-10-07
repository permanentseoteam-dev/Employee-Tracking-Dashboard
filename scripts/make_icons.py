import struct
import zlib
import os

def make_png(width, height, r, g, b):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00' + bytes([r, g, b] * width)
    idat = chunk(b'IDAT', zlib.compress(raw_data))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

os.makedirs('src-tauri/icons', exist_ok=True)
png_32 = make_png(32, 32, 59, 130, 246)
png_128 = make_png(128, 128, 59, 130, 246)
png_64 = make_png(64, 64, 59, 130, 246)

with open('src-tauri/icons/32x32.png', 'wb') as f:
    f.write(png_32)
with open('src-tauri/icons/128x128.png', 'wb') as f:
    f.write(png_128)
with open('src-tauri/icons/icon.png', 'wb') as f:
    f.write(png_64)

ico_header = struct.pack('<HHH', 0, 1, 1)
ico_entry = struct.pack('<BBBBHHII', 32, 32, 0, 0, 1, 32, len(png_32), 6 + 16)
with open('src-tauri/icons/icon.ico', 'wb') as f:
    f.write(ico_header + ico_entry + png_32)

print('Icons created successfully')
