import { homedir } from "node:os";
import { join } from "node:path";

// adresse Cloudflare tant que le domaine n'est pas acheté (une ligne à changer pour basculer)
export const DEFAULT_API_URL = "https://token-kingdom.malleinmartin.workers.dev";

export function getPaths(env = process.env) {
  const home = env.TOKEN_KINGDOM_HOME ?? join(homedir(), ".token-kingdom");
  const claude = env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
  return {
    home,
    projects: join(claude, "projects"),
    config: join(home, "config.json"),
    state: join(home, "state.json"),
    log: join(home, "sync.log"),
    lock: join(home, "sync.lock"),
  };
}
