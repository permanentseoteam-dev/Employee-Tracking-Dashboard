use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PresenceStatus {
    Active,
    Idle,
    Offline,
}

impl std::fmt::Display for PresenceStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Active => write!(f, "active"),
            Self::Idle => write!(f, "idle"),
            Self::Offline => write!(f, "offline"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StatusTransition {
    BecameIdle { idle_since: DateTime<Utc> },
    ResumedActive { last_activity_at: DateTime<Utc> },
}

#[derive(Debug, Clone)]
pub struct PresenceStateMachine {
    current_status: PresenceStatus,
    last_activity_at: DateTime<Utc>,
    idle_since: Option<DateTime<Utc>>,
}

impl PresenceStateMachine {
    pub fn new() -> Self {
        let now = Utc::now();
        Self {
            current_status: PresenceStatus::Active,
            last_activity_at: now,
            idle_since: None,
        }
    }

    pub fn current_status(&self) -> PresenceStatus {
        self.current_status
    }

    pub fn last_activity_at(&self) -> DateTime<Utc> {
        self.last_activity_at
    }

    pub fn idle_since(&self) -> Option<DateTime<Utc>> {
        self.idle_since
    }

    /// Evaluates current idle duration and triggers state transitions
    pub fn update(&mut self, is_idle: bool, idle_seconds: u64) -> Option<StatusTransition> {
        let now = Utc::now();

        if is_idle {
            if self.current_status != PresenceStatus::Idle {
                self.current_status = PresenceStatus::Idle;
                let idle_start = now - Duration::seconds(idle_seconds as i64);
                self.idle_since = Some(idle_start);
                tracing::info!("Status transition: ACTIVE -> IDLE (idle for {}s)", idle_seconds);
                return Some(StatusTransition::BecameIdle {
                    idle_since: idle_start,
                });
            }
        } else {
            self.last_activity_at = now;
            if self.current_status == PresenceStatus::Idle {
                self.current_status = PresenceStatus::Active;
                self.idle_since = None;
                tracing::info!("Status transition: IDLE -> ACTIVE (user activity resumed)");
                return Some(StatusTransition::ResumedActive {
                    last_activity_at: now,
                });
            }
        }

        None
    }
}
