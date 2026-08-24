export function buildContextBlock(profileName: string, memories: string[]): string {
  const lines = [
    "[Memory Wallet Context]",
    `Profile: ${profileName}`,
    ...memories.map((m) => `- ${m}`),
    "[End Memory Wallet Context]",
  ];
  return lines.join("\n");
}
