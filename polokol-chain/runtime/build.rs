fn main() {
    substrate_wasm_builder::WasmBuilder::new()
        .with_current_project()
        .import_memory()
        .build();
}
