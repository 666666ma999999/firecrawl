import amqp from "amqplib";
import { config } from "../../config";
import { logger as _logger } from "../../lib/logger";
import { WebhookEvent } from "./types";

const WEBHOOK_QUEUE_NAME = "webhooks";

export type WebhookQueueMessage = {
  webhook_url: string;
  payload: {
    success: boolean;
    type: string;
    webhookId: string;
    id?: string;
    jobId?: string;
    data: any[];
    error?: string;
    metadata?: Record<string, string>;
  };
  headers: Record<string, string>;
  team_id: string;
  job_id: string;
  scrape_id: string | null;
  event: WebhookEvent;
  timeout_ms: number;
};

class WebhookQueue {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private connecting: boolean = false;
  private closing: boolean = false;

  async connect(): Promise<void> {
    if (this.connection && this.channel) return;
    if (this.connecting) {
      while (this.connecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    if (!config.NUQ_RABBITMQ_URL) {
      throw new Error("NUQ_RABBITMQ_URL is not configured");
    }

    this.connecting = true;
    try {
      _logger.info("Connecting to webhook RabbitMQ", {
        module: "webhook-queue",
      });

      this.connection = await amqp.connect(config.NUQ_RABBITMQ_URL);
      this.channel = await this.connection.createChannel();

      await this.channel.checkQueue(WEBHOOK_QUEUE_NAME);

      _logger.info("Connected to webhook RabbitMQ", {
        module: "webhook-queue",
      });

      this.connection.on("close", () => {
        _logger.warn("Webhook RabbitMQ connection closed", {
          module: "webhook-queue",
        });
        this.connection = null;
        this.channel = null;
        if (!this.closing) {
          setTimeout(() => {
            this.connect().catch(err =>
              _logger.error("Failed to reconnect to webhook RabbitMQ", {
                err,
                module: "webhook-queue",
              }),
            );
          }, 5000);
        }
      });

      this.connection.on("error", err => {
        _logger.error("Webhook RabbitMQ connection error", {
          err,
          module: "webhook-queue",
        });
      });

      this.channel.on("close", () => {
        _logger.warn("Webhook RabbitMQ channel closed", {
          module: "webhook-queue",
        });
        this.channel = null;
      });

      this.channel.on("error", err => {
        _logger.error("Webhook RabbitMQ channel error", {
          err,
          module: "webhook-queue",
        });
      });
    } finally {
      this.connecting = false;
    }
  }

  async publish(message: WebhookQueueMessage): Promise<void> {
    await this.connect();

    if (!this.channel) {
      throw new Error("Webhook RabbitMQ channel not available");
    }

    const messageBuffer = Buffer.from(JSON.stringify(message), "utf8");

    const sent = this.channel.sendToQueue(WEBHOOK_QUEUE_NAME, messageBuffer, {
      persistent: true,
      contentType: "application/json",
    });

    if (!sent) {
      _logger.warn("Webhook message buffer full, waiting for drain", {
        module: "webhook-queue",
        teamId: message.team_id,
        jobId: message.job_id,
      });

      const channel = this.channel;
      let timeoutHandle: NodeJS.Timeout | null = null;
      let drainHandler: (() => void) | null = null;
      let closeHandler: (() => void) | null = null;
      let errorHandler: ((err: Error) => void) | null = null;

      try {
        await Promise.race([
          new Promise<void>(resolve => {
            drainHandler = () => resolve();
            channel!.once("drain", drainHandler);
          }),
          new Promise<void>((_, reject) => {
            closeHandler = () =>
              reject(new Error("Channel closed while waiting for drain"));
            channel!.once("close", closeHandler);
          }),
          new Promise<void>((_, reject) => {
            errorHandler = (err: Error) => reject(err);
            channel!.once("error", errorHandler);
          }),
          new Promise<void>((_, reject) => {
            timeoutHandle = setTimeout(
              () => reject(new Error("Drain timeout after 30s")),
              30000,
            );
          }),
        ]);
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (drainHandler) channel!.removeListener("drain", drainHandler);
        if (closeHandler) channel!.removeListener("close", closeHandler);
        if (errorHandler) channel!.removeListener("error", errorHandler);
      }
    }

    _logger.info("Webhook message published to queue", {
      module: "webhook-queue",
      teamId: message.team_id,
      jobId: message.job_id,
      event: message.event,
    });
  }

  async close(): Promise<void> {
    this.closing = true;
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
    _logger.info("Webhook RabbitMQ connection closed", {
      module: "webhook-queue",
    });
  }
}

export const webhookQueue = new WebhookQueue();

export async function shutdownWebhookQueue(): Promise<void> {
  await webhookQueue.close();
}
