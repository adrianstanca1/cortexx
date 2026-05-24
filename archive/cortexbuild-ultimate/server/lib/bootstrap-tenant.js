/**
 * Create organization + company rows (expects an active transaction on client).
 * @param {import('pg').PoolClient} client
 * @param {{ orgName: string, companyName?: string }} opts
 * @returns {Promise<{ organizationId: string, companyId: string }>}
 */
async function insertOrgAndCompany(client, { orgName, companyName }) {
  const name = orgName.trim();
  const comp = (companyName || name).trim();
  const { rows: [org] } = await client.query(
    `INSERT INTO organizations (id, name, description)
     VALUES (gen_random_uuid(), $1, $2)
     RETURNING id`,
    [name, `${name} organization`]
  );
  const { rows: [company] } = await client.query(
    `INSERT INTO companies (id, organization_id, name, country)
     VALUES (gen_random_uuid(), $1, $2, 'UK')
     RETURNING id`,
    [org.id, comp]
  );
  return { organizationId: org.id, companyId: company.id };
}

/**
 * Attach org + company to an **existing** user row (separate transaction).
 * Do **not** use for OAuth first signup — if INSERT user happened first and this fails, the user is orphaned.
 * Prefer `createOAuthUserWithTenant`. Keep this for one-off scripts / backfills only.
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {{ orgName: string, companyName?: string }} opts
 */
async function attachNewTenantToUser(pool, userId, { orgName, companyName }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { organizationId, companyId } = await insertOrgAndCompany(client, {
      orgName,
      companyName,
    });
    const comp = (companyName || orgName).trim();
    await client.query(
      `UPDATE users
       SET organization_id = $1, company_id = $2,
           company = CASE WHEN TRIM(COALESCE(company, '')) = '' THEN $3 ELSE company END
       WHERE id = $4`,
      [organizationId, companyId, comp, userId]
    );
    await client.query('COMMIT');
    return { organizationId, companyId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Single transaction: org + company + OAuth user (+ optional oauth_providers row).
 * @param {import('pg').Pool} pool
 * @param {{ email: string, name: string, avatarUrl?: string | null }} profile
 * @param {{ orgName: string, companyName?: string }} tenantOpts
 * @param {null | { provider: string, providerUserId: string, accessToken: string, refreshToken: string | null, email: string }} oauthLink
 */
async function createOAuthUserWithTenant(
  pool,
  { email, name, avatarUrl = null },
  { orgName, companyName },
  oauthLink = null
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { organizationId, companyId } = await insertOrgAndCompany(client, {
      orgName,
      companyName,
    });
    const comp = (companyName || orgName).trim();
    const { rows } = await client.query(
      `INSERT INTO users (email, name, avatar, role, organization_id, company_id, company)
       VALUES ($1, $2, $3, 'company_owner', $4, $5, $6)
       RETURNING *`,
      [email.toLowerCase(), name, avatarUrl, organizationId, companyId, comp]
    );
    const user = rows[0];
    if (oauthLink) {
      await client.query(
        `INSERT INTO oauth_providers (user_id, provider, provider_user_id, access_token, refresh_token, email)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user.id,
          oauthLink.provider,
          oauthLink.providerUserId,
          oauthLink.accessToken,
          oauthLink.refreshToken,
          oauthLink.email,
        ]
      );
    }
    await client.query('COMMIT');
    return user;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { insertOrgAndCompany, attachNewTenantToUser, createOAuthUserWithTenant };
