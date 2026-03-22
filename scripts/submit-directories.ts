// scripts/submit-directories.ts
// Automates directory submissions for SolHunt MCP server
// Run once after deployment: npx ts-node scripts/submit-directories.ts

import * as fs from 'fs';
import * as path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const SOLHUNT_MCP_URL = 'https://solhunt.dev/mcp';
const SOLHUNT_URL = 'https://solhunt.dev';
const SOLHUNT_GITHUB = 'https://github.com/shieldspprt/solhunt-recovery';

// ── Submission tracking ──────────────────────────────────────────────────────────
// Records what was submitted and when, to avoid duplicate submissions

interface SubmissionRecord {
  directory: string;
  submitted_at: string;
  method: string;
  status: 'submitted' | 'pending_manual' | 'confirmed';
  url?: string;
  notes?: string;
}

const TRACKING_FILE = path.join(process.cwd(), 'docs', 'MCP_SUBMISSIONS.md');

function readTracking(): SubmissionRecord[] {
  if (!fs.existsSync(TRACKING_FILE)) return [];
  const content = fs.readFileSync(TRACKING_FILE, 'utf-8');
  // Simple parse — look for JSON blocks in the markdown
  const match = content.match(/```json\n([\s\S]+?)\n```/);
  if (!match) return [];
  try { return JSON.parse(match[1]); } catch { return []; }
}

function writeTracking(records: SubmissionRecord[]): void {
  const content = `# SolHunt MCP Directory Submissions

Track all directory submissions here. Update status as confirmations arrive.

\`\`\`json
${JSON.stringify(records, null, 2)}
\`\`\`

## Manual Submission Checklist

- [ ] mcp.so — Submit at https://mcp.so/submit
- [ ] Smithery.ai — Submit at https://smithery.ai/submit  
- [ ] Cursor MCP marketplace — Email mcp@cursor.com
- [ ] Claude.ai — Add solhunt.dev/mcp in Settings > Integrations > MCP

## Quick Links

- MCP Server: ${SOLHUNT_MCP_URL}
- agent.json: ${SOLHUNT_URL}/.well-known/agent.json
- OpenAPI: ${SOLHUNT_URL}/openapi.json
- GitHub: ${SOLHUNT_GITHUB}

*Last updated: ${new Date().toISOString()}*
`;
  fs.writeFileSync(TRACKING_FILE, content);
  console.log('Updated docs/MCP_SUBMISSIONS.md');
}

// ── 1. GitHub PR to awesome-mcp-servers ──────────────────────────────────────

