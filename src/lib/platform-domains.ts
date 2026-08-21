/**
 * Platform custom-domain provisioning (SSL + DNS record values).
 * Calls the hosting provider GraphQL API when configured.
 * Never surface provider brand names in product UI — say "platform".
 */

export type PlatformDnsRecords = {
  hostname: string;
  externalId: string;
  cnameHost: string | null;
  cnameTarget: string | null;
  txtHost: string | null;
  txtValue: string | null;
  verificationToken: string | null;
};

export type PlatformDomainResult =
  | { ok: true; records: PlatformDnsRecords; alreadyExisted?: boolean }
  | { ok: false; error: string; configured: boolean };

type GqlDnsRecord = {
  hostlabel?: string | null;
  requiredValue?: string | null;
  currentValue?: string | null;
  status?: string | null;
};

type GqlCustomDomain = {
  id: string;
  domain: string;
  status?: {
    verificationToken?: string | null;
    certificateStatus?: string | null;
    dnsRecords?: GqlDnsRecord[] | null;
  } | null;
};

const API_URL = "https://backboard.railway.com/graphql/v2";

function apiToken(): string | null {
  return (
    process.env.PLATFORM_DOMAIN_API_TOKEN?.trim() ||
    process.env.RAILWAY_TOKEN?.trim() ||
    process.env.RAILWAY_API_TOKEN?.trim() ||
    null
  );
}

function projectIds(): {
  projectId: string;
  environmentId: string;
  serviceId: string;
} | null {
  const projectId = process.env.RAILWAY_PROJECT_ID?.trim();
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID?.trim();
  const serviceId = process.env.RAILWAY_SERVICE_ID?.trim();
  if (!projectId || !environmentId || !serviceId) return null;
  return { projectId, environmentId, serviceId };
}

export function isPlatformDomainApiConfigured(): boolean {
  return Boolean(apiToken() && projectIds());
}

async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data?: T; errors?: { message: string }[] }> {
  const token = apiToken();
  if (!token) throw new Error("Platform domain API token is not configured");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  return json;
}

function pickDns(records: PlatformDnsRecords, domain: GqlCustomDomain): PlatformDnsRecords {
  const dns = domain.status?.dnsRecords || [];
  const cname =
    dns.find((r) => (r.requiredValue || "").includes(".")) || dns[0];
  const token = domain.status?.verificationToken || null;
  // www subdomain: registrar zone is bare domain; TXT hostlabel is typically _railway-verify.www
  const txtHost = token
    ? domain.domain.startsWith("www.")
      ? "_railway-verify.www"
      : "_railway-verify"
    : null;
  return {
    ...records,
    externalId: domain.id,
    hostname: domain.domain,
    cnameHost:
      cname?.hostlabel || (domain.domain.startsWith("www.") ? "www" : "@"),
    cnameTarget: cname?.requiredValue || null,
    txtHost,
    txtValue: token,
    verificationToken: token,
  };
}

/**
 * Ensure www.<bare> is registered on the platform service and return DNS values
 * the host must paste at their registrar.
 */
export async function ensurePlatformCustomDomain(
  bareDomain: string,
): Promise<PlatformDomainResult> {
  const bare = bareDomain.replace(/^www\./, "").toLowerCase().trim();
  if (!bare || !bare.includes(".")) {
    return { ok: false, error: "Invalid domain", configured: true };
  }
  const hostname = `www.${bare}`;

  if (!isPlatformDomainApiConfigured()) {
    return {
      ok: false,
      configured: false,
      error:
        "Platform domain API is not configured. Ops must enable the hostname manually, then paste CNAME/TXT for the host.",
    };
  }

  const ids = projectIds()!;

  try {
    // List existing custom domains first
    const listed = await gql<{
      domains: { customDomains: GqlCustomDomain[] };
    }>(
      `query domains($projectId: String!, $environmentId: String!, $serviceId: String!) {
        domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) {
          customDomains {
            id
            domain
            status {
              verificationToken
              certificateStatus
              dnsRecords { hostlabel requiredValue currentValue status }
            }
          }
        }
      }`,
      ids,
    );

    if (listed.errors?.length) {
      return {
        ok: false,
        configured: true,
        error: listed.errors.map((e) => e.message).join("; "),
      };
    }

    const existing = listed.data?.domains?.customDomains?.find(
      (d) => d.domain.toLowerCase() === hostname,
    );
    if (existing) {
      return {
        ok: true,
        alreadyExisted: true,
        records: pickDns(
          {
            hostname,
            externalId: existing.id,
            cnameHost: null,
            cnameTarget: null,
            txtHost: null,
            txtValue: null,
            verificationToken: null,
          },
          existing,
        ),
      };
    }

    const created = await gql<{ customDomainCreate: GqlCustomDomain }>(
      `mutation customDomainCreate($input: CustomDomainCreateInput!) {
        customDomainCreate(input: $input) {
          id
          domain
          status {
            verificationToken
            certificateStatus
            dnsRecords { hostlabel requiredValue currentValue status }
          }
        }
      }`,
      {
        input: {
          projectId: ids.projectId,
          environmentId: ids.environmentId,
          serviceId: ids.serviceId,
          domain: hostname,
        },
      },
    );

    if (created.errors?.length) {
      return {
        ok: false,
        configured: true,
        error: created.errors.map((e) => e.message).join("; "),
      };
    }

    const domain = created.data?.customDomainCreate;
    if (!domain) {
      return {
        ok: false,
        configured: true,
        error: "Platform did not return a domain record",
      };
    }

    return {
      ok: true,
      records: pickDns(
        {
          hostname,
          externalId: domain.id,
          cnameHost: null,
          cnameTarget: null,
          txtHost: null,
          txtValue: null,
          verificationToken: null,
        },
        domain,
      ),
    };
  } catch (e) {
    return {
      ok: false,
      configured: true,
      error: e instanceof Error ? e.message : "Domain provisioning failed",
    };
  }
}
