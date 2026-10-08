use thiserror::Error;

#[derive(Error, Debug)]
pub enum AgentError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[allow(dead_code)]
    #[error("Windows API error: {0}")]
    Windows(String),

    #[error("Supabase API error: {0}")]
    Supabase(String),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("General error: {0}")]
    General(String),

    #[error("JSON serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub type AgentResult<T> = Result<T, AgentError>;
