#!/usr/bin/env bun
import { main } from "../src/runner";

main(process.argv.slice(2)).catch((err) => {
	console.error("[agy-ensemble] Unhandled error:", err);
	process.exit(1);
});
