const WILDCARD = "*";

export interface GitHubOidcSubjectsOptions {
  /** GitHub organization (or user) that owns the repository */
  organization: string;
  /**
   * Numeric organization id, from `CDK_ENV_REPO_ORGANIZATION_ID`,
   * `PROJECT_REPO_ORGANIZATION_ID`, or a construct prop. Wildcarded when
   * absent.
   */
  organizationId?: string;
  /** Repository name, without the organization. Wildcarded when absent. */
  repository?: string;
  /** Numeric repository id. Wildcarded when absent. */
  repositoryId?: string;
}

/**
 * The `sub` claim patterns a GitHub Actions OIDC token can present for a
 * repository, or for every repository in an organization.
 *
 * GitHub issues newer repositories an id-embedded subject:
 *
 *     repo:acme@162184378/widget@1339091097:environment:sandbox
 *
 * where the trailing numbers are the organization and repository ids. Older
 * repositories still present the plain `repo:<org>/<repo>:*` form, and a
 * repo-level subject template does not remove the ids. A trust policy has to
 * accept both, so this returns both — IAM takes an array of `StringLike`
 * values and matches on any one of them.
 *
 * An unknown id is wildcarded rather than omitted. GitHub names cannot contain
 * `@`, so `acme@*` can only be satisfied by an id-embedded subject for the
 * organization named `acme`; a similarly named organization does not match.
 * Supplying the id pins the pattern, which keeps the wildcard rename-safe.
 */
export function githubOidcSubjects({
  organization,
  organizationId = WILDCARD,
  repository = WILDCARD,
  repositoryId = WILDCARD,
}: GitHubOidcSubjectsOptions): string[] {
  const identified =
    repository === WILDCARD ? WILDCARD : `${repository}@${repositoryId}`;
  return [
    `repo:${organization}/${repository}:*`,
    `repo:${organization}@${organizationId}/${identified}:*`,
  ];
}
