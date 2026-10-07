from app.main import app

paths = list(app.openapi()['paths'].keys())
print("Total paths:", len(paths))
for p in sorted(paths):
    print(" ", p)
