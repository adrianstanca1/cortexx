CREATE TYPE equipment_status_enum AS ENUM ('available','rented','in_use','maintenance','retired');
CREATE TYPE equipment_category_enum AS ENUM ('plant','tool','vehicle','ppe','scaffold','other');

CREATE TABLE IF NOT EXISTS equipment (
  id SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  category equipment_category_enum DEFAULT 'tool' NOT NULL,
  status equipment_status_enum DEFAULT 'available' NOT NULL,
  "serialNumber" VARCHAR(255),
  manufacturer VARCHAR(255),
  model VARCHAR(255),
  "purchaseDate" TIMESTAMP,
  "rentalRate" DECIMAL(10,2),
  "dailyRate" DECIMAL(10,2),
  location VARCHAR(255),
  "projectId" INTEGER,
  description TEXT,
  "qrCode" VARCHAR(255),
  "gpsLat" DECIMAL(10,7),
  "gpsLng" DECIMAL(10,7),
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS equipment_assignments (
  id SERIAL PRIMARY KEY,
  "equipmentId" INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  "projectId" INTEGER NOT NULL,
  "assignedTo" INTEGER,
  "assignedBy" INTEGER NOT NULL,
  "checkedOut" TIMESTAMP DEFAULT NOW() NOT NULL,
  "checkedIn" TIMESTAMP,
  "expectedReturn" TIMESTAMP,
  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS equipment_service_logs (
  id SERIAL PRIMARY KEY,
  "equipmentId" INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  "serviceType" VARCHAR(50) NOT NULL,
  description TEXT,
  cost DECIMAL(10,2),
  "serviceDate" TIMESTAMP DEFAULT NOW() NOT NULL,
  "nextServiceDate" TIMESTAMP,
  "performedBy" VARCHAR(255),
  status VARCHAR(20) DEFAULT 'completed' NOT NULL,
  "documentId" INTEGER,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);
