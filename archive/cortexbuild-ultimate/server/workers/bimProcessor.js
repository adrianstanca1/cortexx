const pool = require('../db');
const fs = require('fs');
const WebIFC = require('web-ifc');

/**
 * Processes a single BIM model.
 * Logic moved from server/routes/bim-models.js
 */
async function processBIMModel(modelId) {
  try {
    // Get model details
    const { rows } = await pool.query(
      `SELECT * FROM bim_models WHERE id = $1 AND status = 'processing'`,
      [modelId]
    );

    if (!rows.length) return; // Already processed or deleted

    const model = rows[0];

    let elementsCount = 0;
    let floorsCount = 1;

    if (model.format === 'IFC') {
      try {
        const ifcApi = new WebIFC.IfcAPI();
        await ifcApi.Init();

        const fileBuffer = await fs.promises.readFile(model.file_path);
        const modelIFC = ifcApi.OpenModel(fileBuffer);

        // 1. Extract total elements
        elementsCount = ifcApi.GetCountAll();

        // 2. Precise Floor Count: Count only unique IfcBuildingStorey entities
        const storeys = ifcApi.GetLineIds('IFCBUILDINGSTOREY');
        floorsCount = storeys.length;

        // 3. Extract IFC Version from the file header
        // IFC files start with ISO-10303-21; version is usually in the first few lines
        const header = fileBuffer.toString('utf8', 0, 1000);
        const versionMatch = header.match(/FILE_SCHEMA\((\w+)\)/);
        const version = versionMatch ? versionMatch[1] : 'Unknown';

        ifcApi.CloseModel();

        // Update model with extracted version if available
        await pool.query(
          `UPDATE bim_models SET version = $1 WHERE id = $2`,
          [version, modelId]
        );
      } catch (parseErr) {
        console.error(`[BIM Processing] IFC Parse Error for model ${modelId}:`, parseErr);
        elementsCount = 0;
        floorsCount = 1;
      }
    } else {
      // Non-IFC formats (GLTF, OBJ, etc.) are not yet supported for extraction.
      // Leave elements_count at 0 — do NOT fabricate data.
      elementsCount = 0;
      floorsCount = 1;
    }

    // Update model with extracted data
    await pool.query(
      `UPDATE bim_models SET
        status = 'ready',
        processed_at = NOW(),
        elements_count = $1,
        floors_count = $2
       WHERE id = $3`,
      [elementsCount, floorsCount, modelId]
    );

    // Update processing queue
    await pool.query(
      `UPDATE bim_processing_queue SET status = 'completed', completed_at = NOW()
       WHERE model_id = $1`,
      [modelId]
    );

    console.log(`[BIM Processing] Model ${modelId} processed: ${elementsCount} elements, ${floorsCount} floors`);
  } catch (err) {
    console.error(`[BIM Processing] Error processing model ${modelId}:`, err);
    await pool.query(
      `UPDATE bim_models SET status = 'error', error_message = $1 WHERE id = $2`,
      ['Processing failed', modelId]
    );
    await pool.query(
      `UPDATE bim_processing_queue SET status = 'failed', error_message = $1 WHERE model_id = $2`,
      ['Processing failed', modelId]
    );
  }
}

/**
 * Polls the bim_processing_queue for pending jobs and processes them.
 */
async function pollQueue() {
  try {
    // Use an explicit transaction with SELECT FOR UPDATE SKIP LOCKED
    // to safely claim exactly one job without race conditions
    const client = await pool.connect();
    let jobId = null;
    let modelId = null;

    try {
      await client.query('BEGIN');

      const res = await client.query(`
        SELECT id, model_id FROM bim_processing_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);

      if (res.rows.length > 0) {
        jobId = res.rows[0].id;
        modelId = res.rows[0].model_id;

        // Mark as processing so we don't pick it up again
        await client.query(`
          UPDATE bim_processing_queue
          SET status = 'processing', updated_at = NOW()
          WHERE id = $1
        `, [jobId]);
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Process outside the transaction so we don't hold the lock during long work
    if (jobId && modelId) {
      console.log(`[BIM Processor] Picked up job ${jobId} for model ${modelId}`);
      await processBIMModel(modelId);
    }
  } catch (err) {
    console.error('[BIM Processor] Polling error:', err);
  } finally {
    // Schedule the next poll.
    // Wait longer if there's an error, otherwise poll regularly.
    setTimeout(pollQueue, 5000); // 5 seconds
  }
}

function startBIMProcessor() {
  console.log('[BIM Processor] Started background polling for BIM processing jobs');
  pollQueue();
}

module.exports = {
  startBIMProcessor,
  processBIMModel
};
