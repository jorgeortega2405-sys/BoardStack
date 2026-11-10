use std::collections::HashMap;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::types::{AiLockState, PeerInfo, ServerMessage, PALETTE};

pub struct Room {
    pub peers: HashMap<String, PeerInfo>,
    pub senders: HashMap<String, Sender<String>>,
    pub ai_lock: Option<AiLockState>,
}

impl Room {
    pub fn new() -> Self {
        Self {
            peers: HashMap::new(),
            senders: HashMap::new(),
            ai_lock: None,
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
        ai_lock: Option<AiLockState>,
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
        let current_lock = room.ai_lock.clone();

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
            ai_lock: current_lock,
        }
    }

    pub fn leave_room(&mut self, doc_id: &str, client_id: &str) -> Option<PeerInfo> {
        if let Some(room) = self.rooms.get_mut(doc_id) {
            room.senders.remove(client_id);
            let removed = room.peers.remove(client_id);

            let should_unlock = room
                .ai_lock
                .as_ref()
                .map(|lock| lock.locked_by_client_id == client_id)
                .unwrap_or(false);
            if should_unlock {
                room.ai_lock = None;
                let unlock_notice = ServerMessage::AiLock {
                    locked: false,
                    locked_by: None,
                    locked_by_client_id: None,
                };
                if let Ok(json_str) = serde_json::to_string(&unlock_notice) {
                    room.broadcast(None, &json_str, false);
                }
            }

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

    pub fn set_ai_lock(
        &mut self,
        doc_id: &str,
        client_id: &str,
        locked: bool,
        locked_by: Option<String>,
    ) -> Result<Option<AiLockState>, AiLockState> {
        let room = match self.rooms.get_mut(doc_id) {
            Some(r) => r,
            None => return Ok(None),
        };

        if locked {
            if let Some(existing) = &room.ai_lock {
                if existing.locked_by_client_id != client_id {
                    return Err(existing.clone());
                }
            }

            let fallback_name = room
                .peers
                .get(client_id)
                .map(|p| p.username.clone())
                .unwrap_or_else(|| "Member".to_string());
            let resolved_name = locked_by
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or(fallback_name);

            let new_lock = AiLockState {
                locked_by: resolved_name,
                locked_by_client_id: client_id.to_string(),
            };
            room.ai_lock = Some(new_lock.clone());
            Ok(Some(new_lock))
        } else {
            if let Some(existing) = &room.ai_lock {
                if existing.locked_by_client_id == client_id {
                    room.ai_lock = None;
                    return Ok(None);
                }
                return Err(existing.clone());
            }
            Ok(None)
        }
    }

    pub fn is_ai_locked(&self, doc_id: &str) -> bool {
        self.rooms
            .get(doc_id)
            .and_then(|r| r.ai_lock.as_ref())
            .is_some()
    }

    pub fn can_broadcast_doc_sync(&self, doc_id: &str, client_id: &str) -> bool {
        match self.rooms.get(doc_id).and_then(|r| r.ai_lock.as_ref()) {
            None => true,
            Some(lock) => lock.locked_by_client_id == client_id,
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

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;

    #[test]
    fn ai_lock_blocks_foreign_override_and_releases_on_leave() {
        let mut hub = CollabHub::new(10);
        let (tx1, _rx1) = mpsc::channel::<String>(16);
        let (tx2, mut rx2) = mpsc::channel::<String>(16);

        let peer1_id = match hub.join_room("doc-1", Some(1), "Alice".to_string(), None, false, tx1) {
            JoinResult::Success { peer, .. } => peer.client_id,
            _ => panic!("expected join 1 to succeed"),
        };
        let peer2_id = match hub.join_room("doc-1", Some(2), "Bob".to_string(), None, false, tx2) {
            JoinResult::Success { peer, .. } => peer.client_id,
            _ => panic!("expected join 2 to succeed"),
        };

        let acquired = hub.set_ai_lock("doc-1", &peer1_id, true, Some("Alice".to_string()));
        assert!(acquired.is_ok());
        assert!(hub.is_ai_locked("doc-1"));
        assert!(hub.can_broadcast_doc_sync("doc-1", &peer1_id));
        assert!(!hub.can_broadcast_doc_sync("doc-1", &peer2_id));

        let foreign_unlock = hub.set_ai_lock("doc-1", &peer2_id, false, None);
        assert!(foreign_unlock.is_err());
        assert!(hub.is_ai_locked("doc-1"));

        let foreign_acquire = hub.set_ai_lock("doc-1", &peer2_id, true, Some("Bob".to_string()));
        assert!(foreign_acquire.is_err());

        while rx2.try_recv().is_ok() {}
        hub.leave_room("doc-1", &peer1_id);
        assert!(!hub.is_ai_locked("doc-1"));

        let unlock_msg = rx2.try_recv().expect("expected unlock notice for peer 2");
        assert!(unlock_msg.contains("\"type\":\"aiLock\""));
        assert!(unlock_msg.contains("\"locked\":false"));
    }

    #[test]
    fn new_peer_receives_active_ai_lock_state_on_join() {
        let mut hub = CollabHub::new(10);
        let (tx1, _rx1) = mpsc::channel::<String>(16);
        let (tx2, _rx2) = mpsc::channel::<String>(16);

        let peer1_id = match hub.join_room("doc-2", Some(1), "Alice".to_string(), None, false, tx1) {
            JoinResult::Success { peer, .. } => peer.client_id,
            _ => panic!("expected join 1 to succeed"),
        };

        hub.set_ai_lock("doc-2", &peer1_id, true, Some("Alice".to_string())).unwrap();

        match hub.join_room("doc-2", Some(2), "Bob".to_string(), None, false, tx2) {
            JoinResult::Success { ai_lock, .. } => {
                let lock = ai_lock.expect("expected active ai lock");
                assert_eq!(lock.locked_by, "Alice");
                assert_eq!(lock.locked_by_client_id, peer1_id);
            }
            _ => panic!("expected join 2 to succeed"),
        }
    }
}
