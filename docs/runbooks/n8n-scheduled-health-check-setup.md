# n8n Scheduled Health-Check Setup

The app is scheduler-ready, but n8n is not connected by default. Use this guide only when an operator is ready to configure an external n8n workflow.

## Import The Workflow

Import this workflow JSON into n8n:

```text
docs/n8n/production-readiness-scheduled-health-check.json
```

The workflow contains:

1. A Schedule Trigger that runs every 5 minutes.
2. An HTTP Request node that posts to the scheduled health-check endpoint.
3. Response classification for normal completion, safe overlap, credential failure, and retry-worthy failures.
4. Simple logging nodes that can be replaced with your operator notification path later.

## Configure Credentials

Create or provide values in n8n for:

```text
PRODUCTION_READINESS_DASHBOARD_BASE_URL
PRODUCTION_READINESS_INTERNAL_HEALTH_CHECK_SECRET
```

The base URL should point to the deployed application origin only. The workflow appends:

```text
/api/internal/health-checks/scheduled-run
```

Store the internal secret in n8n credentials or protected n8n environment variables. Do not paste real secret values into node descriptions, workflow names, documentation, screenshots, or source control.

## Test One Manual Execution

Before activating the schedule:

1. Keep the Schedule Trigger disabled or execute the workflow manually.
2. Run the workflow once from n8n.
3. Confirm the HTTP Request node returns a `2xx` response.
4. Sign in to the dashboard and check Overview.
5. Confirm the Scheduled monitoring area shows persisted scheduled-run evidence.

If the response is `401` or `403`, stop and review the n8n credential value and the app's `INTERNAL_HEALTH_CHECK_SECRET`. If the response is `409`, another workspace run was already active; wait for the next interval instead of retrying immediately.

## Activate The Workflow

After one successful manual execution, activate the workflow. The imported schedule runs every 5 minutes. The app does not start any in-process scheduler, queue, timer, or background loop.

## Expected Runtime Behavior

`2xx`: normal completion. The app creates a `HealthCheckRun` with `triggerType=SCHEDULED` and links generated `HealthCheck` rows to that run.

`409`: safe overlap. A database-backed workspace lease indicates another run is active. Let the next scheduled interval try again.

`401` or `403`: configuration or security failure. Review n8n credential storage and the app secret configuration.

`5xx` or network failure: retry-worthy. Use normal n8n retry policy and review workflow execution logs.

## Dashboard Verification

The dashboard shows scheduler state only from persisted `SCHEDULED` health-check runs:

```text
Not configured — no scheduled run evidence yet
Active — last scheduled run <relative timestamp>
Attention required — latest scheduled run failed
Skipped — another run was active
```

Do not treat the workflow JSON, an environment variable, or an inactive n8n workflow as proof that scheduled monitoring is active. The source of truth is successful scheduled-run evidence in the database.
