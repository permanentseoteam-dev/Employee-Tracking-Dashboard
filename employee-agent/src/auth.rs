use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};

#[derive(Clone, Debug)]
pub struct AuthManager {
    anon_key: String,
}

impl AuthManager {
    pub fn new(anon_key: &str) -> Self {
        Self {
            anon_key: anon_key.trim().to_string(),
        }
    }

    /// Build standard authenticated headers required by PostgREST & Supabase Storage
    pub fn build_headers(&self) -> Result<HeaderMap, String> {
        let mut headers = HeaderMap::new();

        let mut apikey_val = HeaderValue::from_str(&self.anon_key)
            .map_err(|e| format!("Invalid apikey header value: {}", e))?;
        apikey_val.set_sensitive(true);
        headers.insert("apikey", apikey_val);

        let mut bearer_val = HeaderValue::from_str(&format!("Bearer {}", self.anon_key))
            .map_err(|e| format!("Invalid bearer header value: {}", e))?;
        bearer_val.set_sensitive(true);
        headers.insert(AUTHORIZATION, bearer_val);

        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        Ok(headers)
    }

    #[allow(dead_code)]
    pub fn anon_key(&self) -> &str {
        &self.anon_key
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_headers_construction() {
        let auth = AuthManager::new("sample-secret-jwt-key");
        let headers = auth.build_headers().unwrap();
        assert!(headers.contains_key("apikey"));
        assert!(headers.contains_key(AUTHORIZATION));
    }
}
