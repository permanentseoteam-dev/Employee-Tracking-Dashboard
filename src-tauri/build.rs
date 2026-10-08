fn main() {
    let windows = tauri_build::WindowsAttributes::new();
    let attrs = tauri_build::Attributes::new().windows_attributes(windows);
    tauri_build::try_build(attrs).expect("failed to run tauri-build");
}

