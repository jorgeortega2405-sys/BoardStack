use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use rand::RngExt;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::{broadcast, Mutex};
use tower_http::cors::{Any, CorsLayer};
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize)]
struct Participant {
    peer_id: String,
    username: String,
    avatar_url: Option<String>,
    is_owner: bool,
    can_upload: bool,
    joined_at: u64,
}

#[allow(dead_code)]
struct Room {
    id: String,
    code: String,
    slug: Option<String>,
    password: Option<String>,
    owner_token: Option<String>,
    is_persistent: bool,
    expires_at: Option<u64>,
    max_downloads: Option<u32>,
    save_to_cloud: bool,
    upload_permission: String,
    owner_peer_id: Option<String>,
    owner_username: String,
    owner_avatar_url: Option<String>,
    created_at: u64,
    participants: HashMap<String, Participant>,
    tx: broadcast::Sender<String>,
}

#[derive(Default)]
struct AppState {
    rooms: HashMap<String, Room>,
    code_to_id: HashMap<String, String>,
    slug_to_id: HashMap<String, String>,
}

type SharedState = Arc<Mutex<AppState>>;

#[derive(Deserialize)]
struct CreateRoomRequest {
    room_id: Option<String>,
    code: Option<String>,
    owner_username: Option<String>,
    avatar_url: Option<String>,
    custom_slug: Option<String>,
    password: Option<String>,
    owner_token: Option<String>,
    is_persistent: Option<bool>,
    expires_in_hours: Option<u64>,
    expires_at: Option<u64>,
    max_downloads: Option<u32>,
    save_to_cloud: Option<bool>,
    upload_permission: Option<String>,
}

#[derive(Serialize)]
struct CreateRoomResponse {
    ok: bool,
    room_id: String,
    code: String,
    slug: Option<String>,
    is_persistent: bool,
    has_password: bool,
    expires_at: Option<u64>,
    max_downloads: Option<u32>,
    save_to_cloud: bool,
    upload_permission: String,
}

#[derive(Serialize)]
struct ResolveRoomResponse {
    ok: bool,
    room_id: String,
    code: String,
    slug: Option<String>,
    is_persistent: bool,
    requires_password: bool,
    owner_username: String,
    participant_count: usize,
    expires_at: Option<u64>,
    max_downloads: Option<u32>,
    save_to_cloud: bool,
    upload_permission: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    ok: bool,
    error: String,
}

#[derive(Deserialize)]
struct WsQuery {
    peer_id: Option<String>,
    username: Option<String>,
    avatar_url: Option<String>,
    #[allow(dead_code)]
    is_owner: Option<bool>,
    owner_token: Option<String>,
    password: Option<String>,
}

#[derive(Serialize)]
struct WsRoomStatePayload {
    r#type: String,
    room_id: String,
    code: String,
    slug: Option<String>,
    is_persistent: bool,
    requires_password: bool,
    owner_username: String,
    participants: Vec<Participant>,
    expires_at: Option<u64>,
    max_downloads: Option<u32>,
    save_to_cloud: bool,
    upload_permission: String,
}

#[derive(Serialize)]
struct WsRoomClosedPayload {
    r#type: String,
    reason: String,
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn generate_room_code() -> String {
    let mut rng = rand::rng();
    let letters: String = (0..3)
        .map(|_| rng.random_range(b'A'..=b'Z') as char)
        .collect();
    let digits: u32 = rng.random_range(100..=999);
    format!("{}-{}", letters, digits)
}

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))
}

