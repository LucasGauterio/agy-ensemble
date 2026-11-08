import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	generateCloudReleaseArtifacts,
	validateCloudReleaseReadiness,
} from "../src/cloud-release-validator";

describe("IMP-14 / VAL-14: Stage 11 Production Cloud Deployment (GitHub Actions First + Multi-Cloud + 3 Runbooks)", () => {
	test("blocks production cloud release without explicit user permission (Error path) and generates GitHub Actions workflows + 3 mandatory human contingency runbooks", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-cloud-"));

		generateCloudReleaseArtifacts(tmpDir, {
			projectName: "clinical-saas",
			primaryCloud: "gcp-cloudflare-github",
			supportedClouds: ["gcp", "cloudflare", "github", "aws", "azure"],
		});

		// Without user permission -> blocked
		const denied = validateCloudReleaseReadiness(tmpDir, {
			userPermissionGranted: false,
		});
		expect(denied.canExecuteCloudDeploy).toBe(false);
		expect(denied.allRunbooksPresent).toBe(true);

		// With explicit user permission -> ready and verified
		const allowed = validateCloudReleaseReadiness(tmpDir, {
			userPermissionGranted: true,
		});
		expect(allowed.canExecuteCloudDeploy).toBe(true);
		expect(allowed.allWorkflowsPresent).toBe(true);
		expect(allowed.allRunbooksPresent).toBe(true);

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});
});
