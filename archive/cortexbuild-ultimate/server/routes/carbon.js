/**
 * Carbon Estimating API
 * UK Net Zero compliance — calculates embodied and operational carbon
 * for construction projects and materials.
 *
 * Endpoints:
 *   POST /carbon/estimate          — calculate project carbon footprint
 *   POST /carbon/materials         — calculate material carbon
 *   GET  /carbon/projects/:id      — get project carbon summary
 */
const express = require('express');
const pool    = require('../db');
const authMw  = require('../middleware/auth');
const { buildTenantFilter } = require('../middleware/tenantFilter');

const router = express.Router();
router.use(authMw);

// ─── UK-specific carbon emission factors (kgCO2e per unit) ─────────────────
// These are based on RICS, IStructE, and UK GOV. Concordat figures
const MATERIAL_FACTORS = {
  // Structural materials (per tonne)
  'concrete_in_situ':       { factor: 295,  unit: 'm3',   desc: 'In-situ concrete (C30/37 average)' },
  'concrete_precast':       { factor: 245,  unit: 'm3',   desc: 'Precast concrete' },
  'reinforcement_steel':    { factor: 775,  unit: 'tonne', desc: 'Reinforcement steel (UK average)' },
  'structural_steel':       { factor: 1430, unit: 'tonne', desc: 'Structural steel (UK blast furnace)' },
  'timber_sustainable':      { factor: -50,  unit: 'm3',   desc: 'Sustainable timber (biogenic carbon)' },
  'masonry_brick':          { factor: 285,  unit: 'tonne', desc: 'Clay brick masonry' },
  'masonry_block':          { factor: 165,  unit: 'm3',   desc: 'Concrete blockwork' },

  // Finishes (per m2)
  'plasterboard':           { factor: 4.8,  unit: 'm2',   desc: 'Plasterboard (12.5mm)' },
  'paint_decoration':       { factor: 1.2,  unit: 'm2',   desc: 'Paint system (2 coats)' },
  'floor_finish_concrete':  { factor: 32,   unit: 'm2',   desc: 'Polished concrete floor' },
  'floor_finish_timber':    { factor: 8.5,  unit: 'm2',   desc: 'Engineered timber flooring' },
  'floor_finish_carpet':    { factor: 6.2,  unit: 'm2',   desc: 'Carpet flooring' },
  ' ceiling_tile':           { factor: 5.1,  unit: 'm2',   desc: 'Mineral fibre ceiling tile' },

  // MEP (per unit or item)
  'cable_1kv':              { factor: 18.5, unit: 'm',    desc: '1kV power cable (per metre)' },
  'cable_lighting':         { factor: 3.2,  unit: 'm',    desc: 'Lighting circuit cable' },
  'pipe_steel':             { factor: 12.8, unit: 'm',    desc: 'Steel pipe (per metre, 50mm dia)' },
  'ductwork_galvanised':    { factor: 28,   unit: 'm2',   desc: 'Galvanised steel ductwork (per m2)' },
  'thermal_insulation':      { factor: 45,   unit: 'm2',   desc: 'PIR insulation (100mm)' },

  // Demolition & excavation (per m3)
  'excavation':             { factor: 6.5,  unit: 'm3',   desc: 'Excavation (plant diesel)' },
  'demolition_concrete':     { factor: 14.2, unit: 'm3',   desc: 'Demolition (concrete)' },
  'waste_transport':        { factor: 0.9,  unit: 'tonne', desc: 'Waste transport (20km avg)' },
  'waste_recycling_concrete': { factor: 18,  unit: 'tonne', desc: 'Concrete recycling' },
};

// Transport emission factors (kgCO2e per tonne-km)
const TRANSPORT_FACTORS = {
  'articulated_lorry':    0.096,
  'rigid_lorry':          0.138,
  'flat_lorry':           0.120,
  'van':                  0.220,
  'rail_freight':         0.028,
  'sea_freight':          0.016,
};

// UK grid electricity emission factor (kgCO2e/kWh) — 2024 BEIS
const GRID_FACTOR = 0.193;

// ─── Helpers ───────────────────────────────────────────────────────────────

function calculateA1A3(materials) {
  // A1A3: Product stage (raw material supply + transport + manufacturing)
  let total = 0;
  const breakdown = [];
  for (const { category, quantity, unit } of materials) {
    const f = MATERIAL_FACTORS[category];
    if (!f) continue;
    let value;
    if (f.unit === 'm3' || f.unit === 'tonne') {
      value = f.factor * quantity;
    } else {
      value = f.factor * quantity;
    }
    const item = { category, quantity, unit, factor: f.factor, kgCO2e: Math.round(value), desc: f.desc };
    breakdown.push(item);
    total += value;
  }
  return { total: Math.round(total), breakdown };
}

function calculateTransport(materials) {
  // A4: Transport to site
  let total = 0;
  const breakdown = [];
  for (const { transport_mode, distance_km, weight_tonnes } of materials) {
    const factor = TRANSPORT_FACTORS[transport_mode] || TRANSPORT_FACTORS['articulated_lorry'];
    const value = factor * distance_km * weight_tonnes;
    breakdown.push({ transport_mode, distance_km, weight_tonnes, factor, kgCO2e: Math.round(value) });
    total += value;
  }
  return { total: Math.round(total), breakdown };
}

function calculateOperational(area_m2, occupancy_hours, epc_rating) {
  // B6: Operational energy use (simplified model)
  // Based on EPC rating → kWh/m2/yr
  const epcFactors = { A: 30, B: 50, C: 75, D: 110, E: 160, F: 225, G: 300 };
  const kwh_per_m2 = epcFactors[epc_rating] || epcFactors['D'];
  const annual_kwh = area_m2 * kwh_per_m2;
  const annual_kg = annual_kwh * GRID_FACTOR;
  return {
    total: Math.round(annual_kg),
    annual_kwh,
    epc_rating,
    grid_factor: GRID_FACTOR,
  };
}

