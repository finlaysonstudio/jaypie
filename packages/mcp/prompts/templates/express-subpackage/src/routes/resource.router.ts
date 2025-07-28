import express from "express";
import { EXPRESS } from "jaypie";
import resourceGetRoute from "./resource/resourceGet.route.js";

const router = express.Router();
router.use(express.json({ strict: false }));

// Single example route
router.get(EXPRESS.PATH.ROOT, resourceGetRoute);

export default router;