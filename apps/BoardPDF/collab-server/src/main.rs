mod hub;
mod types;

use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use futures_util::{SinkExt, StreamExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, RwLock};
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_tungstenite::tungstenite::http::StatusCode;
use tokio_tungstenite::tungstenite::protocol::WebSocketConfig;
use tokio_tungstenite::tungstenite::Message;

use crate::hub::{CollabHub, JoinResult};
use crate::types::{
    ClientMessage, ServerMessage, DEFAULT_MAX_COLLABORATORS, MAX_MESSAGE_BYTES,
    RATE_LIMIT_CAPACITY, RATE_LIMIT_REFILL_PER_SEC,
};

struct RateLimiter {
    tokens: f64,
    max_tokens: f64,
    refill_rate_per_sec: f64,
    last_refill: std::time::Instant,
}

impl RateLimiter {
    fn new(max_tokens: f64, refill_rate_per_sec: f64) -> Self {
        Self {
            tokens: max_tokens,
            max_tokens,
            refill_rate_per_sec,
            last_refill: std::time::Instant::now(),
        }
    }

    fn try_acquire(&mut self) -> bool {
        let now = std::time::Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.last_refill = now;
        self.tokens = (self.tokens + elapsed * self.refill_rate_per_sec).min(self.max_tokens);

        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let port: u16 = env::var("COLLAB_PORT")
        .or_else(|_| env::var("PORT"))
        .unwrap_or_else(|_| "3001".to_string())
        .parse()
        .unwrap_or(3001);

    let max_collab: usize = env::var("MAX_COLLABORATORS_PER_ROOM")
        .unwrap_or_else(|_| DEFAULT_MAX_COLLABORATORS.to_string())
        .parse()
        .unwrap_or(DEFAULT_MAX_COLLABORATORS);

    let addr: SocketAddr = format!("0.0.0.0:{}", port).parse()?;
    let listener = TcpListener::bind(&addr).await?;
    println!(
        "[CollabServer] Collaborative WebSocket server listening on {} (Room limit: {} collaborators)",
        addr, max_collab
    );

    let hub = Arc::new(RwLock::new(CollabHub::new(max_collab)));

    while let Ok((stream, peer_addr)) = listener.accept().await {
        let hub_clone = Arc::clone(&hub);
        tokio::spawn(async move {
            if let Err(err) = handle_connection(stream, peer_addr, hub_clone).await {
                eprintln!("[CollabServer] Connection error with {}: {:?}", peer_addr, err);
            }
        });
    }

    Ok(())
}

fn is_origin_allowed(origin: &str, allowed_env: Option<&str>) -> bool {
    let origin_lower = origin.trim().to_lowercase();
    if origin_lower.starts_with("http://localhost")
        || origin_lower.starts_with("https://localhost")
        || origin_lower.starts_with("http://127.0.0.1")
        || origin_lower.starts_with("https://127.0.0.1")
    {
        return true;
    }

    if let Some(allowed) = allowed_env {
        for entry in allowed.split(',') {
            let entry_trimmed = entry.trim().to_lowercase();
            if !entry_trimmed.is_empty() && (origin_lower == entry_trimmed || origin_lower.ends_with(&format!(".{}", entry_trimmed))) {
                return true;
            }
        }
    } else if origin_lower == "https://boardpdf.com" || origin_lower == "https://www.boardpdf.com" {
        return true;
    }

    false
}

async fn handle_connection(
    stream: TcpStream,
    _peer_addr: SocketAddr,
    hub: Arc<RwLock<CollabHub>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut ws_config = WebSocketConfig::default();
    ws_config.max_message_size = Some(2 * 1024 * 1024);
    ws_config.max_frame_size = Some(2 * 1024 * 1024);

    let allowed_env = env::var("ALLOWED_ORIGINS").ok();
    let callback = |req: &Request, resp: Response| -> Result<Response, ErrorResponse> {
        if let Some(origin_header) = req.headers().get("Origin") {
            if let Ok(origin_str) = origin_header.to_str() {
                if !is_origin_allowed(origin_str, allowed_env.as_deref()) {
                    let err_resp = Response::builder()
                        .status(StatusCode::FORBIDDEN)
                        .body(Some("Forbidden Origin".to_string()))
                        .unwrap();
                    return Err(err_resp);
                }
            }
        }
        Ok(resp)
    };

    let ws_stream = tokio_tungstenite::accept_hdr_async_with_config(stream, callback, Some(ws_config)).await?;
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    let (tx, mut rx) = mpsc::channel::<Message>(512);

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    let (hub_tx, mut hub_rx) = mpsc::channel::<String>(512);
    let tx_forward = tx.clone();
    let forward_task = tokio::spawn(async move {
        while let Some(json_str) = hub_rx.recv().await {
            if tx_forward.send(Message::Text(json_str.into())).await.is_err() {
                break;
            }
        }
    });

    let mut current_doc_id: Option<String> = None;
    let mut current_client_id: Option<String> = None;
    let mut heartbeat_interval = tokio::time::interval(std::time::Duration::from_secs(20));
    let mut last_activity = std::time::Instant::now();
    let mut rate_limiter = RateLimiter::new(RATE_LIMIT_CAPACITY, RATE_LIMIT_REFILL_PER_SEC);

    loop {
        tokio::select! {
            _ = heartbeat_interval.tick() => {
                if last_activity.elapsed() > std::time::Duration::from_secs(45) {
                    break;
                }
                let _ = tx.try_send(Message::Ping(vec![].into()));
            }
            msg_opt = ws_receiver.next() => {
                let msg = match msg_opt {
                    Some(Ok(m)) => m,
                    _ => break,
                };
                last_activity = std::time::Instant::now();

                match msg {
                    Message::Ping(payload) => {
                        let _ = tx.try_send(Message::Pong(payload));
                    }
                    Message::Pong(_) => {
                    }
                    Message::Close(_) => {
                        break;
                    }
                    Message::Text(text) => {
                        if text.len() > MAX_MESSAGE_BYTES {
                            let err_msg = ServerMessage::Error {
                                message: "Message payload exceeds allowed limit (1 MB).".to_string(),
                                code: Some("PAYLOAD_TOO_LARGE".to_string()),
                            };
                            if let Ok(json_str) = serde_json::to_string(&err_msg) {
                                let _ = tx.try_send(Message::Text(json_str.into()));
                            }
                            continue;
                        }

                        let client_msg: ClientMessage = match serde_json::from_str(text.as_str()) {
                            Ok(m) => m,
                            Err(err) => {
                                eprintln!("[CollabServer] Error deserializing JSON: {:?}", err);
                                let err_msg = ServerMessage::Error {
                                    message: "Invalid message format.".to_string(),
                                    code: Some("INVALID_JSON".to_string()),
                                };
                                if let Ok(json_str) = serde_json::to_string(&err_msg) {
                                    let _ = tx.try_send(Message::Text(json_str.into()));
                                }
                                continue;
                            }
                        };

                        let is_cursor = matches!(client_msg, ClientMessage::Cursor { .. });
                        if !rate_limiter.try_acquire() {
                            if is_cursor {
                                continue;
                            } else {
                                let rate_msg = ServerMessage::RateLimited {
                                    message: "Rate limit exceeded. Please slow down.".to_string(),
                                };
                                if let Ok(json_str) = serde_json::to_string(&rate_msg) {
                                    let _ = tx.try_send(Message::Text(json_str.into()));
                                }
                                continue;
                            }
                        }

                        match client_msg {
                            ClientMessage::Join {
                                doc_id,
                                user_id,
                                username,
                                avatar_url,
                                is_guest,
                            } => {
                                let mut hub_write = hub.write().await;
                                if let (Some(prev_doc), Some(prev_client)) =
                                    (&current_doc_id, &current_client_id)
                                {
                                    hub_write.leave_room(prev_doc, prev_client);
                                }

                                let is_guest_val = is_guest.unwrap_or(user_id.is_none());
                                let join_result = hub_write.join_room(
                                    &doc_id,
                                    user_id,
                                    username,
                                    avatar_url,
                                    is_guest_val,
                                    hub_tx.clone(),
                                );

                                match join_result {
                                    JoinResult::Success {
                                        peer: self_peer,
                                        existing_peers,
                                        ai_lock,
                                    } => {
                                        current_doc_id = Some(doc_id);
                                        current_client_id = Some(self_peer.client_id.clone());

                                        let joined_msg = ServerMessage::Joined {
                                            client_id: self_peer.client_id,
                                            color: self_peer.color,
                                            peers: existing_peers,
                                        };
                                        if let Ok(json_str) = serde_json::to_string(&joined_msg) {
                                            let _ = tx.try_send(Message::Text(json_str.into()));
                                        }

                                        if let Some(active_lock) = ai_lock {
                                            let lock_msg = ServerMessage::AiLock {
                                                locked: true,
                                                locked_by: Some(active_lock.locked_by),
                                                locked_by_client_id: Some(active_lock.locked_by_client_id),
                                            };
                                            if let Ok(lock_json) = serde_json::to_string(&lock_msg) {
                                                let _ = tx.try_send(Message::Text(lock_json.into()));
                                            }
                                        }
                                    }
                                    JoinResult::RoomFull { max_collaborators } => {
                                        let full_msg = ServerMessage::RoomFull {
                                            message: format!(
                                                "This collaborative room has reached the maximum limit of {} concurrent collaborators.",
                                                max_collaborators
                                            ),
                                            max_collaborators,
                                        };
                                        if let Ok(json_str) = serde_json::to_string(&full_msg) {
                                            let _ = tx.try_send(Message::Text(json_str.into()));
                                        }
                                    }
                                }
                            }

                            ClientMessage::Cursor { x, y, page_index } => {
                                if let (Some(doc_id), Some(client_id)) =
                                    (&current_doc_id, &current_client_id)
                                {
                                    let hub_read = hub.read().await;
                                    if let Some(peer) = hub_read.get_peer(doc_id, client_id) {
                                        let cursor_msg = ServerMessage::RemoteCursor {
                                            client_id: client_id.clone(),
                                            username: peer.username,
                                            color: peer.color,
                                            x,
                                            y,
                                            page_index,
                                        };
                                        if let Ok(json_str) = serde_json::to_string(&cursor_msg) {
                                            hub_read.broadcast_to_room(doc_id, client_id, &json_str, true);
                                        }
                                    }
                                }
                            }

                            ClientMessage::ElementChange {
                                action,
                                element,
                                page_index,
                            } => {
                                if let (Some(doc_id), Some(client_id)) =
                                    (&current_doc_id, &current_client_id)
                                {
                                    let hub_read = hub.read().await;
                                    if hub_read.is_ai_locked(doc_id) {
                                        continue;
                                    }
                                    let broadcast_msg = ServerMessage::ElementChange {
                                        sender_client_id: client_id.clone(),
                                        action,
                                        element,
                                        page_index,
                                    };
                                    if let Ok(json_str) = serde_json::to_string(&broadcast_msg) {
                                        hub_read.broadcast_to_room(doc_id, client_id, &json_str, false);
                                    }
                                }
                            }

                            ClientMessage::DocSync {
                                elements,
                                page_backgrounds,
                                page_count,
                                page_size,
                                page_sizes,
                                page_titles,
                                title,
                            } => {
                                if let (Some(doc_id), Some(client_id)) =
                                    (&current_doc_id, &current_client_id)
                                {
                                    let hub_read = hub.read().await;
                                    if !hub_read.can_broadcast_doc_sync(doc_id, client_id) {
                                        continue;
                                    }
                                    let broadcast_msg = ServerMessage::DocSync {
                                        sender_client_id: client_id.clone(),
                                        elements,
                                        page_backgrounds,
                                        page_count,
                                        page_size,
                                        page_sizes,
                                        page_titles,
                                        title,
                                    };
                                    if let Ok(json_str) = serde_json::to_string(&broadcast_msg) {
                                        hub_read.broadcast_to_room(doc_id, client_id, &json_str, false);
                                    }
                                }
                            }

                            ClientMessage::TitleChange { title } => {
                                if let (Some(doc_id), Some(client_id)) =
                                    (&current_doc_id, &current_client_id)
                                {
                                    let hub_read = hub.read().await;
                                    if hub_read.is_ai_locked(doc_id) {
                                        continue;
                                    }
                                    let broadcast_msg = ServerMessage::TitleChange {
                                        sender_client_id: client_id.clone(),
                                        title,
                                    };
                                    if let Ok(json_str) = serde_json::to_string(&broadcast_msg) {
                                        hub_read.broadcast_to_room(doc_id, client_id, &json_str, false);
                                    }
                                }
                            }

                            ClientMessage::AiLock { locked, locked_by } => {
                                if let (Some(doc_id), Some(client_id)) =
                                    (&current_doc_id, &current_client_id)
                                {
                                    let mut hub_write = hub.write().await;
                                    match hub_write.set_ai_lock(doc_id, client_id, locked, locked_by) {
                                        Ok(Some(lock_state)) => {
                                            let lock_msg = ServerMessage::AiLock {
                                                locked: true,
                                                locked_by: Some(lock_state.locked_by),
                                                locked_by_client_id: Some(lock_state.locked_by_client_id),
                                            };
                                            if let Ok(json_str) = serde_json::to_string(&lock_msg) {
                                                hub_write.broadcast_to_room(doc_id, client_id, &json_str, false);
                                            }
                                        }
                                        Ok(None) => {
                                            if !locked {
                                                let unlock_msg = ServerMessage::AiLock {
                                                    locked: false,
                                                    locked_by: None,
                                                    locked_by_client_id: None,
                                                };
                                                if let Ok(json_str) = serde_json::to_string(&unlock_msg) {
                                                    hub_write.broadcast_to_room(doc_id, client_id, &json_str, false);
                                                }
                                            }
                                        }
                                        Err(existing) => {
                                            let lock_msg = ServerMessage::AiLock {
                                                locked: true,
                                                locked_by: Some(existing.locked_by),
                                                locked_by_client_id: Some(existing.locked_by_client_id),
                                            };
                                            if let Ok(json_str) = serde_json::to_string(&lock_msg) {
                                                let _ = tx.try_send(Message::Text(json_str.into()));
                                            }
                                        }
                                    }
                                }
                            }

                            ClientMessage::Ping => {
                                if let Ok(json_str) = serde_json::to_string(&ServerMessage::Pong) {
                                    let _ = tx.try_send(Message::Text(json_str.into()));
                                }
                            }

                            ClientMessage::Leave => {
                                if let (Some(doc_id), Some(client_id)) =
                                    (current_doc_id.take(), current_client_id.take())
                                {
                                    let mut hub_write = hub.write().await;
                                    hub_write.leave_room(&doc_id, &client_id);
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    if let (Some(doc_id), Some(client_id)) = (&current_doc_id, &current_client_id) {
        let mut hub_write = hub.write().await;
        hub_write.leave_room(doc_id, client_id);
    }

    send_task.abort();
    forward_task.abort();

    Ok(())
}
