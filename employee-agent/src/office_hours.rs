use chrono::{Datelike, Local, NaiveTime, Timelike, Weekday};
use serde::Deserialize;

#[derive(Debug, Clone)]
pub struct OfficeHoursConfig {
    pub enabled: bool,
    pub work_start: NaiveTime,
    pub work_end: NaiveTime,
    /// Weekdays allowed: Mon=0 .. Sun=6 (chrono Weekday numbering via from)
    pub work_days: Vec<Weekday>,
    pub capture_outside_hours: bool,
}

impl Default for OfficeHoursConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            work_start: NaiveTime::from_hms_opt(9, 0, 0).unwrap(),
            work_end: NaiveTime::from_hms_opt(17, 0, 0).unwrap(),
            work_days: vec![
                Weekday::Mon,
                Weekday::Tue,
                Weekday::Wed,
                Weekday::Thu,
                Weekday::Fri,
            ],
            capture_outside_hours: false,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct RemoteOfficeHoursRow {
    pub enabled: Option<bool>,
    pub work_start: Option<String>,
    pub work_end: Option<String>,
    pub work_days: Option<Vec<String>>,
    pub capture_outside_hours: Option<bool>,
}

impl OfficeHoursConfig {
    pub fn from_env_defaults() -> Self {
        let mut cfg = Self::default();

        if let Ok(v) = std::env::var("OFFICE_HOURS_ENABLED") {
            cfg.enabled = parse_bool(&v).unwrap_or(true);
        }
        if let Ok(v) = std::env::var("WORK_START") {
            if let Some(t) = parse_hhmm(&v) {
                cfg.work_start = t;
            }
        }
        if let Ok(v) = std::env::var("WORK_END") {
            if let Some(t) = parse_hhmm(&v) {
                cfg.work_end = t;
            }
        }
        if let Ok(v) = std::env::var("WORK_DAYS") {
            cfg.work_days = parse_work_days(&v);
        }
        if let Ok(v) = std::env::var("CAPTURE_OUTSIDE_HOURS") {
            cfg.capture_outside_hours = parse_bool(&v).unwrap_or(false);
        }

        cfg
    }

    pub fn apply_remote(&mut self, row: &RemoteOfficeHoursRow) {
        if let Some(v) = row.enabled {
            self.enabled = v;
        }
        if let Some(ref s) = row.work_start {
            if let Some(t) = parse_hhmm(s) {
                self.work_start = t;
            }
        }
        if let Some(ref s) = row.work_end {
            if let Some(t) = parse_hhmm(s) {
                self.work_end = t;
            }
        }
        if let Some(ref days) = row.work_days {
            let joined = days.join(",");
            let parsed = parse_work_days(&joined);
            if !parsed.is_empty() {
                self.work_days = parsed;
            }
        }
        if let Some(v) = row.capture_outside_hours {
            self.capture_outside_hours = v;
        }
    }

    /// Uses the workstation's local clock (office PC timezone).
    pub fn allows_capture_now(&self) -> bool {
        if !self.enabled || self.capture_outside_hours {
            return true;
        }
        let now = Local::now();
        if !self.work_days.contains(&now.weekday()) {
            return false;
        }
        let t = NaiveTime::from_hms_opt(now.hour(), now.minute(), now.second()).unwrap_or(now.time());
        if self.work_start <= self.work_end {
            t >= self.work_start && t < self.work_end
        } else {
            // Overnight window e.g. 22:00–06:00
            t >= self.work_start || t < self.work_end
        }
    }

    pub fn summary(&self) -> String {
        let days: Vec<&str> = self
            .work_days
            .iter()
            .map(|d| match d {
                Weekday::Mon => "Mon",
                Weekday::Tue => "Tue",
                Weekday::Wed => "Wed",
                Weekday::Thu => "Thu",
                Weekday::Fri => "Fri",
                Weekday::Sat => "Sat",
                Weekday::Sun => "Sun",
            })
            .collect();
        format!(
            "enabled={}, {}-{}, days=[{}], outside={}",
            self.enabled,
            self.work_start.format("%H:%M"),
            self.work_end.format("%H:%M"),
            days.join(","),
            self.capture_outside_hours
        )
    }
}

fn parse_hhmm(raw: &str) -> Option<NaiveTime> {
    let s = raw.trim();
    // Accept "09:00", "9:00", "09:00:00"
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() < 2 {
        return None;
    }
    let h: u32 = parts[0].parse().ok()?;
    let m: u32 = parts[1].parse().ok()?;
    let sec: u32 = parts.get(2).and_then(|p| p.parse().ok()).unwrap_or(0);
    NaiveTime::from_hms_opt(h, m, sec)
}

fn parse_bool(raw: &str) -> Option<bool> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Some(true),
        "0" | "false" | "no" | "off" => Some(false),
        _ => None,
    }
}

fn parse_work_days(raw: &str) -> Vec<Weekday> {
    raw.split(|c| c == ',' || c == ';' || c == ' ')
        .filter_map(|token| {
            let t = token.trim().to_ascii_lowercase();
            if t.is_empty() {
                return None;
            }
            Some(match t.as_str() {
                "mon" | "monday" | "1" => Weekday::Mon,
                "tue" | "tuesday" | "2" => Weekday::Tue,
                "wed" | "wednesday" | "3" => Weekday::Wed,
                "thu" | "thursday" | "4" => Weekday::Thu,
                "fri" | "friday" | "5" => Weekday::Fri,
                "sat" | "saturday" | "6" => Weekday::Sat,
                "sun" | "sunday" | "0" | "7" => Weekday::Sun,
                _ => return None,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_times_and_days() {
        assert_eq!(
            parse_hhmm("09:30").unwrap(),
            NaiveTime::from_hms_opt(9, 30, 0).unwrap()
        );
        let days = parse_work_days("Mon,Tue,Fri");
        assert_eq!(days, vec![Weekday::Mon, Weekday::Tue, Weekday::Fri]);
    }
}
