use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    // Locate and copy WebView2Loader.dll to OUT_DIR and target directory
    let target = env::var("TARGET").unwrap_or_default();
    let arch = if target.contains("x86_64") {
        "x64"
    } else if target.contains("aarch64") {
        "arm64"
    } else {
        "x86"
    };

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap_or_default());
    let target_dir = manifest_dir.join("target").join(if env::var("PROFILE").unwrap_or_default() == "release" {
        "release"
    } else {
        "debug"
    });

    // Search for WebView2Loader.dll in target build artifacts
    if let Ok(entries) = fs::read_dir(target_dir.join("build")) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && path.file_name().unwrap_or_default().to_string_lossy().starts_with("webview2-com-sys-") {
                let dll_src = path.join("out").join(arch).join("WebView2Loader.dll");
                if dll_src.exists() {
                    let _ = fs::copy(&dll_src, target_dir.join("WebView2Loader.dll"));
                    let _ = fs::copy(&dll_src, target_dir.join("deps").join("WebView2Loader.dll"));
                    break;
                }
            }
        }
    }
}

