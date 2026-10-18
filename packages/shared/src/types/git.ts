export interface GitCommitContext {
  commitSha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  changedFiles: string[];
  diffSummary?: string;
}

export interface GitHubPullRequestInfo {
  number: number;
  url: string;
  htmlUrl: string;
  branch: string;
  baseBranch: string;
  title: string;
  body: string;
  createdAt: string;
  merged: boolean;
}

export interface RepoContext {
  owner: string;
  repo: string;
  defaultBranch: string;
  installationId?: number;
  recentCommits: GitCommitContext[];
}