async fn create_room(
    State(state): State<SharedState>,
    Json(payload): Json<CreateRoomRequest>,
) -> impl IntoResponse {
    let mut lock = state.lock().await;

    let custom_slug = if let Some(raw_slug) = payload.custom_slug {
        let clean = raw_slug.trim().to_lowercase();
        if clean.is_empty() {
            None
        } else {
            if clean.len() < 3 || clean.len() > 40 {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!(ErrorResponse {
                        ok: false,
                        error: "Custom slug must be between 3 and 40 characters".to_string(),
                    })),
                );
            }
            let is_valid = clean.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
            if !is_valid {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!(ErrorResponse {
                        ok: false,
                        error: "Custom slug can only contain alphanumeric characters and hyphens".to_string(),
                    })),
                );
            }
            if lock.slug_to_id.contains_key(&clean) || lock.code_to_id.contains_key(&clean.to_uppercase()) {
                return (
                    StatusCode::CONFLICT,
                    Json(serde_json::json!(ErrorResponse {
                        ok: false,
                        error: "Custom slug is already in use".to_string(),
                    })),
                );
            }
            Some(clean)
        }
    } else {
        None
    };

    let password = payload.password.and_then(|p| {
        let trimmed = p.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    let has_password = password.is_some();
    let save_to_cloud = payload.save_to_cloud.unwrap_or(false);
    let is_persistent = if save_to_cloud {
        true
    } else {
        payload.is_persistent.unwrap_or(false)
    };

    let upload_permission = payload.upload_permission
        .filter(|p| p == "owner_only" || p == "specific")
        .unwrap_or_else(|| "all".to_string());

    let expires_at = if let Some(ts) = payload.expires_at {
        if ts > current_timestamp() {
            Some(ts)
        } else {
            None
        }
    } else if let Some(hours) = payload.expires_in_hours {
        if hours > 0 {
            Some(current_timestamp() + hours * 3600)
        } else {
            None
        }
    } else {
        None
    };

    let max_downloads = payload.max_downloads.filter(|&m| m > 0);

    let room_id = payload
        .room_id
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    if let Some(existing_room) = lock.rooms.get(&room_id) {
        return (
            StatusCode::OK,
            Json(serde_json::json!(CreateRoomResponse {
                ok: true,
                room_id: existing_room.id.clone(),
                code: existing_room.code.clone(),
                slug: existing_room.slug.clone(),
                is_persistent: existing_room.is_persistent,
                has_password: existing_room.password.is_some(),
                expires_at: existing_room.expires_at,
                max_downloads: existing_room.max_downloads,
                save_to_cloud: existing_room.save_to_cloud,
                upload_permission: existing_room.upload_permission.clone(),
            })),
        );
    }

    let code = if let Some(existing_code) = payload.code.filter(|s| !s.trim().is_empty()) {
        existing_code
    } else {
        let mut c = generate_room_code();
        while lock.code_to_id.contains_key(&c) {
            c = generate_room_code();
        }
        c
    };

    let (tx, _rx) = broadcast::channel(2048);
    let owner_username = payload
        .owner_username
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Host".to_string());

    let room = Room {
        id: room_id.clone(),
        code: code.clone(),
        slug: custom_slug.clone(),
        password,
        owner_token: payload.owner_token.and_then(|t| {
            let trimmed = t.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        }),
        is_persistent,
        expires_at,
        max_downloads,
        save_to_cloud,
        upload_permission: upload_permission.clone(),
        owner_peer_id: None,
        owner_username,
        owner_avatar_url: payload.avatar_url,
        created_at: current_timestamp(),
        participants: HashMap::new(),
        tx,
    };

    lock.code_to_id.insert(code.clone(), room_id.clone());
    if let Some(ref slug) = custom_slug {
        lock.slug_to_id.insert(slug.clone(), room_id.clone());
    }
    lock.rooms.insert(room_id.clone(), room);

    (
        StatusCode::CREATED,
        Json(serde_json::json!(CreateRoomResponse {
            ok: true,
            room_id,
            code,
            slug: custom_slug,
            is_persistent,
            has_password,
            expires_at,
            max_downloads,
            save_to_cloud,
            upload_permission,
        })),
    )
}

async fn resolve_room(
    State(state): State<SharedState>,
    Path(query_key): Path<String>,
) -> Result<Json<ResolveRoomResponse>, (StatusCode, Json<ErrorResponse>)> {
    let clean_upper = query_key.trim().to_uppercase();
    let clean_lower = query_key.trim().to_lowercase();
    let lock = state.lock().await;

    let room_id = lock
        .code_to_id
        .get(&clean_upper)
        .or_else(|| lock.slug_to_id.get(&clean_lower))
        .or_else(|| lock.rooms.get(&query_key).map(|r| &r.id))
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    ok: false,
                    error: "Room not found or code expired".to_string(),
                }),
            )
        })?;

    let room = lock.rooms.get(room_id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                ok: false,
                error: "Room no longer active".to_string(),
            }),
        )
    })?;

    if let Some(exp) = room.expires_at {
        if current_timestamp() > exp {
            return Err((
                StatusCode::GONE,
                Json(ErrorResponse {
                    ok: false,
                    error: "Room has expired".to_string(),
                }),
            ));
        }
    }

    Ok(Json(ResolveRoomResponse {
        ok: true,
        room_id: room.id.clone(),
        code: room.code.clone(),
        slug: room.slug.clone(),
        is_persistent: room.is_persistent,
        requires_password: room.password.is_some(),
        owner_username: room.owner_username.clone(),
        participant_count: room.participants.len(),
        expires_at: room.expires_at,
        max_downloads: room.max_downloads,
        save_to_cloud: room.save_to_cloud,
        upload_permission: room.upload_permission.clone(),
    }))
}

