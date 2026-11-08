import { describe, expect, test } from "bun:test";
import { TenantProvisioner } from "../src/tenant-provisioner";

describe("IMP-02 / VAL-02: Multi-Tenant Container & Vault Provisioner per SI", () => {
	test("concurrently provisions isolated Postgres schema/user, Redis ACL/prefix, RabbitMQ vhost, and ephemeral Vault token across 3 parallel Teammates without collision", async () => {
		const provisioner = new TenantProvisioner();

		const [t1, t2, t3] = await Promise.all([
			provisioner.provisionTenant({
				phaseId: "01",
				siId: "SI-01.1",
				memberName: "worker-1",
			}),
			provisioner.provisionTenant({
				phaseId: "01",
				siId: "SI-01.2",
				memberName: "worker-2",
			}),
			provisioner.provisionTenant({
				phaseId: "01",
				siId: "SI-01.3",
				memberName: "worker-3",
			}),
		]);

		expect(t1.postgresSchema).toBe("s_si_01_1");
		expect(t1.postgresUser).toBe("u_si_01_1");
		expect(t1.redisKeyPrefix).toBe("si_01_1:");
		expect(t1.rabbitMqVhost).toBe("/si_01_1");
		expect(t1.vaultSecretPath).toBe("secret/data/ensemble/01/si_01_1");
		expect(t1.vaultToken).toMatch(/^vlt_eph_/);

		// Ensure complete disjointness across concurrent tenants
		expect(
			new Set([t1.postgresSchema, t2.postgresSchema, t3.postgresSchema]).size,
		).toBe(3);
		expect(new Set([t1.vaultToken, t2.vaultToken, t3.vaultToken]).size).toBe(3);

		// Verify isolation guard blocks cross-tenant access (Error path)
		expect(() =>
			provisioner.assertTenantAccess(t1.vaultToken, "s_si_01_2"),
		).toThrow(/Cross-tenant access denied/);

		// Teardown on ensemble_shutdown revokes Vault token and drops schema
		const teardown = await provisioner.teardownTenant(t1.tenantId);
		expect(teardown.vaultTokenRevoked).toBe(true);
		expect(teardown.schemaDropped).toBe(true);

		expect(() =>
			provisioner.assertTenantAccess(t1.vaultToken, "s_si_01_1"),
		).toThrow(/Revoked or unknown Vault token/);
	});
});
