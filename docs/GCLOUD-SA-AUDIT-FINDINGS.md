# ADAM — GCLOUD SERVICE-ACCOUNT / IDENTITY AUDIT FINDINGS

**Order:** ADAM-145-GCLOUD-SA-AUDIT-R1 · **Issue:** #145 · **Date:** 2026-08-07
**Agent:** ADAM (DevOps) · **Mode:** read-only. No IAM binding, service, project, API, or workflow was modified.

---

## Bottom line

The prior audit ran under an **impersonated service account that can reach 1 project**. The
correct principal reaches **7**. The delta is **6 projects (86% of the estate) that the prior
audit could not see** — and it reported no error while blind, because the impersonation notice
goes to **stderr** and the failure surfaces as a clean empty result, not a denial.

Re-run under the correct principal, the estate holds **19 public (`allUsers`) grants** —
17 `roles/run.invoker` on Cloud Run services and 2 `roles/cloudfunctions.invoker` on gen-1
functions. **Zero** `allAuthenticatedUsers` bindings anywhere.

A further gap sits **outside the "7 total" premise**: a project (`ad-retriever`) exists that
the correct principal also cannot see. The estate is **at least 8 projects**. See §4.

Per the STOP condition: the correct principal sees 7 of 7 stated projects, so no widening was
attempted. Where it sees fewer than the true estate, the gap is recorded and **left open** — no
access change was requested or made.

---

## 1. Identities in the current gcloud auth context

`gcloud auth list` shows three credentials, but the identity that actually executes API calls is
a **fourth** one, injected by the active config's impersonation setting.

| # | Principal | Kind | In `auth list`? | Executes calls? | Projects reached | Notes |
|---|---|---|---|---|---|---|
| 1 | `david@ticoai.net` | Human (Workspace) | Yes — **ACTIVE** | Only with impersonation disabled | **7** | **← the principal every audit must run as** |
| 2 | `agent-cli@tico-ai-prod.iam.gserviceaccount.com` | Service account | **No** | **Yes — by default** | **1** (`tico-ai-prod`) | Injected by `[auth] impersonate_service_account` in config `agent`. Cause of the 1-of-7 blindness. |
| 3 | `theconnexusai@gmail.com` | Human (consumer) | Yes — inactive | On `--account=` | **1** (`ad-retriever`) | Reaches a project **no other identity can see** (§4) |
| 4 | `ragbox-sa@ragbox-sovereign-prod.iam.gserviceaccount.com` | Service account | Yes — inactive | **No** | **0** | Credential is dead: `invalid_grant: account not found` |

**Impersonation capability — confirmed by policy read, not inference:**
`david@ticoai.net` holds `roles/iam.serviceAccountTokenCreator` on `agent-cli`
(etag `BwZXx8giBGs=`), which is what lets the config silently downgrade every call.

**Active config (the defect):**

```
[auth] impersonate_service_account = agent-cli@tico-ai-prod.iam.gserviceaccount.com
[core] account = david@ticoai.net
Active configuration: [agent]
```

### The trap, stated precisely

`--account=david@ticoai.net` **alone does not defeat impersonation.** Measured both ways:

| Arm | Command | Projects returned |
|---|---|---|
| A — default | `gcloud projects list` | **1** |
| B — `--account` only | `gcloud projects list --account=david@ticoai.net` | **1** ← still blind |
| C — impersonation disabled | `CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT= gcloud projects list --account=david@ticoai.net` | **7** |

`--account` selects which credential *mints the impersonation token*; it does not stop the
impersonation. **The empty-string env prefix is the only load-bearing part of the command line.**
A remediation that drops it looks correct and changes nothing.

Two further ways this reads as clean when it is not:

- **The error message actively misleads.** A denial incurred *while impersonating* still ends
  `"This command is authenticated as david@ticoai.net"` — naming the human account for a refusal
  the service account caused.
- **Never merge streams to count.** `gcloud projects list 2>&1 | grep -c .` returns **2**, not 1 —
  the stderr `WARNING:` is counted as a project row. Measure **stdout only**.

**Every command in this document was run with the §Reproduction prefix.**

---

## 2. Projects reachable by the correct principal

All 7 `ACTIVE`. Billing read bottom-up per project (`billing accounts list` is role-scoped and is
never an estate inventory).

