import { execSync } from 'child_process'

function getGitInfo() {
  try {
    const branch = process.env.VERCEL_GIT_COMMIT_REF ||
      execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
    const sha = process.env.VERCEL_GIT_COMMIT_SHA ||
      execSync('git rev-parse HEAD').toString().trim()
    return { branch, commit: sha.slice(0, 7) }
  } catch {
    return { branch: 'unknown', commit: 'unknown' }
  }
}

const { branch, commit } = getGitInfo()

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_GIT_BRANCH: branch,
    NEXT_PUBLIC_GIT_COMMIT: commit,
  },
}

export default nextConfig