function calculateConstruction(area_m2, programme_months) {
  // A5: Construction stage (site operations, plant, temporary works)
  // Approximation: 25kg CO2e per m2 per month of construction
  return {
    total: Math.round(area_m2 * programme_months * 25),
    note: `~25 kgCO2e/m2/month. Actual data should replace this estimate.`,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────

/** POST /carbon/estimate — full project carbon footprint estimate */
router.post('/estimate', async (req, res) => {
  try {
    const { project_id, area_m2, occupancy_hours, epc_rating, programme_months, materials = [], transport = [] } = req.body;

    if (!area_m2 || area_m2 <= 0) {
      return res.status(400).json({ message: 'area_m2 (positive number) is required' });
    }

    const a1a3 = calculateA1A3(materials);
    const a4 = calculateTransport(transport);
    const a5 = calculateConstruction(area_m2, programme_months || 12);
    const b6 = calculateOperational(area_m2, occupancy_hours, epc_rating || 'C');

    const embodied = a1a3.total + a4.total + a5.total;
    const operational = b6.total;
    const total = embodied + operational;

    // As % of total — typical UK building: 20% embodied, 80% operational over 60 years
    const lifespan_years = 60;
    const operational_60yr = operational * lifespan_years;
    const lifetime_total = embodied + operational_60yr;
    const embodied_pct = lifespan_years > 0 ? Math.round((embodied / lifetime_total) * 100) : 0;

    // RICS Whole Life Carbon template categories
    const result = {
      project_id: project_id || null,
      area_m2,
      programme_months: programme_months || 12,
      epc_rating: epc_rating || 'C',
      phases: {
        A1A3_product:       { kgCO2e: a1a3.total, desc: 'Product stage (raw materials, manufacturing, transport to site)' },
        A4_transport:       { kgCO2e: a4.total, desc: 'Transport to site' },
        A5_construction:    { kgCO2e: a5.total, desc: 'Construction stage (plant, temporary works)' },
        B6_operational:     { kgCO2e: b6.total, desc: `Operational energy (${lifespan_years}yr annualised: ${Math.round(operational_60yr).toLocaleString()} kgCO2e)`, annual_kwh: b6.annual_kwh },
      },
      summary: {
        embodied_kgCO2e: embodied,
        operational_annual_kgCO2e: operational,
        operational_60yr_kgCO2e: Math.round(operational_60yr),
        total_lifetime_kgCO2e: Math.round(lifetime_total),
        embodied_pct,
        operational_pct: 100 - embodied_pct,
        kgCO2e_per_m2: Math.round(embodied / area_m2),
        rating: embodied_pct <= 20 ? 'Excellent' : embodied_pct <= 35 ? 'Good' : embodied_pct <= 50 ? 'Average' : 'Poor',
      },
      material_breakdown: a1a3.breakdown,
      transport_breakdown: a4.breakdown,
    };

    // Save to DB if project_id provided
    if (project_id) {
      try {
        // Verify project belongs to user's tenant
        const { clause: projFilter, params: projParams } = buildTenantFilter(req, 'AND');
        const { rows: projRows } = await pool.query(
          `SELECT id FROM projects WHERE id = $1${projFilter}`,
          [project_id, ...projParams]
        );
        if (projRows.length === 0) {
          return res.status(403).json({ message: 'Project not found or access denied' });
        }

        const orgId = req.user?.organization_id;
        const companyId = req.user?.company_id;
        await pool.query(
          `INSERT INTO carbon_estimates (project_id, organization_id, company_id, area_m2, embodied_kgCO2e, operational_annual_kgCO2e, total_lifetime_kgCO2e, epc_rating, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [project_id, orgId, companyId, area_m2, embodied, operational, Math.round(lifetime_total), epc_rating || 'C', JSON.stringify(result)]
        );
      } catch (err) {
        console.error('[Carbon estimate save error]', err.message);
      }
    }

    res.json(result);
  } catch (err) {
    console.error('[Carbon estimate]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** POST /carbon/materials — calculate carbon for a list of materials */
router.post('/materials', async (req, res) => {
  try {
    const { materials = [] } = req.body;
    if (!Array.isArray(materials) || !materials.length) {
      return res.status(400).json({ message: 'materials array is required' });
    }

    const a1a3 = calculateA1A3(materials);
    res.json({
      total_kgCO2e: a1a3.total,
      breakdown: a1a3.breakdown,
      note: 'Based on RICS/IStructE UK emission factors. A1A3 product stage only.',
    });
  } catch (err) {
    console.error('[Carbon materials]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /carbon/projects/:id — get saved carbon estimates for a project */
router.get('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const isSuper = req.user?.role === 'super_admin';

    let query, params;
    if (isSuper) {
      query = `SELECT * FROM carbon_estimates WHERE project_id = $1 ORDER BY created_at DESC`;
      params = [id];
    } else {
      query = `SELECT * FROM carbon_estimates WHERE project_id = $1 AND (organization_id = $2 OR (organization_id IS NULL AND company_id = $3)) ORDER BY created_at DESC`;
      params = [id, orgId, companyId];
    }

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('[Carbon project]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /carbon/factors — list all emission factors */
router.get('/factors', async (req, res) => {
  res.json({
    materials: MATERIAL_FACTORS,
    transport: TRANSPORT_FACTORS,
    grid_electricity: GRID_FACTOR,
    source: 'RICS, IStructE, UK GOV BEIS 2024, Carbon Trust',
    note: 'Factors should be updated annually. This is an estimate tool, not a substitute for a formal RICS WLC assessment.',
  });
});

module.exports = router;
