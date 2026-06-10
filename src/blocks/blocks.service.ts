import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BLOCK_REPOSITORY,
  IBlockRepository,
  MutedKeywordRow,
} from './block.repository';

export type BlockOutcome = 'blocked' | 'unchanged';
export type UnblockOutcome = 'unblocked' | 'unchanged';
export type MuteOutcome = 'muted' | 'unchanged';
export type UnmuteOutcome = 'unmuted' | 'unchanged';
export type AddKeywordOutcome =
  | { status: 'added'; keyword: MutedKeywordRow }
  | { status: 'unchanged' };

@Injectable()
export class BlocksService {
  constructor(
    @Inject(BLOCK_REPOSITORY) private readonly repo: IBlockRepository,
  ) {}

  async block(userId: string, targetId: string): Promise<BlockOutcome> {
    await this.assertOtherUser(userId, targetId, 'engelleyemezsin');
    return (await this.repo.block(userId, targetId)) ? 'blocked' : 'unchanged';
  }

  async unblock(userId: string, targetId: string): Promise<UnblockOutcome> {
    return (await this.repo.unblock(userId, targetId))
      ? 'unblocked'
      : 'unchanged';
  }

  async mute(userId: string, targetId: string): Promise<MuteOutcome> {
    await this.assertOtherUser(userId, targetId, 'susturamazsın');
    return (await this.repo.mute(userId, targetId)) ? 'muted' : 'unchanged';
  }

  async unmute(userId: string, targetId: string): Promise<UnmuteOutcome> {
    return (await this.repo.unmute(userId, targetId)) ? 'unmuted' : 'unchanged';
  }

  async addKeyword(
    userId: string,
    keywordRaw: string,
  ): Promise<AddKeywordOutcome> {
    const keyword = keywordRaw.trim().toLowerCase();
    const created = await this.repo.addKeyword(userId, keyword);
    return created
      ? { status: 'added', keyword: created }
      : { status: 'unchanged' };
  }

  async removeKeyword(userId: string, keywordId: string): Promise<void> {
    if (!(await this.repo.removeKeyword(userId, keywordId))) {
      throw new NotFoundException('Kelime bulunamadı');
    }
  }

  listKeywords(userId: string): Promise<MutedKeywordRow[]> {
    return this.repo.getKeywords(userId);
  }

  // ── Feed query hydration için ──────────────────────────────
  getSuppressedAuthorIds(userId: string): Promise<string[]> {
    return this.repo.getSuppressedAuthorIds(userId);
  }

  getMutedKeywords(userId: string): Promise<string[]> {
    return this.repo.getMutedKeywordStrings(userId);
  }

  private async assertOtherUser(
    userId: string,
    targetId: string,
    verb: string,
  ): Promise<void> {
    if (userId === targetId) {
      throw new BadRequestException(`Kendini ${verb}`);
    }
    if (!(await this.repo.userExists(targetId))) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
  }
}