async fn broadcast_to_room(
    State(state): State<SharedState>,
    Path(room_id): Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    let mut lock = state.lock().await;
    let actual_id = lock
        .slug_to_id
        .get(&room_id.to_lowercase())
        .or_else(|| lock.code_to_id.get(&room_id.to_uppercase()))
        .cloned()
        .unwrap_or(room_id);

    let is_close_room = payload.get("type").and_then(|t| t.as_str()) == Some("room_closed");

    if is_close_room {
        if let Some(room) = lock.rooms.remove(&actual_id) {
            lock.code_to_id.remove(&room.code);
            if let Some(ref slug) = room.slug {
                lock.slug_to_id.remove(slug);
            }
            let msg = serde_json::to_string(&payload).unwrap_or_default();
            let _ = room.tx.send(msg);
            return (StatusCode::OK, Json(serde_json::json!({ "ok": true })));
        }
    } else if let Some(room) = lock.rooms.get(&actual_id) {
        let msg = serde_json::to_string(&payload).unwrap_or_default();
        let _ = room.tx.send(msg);
        return (StatusCode::OK, Json(serde_json::json!({ "ok": true })));
    }

    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "ok": false, "error": "Room not active" })),
    )
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(room_id): Path<String>,
    Query(query): Query<WsQuery>,
    State(state): State<SharedState>,
) -> impl IntoResponse {
    ws.max_message_size(1024 * 1024)
        .on_upgrade(move |socket| handle_socket(socket, room_id, query, state))
}