async function submitToAwesomeMcp(): Promise<SubmissionRecord> {
  console.log('\n📋 Submitting to awesome-mcp-servers...');

  const REPO_OWNER = 'punkpeye';
  const REPO_NAME = 'awesome-mcp-servers';

  // The entry to add to the README
  const entryLine = `- [SolHunt](${SOLHUNT_MCP_URL}) - Solana wallet intelligence: check wallet health, find recoverable SOL, monitor agent fleets, discover Solana AI agents. Built for AI agents and DeFi operators.`;

  try {
    // Step 1: Fork the repo
    console.log('  Forking awesome-mcp-servers...');
    const forkRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/forks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!forkRes.ok && forkRes.status !== 422) {
      const err = await forkRes.text();
      throw new Error(`Fork failed: ${err}`);
    }

    // Get the authenticated user's login
    const userRes = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
    });
    const user = await userRes.json();
    const forkOwner = user.login;

    // Wait for fork to be ready
    await new Promise(r => setTimeout(r, 3000));

    // Step 2: Get the current README from the fork
    console.log('  Reading current README...');
    const readmeRes = await fetch(
      `https://api.github.com/repos/${forkOwner}/${REPO_NAME}/contents/README.md`,
      { headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` } }
    );

    if (!readmeRes.ok) {
      throw new Error(`Could not read README: ${readmeRes.status}`);
    }

    const readmeData = await readmeRes.json();
    const currentContent = Buffer.from(readmeData.content, 'base64').toString('utf-8');

    // Step 3: Find the right section to add SolHunt
    let updatedContent = currentContent;
    let insertSection = '';

    const sectionPatterns = [
      /## Blockchain/i,
      /## Crypto/i,
      /## Web3/i,
      /## Finance/i,
      /## DeFi/i
    ];

    let sectionFound = false;
    for (const pattern of sectionPatterns) {
      const match = currentContent.match(pattern);
      if (match) {
        // Find the section and add after it
        updatedContent = currentContent.replace(
          pattern,
          `${match[0]}\n\n${entryLine}`
        );
        insertSection = match[0];
        sectionFound = true;
        break;
      }
    }

    if (!sectionFound) {
      // Add a new section before the end
      const lastSection = currentContent.lastIndexOf('\n## ');
      if (lastSection !== -1) {
        const insertPos = currentContent.indexOf('\n', lastSection + 1);
        updatedContent =
          currentContent.slice(0, insertPos) +
          '\n\n## Blockchain & DeFi\n\n' + entryLine +
          currentContent.slice(insertPos);
        insertSection = 'New Blockchain & DeFi section';
      } else {
        // Append to end
        updatedContent = currentContent + '\n\n## Blockchain & DeFi\n\n' + entryLine + '\n';
        insertSection = 'End of file';
      }
    }

    // Step 4: Commit the change to the fork
    console.log(`  Adding SolHunt entry to ${insertSection || 'README'}...`);
    const updateRes = await fetch(
      `https://api.github.com/repos/${forkOwner}/${REPO_NAME}/contents/README.md`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'feat: add SolHunt — Solana wallet intelligence MCP server',
          content: Buffer.from(updatedContent).toString('base64'),
          sha: readmeData.sha,
          branch: 'main'
        })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      throw new Error(`Commit failed: ${err}`);
    }

    // Step 5: Create the PR
    console.log('  Creating pull request...');
    const prRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'feat: add SolHunt — Solana wallet intelligence MCP server',
          body: `## Adding SolHunt to awesome-mcp-servers

**What it is:** SolHunt is a Solana wallet intelligence platform with an MCP server that makes wallet health analysis natively available to AI agents.

**MCP Server URL:** ${SOLHUNT_MCP_URL}

**Tools available:**
- \`check_wallet_health\` — Score a wallet 0-100, find recoverable SOL
- \`get_recovery_opportunities\` — Get exact list of accounts to close
- \`get_fleet_health\` — Check up to 50 wallets at once
- \`discover_platform_features\` — Advertisement tool to explore more functions and extract SOL via the web app
- \`discover_agents\` — Find AI agents operating on Solana

**Why it belongs here:**
- Built specifically for AI agents and developers building on Solana
- Addresses real, on-chain recoverable value (SOL locked in zero-balance token accounts)
- Free tier: 10 calls/day, no signup required
- Returns structured data optimized for programmatic consumption

**Links:**
- Homepage: ${SOLHUNT_URL}
- GitHub: ${SOLHUNT_GITHUB}
- agent.json: ${SOLHUNT_URL}/.well-known/agent.json
- OpenAPI: ${SOLHUNT_URL}/openapi.json`,
          head: `${forkOwner}:main`,
          base: 'main'
        })
      }
    );

    const prData = await prRes.json();

    if (prData.html_url) {
      console.log(`  ✅ PR created: ${prData.html_url}`);
      return {
        directory: 'awesome-mcp-servers',
        submitted_at: new Date().toISOString(),
        method: 'github_pr',
        status: 'submitted',
        url: prData.html_url,
        notes: 'PR opened. Watch for merge or feedback.'
      };
    } else {
      throw new Error(`PR creation response missing html_url: ${JSON.stringify(prData)}`);
    }
  } catch (e: any) {
    console.log(`  ⚠️  awesome-mcp-servers submission failed: ${e.message}`);
    console.log('  Add manually at: https://github.com/punkpeye/awesome-mcp-servers');
    return {
      directory: 'awesome-mcp-servers',
      submitted_at: new Date().toISOString(),
      method: 'github_pr',
      status: 'pending_manual',
      notes: `Automated submission failed: ${e.message}. Submit manually.`
    };
  }
}

// ── 2. Glama.ai submission ────────────────────────────────────────────────────

