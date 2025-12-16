import { redisClient } from '../config/redis';
import { v4 as uuidv4 } from 'uuid';

interface Job {
  id: string;
  type: string;
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay: number;
  createdAt: string;
  scheduledFor: string;
  processedAt?: string;
  completedAt?: string;
  failedAt?: string;
  error?: string;
}

interface JobOptions {
  priority?: number; // Higher number = higher priority
  maxAttempts?: number;
  delay?: number; // Delay in milliseconds
}

interface JobHandler {
  (job: Job): Promise<void>;
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

class JobQueueService {
  private readonly QUEUE_PREFIX = 'queue:';
  private readonly JOB_PREFIX = 'job:';
  private handlers: Map<string, JobHandler> = new Map();
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout | undefined;

  constructor(private queueName: string = 'default') {}

  /**
   * Add a job to the queue
   */
  public async addJob(
    type: string,
    data: any,
    options: JobOptions = {}
  ): Promise<string> {
    const client = redisClient.getClient();
    const jobId = uuidv4();
    const now = new Date();
    const scheduledFor = new Date(now.getTime() + (options.delay || 0));

    const job: Job = {
      id: jobId,
      type,
      data,
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      delay: options.delay || 0,
      createdAt: now.toISOString(),
      scheduledFor: scheduledFor.toISOString(),
    };

    // Store job data
    await client.setEx(
      `${this.JOB_PREFIX}${jobId}`,
      24 * 60 * 60, // 24 hours TTL
      JSON.stringify(job)
    );

    if (options.delay && options.delay > 0) {
      // Add to delayed queue
      await client.zAdd(`${this.QUEUE_PREFIX}${this.queueName}:delayed`, {
        score: scheduledFor.getTime(),
        value: jobId,
      });
    } else {
      // Add to waiting queue with priority
      await client.zAdd(`${this.QUEUE_PREFIX}${this.queueName}:waiting`, {
        score: -job.priority, // Negative for descending order (higher priority first)
        value: jobId,
      });
    }

    return jobId;
  }

  /**
   * Register a job handler
   */
  public registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Start processing jobs
   */
  public async startProcessing(intervalMs: number = 1000): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    console.log(`🚀 Started job queue processing for queue: ${this.queueName}`);

    // Process delayed jobs first
    await this.processDelayedJobs();

