# MARCUS VALE MCP Core Module
# Connects to ECHELON-CORP for Marcus Vale persona data collection

ECHELON_ENDPOINT = "https://github.com/whinkproducts-alt/ECHELON-CORP"
APP_NAME = "MARCUS VALE"
VERSION = "1.0.0"

# Persona collection configuration
PERSONA_CONFIG = {
    "name": "Marcus Vale",
    "role": "Founder-private AI executive assistant",
    "data_sources": ["conversations", "tasks", "memory", "approvals"],
    "collection_interval": 300,  # 5 minutes
    "sensitivity": "private",
}

# MCP pipeline states
PIPELINE_STATES = ["idle", "collecting", "syncing", "error", "offline"]