| Project ID | Number | Lifecycle | Billing | Billing account | Source |
|---|---|---|---|---|---|
| `convodojo` | 488190987753 | ACTIVE | **False** | — | `projects list` + `billing projects describe` |
| `donovan-law-site` | 290683654730 | ACTIVE | **False** | — | idem |
| `mediamagic-prod` | 787245271387 | ACTIVE | **False** | — | idem |
| `platinum-bivouac-tgh3w` | 431919082599 | ACTIVE | True | `0194ED-C51035-F9189D` | idem |
| `ragbox-sovereign-prod` | 100739220279 | ACTIVE | True | `018A80-117F09-F20035` | idem |
| `tico-ai-ops` | 444835923080 | ACTIVE | True | `018A80-117F09-F20035` | idem |
| `tico-ai-prod` | 418029748257 | ACTIVE | True | `018A80-117F09-F20035` | idem |

**Billing is the live/dead axis.** A project with `billingEnabled: False` keeps its Cloud Run
services at `Ready=True` while **every request 5xxs**. Readiness is not liveness here.

---

## 3. Public-facing IAM inventory

### 3a. CONFIRMED public grants — 19 total, all `allUsers`

| Project | Resource | Region | Role | Live / Dead | Basis |
|---|---|---|---|---|---|
| `convodojo` | `convodojo-frontend` | us-east1 | `run.invoker` | **DEAD** | billing off |
| `convodojo` | `convodojo-frontend-v2` | us-east1 | `run.invoker` | **DEAD** | billing off |
| `convodojo` | `convodojo-relay` | us-east1 | `run.invoker` | **DEAD** | billing off |
| `convodojo` | `convodojo-voice` | us-east1 | `run.invoker` | **DEAD** | billing off |
| `ragbox-sovereign-prod` | `mercury-voice` | us-east4 | `run.invoker` | **DEGRADED** | `Ready=False`, billing on |
| `ragbox-sovereign-prod` | `ragbox-app` | us-east4 | `run.invoker` | **LIVE** | Ready=True, billing on |
| `ragbox-sovereign-prod` | `ragbox-backend` | us-east4 | `run.invoker` | **LIVE** | idem |
| `tico-ai-prod` | `athena-preview` | us-east4 | `run.invoker` | **LIVE** | idem |
| `tico-ai-prod` | `connexus-mcp` | us-east4 | `run.invoker` | **LIVE** | idem |
| `tico-ai-prod` | `connexus-site-staging` | us-east4 | `run.invoker` | **LIVE** | idem |
| `tico-ai-prod` | `performance-hub-api` | us-east4 | `run.invoker` | **LIVE** | idem |
| `tico-ai-prod` | `ragbrain-api` | us-central1 | `run.invoker` | **LIVE** | idem |
| `tico-ai-prod` | `visium-command-portal` | us-east4 | `run.invoker` | **LIVE** | idem |
| `tico-ai-prod` | `visium-ir-cc` | us-east4 | `run.invoker` | **LIVE** | idem |
| `tico-ai-prod` | `visium-mcp` | us-east4 | `run.invoker` | **LIVE** | idem |
| `tico-ai-prod` | `visium-portal` | us-east4 | `run.invoker` | **LIVE** | idem |
| `tico-ai-prod` | `webhook-receiver` | us-east4 | `run.invoker` | **LIVE** | idem |
| `tico-ai-prod` | `vismIR` (gen-1 fn) | us-central1 | `cloudfunctions.invoker` | **LIVE** | ACTIVE, billing on, etag `BwZPmOkZu0c=` |
| `tico-ai-prod` | `vismQuote` (gen-1 fn) | us-central1 | `cloudfunctions.invoker` | **LIVE** | ACTIVE, billing on, etag `BwZPmOH0Mtk=` |

**14 LIVE · 1 DEGRADED · 4 DEAD.** No `allAuthenticatedUsers` binding exists on any resource read.

The 4 `convodojo` services are the **same class as the binding removed under #146**: a public
`allUsers` invoker on a service that cannot serve because project billing is off. They are
reachable-by-policy but not reachable-in-fact. If billing is ever re-enabled on `convodojo`,
four public endpoints come back with it — this is latent exposure, not resolved exposure.

### 3b. ADAM-146 removal — independently re-confirmed

