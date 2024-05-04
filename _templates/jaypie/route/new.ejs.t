---
to: <%= path %>/<%= name %><%= dotSubtype %>.js
---
import { httpRoute } from "@knowdev/express";
import HTTP from "@knowdev/http";

import express from "express";

import { cookies } from "../lib/trace/index.js";

import { PATH } from "../constants.js";
// TODO: import ...handlers

const router = express.Router();
router.use(cookies);
router.use(express.json());

//
//
// Main
//

// Vocabulary
router.get(PATH.ROOT, httpRoute(HTTP.CODE.NO_CONTENT));
router.post(PATH.ROOT, httpRoute(HTTP.CODE.NO_CONTENT));
router.get("/:id", httpRoute(HTTP.CODE.NO_CONTENT));
router.post("/:id", httpRoute(HTTP.CODE.NO_CONTENT));

// Penultimate: right URL, wrong method
router.all(PATH.ROOT, httpRoute(HTTP.CODE.METHOD_NOT_ALLOWED));
router.all("/:id", httpRoute(HTTP.CODE.METHOD_NOT_ALLOWED));

// Last: anything else is a 404
router.all(PATH.ANY, httpRoute(HTTP.CODE.NOT_FOUND));

//
//
// Export
//

export default router;
