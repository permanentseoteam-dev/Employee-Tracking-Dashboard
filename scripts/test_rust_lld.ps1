$env:RUSTFLAGS = "-C linker=rust-lld"
cargo test -- --nocapture
