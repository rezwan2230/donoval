# Perplexity Account Migration Checklist

Use this list when standing up the **new Perplexity Computer account** for the Donovan Legal × ConnexŪS AI project.

---

## A. Account-level setup

- [ ] Sign in to the new Perplexity account
- [ ] Confirm the account is Pro / Computer-enabled (subagents, connectors, file tools all available)
- [ ] Set timezone to **America/New_York**
- [ ] Add user profile: David Pierce · **david@ticoai.net** · Boca Raton, FL
- [ ] Note legacy address (not default): david@scaleagilesolutions.com

## B. Connectors to verify on the new account

Connector availability **must be confirmed live** on the new account — run `list_external_tools` first. The lists below are best-effort snapshots of two prior states and should be treated as guidance, not ground truth.

### Visible in the previous Perplexity session's connector block
| Connector | Purpose |
|---|---|
| **github_mcp_direct** | Push/pull `TicoAI/donovanLAW` |
| **gcal** | Schedule Donovan meetings |
| **outlook** | Email to Paul + team |
| **jira_mcp_merge** | Sprint tracking — historical reports of intermittent auth issues; no verified ticket ID on file |
| **confluence_mcp_merge** | Internal docs |
| **telegram_bot_api__pipedream** | Notifications |

### Reported as also available on the new account (verify)
| Connector | Likely purpose |
|---|---|
| **slack_direct** | Team comms |
| **onedrive** | Microsoft cloud storage |
| **google_drive** | Google cloud storage |
| **youtube_analytics_api__pipedream** | Channel analytics (if relevant) |

> **Action:** ask the agent to `list_external_tools` and reconcile against both tables above. Re-authorize anything DISCONNECTED. Anything missing should be added if relevant to the build.

## C. GitHub access

- [ ] Confirm the new account's GitHub connector is authorized to the **TicoAI** org
- [ ] Confirm visibility of `TicoAI/donovanLAW` (canonical, private)
- [ ] Verify push permissions by cloning + dry-run push
- [ ] **Do NOT push to** `TicoAI/donovan-law-site` (tagged `archive`/`duplicate`) or `TicoDavid/donovan-law-site` (legacy redirect)
- [ ] Decide repo hygiene: delete the duplicate or leave it tagged-archived

## D. GCP / Cloud Run access (only if doing infra work)

| Item | Value |
|---|---|
| GCP identity | theconnexusai@gmail.com |
| Project ID | donovan-law-site |
| Project number | 290683654730 |
| Billing | 018A80-117F09-F20035 |
| Region | us-east1 |
| Cloud Run service | donovan-law-site |
| Live URL | https://donovan-law-site-290683654730.us-east1.run.app |
| Cloud Build trigger | donovan-law-deploy (push to main → cloudbuild.yaml) |
| GitHub Connection | github-connexus (2nd-gen Developer Connect) |

`gcloud auth login --account theconnexusai@gmail.com` on the local Windows machine if needed.

## E. Skills to re-install

### `connexus-ai-doc` (REQUIRED for client docs)

Available as a portable tarball at `project-handoff/06-skills-and-scripts/connexus-ai-doc.tar.gz` (1.8MB) and as an unpacked folder at `project-handoff/06-skills-and-scripts/connexus-ai-doc/`.

Steps:
1. Download the tarball or the folder from the canonical repo (`TicoAI/donovanLAW`)
2. Upload to Perplexity Computer using the user-skill upload flow (or have the agent run `save_custom_skill`)
3. Verify by asking the agent: *"List my user skills"*
4. Test with: *"Generate a one-page test letter on ConnexŪS letterhead"*

> Skill folder name is `connexus-ai-doc` (lowercase, no accent — it's an identifier). Branded output renders as **ConnexŪS** and **RAGböx**.

## F. Files the new agent needs to read first

1. `project-handoff/HANDOFF.md` — full state snapshot
2. `project-handoff/STARTER-PROMPT.md` — paste-able first message
3. `project-handoff/05-session-thread/turns/turn_0008.md` — last action taken
4. `project-handoff/01-strategy/donovan-redesign-plan.md` — current enhancement plan
5. `project-handoff/01-strategy/legal-concierge-strategy-v2.md` — master strategy v2.1
6. `project-handoff/02-meeting/donovan-meeting-minutes-2026-05-13.pdf` — what we agreed

## G. Things the new account CANNOT inherit automatically

| Thing | How to recreate |
|---|---|
| Workspace files at `/home/user/workspace/` | Re-clone the repo; everything important is in `project-handoff/` |
| `current_session_context/turns/` | Already copied to `project-handoff/05-session-thread/` |
| User memory (preferences, prior context) | Will rebuild organically; key facts already in HANDOFF.md |
| Open subagent state | None active at migration time |
| Pending scheduled tasks (cron) | None active at migration time |
| Email draft to Paul | Captured verbatim in `05-session-thread/turns/turn_0006.md`; do not send without explicit go-ahead |

## H. First task on new account

1. Paste `STARTER-PROMPT.md` into Perplexity Computer on the new account
2. Confirm agent has read HANDOFF.md and lists no gaps
3. **Then** decide whether to:
   - Send the drafted kickoff email to Paul + team, OR
   - Proceed straight to Phase 1 engineering (voice agent on donovan.law)

---

*Last updated: May 15, 2026 10:17 AM EDT (revised after canonical-repo + brand-spelling audit)*
