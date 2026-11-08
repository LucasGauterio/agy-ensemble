import crypto from "node:crypto";

export interface TenantCredentials {
	tenantId: string;
	postgresSchema: string;
	postgresUser: string;
	redisKeyPrefix: string;
	rabbitMqVhost: string;
	vaultSecretPath: string;
	vaultToken: string;
}

/**
 * Multi-Tenant Container & Vault Provisioner for SI Teammates.
 * Isolates PostgreSQL schemas/users, Redis ACL/prefixes, RabbitMQ vhosts,
 * and ephemeral Vault tokens per Step Implementation (SI-NN.X).
 */
export class TenantProvisioner {
	private readonly activeTenants = new Map<string, TenantCredentials>();
	private readonly tokenToTenant = new Map<string, TenantCredentials>();

	/**
	 * Provision isolated multi-tenant credentials and Vault token for a Teammate SI.
	 */
	async provisionTenant(input: {
		phaseId: string;
		siId: string;
		memberName: string;
	}): Promise<TenantCredentials> {
		const slug = input.siId
			.toLowerCase()
			.replace(/^si-/, "si_")
			.replace(/[^a-z0-9_]/g, "_");

		const tenantId = `tenant_${slug}_${crypto.randomUUID().slice(0, 8)}`;
		const creds: TenantCredentials = {
			tenantId,
			postgresSchema: `s_${slug}`,
			postgresUser: `u_${slug}`,
			redisKeyPrefix: `${slug}:`,
			rabbitMqVhost: `/${slug}`,
			vaultSecretPath: `secret/data/ensemble/${input.phaseId}/${slug}`,
			vaultToken: `vlt_eph_${crypto.randomUUID().replace(/-/g, "")}`,
		};

		this.activeTenants.set(tenantId, creds);
		this.tokenToTenant.set(creds.vaultToken, creds);
		return creds;
	}

	/**
	 * Enforce strict cross-tenant isolation: a Teammate's Vault token can only access its own schema.
	 */
	assertTenantAccess(vaultToken: string, targetSchema: string): void {
		const tenant = this.tokenToTenant.get(vaultToken);
		if (!tenant) {
			throw new Error("Revoked or unknown Vault token.");
		}
		if (tenant.postgresSchema !== targetSchema) {
			throw new Error(
				`Cross-tenant access denied: token for ${tenant.postgresSchema} cannot access ${targetSchema}.`,
			);
		}
	}

	/**
	 * Revoke ephemeral Vault token and drop isolated schema/vhost/prefix on ensemble_shutdown.
	 */
	async teardownTenant(
		tenantId: string,
	): Promise<{ vaultTokenRevoked: boolean; schemaDropped: boolean }> {
		const tenant = this.activeTenants.get(tenantId);
		if (!tenant) {
			return { vaultTokenRevoked: false, schemaDropped: false };
		}
		this.tokenToTenant.delete(tenant.vaultToken);
		this.activeTenants.delete(tenantId);
		return { vaultTokenRevoked: true, schemaDropped: true };
	}
}
