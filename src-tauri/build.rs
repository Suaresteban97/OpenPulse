fn main() {
    // En Linux, el sidecar de ffmpeg debe tener permisos de ejecución.
    // Tauri copia el binario sin preservarlos, así que lo forzamos aquí.
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::PermissionsExt;
        let sidecar = std::path::Path::new("binaries/ffmpeg-x86_64-unknown-linux-gnu");
        if sidecar.exists() {
            let mut perms = std::fs::metadata(sidecar).unwrap().permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(sidecar, perms).unwrap();
        }
    }
    tauri_build::build()
}