    // Start processing interval
    this.processingInterval = setInterval(async () => {
      try {
        await this.processDelayedJobs();
        await this.processNextJob();
      } catch (error) {
        console.error('Job processing error:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop processing jobs
   */
  public async stopProcessing(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    console.log(`⏹️ Stopped job queue processing for queue: ${this.queueName}`);
  }

  /**
   * Process delayed jobs that are ready
   */
  private async processDelayedJobs(): Promise<void> {
    const client = redisClient.getClient();
    const now = Date.now();
    const delayedQueueKey = `${this.QUEUE_PREFIX}${this.queueName}:delayed`;
    const waitingQueueKey = `${this.QUEUE_PREFIX}${this.queueName}:waiting`;

    // Get jobs that are ready to be processed
    const readyJobs = await client.zRangeByScore(delayedQueueKey, 0, now);

    for (const jobId of readyJobs) {
      // Move from delayed to waiting queue
      const job = await this.getJob(jobId);
      if (job) {
        await client.zRem(delayedQueueKey, jobId);
        await client.zAdd(waitingQueueKey, {
          score: -job.priority,
          value: jobId,
        });
      }
    }
  }

  /**
   * Process the next job in the queue
   */
  private async processNextJob(): Promise<void> {
    const client = redisClient.getClient();
    const waitingQueueKey = `${this.QUEUE_PREFIX}${this.queueName}:waiting`;
    const activeQueueKey = `${this.QUEUE_PREFIX}${this.queueName}:active`;

    // Get the highest priority job
    const jobIds = await client.zRange(waitingQueueKey, 0, 0);
    if (jobIds.length === 0) {
      return; // No jobs to process
    }

    const jobId = jobIds[0];
    if (!jobId) {
      return; // Invalid job ID
    }

    const job = await this.getJob(jobId);
    if (!job) {
      // Job not found, remove from queue
      await client.zRem(waitingQueueKey, jobId);
      return;
    }

    // Move job to active queue
    await client.zRem(waitingQueueKey, jobId);
    await client.zAdd(activeQueueKey, {
      score: Date.now(),
      value: jobId,
    });

    // Process the job
    await this.executeJob(job);
  }

  /**
   * Execute a job
   */
  private async executeJob(job: Job): Promise<void> {
    const client = redisClient.getClient();
    const activeQueueKey = `${this.QUEUE_PREFIX}${this.queueName}:active`;
    const completedQueueKey = `${this.QUEUE_PREFIX}${this.queueName}:completed`;

    const handler = this.handlers.get(job.type);
    if (!handler) {
      console.error(`No handler registered for job type: ${job.type}`);
      await this.failJob(job, `No handler registered for job type: ${job.type}`);
      return;
    }

    job.attempts++;
    job.processedAt = new Date().toISOString();

    try {
      // Update job with processing info
      await this.updateJob(job);

      // Execute the handler
      await handler(job);

      // Job completed successfully
      job.completedAt = new Date().toISOString();
      await this.updateJob(job);

      // Move to completed queue
      await client.zRem(activeQueueKey, job.id);
      await client.zAdd(completedQueueKey, {
        score: Date.now(),
        value: job.id,
      });

      console.log(`✅ Job ${job.id} (${job.type}) completed successfully`);
    } catch (error) {
      console.error(`❌ Job ${job.id} (${job.type}) failed:`, error);

      if (job.attempts >= job.maxAttempts) {
        // Max attempts reached, move to failed queue
        await this.failJob(job, error instanceof Error ? error.message : String(error));
      } else {
        // Retry the job with exponential backoff
        const retryDelay = Math.pow(2, job.attempts) * 1000; // Exponential backoff
        job.scheduledFor = new Date(Date.now() + retryDelay).toISOString();
        
        await client.zRem(activeQueueKey, job.id);
        await client.zAdd(`${this.QUEUE_PREFIX}${this.queueName}:delayed`, {
          score: Date.now() + retryDelay,
          value: job.id,
        });

        await this.updateJob(job);
        console.log(`🔄 Job ${job.id} scheduled for retry in ${retryDelay}ms (attempt ${job.attempts}/${job.maxAttempts})`);
      }
    }
  }

  /**
   * Mark a job as failed
   */
  private async failJob(job: Job, error: string): Promise<void> {
    const client = redisClient.getClient();
    const activeQueueKey = `${this.QUEUE_PREFIX}${this.queueName}:active`;
    const failedQueueKey = `${this.QUEUE_PREFIX}${this.queueName}:failed`;

    job.failedAt = new Date().toISOString();
    job.error = error;

    await this.updateJob(job);
    await client.zRem(activeQueueKey, job.id);
    await client.zAdd(failedQueueKey, {
      score: Date.now(),
      value: job.id,
    });

    console.log(`❌ Job ${job.id} moved to failed queue: ${error}`);
  }

  /**
   * Get job by ID
   */
  public async getJob(jobId: string): Promise<Job | null> {
    const client = redisClient.getClient();
    const jobData = await client.get(`${this.JOB_PREFIX}${jobId}`);
    
    if (!jobData) {
      return null;
    }

    return JSON.parse(jobData) as Job;
  }

  /**
   * Update job data
   */
  private async updateJob(job: Job): Promise<void> {
    const client = redisClient.getClient();
    await client.setEx(
      `${this.JOB_PREFIX}${job.id}`,
      24 * 60 * 60, // 24 hours TTL
      JSON.stringify(job)
    );
  }

  /**
   * Get queue statistics
   */
  public async getStats(): Promise<QueueStats> {
    const client = redisClient.getClient();

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      client.zCard(`${this.QUEUE_PREFIX}${this.queueName}:waiting`),
      client.zCard(`${this.QUEUE_PREFIX}${this.queueName}:active`),
      client.zCard(`${this.QUEUE_PREFIX}${this.queueName}:completed`),
      client.zCard(`${this.QUEUE_PREFIX}${this.queueName}:failed`),
      client.zCard(`${this.QUEUE_PREFIX}${this.queueName}:delayed`),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Clear completed jobs older than specified time
   */
  public async cleanupCompletedJobs(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const client = redisClient.getClient();
    const cutoffTime = Date.now() - olderThanMs;
    const completedQueueKey = `${this.QUEUE_PREFIX}${this.queueName}:completed`;

    const oldJobIds = await client.zRangeByScore(completedQueueKey, 0, cutoffTime);
    
    if (oldJobIds.length === 0) {
      return 0;
    }

    // Remove from queue and delete job data
    await client.zRem(completedQueueKey, oldJobIds);
    const jobKeys = oldJobIds.map(id => `${this.JOB_PREFIX}${id}`);
    await client.del(jobKeys);

    return oldJobIds.length;
  }

  /**
   * Remove a specific job from any queue
   */
  public async removeJob(jobId: string): Promise<boolean> {
    const client = redisClient.getClient();
    const queueKeys = [
      `${this.QUEUE_PREFIX}${this.queueName}:waiting`,
      `${this.QUEUE_PREFIX}${this.queueName}:active`,
      `${this.QUEUE_PREFIX}${this.queueName}:delayed`,
      `${this.QUEUE_PREFIX}${this.queueName}:completed`,
      `${this.QUEUE_PREFIX}${this.queueName}:failed`,
    ];

    let removed = false;
    for (const queueKey of queueKeys) {
      const result = await client.zRem(queueKey, jobId);
      if (result > 0) {
        removed = true;
      }
    }

    // Delete job data
    const jobDeleted = await client.del(`${this.JOB_PREFIX}${jobId}`);
    
    return removed || jobDeleted > 0;
  }
}

export { JobQueueService, Job, JobOptions, JobHandler, QueueStats };