| Resource | Expected after #146 | Observed now | Verdict |
|---|---|---|---|
| `donovan-law-site` svc, us-east1 | zero bindings, etag `BwZYewU88jU=` | **zero bindings, etag `BwZYewU88jU=`** | **HOLDS — byte-identical** |

Verified by **policy read only**. This project's billing is off, so probing the URL would return
a billing-induced 5xx that **shadows** the IAM result — a 403 and a 503 are indistinguishable at
the edge, so a probe can neither prove nor disprove the removal. The policy is the only sound
oracle.

### 3c. Private Cloud Run services (12 of 29) — CONFIRMED not public

`donovan-law-site` (0 bindings); `ragbox-sovereign-prod`: `doc-chunk-worker`, `doc-embed-worker`,
`doc-enrich-worker`, `doc-extract-worker`, `doc-finalize-worker`, `doc-graph-worker`,
`ragbox-app-staging`, `ragbox-backend-staging`; `tico-ai-prod`: `brain-viewer`,
`performance-processor`, `ragbrain-omnisync`.

### 3d. Cloud Storage — no public buckets

22 buckets across 5 projects, **all private**. `mediamagic-prod`, `platinum-bivouac-tgh3w`,
`tico-ai-ops`: no buckets.

### 3e. Project-level IAM — no public members

No `allUsers`/`allAuthenticatedUsers` at project level in 6 of 7 projects.
`platinum-bivouac-tgh3w` **could not be read** — see §4.

### Measurement note — a control failure that nearly produced a false table

The first per-service sweep returned `PERMISSION_DENIED` for **all 29 services**. That was an
artifact, not a finding: `gcloud` invoked inside a `while read` loop consumes the loop's piped
stdin and the calls execute under the wrong resolved identity. A 100% failure rate is a broken
instrument, not a result. Re-run with the service list materialised to a file and each call given
`</dev/null`, the same services return real policies — `doc-chunk-worker` flipped from `DENIED` to
genuinely private (2 SA invokers, etag `BwZU-JXp0MQ=`), and `ragbox-app` from `DENIED` to
**public**. Had the first sweep been trusted, this audit would have reported a uniform access gap
and missed all 17 public Run bindings. **Every row in §3a/§3c comes from the corrected sweep.**

---

## 4. What the prior audit could NOT see — and what is *still* unaudited

### 4a. Blind spots of the prior 1-of-7 audit

The impersonated `agent-cli` SA reaches exactly one project. Anything scoped to it covers
`tico-ai-prod` only; every other project returned nothing — **not a denial, an empty result**.

| Project | Prior audit (`agent-cli`) | This audit (`david@ticoai.net`) | Was hidden |
|---|---|---|---|
| `tico-ai-prod` | **VISIBLE** | VISIBLE | — |
| `convodojo` | **BLIND** | VISIBLE | **4 public `allUsers` bindings** |
| `ragbox-sovereign-prod` | **BLIND** | VISIBLE | **3 public `allUsers` bindings** |
| `donovan-law-site` | **BLIND** | VISIBLE | the #146 service (now 0 bindings) |
| `mediamagic-prod` | **BLIND** | VISIBLE | no Run/public surface found |
| `platinum-bivouac-tgh3w` | **BLIND** | partial | project IAM **still unreadable** |
| `tico-ai-ops` | **BLIND** | VISIBLE | no Run/public surface found |

**Coverage: 1 of 7 → 7 of 7. Delta = 6 projects.** Seven public `allUsers` bindings
(4 `convodojo` + 3 `ragbox-sovereign-prod`) sat entirely outside the prior audit's reach. Any
prior statement that the estate had no public bindings beyond `tico-ai-prod` was **bounded by
the identity, not by the estate**, and must not be read as a pass.

### 4b. Gaps that remain open under the correct principal

Stated plainly so none reads as clean:

1. **`ad-retriever` (598048777643) — an 8th project, entirely unaudited.**
   `theconnexusai@gmail.com` can see it; `david@ticoai.net` is **denied**. It is ACTIVE with
   **billing enabled**, and even `theconnexusai` is denied `run.services.list` on it — so **no
   identity available here can enumerate its public surface at all.** The order's "7 total" is
   itself an artifact of david's reach; the estate is **at least 8**. Per the STOP condition, no
   access widening was attempted. **Unaudited: public IAM state unknown.**

