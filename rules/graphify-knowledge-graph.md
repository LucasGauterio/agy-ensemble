---
trigger: always_on
---

# Graphify Knowledge Graph Mandate (`GRAPHIFY-0`)

`agy-ensemble` integrates **Graphify** (`graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md`, and the `graphify` MCP server) across all workflow stages to reduce token usage and prevent architectural blind spots:

1. **Graph-First Codebase Navigation:** Before running broad raw-file greps or reading entire source trees, read `graphify-out/GRAPH_REPORT.md` and query the `graphify` MCP tools (`query_graph`, `get_neighbors`, `shortest_path`, `god_nodes`, `get_node`) or `graphify explain "<symbol>"` / `graphify path "A" "B"`.
2. **Etapa 0.0 (Brownfield Gate & Initial Setup):** Ensure `graphify-out/graph.json` is built (`graphify update .`) and git hooks (`graphify hook install`) are active before starting reverse codebase analysis. Use `god_nodes` and community clusters to map module boundaries in `docs/RFC.md` and `docs/FDD.md`.
3. **Etapa 4 / 7 (Context Pack & File-Touch Disjointness):** Use Graphify neighbor/blast-radius analysis (`get_neighbors` / `god_nodes`) when computing `Files touched` for each `SI-NN.X` so parallel Teammates never collide on shared hub files.
4. **Etapa 8 / 9 (Post-Merge Graph Freshness):** After merging phase worktrees, ensure `graphify update .` has refreshed `graphify-out/graph.json` so subsequent phases and Teammates never operate on a stale graph.