async fn handle_socket(
    socket: WebSocket,
    room_id_or_slug: String,
    query: WsQuery,
    state: SharedState,
) {
    let (mut sender, mut receiver) = socket.split();

    let actual_room_id = {
        let lock = state.lock().await;
        lock.slug_to_id
            .get(&room_id_or_slug.to_lowercase())
            .or_else(|| lock.code_to_id.get(&room_id_or_slug.to_uppercase()))
            .cloned()
            .unwrap_or_else(|| room_id_or_slug.clone())
    };

    let is_expired = {
        let lock = state.lock().await;
        lock.rooms.get(&actual_room_id).map(|r| {
            if let Some(exp) = r.expires_at {
                current_timestamp() > exp
            } else {
                false
            }
        }).unwrap_or(false)
    };

    if is_expired {
        let err_msg = serde_json::to_string(&WsRoomClosedPayload {
            r#type: "room_closed".to_string(),
            reason: "Room has expired".to_string(),
        })
        .unwrap_or_default();
        let _ = sender.send(Message::Text(err_msg.into())).await;
        return;
    }

    let peer_id = query
        .peer_id
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let is_owner = {
        let lock = state.lock().await;
        if let Some(r) = lock.rooms.get(&actual_room_id) {
            match (&query.owner_token, &r.owner_token) {
                (Some(provided), Some(expected)) => {
                    let p = provided.trim();
                    !p.is_empty() && p == expected
                }
                _ => false,
            }
        } else {
            false
        }
    };
    let username = query
        .username
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            if is_owner {
                "Host".to_string()
            } else {
                let suffix: u16 = rand::rng().random_range(100..=999);
                format!("Guest #{}", suffix)
            }
        });

    let (rx_opt, room_tx_opt, auth_error) = {
        let mut lock = state.lock().await;
        if let Some(room) = lock.rooms.get_mut(&actual_room_id) {
            let can_upload = if is_owner {
                true
            } else {
                match room.upload_permission.as_str() {
                    "owner_only" => false,
                    "specific" => false,
                    _ => true,
                }
            };

            let participant = Participant {
                peer_id: peer_id.clone(),
                username: username.clone(),
                avatar_url: query.avatar_url,
                is_owner,
                can_upload,
                joined_at: current_timestamp(),
            };

            if let Some(ref expected_pw) = room.password {
                let provided = query.password.as_deref().unwrap_or("");
                if provided != expected_pw {
                    let reason = if provided.is_empty() {
                        "Password required"
                    } else {
                        "Invalid password"
                    };
                    (None, None, Some(reason))
                } else {
                    if is_owner {
                        room.owner_peer_id = Some(peer_id.clone());
                    }

                    room.participants.insert(peer_id.clone(), participant);
                    let rx = room.tx.subscribe();
                    let room_tx = room.tx.clone();

                    let state_msg = serde_json::to_string(&WsRoomStatePayload {
                        r#type: "room_state".to_string(),
                        room_id: room.id.clone(),
                        code: room.code.clone(),
                        slug: room.slug.clone(),
                        is_persistent: room.is_persistent,
                        requires_password: true,
                        owner_username: room.owner_username.clone(),
                        participants: room.participants.values().cloned().collect(),
                        expires_at: room.expires_at,
                        max_downloads: room.max_downloads,
                        save_to_cloud: room.save_to_cloud,
                        upload_permission: room.upload_permission.clone(),
                    })
                    .unwrap_or_default();

                    let _ = room.tx.send(state_msg);
                    (Some(rx), Some(room_tx), None)
                }
            } else {
                if is_owner {
                    room.owner_peer_id = Some(peer_id.clone());
                }

                room.participants.insert(peer_id.clone(), participant);
                let rx = room.tx.subscribe();
                let room_tx = room.tx.clone();

                let state_msg = serde_json::to_string(&WsRoomStatePayload {
                    r#type: "room_state".to_string(),
                    room_id: room.id.clone(),
                    code: room.code.clone(),
                    slug: room.slug.clone(),
                    is_persistent: room.is_persistent,
                    requires_password: false,
                    owner_username: room.owner_username.clone(),
                    participants: room.participants.values().cloned().collect(),
                    expires_at: room.expires_at,
                    max_downloads: room.max_downloads,
                    save_to_cloud: room.save_to_cloud,
                    upload_permission: room.upload_permission.clone(),
                })
                .unwrap_or_default();

                let _ = room.tx.send(state_msg);
                (Some(rx), Some(room_tx), None)
            }
        } else {
            (None, None, None)
        }
    };

    if let Some(reason) = auth_error {
        let msg_type = if reason == "Password required" { "password_required" } else { "auth_error" };
        let err_msg = serde_json::to_string(&serde_json::json!({
            "type": msg_type,
            "reason": reason
        }))
        .unwrap_or_default();
        let _ = sender.send(Message::Text(err_msg.into())).await;
        return;
    }

    let mut rx = match rx_opt {
        Some(rx) => rx,
        None => {
            let err_msg = serde_json::to_string(&WsRoomClosedPayload {
                r#type: "room_closed".to_string(),
                reason: "Room does not exist or has ended".to_string(),
            })
            .unwrap_or_default();
            let _ = sender.send(Message::Text(err_msg.into())).await;
            return;
        }
    };

    let room_tx = match room_tx_opt {
        Some(tx) => tx,
        None => return,
    };

    let mut send_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(msg) => {
                    if sender.send(Message::Text(msg.into())).await.is_err() {
                        break;
                    }
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    let state_for_recv = state.clone();
    let actual_room_id_for_recv = actual_room_id.clone();
    let room_tx_for_recv = room_tx.clone();

    let mut recv_task = tokio::spawn(async move {
        let mut msg_count = 0u32;
        let mut last_window = current_timestamp();
        while let Some(Ok(msg)) = receiver.next().await {
            let now = current_timestamp();
            if now != last_window {
                last_window = now;
                msg_count = 0;
            }
            msg_count += 1;
            if msg_count > 60 {
                continue;
            }
            match msg {
                Message::Text(text) => {
                    if is_owner {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                            let msg_type = val.get("type").and_then(|t| t.as_str());
                            if msg_type == Some("close_room") {
                                let mut lock = state_for_recv.lock().await;
                                if let Some(room) = lock.rooms.remove(&actual_room_id_for_recv) {
                                    lock.code_to_id.remove(&room.code);
                                    if let Some(ref slug) = room.slug {
                                        lock.slug_to_id.remove(slug);
                                    }
                                    let closed_msg = serde_json::to_string(&WsRoomClosedPayload {
                                        r#type: "room_closed".to_string(),
                                        reason: "Room permanently closed by host.".to_string(),
                                    })
                                    .unwrap_or_default();
                                    let _ = room.tx.send(closed_msg);
                                }
                                break;
                            } else if msg_type == Some("update_peer_permission") {
                                if let Some(target_id) = val.get("target_peer_id").and_then(|t| t.as_str()) {
                                    let can_upload = val.get("can_upload").and_then(|c| c.as_bool()).unwrap_or(false);
                                    let mut lock = state_for_recv.lock().await;
                                    if let Some(room) = lock.rooms.get_mut(&actual_room_id_for_recv) {
                                        if let Some(p) = room.participants.get_mut(target_id) {
                                            p.can_upload = can_upload;
                                        }
                                        let state_msg = serde_json::to_string(&WsRoomStatePayload {
                                            r#type: "room_state".to_string(),
                                            room_id: room.id.clone(),
                                            code: room.code.clone(),
                                            slug: room.slug.clone(),
                                            is_persistent: room.is_persistent,
                                            requires_password: room.password.is_some(),
                                            owner_username: room.owner_username.clone(),
                                            participants: room.participants.values().cloned().collect(),
                                            expires_at: room.expires_at,
                                            max_downloads: room.max_downloads,
                                            save_to_cloud: room.save_to_cloud,
                                            upload_permission: room.upload_permission.clone(),
                                        })
                                        .unwrap_or_default();
                                        let _ = room.tx.send(state_msg);
                                    }
                                }
                                continue;
                            } else if msg_type == Some("kick_peer") {
                                if let Some(target_id) = val.get("target_peer_id").and_then(|t| t.as_str()) {
                                    let kick_msg = serde_json::to_string(&serde_json::json!({
                                        "type": "peer_kicked",
                                        "target_peer_id": target_id
                                    }))
                                    .unwrap_or_default();
                                    let _ = room_tx_for_recv.send(kick_msg);
                                }
                                continue;
                            }
                        }
                    }
                    let _ = room_tx_for_recv.send(text.to_string());
                }
                Message::Close(_) => {
                    break;
                }
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    let mut lock = state.lock().await;
    if is_owner {
        if let Some(room) = lock.rooms.get_mut(&actual_room_id) {
            room.participants.remove(&peer_id);
            room.owner_peer_id = None;
            let state_msg = serde_json::to_string(&WsRoomStatePayload {
                r#type: "room_state".to_string(),
                room_id: room.id.clone(),
                code: room.code.clone(),
                slug: room.slug.clone(),
                is_persistent: room.is_persistent,
                requires_password: room.password.is_some(),
                owner_username: room.owner_username.clone(),
                participants: room.participants.values().cloned().collect(),
                expires_at: room.expires_at,
                max_downloads: room.max_downloads,
                save_to_cloud: room.save_to_cloud,
                upload_permission: room.upload_permission.clone(),
            })
            .unwrap_or_default();
            let _ = room.tx.send(state_msg);

            if !room.is_persistent {
                let delayed_state = state.clone();
                let delayed_room_id = actual_room_id.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(30)).await;
                    let mut lock = delayed_state.lock().await;
                    if let Some(r) = lock.rooms.get(&delayed_room_id) {
                        if !r.is_persistent && r.owner_peer_id.is_none() {
                            if let Some(removed_room) = lock.rooms.remove(&delayed_room_id) {
                                lock.code_to_id.remove(&removed_room.code);
                                if let Some(ref slug) = removed_room.slug {
                                    lock.slug_to_id.remove(slug);
                                }
                                let closed_msg = serde_json::to_string(&WsRoomClosedPayload {
                                    r#type: "room_closed".to_string(),
                                    reason: "Owner has left the room. Room terminated.".to_string(),
                                })
                                .unwrap_or_default();
                                let _ = removed_room.tx.send(closed_msg);
                            }
                        }
                    }
                });
            }
        }
    } else if let Some(room) = lock.rooms.get_mut(&actual_room_id) {
        room.participants.remove(&peer_id);
        let state_msg = serde_json::to_string(&WsRoomStatePayload {
            r#type: "room_state".to_string(),
            room_id: room.id.clone(),
            code: room.code.clone(),
            slug: room.slug.clone(),
            is_persistent: room.is_persistent,
            requires_password: room.password.is_some(),
            owner_username: room.owner_username.clone(),
            participants: room.participants.values().cloned().collect(),
            expires_at: room.expires_at,
            max_downloads: room.max_downloads,
            save_to_cloud: room.save_to_cloud,
            upload_permission: room.upload_permission.clone(),
        })
        .unwrap_or_default();
        let _ = room.tx.send(state_msg);
    }
}

