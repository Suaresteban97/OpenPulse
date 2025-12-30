#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use sysinfo::System;
use tauri::{AppHandle, State};
use tauri_plugin_shell::{ShellExt, process::CommandChild};
use tauri_plugin_dialog::DialogExt;
use tauri::Emitter;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::fs;
use std::path::PathBuf;

struct ConversionState {
    current_process: Arc<Mutex<Option<CommandChild>>>,
}

#[tauri::command]
async fn select_file(app: tauri::AppHandle, file_type: String) -> Result<Vec<String>, String> {

    let mut dialog_builder = app.dialog().file();

    if file_type == "video" {
        dialog_builder = dialog_builder.add_filter("Videos", &["mp4", "mov", "avi", "mkv", "webm"]);
    } else if file_type == "audio" {
        dialog_builder = dialog_builder.add_filter("Multimedia", &["mp3", "wav", "m4a", "ogg", "mp4", "mov", "avi"]);
    }

    let file_paths = dialog_builder.blocking_pick_files();

    match file_paths {
        Some(paths) => {
            let string_paths: Vec<String> = paths.into_iter().map(|p| p.to_string()).collect();
            Ok(string_paths)
        },
        None => Err("Cancelado".to_string()),
    }
}

#[tauri::command]
async fn get_media_duration(app: AppHandle, path: String) -> Result<String, String> {
    let args = vec!["-i", &path];
    let command = app.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?.args(&args);
    
    let output = command.output().await.map_err(|e| e.to_string())?;
    let stderr = String::from_utf8_lossy(&output.stderr);

    if let Some(pos) = stderr.find("Duration: ") {
        if pos + 18 <= stderr.len() {
            let duration_str = &stderr[pos + 10..pos + 18];
            return Ok(duration_str.to_string());
        }
    }
    
    Ok("00:00:00".to_string())
}

fn calculate_smart_threads() -> String {
    let mut sys = System::new_all();
    sys.refresh_all(); 

    let free_ram_gb = sys.available_memory() / 1024 / 1024 / 1024; 
    let global_cpu_usage = sys.global_cpu_info().cpu_usage(); 
    let logical_cores = sys.cpus().len();

    println!("Diagnóstico: RAM Libre: {}GB | CPU Uso: {}% | Cores: {}", free_ram_gb, global_cpu_usage, logical_cores);

    if free_ram_gb < 2 || global_cpu_usage > 60.0 {
        println!("Sistema ocupado. Modo Sigiloso (1 hilo).");
        return "1".to_string();
    }
    
    let threads_to_use = if logical_cores > 1 {
        logical_cores / 2
    } else {
        1
    };

    println!("Modo Equilibrado activo ({} hilos de {}).", threads_to_use, logical_cores);
    threads_to_use.to_string()
}

fn generate_unique_path(base_path: PathBuf) -> PathBuf {
    if !base_path.exists() {
        return base_path;
    }

    let stem = base_path.file_stem().unwrap().to_str().unwrap();
    let extension = base_path.extension().unwrap().to_str().unwrap();
    let parent = base_path.parent().unwrap();

    let mut counter = 1;
    loop {
        let new_name = format!("{}_{}.{}", stem, counter, extension);
        let new_path = parent.join(new_name);
        if !new_path.exists() {
            return new_path;
        }
        counter += 1;
    }
}

#[tauri::command]
async fn cancel_conversion(state: State<'_, ConversionState>) -> Result<String, String> {
    let mut process_guard = state.current_process.lock().map_err(|_| "Error de bloqueo")?;
    
    if let Some(child) = process_guard.take() {
        child.kill().map_err(|e| e.to_string())?;
        Ok("Proceso cancelado correctamente".to_string())
    } else {
        Ok("No había nada ejecutándose".to_string())
    }
}

#[tauri::command]
async fn convert_file(
    app: AppHandle, 
    state: State<'_, ConversionState>, 
    input_path: String, 
    format: String,
    start_time: Option<String>,
    end_time: Option<String>
)-> Result<String, String> {
    
    let smart_threads = calculate_smart_threads();
    let path_obj = Path::new(&input_path);
    let file_stem = path_obj.file_stem().unwrap().to_str().unwrap();
    let parent_dir = path_obj.parent().unwrap();

    let (suffix, extra_args) = match format.as_str() {
        "insta" => ("_reel.mp4", vec!["-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2", "-c:v", "libx264"]),
        "whatsapp" => ("_wa.mp4", vec!["-vf", "scale=480:-2", "-c:v", "libx264"]),
        "gif" => (".gif", vec!["-vf", "fps=10,scale=320:-1:flags=lanczos"]),
        "audio" => (".mp3", vec!["-vn", "-acodec", "libmp3lame"]),
        "mp3-high" => (".mp3", vec!["-vn", "-c:a", "libmp3lame", "-q:a", "2"]),
        "mp3-low" => (".mp3", vec!["-vn", "-c:a", "libmp3lame", "-b:a", "96k"]),
        "wav" => (".wav", vec!["-vn", "-c:a", "pcm_s16le"]),
        "m4a" => (".m4a", vec!["-vn", "-c:a", "aac", "-b:a", "192k"]),
        _ => ("_convertido.mp4", vec!["-c:v", "libx264"])
    };

    let tentative_path = parent_dir.join(format!("{}{}", file_stem, suffix));
    let output_path = generate_unique_path(tentative_path);
    let output_str = output_path.to_str().unwrap().to_string();

    let mut args = vec![
        "-i", &input_path,
        "-threads", &smart_threads,
    ];

    if let Some(ref s) = start_time {
        if !s.is_empty() {
            args.push("-ss");
            args.push(s);
        }
    }

    if let Some(ref e) = end_time {
        if !e.is_empty() {
            args.push("-to");
            args.push(e);
        }
    }

    args.push("-threads");
    args.push(&smart_threads);

    args.extend_from_slice(&extra_args);
    args.push(&output_str);

    let command = app.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?.args(&args);
    let (mut rx, child) = command.spawn().map_err(|e| e.to_string())?;

    {
        let mut process_guard = state.current_process.lock().unwrap();
        *process_guard = Some(child);
    }

    while let Some(event) = rx.recv().await {
        match event {
            tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                let out = String::from_utf8_lossy(&line);
                
                if out.contains("Duration: ") {
                    if let Some(pos) = out.find("Duration: ") {
                        let duration_str = &out[pos + 10..pos + 21];
                        let _ = app.emit("video-total-duration", duration_str);
                    }
                }

                if out.contains("time=") {
                    if let Some(pos) = out.find("time=") {
                        let time_str = &out[pos + 5..pos + 13];
                        let _ = app.emit("ffmpeg-progress", time_str);
                    }
                }
            },
            tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                let mut process_guard = state.current_process.lock().unwrap();
                *process_guard = None;

                if payload.code == Some(0) {
                    return Ok(format!("Éxito: {}", output_str));
                } else {
                    let _ = fs::remove_file(&output_str); 
                    return Err("Proceso detenido".to_string());
                }
            },
            _ => {}
        }
    }
    
    Ok("Finalizado".to_string())
}

fn main() {
    tauri::Builder::default()
        .manage(ConversionState {
            current_process: Arc::new(Mutex::new(None)),
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![select_file, convert_file, cancel_conversion, get_media_duration])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}