import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BLOCK_REPOSITORY, IBlockRepository } from './block.repository';
import { BlocksService } from './blocks.service';

describe('BlocksService', () => {
  let service: BlocksService;
  let repo: jest.Mocked<IBlockRepository>;

  beforeEach(async () => {
    repo = {
      block: jest.fn(),
      unblock: jest.fn(),
      mute: jest.fn(),
      unmute: jest.fn(),
      userExists: jest.fn(),
      getSuppressedAuthorIds: jest.fn(),
      getBlockedUsers: jest.fn(),
      getMutedUsers: jest.fn(),
      addKeyword: jest.fn(),
      removeKeyword: jest.fn(),
      getKeywords: jest.fn(),
      getMutedKeywordStrings: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [BlocksService, { provide: BLOCK_REPOSITORY, useValue: repo }],
    }).compile();

    service = module.get(BlocksService);
  });

  afterEach(() => jest.clearAllMocks());

  it('blocks an existing other user', async () => {
    repo.userExists.mockResolvedValue(true);
    repo.block.mockResolvedValue(true);
    await expect(service.block('a', 'b')).resolves.toBe('blocked');
  });

  it('rejects blocking self', async () => {
    await expect(service.block('a', 'a')).rejects.toThrow(BadRequestException);
    expect(repo.userExists).not.toHaveBeenCalled();
  });

  it('throws NotFound when mute target missing', async () => {
    repo.userExists.mockResolvedValue(false);
    await expect(service.mute('a', 'b')).rejects.toThrow(NotFoundException);
  });

  it('normalizes keyword to trimmed lowercase before storing', async () => {
    repo.addKeyword.mockResolvedValue({ id: '1', keyword: 'sponsorlu' });
    const out = await service.addKeyword('a', '  SponsorLU  ');
    expect(repo.addKeyword).toHaveBeenCalledWith('a', 'sponsorlu');
    expect(out).toEqual({
      status: 'added',
      keyword: { id: '1', keyword: 'sponsorlu' },
    });
  });

  it('returns unchanged when keyword already muted', async () => {
    repo.addKeyword.mockResolvedValue(null);
    await expect(service.addKeyword('a', 'x')).resolves.toEqual({
      status: 'unchanged',
    });
  });

  it('throws NotFound when removing a missing keyword', async () => {
    repo.removeKeyword.mockResolvedValue(false);
    await expect(service.removeKeyword('a', 'k')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('listBlockedUsers delegates to repo.getBlockedUsers', async () => {
    const rows = [
      {
        id: 'b1',
        username: 'u',
        nickname: 'n',
        profilePic: null,
        verificationType: null,
      },
    ];
    repo.getBlockedUsers.mockResolvedValue(rows);
    await expect(service.listBlockedUsers('a')).resolves.toBe(rows);
    expect(repo.getBlockedUsers).toHaveBeenCalledWith('a');
  });

  it('listMutedUsers delegates to repo.getMutedUsers', async () => {
    const rows = [
      {
        id: 'm1',
        username: 'u',
        nickname: 'n',
        profilePic: null,
        verificationType: null,
      },
    ];
    repo.getMutedUsers.mockResolvedValue(rows);
    await expect(service.listMutedUsers('a')).resolves.toBe(rows);
    expect(repo.getMutedUsers).toHaveBeenCalledWith('a');
  });
});
