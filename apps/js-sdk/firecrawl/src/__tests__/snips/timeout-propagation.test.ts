import { describe, test, expect, jest } from '@jest/globals';
import { FirecrawlAppV1, Firecrawl } from "../../index";
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Timeout Propagation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockRejectedValue(new Error('Timeout'));
    mockedAxios.create.mockReturnValue(mockedAxios);
  });

  test('should calculate timeout correctly in v1 with waitFor and actions', async () => {
    const app = new FirecrawlAppV1({ apiKey: "test-key" });
    
    try {
      await app.scrapeUrl("https://example.com", { 
        timeout: 1000,
        waitFor: 2000,
        actions: [
          { type: "wait", milliseconds: 1500 },
          { type: "wait", selector: ".element" },
          { type: "click", selector: ".button" }
        ]
      });
    } catch (error) {
    }

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        timeout: 9500 // 1000 + 2000 + 1500 + 1000 + 5000 buffer
      })
    );
  });

  test('should calculate timeout correctly in v1 with timeout 0', async () => {
    const app = new FirecrawlAppV1({ apiKey: "test-key" });
    
    try {
      await app.scrapeUrl("https://example.com", { 
        timeout: 0,
        waitFor: 1000
      });
    } catch (error) {
    }

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        timeout: 6000 // 0 + 1000 + 5000 buffer
      })
    );
  });

  test('should handle undefined timeout in v1', async () => {
    const app = new FirecrawlAppV1({ apiKey: "test-key" });
    
    try {
      await app.scrapeUrl("https://example.com", {});
    } catch (error) {
    }

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        timeout: undefined
      })
    );
  });

  test('should calculate timeout correctly in v2 HttpClient', async () => {
    const app = new Firecrawl({ apiKey: "test-key" });
    
    const mockInstance = {
      post: jest.fn().mockRejectedValue(new Error('Timeout')),
      get: jest.fn(),
      delete: jest.fn()
    };
    mockedAxios.create.mockReturnValue(mockInstance as any);
    
    try {
      await app.scrape("https://example.com", { 
        timeout: 2000,
        waitFor: 1000,
        actions: [
          { type: "wait", milliseconds: 500 }
        ]
      });
    } catch (error) {
    }

    expect(mockInstance.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        timeout: 8500 // 2000 + 1000 + 500 + 5000 buffer
      })
    );
  });

  test('should calculate timeout correctly in v2 extract with scrapeOptions', async () => {
    const app = new Firecrawl({ apiKey: "test-key" });
    
    const mockInstance = {
      post: jest.fn().mockRejectedValue(new Error('Timeout')),
      get: jest.fn(),
      delete: jest.fn()
    };
    mockedAxios.create.mockReturnValue(mockInstance as any);
    
    try {
      await app.extract({
        urls: ["https://example.com"],
        prompt: "Extract title",
        scrapeOptions: { 
          timeout: 1500,
          waitFor: 500,
          actions: [
            { type: "wait", selector: ".loading" }
          ]
        }
      });
    } catch (error) {
    }

    expect(mockInstance.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        timeout: 8000 // 1500 + 500 + 1000 + 5000 buffer
      })
    );
  });
});
