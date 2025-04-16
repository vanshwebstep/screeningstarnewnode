const express = require("express");
const router = express.Router();
const clientAllocationController = require("../../controllers/admin/clientAllocationController");

// Authentication routes
router.get("/applications", clientAllocationController.applications);
router.post("/create", clientAllocationController.create);
router.post("/bulk/create", clientAllocationController.bulkCcreate);
router.get("/list", clientAllocationController.list);
module.exports = router;
