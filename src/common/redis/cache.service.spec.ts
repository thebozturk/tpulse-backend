import { CacheService } from './cache.service';
import { RedisService } from './redis.service';

interface FakePipeline {
  set: jest.Mock;
  sadd: jest.Mock;
  expire: jest.Mock;
  del: jest.Mock;
  exec: jest.Mock;
}

function makePipeline(): FakePipeline {
  const pipeline: Partial<FakePipeline> = {};
  pipeline.set = jest.fn().mockReturnValue(pipeline);
  pipeline.sadd = jest.fn().mockReturnValue(pipeline);
  pipeline.expire = jest.fn().mockReturnValue(pipeline);
  pipeline.del = jest.fn().mockReturnValue(pipeline);
  pipeline.exec = jest.fn().mockResolvedValue([]);
  return pipeline as FakePipeline;
}

describe('CacheService', () => {
  let service: CacheService;
  let client: {
    get: jest.Mock;
    smembers: jest.Mock;
    del: jest.Mock;
    pipeline: jest.Mock;
  };
  let pipeline: FakePipeline;

  beforeEach(() => {
    pipeline = makePipeline();
    client = {
      get: jest.fn(),
      smembers: jest.fn(),
      del: jest.fn(),
      pipeline: jest.fn().mockReturnValue(pipeline),
    };
    const redis = { client } as unknown as RedisService;
    service = new CacheService(redis);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getOrSet', () => {
    it('should run producer and store result when cache miss', async () => {
      client.get.mockResolvedValue(null);
      const producer = jest.fn().mockResolvedValue({ id: '1' });

      const result = await service.getOrSet('q:x', 300, producer, [
        'transfers',
      ]);

      expect(result).toEqual({ id: '1' });
      expect(producer).toHaveBeenCalledTimes(1);
      expect(pipeline.set).toHaveBeenCalledWith(
        'q:x',
        JSON.stringify({ id: '1' }),
        'EX',
        300,
      );
      expect(pipeline.sadd).toHaveBeenCalledWith('cache:tag:transfers', 'q:x');
      expect(pipeline.exec).toHaveBeenCalledTimes(1);
    });

    it('should return cached value without running producer on hit', async () => {
      client.get.mockResolvedValue(JSON.stringify({ id: '1' }));
      const producer = jest.fn();

      const result = await service.getOrSet('q:x', 300, producer);

      expect(result).toEqual({ id: '1' });
      expect(producer).not.toHaveBeenCalled();
      expect(client.pipeline).not.toHaveBeenCalled();
    });

    it('should fail-open to producer when redis read throws', async () => {
      client.get.mockRejectedValue(new Error('redis down'));
      const producer = jest.fn().mockResolvedValue('fallback');

      const result = await service.getOrSet('q:x', 300, producer);

      expect(result).toBe('fallback');
      expect(producer).toHaveBeenCalledTimes(1);
    });

    it('should not cache when producer throws', async () => {
      client.get.mockResolvedValue(null);
      const producer = jest.fn().mockRejectedValue(new Error('not found'));

      await expect(service.getOrSet('q:x', 300, producer)).rejects.toThrow(
        'not found',
      );
      expect(client.pipeline).not.toHaveBeenCalled();
    });
  });

  describe('invalidateTags', () => {
    it('should delete all member keys and the tag set', async () => {
      client.smembers.mockResolvedValue(['q:a', 'q:b']);

      await service.invalidateTags('transfers');

      expect(client.smembers).toHaveBeenCalledWith('cache:tag:transfers');
      expect(pipeline.del).toHaveBeenCalledWith('q:a', 'q:b');
      expect(pipeline.del).toHaveBeenCalledWith('cache:tag:transfers');
    });

    it('should still delete the tag set when no members', async () => {
      client.smembers.mockResolvedValue([]);

      await service.invalidateTags('players');

      expect(pipeline.del).toHaveBeenCalledWith('cache:tag:players');
      expect(pipeline.del).toHaveBeenCalledTimes(1);
    });

    it('should not throw when redis fails', async () => {
      client.smembers.mockRejectedValue(new Error('redis down'));

      await expect(service.invalidateTags('teams')).resolves.toBeUndefined();
    });
  });

  describe('buildKey', () => {
    it('should produce identical keys regardless of param order', () => {
      const a = CacheService.buildKey('players:list', {
        page: 1,
        pageSize: 20,
        teamId: 't1',
      });
      const b = CacheService.buildKey('players:list', {
        teamId: 't1',
        pageSize: 20,
        page: 1,
      });
      expect(a).toBe(b);
    });

    it('should ignore undefined params', () => {
      const withUndefined = CacheService.buildKey('x', { a: 1, b: undefined });
      const without = CacheService.buildKey('x', { a: 1 });
      expect(withUndefined).toBe(without);
    });

    it('should build a bare key when no params', () => {
      expect(CacheService.buildKey('players:freeAgents')).toBe(
        'q:players:freeAgents',
      );
    });
  });
});
