const express = require('express');
const invoiceRouter = require('./invoice');
const rfiRouter = require('./rfi');
const dailyReportRouter = require('./daily-report');
const safetyIncidentRouter = require('./safety-incident');
const projectRouter = require('./project');

const router = express.Router();

router.use('/invoice', invoiceRouter);
router.use('/rfi', rfiRouter);
router.use('/daily-report', dailyReportRouter);
router.use('/safety-incident', safetyIncidentRouter);
router.use('/project', projectRouter);

module.exports = router;