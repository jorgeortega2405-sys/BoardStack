mod hub;
mod types;

use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use futures_util::{SinkExt, StreamExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, RwLock};
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
        "[CollabServer] Servidor WebSocket colaborativo escuchando en {} (Límite por room: {} colaboradores)",
        addr, max_collab
    );

    let hub = Arc::new(RwLock::new(CollabHub::new(max_collab)));

    while let Ok((stream, peer_addr)) = listener.accept().await {
        let hub_clone = Arc::clone(&hub);
        tokio::spawn(async move {
            if let Err(err) = handle_connection(stream, peer_addr, hub_clone).await {
                eprintln!("[CollabServer] Error en conexión con {}: {:?}", peer_addr, err);
            }
        });
    }

    Ok(())
}

async fn handle_connection(
    stream: TcpStream,
    _peer_addr: SocketAddr,
    hub: Arc<RwLock<CollabHub>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut ws_config = WebSocketConfig::default();
    ws_config.max_message_size = Some(2 * 1024 * 1024);
    ws_config.max_frame_size = Some(2 * 1024 * 1024);
    let ws_stream = tokio_tungstenite::accept_async_with_config(stream, Some(ws_config)).await?;
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    let (tx, mut rx) = mpsc::channel::<Message>(128);

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    let (hub_tx, mut hub_rx) = mpsc::channel::<String>(128);
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
                                message: "El tamaño del mensaje excede el límite permitido (1 MB).".to_string(),
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
                                let err_msg = ServerMessage::Error {
                                    message: format!("Mensaje JSON no reconocido: {}", err),
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
                                    message: "Demasiadas peticiones por segundo. Por favor reduce la velocidad.".to_string(),
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
                                    }
                                    JoinResult::RoomFull { max_collaborators } => {
                                        let full_msg = ServerMessage::RoomFull {
                                            message: format!(
                                                "Esta sala colaborativa ha alcanzado el límite máximo de {} colaboradores simultáneos.",
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
                                    let broadcast_msg = ServerMessage::ElementChange {
                                        sender_client_id: client_id.clone(),
                                        action,
                                        element,
                                        page_index,
                                    };
                                    if let Ok(json_str) = serde_json::to_string(&broadcast_msg) {
                                        let hub_read = hub.read().await;
                                        hub_read.broadcast_to_room(doc_id, client_id, &json_str, false);
                                    }
                                }
                            }

                            ClientMessage::DocSync {
                                elements,
                                page_backgrounds,
                                page_count,
                                title,
                            } => {
                                if let (Some(doc_id), Some(client_id)) =
                                    (&current_doc_id, &current_client_id)
                                {
                                    let broadcast_msg = ServerMessage::DocSync {
                                        sender_client_id: client_id.clone(),
                                        elements,
                                        page_backgrounds,
                                        page_count,
                                        title,
                                    };
                                    if let Ok(json_str) = serde_json::to_string(&broadcast_msg) {
                                        let hub_read = hub.read().await;
                                        hub_read.broadcast_to_room(doc_id, client_id, &json_str, false);
                                    }
                                }
                            }

                            ClientMessage::TitleChange { title } => {
                                if let (Some(doc_id), Some(client_id)) =
                                    (&current_doc_id, &current_client_id)
                                {
                                    let broadcast_msg = ServerMessage::TitleChange {
                                        sender_client_id: client_id.clone(),
                                        title,
                                    };
                                    if let Ok(json_str) = serde_json::to_string(&broadcast_msg) {
                                        let hub_read = hub.read().await;
                                        hub_read.broadcast_to_room(doc_id, client_id, &json_str, false);
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
