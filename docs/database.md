# Database Schema

Equiptalk AI uses Google Cloud Firestore, a NoSQL database. Below are the collections and their document structures.

## Collections

### `equipment`
Stores information about each piece of equipment.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated Document ID |
| `name` | `string` | Equipment name |
| `type` | `string` | Equipment type/category |
| `model` | `string` | Model number or identifier |
| `serialNumber` | `string` | Unique serial number |
| `status` | `string` | Current status (e.g., "OPERATIONAL") |
| `organizationId` | `string` | Organization ID (for multi-tenancy) |
| `parentId` | `string` | ID of parent equipment (for hierarchy) |
| `slug` | `string` | URL-friendly identifier |
| `order` | `number` | Display order for lists |
| `createdAt` | `string` | ISO 8601 Timestamp |
| `updatedAt` | `string` | ISO 8601 Timestamp |

### `incidents`
Records of issues or maintenance events reported for equipment.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated Document ID |
| `displayId` | `string` | Human-readable ID (e.g., "INC-123456789") |
| `equipmentId` | `string` | ID of the affected equipment |
| `equipmentName` | `string` | Name of the equipment (for denormalization) |
| `issueDescription` | `string` | Detailed description of the problem |
| `status` | `string` | Incident status (e.g., "open", "closed") |
| `priority` | `string` | Urgency level (e.g., "low", "high") |
| `createdAt` | `string` | ISO 8601 Timestamp |
| `updatedAt` | `string` | ISO 8601 Timestamp |

### `documents`
Metadata for files uploaded to Firebase Storage.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated Document ID |
| `name` | `string` | Display name of the file |
| `url` | `string` | Public URL to the file in Storage |
| `filename` | `string` | Full path in Storage bucket (for deletion) |
| `type` | `string` | File MIME type or category |
| `equipmentId` | `string` | ID of the associated equipment |
| `createdAt` | `string` | ISO 8601 Timestamp |

## Relations

-   **Equipment Hierarchy:** Equipment can be nested via the `parentId` field in the `equipment` collection.
-   **Equipment <-> Incidents:** One-to-Many. An equipment item can have multiple incidents linked by `equipmentId`.
-   **Equipment <-> Documents:** One-to-Many. An equipment item can have multiple documents linked by `equipmentId`.
