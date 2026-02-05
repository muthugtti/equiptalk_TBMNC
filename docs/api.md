# API Reference

This document outlines the API routes available in Equiptalk AI. All API routes are located in `src/app/api`.

## Equipment

### Get All Equipment
**Endpoint:** `GET /api/equipment`

Returns a list of all equipment, ordered by `updatedAt` descending.

**Response:**
```json
{
  "equipment": [
    {
      "id": "string",
      "name": "string",
      "type": "string",
      "status": "OPERATIONAL",
      "slug": "string",
      ...
    }
  ]
}
```

### Create Equipment
**Endpoint:** `POST /api/equipment`

Creates a new equipment record.

**Body:**
```json
{
  "name": "string (required)",
  "type": "string (required)",
  "organizationId": "string (required)",
  "model": "string",
  "serialNumber": "string",
  "status": "string",
  "parentId": "string (optional)"
}
```

## Incidents

### Get All Incidents
**Endpoint:** `GET /api/incidents`

Returns a list of all incidents, ordered by `createdAt` descending.

**Response:**
```json
{
  "incidents": [
    {
      "id": "string",
      "displayId": "string",
      "equipmentId": "string",
      "issueDescription": "string",
      "status": "open",
      "priority": "low",
      ...
    }
  ]
}
```

### Create Incident
**Endpoint:** `POST /api/incidents`

Reports a new incident.

**Body:**
```json
{
  "equipmentId": "string (required)",
  "equipmentName": "string (required)",
  "issueDescription": "string (required)",
  "status": "string",
  "priority": "string"
}
```

## Uploads

### Upload File
**Endpoint:** `POST /api/upload`

Uploads a file to Firebase Storage and associates it with an equipment item.

**Body:** `FormData`
-   `file`: File object (Max 10MB)
-   `equipmentId`: string

**Response:**
```json
{
  "url": "string (public url)",
  "filename": "string",
  "size": 1234,
  "type": "image/jpeg"
}
```

## Utility

-   `GET /api/health`: Health check endpoint.
-   `GET /api/ping`: Simple connectivity test.
-   `GET /api/debug-env`: Returns safe environment variable status for debugging.
