import { BotContentCategory } from '../common/enums/bot-content-category.enum';
import { PostType } from '../common/enums';
import { resolveProjectionTarget } from './projection-target.resolver';

describe('resolveProjectionTarget', () => {
  it('Transfer + Rumour → rumour', () => {
    expect(
      resolveProjectionTarget(PostType.Transfer, BotContentCategory.Rumour),
    ).toBe('rumour');
  });

  it('Transfer + Official → transfer', () => {
    expect(
      resolveProjectionTarget(PostType.Transfer, BotContentCategory.Official),
    ).toBe('transfer');
  });

  it('Transfer + Breaking → none (yalnız akış)', () => {
    expect(
      resolveProjectionTarget(PostType.Transfer, BotContentCategory.Breaking),
    ).toBe('none');
  });

  it('Team şekli → news (kategoriden bağımsız)', () => {
    for (const cat of [
      BotContentCategory.Rumour,
      BotContentCategory.Breaking,
      BotContentCategory.Official,
    ]) {
      expect(resolveProjectionTarget(PostType.Team, cat)).toBe('news');
    }
  });

  it('Player şekli → news (kategoriden bağımsız)', () => {
    for (const cat of [
      BotContentCategory.Rumour,
      BotContentCategory.Breaking,
      BotContentCategory.Official,
    ]) {
      expect(resolveProjectionTarget(PostType.Player, cat)).toBe('news');
    }
  });
});
