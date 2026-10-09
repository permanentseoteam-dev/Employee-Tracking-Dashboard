use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    tauri_build::build();

    // Best-effort: copy WebView2Loader.dll next to the built binary when present.
    let target = env::var("TARGET").unwrap_or_default();
    let arch = if target.contains("x86_64") {
        "x64"
    } else if target.contains("aarch64") {
        "arm64"
    } else {
        "x86"
    };

    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".into());
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap_or_default());
    let target_dir = env::var("CARGO_TARGET_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| manifest_dir.join("target"))
        .join(&profile);

    if let Ok(entries) = fs::read_dir(target_dir.join("build")) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy();
            if path.is_dir() && name.starts_with("webview2-com-sys-") {
                let dll_src = path.join("out").join(arch).join("WebView2Loader.dll");
                if dll_src.exists() {
                    let _ = fs::create_dir_all(target_dir.join("deps"));
                    let _ = fs::copy(&dll_src, target_dir.join("WebView2Loader.dll"));
                    let _ = fs::copy(&dll_src, target_dir.join("deps").join("WebView2Loader.dll"));
                    break;
                }
            }
        }
    }
}
