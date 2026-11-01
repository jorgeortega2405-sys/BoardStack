use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const PALETTE: &[&str] = &[
    "#EF4444", "#F97316", "#F59E0B", "#10B981", "#06B6D4", "#3B82F6",
    "#6366F1", "#8B5CF6", "#EC4899", "#14B8A6", "#84CC16", "#E11D48",
];

pub const DEFAULT_MAX_COLLABORATORS: usize = 12;
pub const MAX_MESSAGE_BYTES: usize = 1024 * 1024;
pub const RATE_LIMIT_CAPACITY: f64 = 60.0;
pub const RATE_LIMIT_REFILL_PER_SEC: f64 = 45.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerInfo {
    pub client_id: String,
    pub user_id: Option<i64>,
    pub username: String,
    pub color: String,
    pub avatar_url: Option<String>,
    pub is_guest: bool,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ClientMessage {
    #[serde(rename_all = "camelCase")]
    Join {
        doc_id: String,
        #[serde(default)]
        user_id: Option<i64>,
        username: String,
        #[serde(default)]
        avatar_url: Option<String>,
        #[serde(default)]
        is_guest: Option<bool>,
    },
    #[serde(rename_all = "camelCase")]
    Cursor {
        x: f64,
        y: f64,
        #[serde(default)]
        page_index: usize,
    },
    #[serde(rename_all = "camelCase")]
    ElementChange {
        action: String,
        element: Value,
        #[serde(default)]
        page_index: Option<usize>,
    },
    #[serde(rename_all = "camelCase")]
    DocSync {
        elements: Vec<Value>,
        #[serde(default)]
        page_backgrounds: Option<Vec<String>>,
        #[serde(default)]
        page_count: Option<usize>,
        #[serde(default)]
        title: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    TitleChange {
        title: String,
    },
    Ping,
    Leave,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerMessage {
    #[serde(rename_all = "camelCase")]
    Joined {
        client_id: String,
        color: String,
        peers: Vec<PeerInfo>,
    },
    #[serde(rename_all = "camelCase")]
    UserJoined {
        peer: PeerInfo,
    },
    #[serde(rename_all = "camelCase")]
    UserLeft {
        client_id: String,
    },
    #[serde(rename_all = "camelCase")]
    RemoteCursor {
        client_id: String,
        username: String,
        color: String,
        x: f64,
        y: f64,
        page_index: usize,
    },
    #[serde(rename_all = "camelCase")]
    ElementChange {
        sender_client_id: String,
        action: String,
        element: Value,
        page_index: Option<usize>,
    },
    #[serde(rename_all = "camelCase")]
    DocSync {
        sender_client_id: String,
        elements: Vec<Value>,
        page_backgrounds: Option<Vec<String>>,
        page_count: Option<usize>,
        title: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    TitleChange {
        sender_client_id: String,
        title: String,
    },
    Pong,
    #[serde(rename_all = "camelCase")]
    RoomFull {
        message: String,
        max_collaborators: usize,
    },
    #[serde(rename_all = "camelCase")]
    RateLimited {
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    Error {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
    },
}