#[tokio::main]
async fn main() {
    let state = SharedState::default();

    let cleanup_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            let now = current_timestamp();
            let mut lock = cleanup_state.lock().await;
            let mut expired_ids = Vec::new();
            for (id, room) in lock.rooms.iter() {
                if let Some(exp) = room.expires_at {
                    if now > exp {
                        expired_ids.push(id.clone());
                    }
                }
            }
            for id in expired_ids {
                if let Some(room) = lock.rooms.remove(&id) {
                    lock.code_to_id.remove(&room.code);
                    if let Some(ref slug) = room.slug {
                        lock.slug_to_id.remove(slug);
                    }
                    let closed_msg = serde_json::to_string(&WsRoomClosedPayload {
                        r#type: "room_closed".to_string(),
                        reason: "Room has expired".to_string(),
                    })
                    .unwrap_or_default();
                    let _ = room.tx.send(closed_msg);
                }
            }
        }
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/rooms/create", post(create_room))
        .route("/api/rooms/resolve/{query_key}", get(resolve_room))
        .route("/api/rooms/{room_id}/broadcast", post(broadcast_to_room))
        .route("/ws/room/{room_id}", get(ws_handler))
        .layer(cors)
        .with_state(state);

    let port: u16 = std::env::var("PORT")
        .or_else(|_| std::env::var("SIGNALS_PORT"))
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind TCP listener");

    println!("Room signaling server listening on http://0.0.0.0:{}", port);

    axum::serve(listener, app)
        .await
        .expect("Server failed to run");
}
