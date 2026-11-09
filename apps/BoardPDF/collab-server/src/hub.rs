use std::collections::HashMap;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::types::{PeerInfo, ServerMessage, PALETTE};

pub struct Room {
    pub peers: HashMap<String, PeerInfo>,
    pub senders: HashMap<String, Sender<String>>,
}

impl Room {
    pub fn new() -> Self {
        Self {
            peers: HashMap::new(),
            senders: HashMap::new(),
        }
    }

    pub fn broadcast(&self, exclude_client_id: Option<&str>, message_str: &str, is_lossy: bool) {
        for (client_id, tx) in &self.senders {
            if let Some(exclude) = exclude_client_id {
                if client_id == exclude {
                    continue;
                }
            }
            if is_lossy {
                let _ = tx.try_send(message_str.to_string());
            } else if let Err(err) = tx.try_send(message_str.to_string()) {
                eprintln!("[CollabServer] Warning: Critical mutation dropped for client {} due to channel saturation: {:?}", client_id, err);
            }
        }
    }
}

pub enum JoinResult {
    Success {
        peer: PeerInfo,
        existing_peers: Vec<PeerInfo>,
    },
    RoomFull {
        max_collaborators: usize,
    },
}

pub struct CollabHub {
    pub rooms: HashMap<String, Room>,
    pub max_collaborators: usize,
}

impl CollabHub {
    pub fn new(max_collaborators: usize) -> Self {
        Self {
            rooms: HashMap::new(),
            max_collaborators,
        }
    }

    pub fn join_room(
        &mut self,
        doc_id: &str,
        user_id: Option<i64>,
        username: String,
        avatar_url: Option<String>,
        is_guest: bool,
        tx: Sender<String>,
    ) -> JoinResult {
        let room = self.rooms.entry(doc_id.to_string()).or_insert_with(Room::new);

        if room.peers.len() >= self.max_collaborators {
            return JoinResult::RoomFull {
                max_collaborators: self.max_collaborators,
            };
        }

        let client_id = Uuid::new_v4().to_string();
        let color_index = room.peers.len() % PALETTE.len();
        let color = PALETTE[color_index].to_string();

        let peer_info = PeerInfo {
            client_id: client_id.clone(),
            user_id,
            username,
            color,
            avatar_url,
            is_guest,
        };

        let existing_peers: Vec<PeerInfo> = room.peers.values().cloned().collect();

        room.peers.insert(client_id.clone(), peer_info.clone());
        room.senders.insert(client_id, tx);

        let join_notice = ServerMessage::UserJoined {
            peer: peer_info.clone(),
        };
        if let Ok(json_str) = serde_json::to_string(&join_notice) {
            room.broadcast(Some(&peer_info.client_id), &json_str, false);
        }

        JoinResult::Success {
            peer: peer_info,
            existing_peers,
        }
    }

    pub fn leave_room(&mut self, doc_id: &str, client_id: &str) -> Option<PeerInfo> {
        if let Some(room) = self.rooms.get_mut(doc_id) {
            room.senders.remove(client_id);
            let removed = room.peers.remove(client_id);

            let leave_notice = ServerMessage::UserLeft {
                client_id: client_id.to_string(),
            };
            if let Ok(json_str) = serde_json::to_string(&leave_notice) {
                room.broadcast(None, &json_str, false);
            }

            if room.peers.is_empty() {
                self.rooms.remove(doc_id);
            }

            removed
        } else {
            None
        }
    }

    pub fn broadcast_to_room(&self, doc_id: &str, sender_client_id: &str, message_str: &str, is_lossy: bool) {
        if let Some(room) = self.rooms.get(doc_id) {
            room.broadcast(Some(sender_client_id), message_str, is_lossy);
        }
    }

    pub fn get_peer(&self, doc_id: &str, client_id: &str) -> Option<PeerInfo> {
        self.rooms.get(doc_id).and_then(|r| r.peers.get(client_id).cloned())
    }
}
