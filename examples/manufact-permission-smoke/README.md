# Disposable Manufact permission fixture

A public, read-only MCP server with one `ping` tool and `/healthz`. It contains no AnyDock credentials, session data, environment access tools or production resources.

Deploy only this directory (`examples/manufact-permission-smoke`) on Manufact's free plan. Port 3000; Dockerfile included. Used to verify AnyDock inspect permissions and approved redeployments. The public ping endpoint is intentionally unauthenticated; organization permissions govern the Manufact control plane, not this public fixture tool.
