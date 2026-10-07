$env:RUSTFLAGS = ""
cargo.cmd clean
cargo.cmd test --verbose