2. **`platinum-bivouac-tgh3w` — project IAM unreadable.** `getIamPolicy` denied for
   `david@ticoai.net`. Billing is **enabled**, so this is a funded project whose IAM cannot be
   inspected. **Unaudited: project-level public bindings unknown.**

3. **Cloud Run API disabled — `mediamagic-prod`, `platinum-bivouac-tgh3w`, `tico-ai-ops`.**
   Reported as `SERVICE_DISABLED`. Treated as *no Cloud Run surface* by **inference** (a disabled
   API cannot serve traffic), not by enumeration. Labelled as inference; the API was **not**
   enabled to check.

4. **Cloud Functions API unavailable in 6 of 7 projects.** Only `tico-ai-prod` could be
   enumerated. **Unaudited: function-level public bindings in the other six.**

5. **Surfaces not enumerated this round:** Pub/Sub topics/subscriptions, Secret Manager, Artifact
   Registry / GCR, BigQuery datasets, Compute Engine firewall rules and external IPs, API Gateway,
   Cloud Endpoints. No claim is made about them in any project.

6. **`ragbox-sa` credential is dead** (`invalid_grant`). Anything it once audited cannot be
   re-verified under that identity.

---

## Reproduction

Every row above was produced read-only. Prefix **all** commands with:

```bash
export CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT=      # load-bearing — see §1
ACC="--account=david@ticoai.net"
```

| § | Command |
|---|---|
| 1 | `gcloud auth list --format="table(account,status)"` |
| 1 | `gcloud config list` · `gcloud config configurations list` |
| 1 | `gcloud iam service-accounts get-iam-policy agent-cli@tico-ai-prod.iam.gserviceaccount.com --project tico-ai-prod $ACC --format=json` |
| 1 | Arms A/B/C: `gcloud projects list [--account=...] --format="value(projectId)" 2>/dev/null \| grep -c .` |
| 2 | `gcloud projects list $ACC --format="table(projectId,projectNumber,lifecycleState)"` |
| 2 | `gcloud billing projects describe <P> $ACC --format="value(billingEnabled,billingAccountName)"` |
| 3a | `gcloud run services list --project <P> $ACC --format="value(metadata.name,region)" </dev/null` |
| 3a | `gcloud run services get-iam-policy <SVC> --region <R> --project <P> $ACC --format=json </dev/null` |
| 3a | `gcloud run services list --project <P> $ACC --format="value(metadata.name,status.conditions[0].status,status.url)"` |
| 3a | `gcloud functions list --project <P> $ACC --format="value(name,state,environment)"` |
| 3a | `gcloud functions get-iam-policy <FN> --region us-central1 --project tico-ai-prod $ACC --format=json` |
| 3d | `gcloud storage buckets list --project <P> $ACC --format="value(name)"` · `gcloud storage buckets get-iam-policy gs://<B> $ACC --format=json` |
| 3e | `gcloud projects get-iam-policy <P> $ACC --format=json` |
| 4b | `gcloud projects describe ad-retriever --account=theconnexusai@gmail.com` (ACTIVE) vs `$ACC` (**denied**) |

`</dev/null` on per-resource calls is required — without it `gcloud` eats the loop's stdin and
every call fails spuriously (§3 measurement note).

---

## Verification against the order

| Requirement | Status |
|---|---|
| Every row cites the read-only command that produced it | **Met** — §Reproduction maps each section to its command |
| Reproducible | **Met** — deterministic given the env prefix; etags quoted for point-in-time rows |
| Projects seen stated against 7 total, delta named | **Met** — 1 → 7 of 7; **delta = 6**. Estate is ≥8; `ad-retriever` named as beyond the premise |
| No IAM binding or service modified | **Met** — only `list` / `describe` / `get-iam-policy`. No `set-iam-policy`, `add-iam-policy-binding`, `remove-iam-policy-binding`, `deploy`, `delete`, or `services enable` was run |
| No API enabled | **Met** — three `SERVICE_DISABLED` prompts declined; left disabled |
| Nothing under `.github` / workflows touched | **Met** — this document is the only file added |
| STOP if principal sees < 7 | **N/A for the 7** (sees all 7). For the 8th (`ad-retriever`) the gap is **recorded, not widened** |

**Not merged.** Agents do not merge — Zane gates, David merges.
