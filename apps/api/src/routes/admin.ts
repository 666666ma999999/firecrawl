import express from "express";
import { config } from "../config";
import { redisHealthController } from "../controllers/v0/admin/redis-health";
import { wrap } from "./shared";
import { acucCacheClearController } from "../controllers/v0/admin/acuc-cache-clear";
import { checkFireEngine } from "../controllers/v0/admin/check-fire-engine";
import { cclogController } from "../controllers/v0/admin/cclog";
import { indexQueuePrometheus } from "../controllers/v0/admin/index-queue-prometheus";
import { zdrcleanerController } from "../controllers/v0/admin/zdrcleaner";
import { triggerPrecrawl } from "../controllers/v0/admin/precrawl";
import {
  metricsController,
  nuqMetricsController,
} from "../controllers/v0/admin/metrics";

export const adminRouter = express.Router();

const authKey = config.BULL_AUTH_KEY;

adminRouter.get(`/admin/${authKey}/redis-health`, redisHealthController);

adminRouter.post(
  `/admin/${authKey}/acuc-cache-clear`,
  wrap(acucCacheClearController),
);

adminRouter.get(`/admin/${authKey}/feng-check`, wrap(checkFireEngine));
adminRouter.get(`/admin/${authKey}/cclog`, wrap(cclogController));
adminRouter.get(`/admin/${authKey}/zdrcleaner`, wrap(zdrcleanerController));

adminRouter.get(
  `/admin/${authKey}/index-queue-prometheus`,
  wrap(indexQueuePrometheus),
);

adminRouter.get(`/admin/${authKey}/precrawl`, wrap(triggerPrecrawl));
adminRouter.get(`/admin/${authKey}/metrics`, wrap(metricsController));
adminRouter.get(`/admin/${authKey}/nuq-metrics`, wrap(nuqMetricsController));
