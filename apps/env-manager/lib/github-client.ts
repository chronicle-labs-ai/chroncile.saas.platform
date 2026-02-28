import { Octokit } from "@octokit/rest";

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  return new Octokit({ auth: token });
}

function getOwnerRepo(): { owner: string; repo: string } {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!owner || !repo) {
    throw new Error("GITHUB_OWNER and GITHUB_REPO must be set");
  }
  return { owner, repo };
}

export interface Branch {
  name: string;
  sha: string;
  isDefault: boolean;
}

export async function listBranches(): Promise<Branch[]> {
  const octokit = getOctokit();
  const { owner, repo } = getOwnerRepo();

  const repoData = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.data.default_branch;

  const branches: Branch[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data } = await octokit.repos.listBranches({
      owner,
      repo,
      per_page: perPage,
      page,
    });

    for (const b of data) {
      branches.push({
        name: b.name,
        sha: b.commit.sha,
        isDefault: b.name === defaultBranch,
      });
    }

    if (data.length < perPage) break;
    page++;
  }

  return branches;
}

export interface BranchInfo {
  name: string;
  sha: string;
  message: string;
  author: string;
  date: string;
}

export async function getBranchInfo(branch: string): Promise<BranchInfo> {
  const octokit = getOctokit();
  const { owner, repo } = getOwnerRepo();

  const { data } = await octokit.repos.getBranch({ owner, repo, branch });
  const commit = data.commit;

  return {
    name: data.name,
    sha: commit.sha,
    message: commit.commit.message,
    author: commit.commit.author?.name ?? "unknown",
    date: commit.commit.author?.date ?? new Date().toISOString(),
  };
}
