use anyhow::{Context, Result};
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub rabbitmq_url: String,
    pub supabase_url: String,
    pub supabase_service_token: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Config {
            rabbitmq_url: env::var("NUQ_RABBITMQ_URL").context("NUQ_RABBITMQ_URL must be set")?,
            supabase_url: env::var("SUPABASE_URL").context("SUPABASE_URL must be set")?,
            supabase_service_token: env::var("SUPABASE_SERVICE_TOKEN")
                .context("SUPABASE_SERVICE_TOKEN must be set")?,
        })
    }
}
