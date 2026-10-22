#!/usr/bin/env node
/**
 * PreToolUse guard — blocks irreversible actions.
 *
 * This is the only enforcement layer that is not advisory. Rules in
 * .claude/rules/ shape behaviour; this file prevents specific outcomes.
 * Keep the list short and limited to things that cannot be undone.
 *
 * Deliberately fails OPEN: a crash here must not brick the session. If the
 * guard stops working you lose protection, not the ability to work.
 *
 * Plain Node, no dependencies, no shell — identical behaviour on WSL,
 * Windows, and macOS/Linux.
 */

'use strict';

const PROTECTED_BRANCHES = ['master', 'main', 'staging', 'dev', 'aws_production'];

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

function allow() {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Bash
// ---------------------------------------------------------------------------

function checkBash(command) {
  const cmd = String(command || '');
  const flat = cmd.replace(/\s+/g, ' ').trim();

  if (/\bgit\s+push\b/.test(flat)) {
    // --force-with-lease is permitted; a bare --force / -f is not.
    if (/--force(?!-with-lease)\b|(?:^|\s)-f(?=\s|$)/.test(flat)) {
      deny(
        'Force push blocked. It rewrites history other people may have pulled. ' +
          'If you genuinely need it, use --force-with-lease on your own branch, ' +
          'or ask a human to run it.'
      );
    }
    if (/--delete\b|(?:^|\s)-d(?=\s|$)/.test(flat)) {
      deny('Deleting a remote branch is blocked. Ask a human to do it.');
    }
    const target = flat.match(
      new RegExp(`\\bgit\\s+push\\b.*?(?:HEAD:)?\\b(${PROTECTED_BRANCHES.join('|')})\\b`)
    );
    if (target) {
      deny(
        `Direct push to '${target[1]}' is blocked — it is a protected branch and some ` +
          'deploy on push. Create a working branch and open a pull request. ' +
          'See .claude/rules/git.md.'
      );
    }
  }

  if (/--no-verify\b/.test(flat)) {
    deny(
      '--no-verify is blocked. It skips the lint and typecheck hooks. ' +
        'Fix what the hook reported instead of bypassing it.'
    );
  }

  if (/\bgit\s+reset\s+(?:.*\s)?--hard\b/.test(flat)) {
    deny(
      'git reset --hard is blocked — it discards uncommitted work irreversibly. ' +
        'Use git stash, or ask a human.'
    );
  }

  if (/\bgit\s+clean\b.*(?:-[a-zA-Z]*f|--force)/.test(flat)) {
    deny('git clean -f is blocked — it deletes untracked files irreversibly.');
  }

  // rm -rf against a dangerous target. Scoped deletes (node_modules, dist,
  // .next) are ordinary maintenance and stay allowed.
  const rmMatch = flat.match(/\brm\s+((?:-\S+\s+)+)(.*)/);
  if (rmMatch) {
    const flags = rmMatch[1];
    const hasR = /-[a-zA-Z]*[rR]/.test(flags);
    const hasF = /-[a-zA-Z]*f/.test(flags);
    if (hasR && hasF) {
      const targets = rmMatch[2].split(/\s+/).filter(Boolean);
      for (const t of targets) {
        const bare = t.replace(/^["']|["']$/g, '');
        if (
          /^[/~]/.test(bare) ||
          bare === '.' ||
          bare === '..' ||
          bare === '*' ||
          /\/\*$/.test(bare) ||
          bare === '$HOME'
        ) {
          deny(
            `Recursive force delete of '${bare}' is blocked. Scoped deletes such as ` +
              'node_modules or dist are fine; this target is not.'
          );
        }
      }
    }
  }

  if (/\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE?)\b/i.test(flat)) {
    deny(
      'Destructive SQL (DROP / TRUNCATE) is blocked. Schema changes belong in a ' +
        'TypeORM migration; ask a human before running this against any database.'
    );
  }

  if (/\bdocker\s+volume\s+(rm|prune)\b/.test(flat)) {
    deny('Removing a Docker volume is blocked — it destroys local database state.');
  }

  allow();
}

// ---------------------------------------------------------------------------
// File access
// ---------------------------------------------------------------------------

function checkPath(filePath) {
  const p = String(filePath || '').replace(/\\/g, '/');
  const base = p.split('/').pop() || '';

  const isExample = /\.example$|\.sample$|\.template$/.test(base);

  if (/^\.env(\..+)?$/.test(base) && !isExample) {
    deny(
      `${base} holds real credentials and is off limits. Key names are in ` +
        '.env.example. See .claude/rules/security.md.'
    );
  }

  if (/\.(pem|key|p12|pfx)$/.test(base) || /^id_(rsa|ed25519|ecdsa)/.test(base)) {
    deny(`${base} looks like a private key. Access is blocked.`);
  }

  if (/(^|\/)\.git\//.test(p)) {
    deny('Direct edits inside .git/ are blocked. Use git commands instead.');
  }

  allow();
}

// ---------------------------------------------------------------------------

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`guard.js: could not parse hook input (${err.message})\n`);
    allow(); // fail open
  }

  try {
    const tool = payload.tool_name;
    const input = payload.tool_input || {};

    if (tool === 'Bash') {
      checkBash(input.command);
    } else if (['Read', 'Edit', 'Write', 'NotebookEdit'].includes(tool)) {
      checkPath(input.file_path || input.notebook_path);
    }
  } catch (err) {
    process.stderr.write(`guard.js: ${err.message}\n`);
  }

  allow();
});