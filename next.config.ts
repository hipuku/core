import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next dev writes an AGENTS.md when it detects a coding agent. This repo
  // carries no agent instruction files, so it is off. It replaces the
  // patch-package patch that did the same before Next 16.4.
  agentRules: false,
};

export default nextConfig;
