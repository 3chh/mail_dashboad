const activeJobs = new Set<string>();

export function markJobRunning(jobId: string) {
  if (activeJobs.has(jobId)) {
    return false;
  }

  activeJobs.add(jobId);
  return true;
}

export function markJobFinished(jobId: string) {
  activeJobs.delete(jobId);
}
