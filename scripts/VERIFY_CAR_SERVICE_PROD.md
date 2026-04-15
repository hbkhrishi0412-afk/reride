# Car Service Production Verification

Use this after deploying to confirm provider edit/save/delete flows are healthy.

## 1) Required tokens

- `CAR_SERVICE_PROVIDER_BEARER`: Access token for a real service-provider account.
- `CAR_SERVICE_ADMIN_BEARER` (optional): Admin token for metrics endpoint validation.

## 2) Run command

```bash
CAR_SERVICE_BASE_URL="https://www.reride.co.in" \
CAR_SERVICE_PROVIDER_BEARER="<provider_token>" \
CAR_SERVICE_ADMIN_BEARER="<admin_token_optional>" \
npm run verify:car-service:prod
```

### Local regression mode

```bash
npm run verify:car-service:local
```

Optional for local mode:

- `CAR_SERVICE_DEV_UID` (default: `dev-uid`)

## 3) What it validates

- Provider profile read (`GET /api/service-providers`)
- Provider profile edit (`PATCH /api/service-providers`)
- Service category save (`PATCH /api/service-providers`)
- Service add/update (`PATCH /api/provider-services`)
- Service delete (`DELETE /api/provider-services?serviceType=...`)
- Open request listing (`GET /api/service-requests?scope=open&recentHours=24`)
- Admin metrics (`GET /api/service-requests?scope=metrics`, optional)

## 4) Expected outcome

- All checks print `PASS`.
- Script exits with code `0`.
- Any failure prints the endpoint and response status/body for quick debugging.

