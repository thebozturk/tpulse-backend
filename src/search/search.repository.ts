import { PlayerWithRel } from '../players/player.repository';

export const SEARCH_REPOSITORY = Symbol('SEARCH_REPOSITORY');

export interface PlayerHit {
  id: string;
  firstName: string;
  lastName: string;
  firstNameTr: string | null;
  lastNameTr: string | null;
  photo: string | null;
  nationality: string;
}
export interface TeamHit {
  id: string;
  name: string;
  nameTr: string | null;
  logo: string | null;
}
export interface LeagueHit {
  id: string;
  name: string;
  nameTr: string | null;
  leagueLogo: string;
  country: string;
}

export interface ISearchRepository {
  searchPlayers(q: string, limit: number): Promise<PlayerHit[]>;
  searchTeams(q: string, limit: number): Promise<TeamHit[]>;
  searchLeagues(q: string, limit: number): Promise<LeagueHit[]>;
  searchPlayersPaged(
    q: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: PlayerWithRel[]; total: number }>;
}