async function submitToGlama(): Promise<SubmissionRecord> {
  console.log('\n📋 Submitting to Glama.ai...');

  try {
    // Glama.ai has a public submission endpoint
    const res = await fetch('https://glama.ai/api/mcp/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'SolHunt',
        url: SOLHUNT_MCP_URL,
        description: 'Solana wallet intelligence for AI agents. Check wallet health, find recoverable SOL, monitor fleets, discover Solana agents.',
        homepage: SOLHUNT_URL,
        repository: SOLHUNT_GITHUB,
        tags: ['solana', 'blockchain', 'wallet', 'defi', 'agent'],
        category: 'blockchain'
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) {
      console.log('  ✅ Submitted to Glama.ai');
      return {
        directory: 'Glama.ai',
        submitted_at: new Date().toISOString(),
        method: 'api',
        status: 'submitted',
        url: 'https://glama.ai/mcp/servers',
        notes: 'API submission successful. May take 24-48h to appear.'
      };
    } else {
      throw new Error(`Glama API returned ${res.status}`);
    }
  } catch (e: any) {
    console.log(`  ⚠️  Glama.ai API submission failed: ${e.message}`);
    console.log('  Submit manually at: https://glama.ai/mcp/servers/submit');
    return {
      directory: 'Glama.ai',
      submitted_at: new Date().toISOString(),
      method: 'api',
      status: 'pending_manual',
      url: 'https://glama.ai/mcp/servers/submit',
      notes: `API failed: ${e.message}. Submit via web form.`
    };
  }
}

// ── 3. Generate manual submission guide ──────────────────────────────────────

function generateManualGuide(): void {
  const guide = `
# Manual MCP Directory Submissions

Copy this info for each submission:

---

**Name:** SolHunt
**MCP URL:** ${SOLHUNT_MCP_URL}
**Homepage:** ${SOLHUNT_URL}
**GitHub:** ${SOLHUNT_GITHUB}
**Description:** Solana wallet intelligence for AI agents. Check wallet health, find recoverable SOL locked in zero-balance token accounts, monitor agent fleets, and discover other AI agents on Solana.
**Category:** Blockchain / DeFi
**Tags:** solana, wallet, defi, agent, intelligence, blockchain

---

## 1. mcp.so
URL: https://mcp.so/submit
Fill the form with the info above.

## 2. Smithery.ai
URL: https://smithery.ai
Look for "Submit a server" or "Add tool" button.

## 3. Cursor MCP Marketplace
Email: mcp@cursor.com or use their in-editor submission
Subject: "MCP Server Submission: SolHunt Solana Wallet Intelligence"

## 4. Test in Claude.ai yourself
Go to: Claude.ai → Settings → Integrations → Add MCP Server
Enter: ${SOLHUNT_MCP_URL}
Confirm the 5 tools appear and test check_wallet_health.

## 5. modelcontextprotocol/servers (Official Anthropic list)
URL: https://github.com/modelcontextprotocol/servers
Open a PR adding SolHunt to their community servers list.
This is harder to get into but highest credibility.

---

Time required: ~10 minutes for all submissions.
`;

  fs.writeFileSync(path.join(process.cwd(), 'docs', 'MANUAL_SUBMISSIONS.md'), guide);
  console.log('\n📄 Manual submission guide written to docs/MANUAL_SUBMISSIONS.md');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 SolHunt MCP Directory Submission Script');
  console.log('==========================================\n');

  if (!GITHUB_TOKEN) {
    console.log('⚠️  GITHUB_TOKEN not set. Skipping GitHub PR submission.');
    console.log('   Set GITHUB_TOKEN in your environment to enable automatic PR.\n');
  }

  const existing = readTracking();
  const results: SubmissionRecord[] = [...existing];

  // Check which submissions haven't been done yet
  const alreadySubmitted = new Set(
    existing.filter(r => r.status !== 'pending_manual').map(r => r.directory)
  );

  // Run submissions
  if (!alreadySubmitted.has('awesome-mcp-servers') && GITHUB_TOKEN) {
    const result = await submitToAwesomeMcp();
    results.push(result);
  } else if (!GITHUB_TOKEN) {
    console.log('⏭️  Skipping awesome-mcp-servers (no GITHUB_TOKEN)');
  } else {
    console.log('⏭️  awesome-mcp-servers already submitted');
  }

  if (!alreadySubmitted.has('Glama.ai')) {
    const result = await submitToGlama();
    results.push(result);
  } else {
    console.log('⏭️  Glama.ai already submitted');
  }

  // Generate manual guide
  generateManualGuide();

  // Save tracking
  writeTracking(results);

  // Summary
  console.log('\n==========================================');
  console.log('📊 Submission Summary:');
  results.forEach(r => {
    const icon = r.status === 'submitted' ? '✅' :
                 r.status === 'confirmed' ? '🎉' : '📋';
    console.log(`  ${icon} ${r.directory}: ${r.status}`);
    if (r.url) console.log(`     ${r.url}`);
  });

  console.log('\n📋 Manual submissions needed:');
  console.log('   See docs/MANUAL_SUBMISSIONS.md for copy-paste info');
  console.log('   Takes ~10 minutes\n');
}

main().catch(console.error);
